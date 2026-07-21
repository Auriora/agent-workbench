#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Installed-package authority-ranking smoke (Spec 043, T008). This deliberately
// packs and installs the npm payload before launching its installed bin. The
// provider labels below identify MCP sessions only; they do not claim that the
// real Codex or Claude Code CLI loaded the plugin.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-installed-smoke-"));
const packRoot = path.join(tempRoot, "pack");
const installRoot = path.join(tempRoot, "install");
const stateRoot = path.join(tempRoot, "state");
// Unix-domain socket paths are short (typically about 108 bytes), so keep the
// isolated runtime root separate and deliberately compact.
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-runtime-"));
const npmCacheRoot = path.join(tempRoot, "npm-cache");
const workspaceRoot = path.join(tempRoot, "workspace");
const sessions = [];
const inheritedSensitiveValues = collectInheritedSensitiveValues(process.env);
const injectedFailure = process.env.AGENT_WORKBENCH_INSTALLED_SMOKE_INJECT_FAILURE;
let daemonPid;
let daemonSocketPath;
let installedPackageRootObserved;
let daemonLaunchPossible = false;
let daemonMetadataObserved = false;
let currentPhase = "setup";

for (const directory of [packRoot, installRoot, stateRoot, runtimeRoot, npmCacheRoot]) {
  fs.mkdirSync(directory, { recursive: true });
}

const isolatedEnv = {
  PATH: process.env.PATH ?? "",
  LANG: process.env.LANG ?? "C.UTF-8",
  LC_ALL: process.env.LC_ALL ?? process.env.LANG ?? "C.UTF-8",
  HOME: stateRoot,
  USERPROFILE: stateRoot,
  LOCALAPPDATA: path.join(stateRoot, "AppData", "Local"),
  XDG_CACHE_HOME: path.join(stateRoot, "cache"),
  XDG_DATA_HOME: path.join(stateRoot, "data"),
  XDG_STATE_HOME: path.join(stateRoot, "state"),
  TMPDIR: runtimeRoot,
  TMP: runtimeRoot,
  TEMP: runtimeRoot,
  npm_config_cache: npmCacheRoot
};
for (const name of ["SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS", "NO_PROXY"]) {
  if (process.env[name] !== undefined) isolatedEnv[name] = process.env[name];
}
for (const name of ["HTTP_PROXY", "HTTPS_PROXY"]) {
  const value = process.env[name];
  if (value !== undefined && !urlContainsCredentials(value)) isolatedEnv[name] = value;
}
if (Number(process.versions.node.split(".")[0]) >= 24) {
  if (process.platform === "win32") isolatedEnv.CL = "/std:c++20";
  else isolatedEnv.CXXFLAGS = "-std=c++20";
}

let receipt;
let failure;
let cleanup = {
  clients_closed: false,
  daemon_stopped: false,
  socket_removed: false,
  metadata_removed: false,
  temporary_root_removed: false
};

try {
  receipt = await runSmoke();
} catch (error) {
  failure = categorizedFailure(currentPhase, error);
} finally {
  cleanup = await cleanupSmoke();
}

const cleanupComplete = Object.values(cleanup).every(Boolean);
if (failure !== undefined || !cleanupComplete) {
  const categorized = failure ?? categorizedFailure(
    "cleanup",
    new Error("One or more isolated smoke resources could not be removed.")
  );
  process.stdout.write(`installed-package-mcp-smoke FAIL ${JSON.stringify({
    schema_version: "2",
    status: "fail",
    failure: categorized,
    cleanup
  })}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`installed-package-mcp-smoke OK ${JSON.stringify({
    ...receipt,
    status: "ok",
    cleanup
  })}\n`);
}

async function runSmoke() {
  currentPhase = "pack";
  const packed = packCheckout();
  currentPhase = "install";
  installTarball(packed.tarballPath);

  const installedPackageRoot = path.join(
    installRoot,
    "node_modules",
    "@auriora",
    "agent-workbench"
  );
  installedPackageRootObserved = installedPackageRoot;
  const installedManifestPath = path.join(installedPackageRoot, "package.json");
  assert(fs.existsSync(installedManifestPath), "installed package.json is present");
  const installedManifest = JSON.parse(fs.readFileSync(installedManifestPath, "utf8"));
  assert(installedManifest.name === "@auriora/agent-workbench", "installed package identity matches");
  assert(typeof installedManifest.version === "string", "installed package version is present");

  const installedBin = path.join(installRoot, "node_modules", ".bin", "agent-workbench-mcp");
  assert(fs.existsSync(installedBin), "installed agent-workbench-mcp bin is present");
  const installedBinRealPath = fs.realpathSync(installedBin);
  assert(
    isInside(installedPackageRoot, installedBinRealPath),
    "installed bin resolves inside the isolated installed package"
  );
  assert(!isInside(repoRoot, installedBinRealPath), "installed bin does not resolve into the checkout");
  const installedPackageContentSha256 = hashDirectory(installedPackageRoot);

  currentPhase = "fixture";
  createWorkspaceFixture();

  currentPhase = "codex_session";
  const codex = trackSession(startInstalledSession({
    binPath: installedBin,
    provider: "codex",
    pluginVersion: installedManifest.version,
    startupRefreshDelayMs: 0
  }));
  await initializeSession(codex, "codex");
  const baselineStatus = await waitForFreshStatus(codex, undefined, 60_000);
  const oldSnapshotId = requiredString(baselineStatus.data.snapshot_id, "baseline snapshot id");
  if (injectedFailure === "post-launch-pre-health") {
    throw new Error("Injected post-launch pre-health failure.");
  }
  const baselineHealth = await readHealth(codex);
  const baselineDaemon = requiredDaemon(baselineHealth);
  const baselineWorkerInvocations = requiredNonNegativeInteger(
    baselineDaemon.worker_invocations,
    "baseline worker_invocations"
  );
  daemonPid = baselineDaemon.pid;
  daemonSocketPath = baselineDaemon.socket_path;
  observeDaemonMetadata();
  assert(
    isInside(runtimeRoot, daemonSocketPath),
    "daemon socket is inside the isolated runtime directory"
  );

  const claude = trackSession(startInstalledSession({
    binPath: installedBin,
    provider: "claude_code",
    pluginVersion: installedManifest.version,
    startupRefreshDelayMs: 60_000
  }));
  currentPhase = "claude_session";
  await initializeSession(claude, "claude_code");

  const [codexInitialHealth, claudeInitialHealth] = await Promise.all([
    readHealth(codex),
    readHealth(claude)
  ]);
  assertProviderIdentity(codexInitialHealth, "codex", installedManifest.version);
  assertProviderIdentity(claudeInitialHealth, "claude_code", installedManifest.version);
  const codexInitialDaemon = requiredDaemon(codexInitialHealth);
  const claudeInitialDaemon = requiredDaemon(claudeInitialHealth);
  assert(codexInitialDaemon.pid === claudeInitialDaemon.pid, "both sessions share one daemon PID");
  assert(
    Math.max(codexInitialDaemon.connected_clients, claudeInitialDaemon.connected_clients) >= 2,
    "shared daemon observes both connected clients"
  );

  const deletedSource = path.join(workspaceRoot, "src", "deleted-evidence.py");
  const deletedDoc = path.join(workspaceRoot, "docs", "deleted-evidence.md");
  fs.rmSync(deletedSource);
  fs.rmSync(deletedDoc);

  // This is the sole post-deletion trigger. Convergence polling below uses
  // integration health, whose diagnostics operation cannot request refresh.
  const admitted = await readStatus(claude);
  assert(admitted.data.snapshot_id === oldSnapshotId, "stale admission retains the old snapshot");
  assert(admitted.data.freshness === "stale", "one non-startup status read detects deletion");

  const terminalHealth = await waitForReplacementHealth(claude, oldSnapshotId, 60_000);
  const terminalDaemon = requiredDaemon(terminalHealth);
  const finalWorkerInvocations = requiredNonNegativeInteger(
    terminalDaemon.worker_invocations,
    "final worker_invocations"
  );
  assert(
    finalWorkerInvocations - baselineWorkerInvocations === 1,
    "the non-startup stale read starts exactly one worker invocation"
  );

  const [codexFinalHealth, claudeFinalHealth] = await Promise.all([
    readHealth(codex),
    readHealth(claude)
  ]);
  assertProviderIdentity(codexFinalHealth, "codex", installedManifest.version);
  assertProviderIdentity(claudeFinalHealth, "claude_code", installedManifest.version);
  const codexFinalDaemon = requiredDaemon(codexFinalHealth);
  const claudeFinalDaemon = requiredDaemon(claudeFinalHealth);
  assertSharedTerminalDiagnostics(codexFinalDaemon, claudeFinalDaemon, oldSnapshotId);
  assertTrustedFreshMeta(codexFinalHealth.meta, "Codex health");
  assertTrustedFreshMeta(claudeFinalHealth.meta, "Claude health");
  const replacementSnapshotId = requiredString(
    codexFinalDaemon.visible_snapshot_id,
    "replacement snapshot id"
  );

  const [codexFinalStatus, claudeFinalStatus] = await Promise.all([
    readStatus(codex),
    readStatus(claude)
  ]);
  for (const [label, status] of [
    ["Codex", codexFinalStatus],
    ["Claude", claudeFinalStatus]
  ]) {
    assert(status.data.snapshot_id === replacementSnapshotId, `${label} status selects replacement`);
    assert(status.data.freshness === "fresh", `${label} status is fresh`);
    assert(status.data.snapshot_validity?.state === "valid", `${label} snapshot validity is valid`);
    assert(status.data.snapshot_validity?.complete === true, `${label} snapshot validity is complete`);
    assert(status.data.snapshot_validity?.missing_paths?.length === 0, `${label} has no missing paths`);
    assert(
      status.data.snapshot_validity?.inaccessible_paths?.length === 0,
      `${label} has no inaccessible paths`
    );
    assertTrustedFreshMeta(status.meta, `${label} status`);
  }

  const references = await callTool(codex, "find_references", {
    symbol: "helper",
    max_depth: 1,
    max_results: 10
  });
  assert(references.data.snapshot_id === replacementSnapshotId, "references use replacement snapshot");
  assertTrustedFreshMeta(references.meta, "find_references");
  const stableReferences = references.data.references.map((reference) => ({
    source_file_path: reference.source_file_path,
    target_file_path: reference.target_file_path,
    reference_name: reference.reference_name,
    reference_kind: reference.reference_kind,
    evidence_kinds: reference.evidence_kinds,
    provenance: reference.provenance,
    status: reference.status
  }));
  assertDeepEqual(stableReferences, [{
    source_file_path: "src/service.py",
    target_file_path: "src/service.py",
    reference_name: "helper",
    reference_kind: "call",
    evidence_kinds: ["parser"],
    provenance: "tree-sitter-reference-resolution",
    status: "resolved"
  }], "exact surviving helper reference");
  assert(references.data.result_count === 1, "reference result count is exact");

  const docs = await callTool(claude, "docs_search", {
    query: "Details",
    max_results: 10,
    include_snippets: true
  });
  assertTrustedFreshMeta(docs.meta, "docs_search");
  const stableDocsHits = docs.data.hits.map((hit) => ({
    path: hit.path,
    title: hit.title,
    heading_id: hit.heading_id,
    heading: hit.heading,
    evidence_kinds: hit.evidence_kinds
  }));
  assertDeepEqual(stableDocsHits, [{
    path: "docs/guide.md",
    title: "Sweep Guide",
    heading_id: "details",
    heading: "Details",
    evidence_kinds: ["docs", "fts"]
  }], "exact surviving docs hit");
  assert(docs.data.result_count === 1, "docs result count is exact");
  assert(docs.data.hits[0]?.snippet?.includes("intentionally short"), "docs snippet is exact");

  const deletedSymbol = await callTool(codex, "symbol_search", {
    query: "DeletedEvidenceSentinel",
    exact: true,
    max_results: 10
  });
  assert(deletedSymbol.data.snapshot_id === replacementSnapshotId, "deleted symbol query uses replacement");
  assert(deletedSymbol.data.symbols.length === 0, "deleted symbol evidence is absent");
  assertTrustedFreshMeta(deletedSymbol.meta, "deleted symbol query");

  const deletedDocs = await callTool(claude, "docs_search", {
    query: "deleted evidence sentinel",
    max_results: 10,
    include_snippets: true
  });
  assert(deletedDocs.data.status === "not_applicable", "deleted docs query is non-blocked and empty");
  assert(deletedDocs.data.hits.length === 0, "deleted docs evidence is absent");
  assertTrustedFreshMeta(deletedDocs.meta, "deleted docs query");

  currentPhase = "authority_ranking";
  const authorityRanking = await verifyAuthorityRanking({
    codex,
    claude,
    snapshotId: replacementSnapshotId
  });

  assertSessionsQuiet();

  return {
    schema_version: "2",
    package: {
      name: installedManifest.name,
      version: installedManifest.version,
      tarball: path.basename(packed.tarballPath),
      tarball_sha256: packed.sha256,
      tarball_integrity: packed.integrity,
      tarball_shasum: packed.shasum,
      installed_package_root: installedPackageRoot,
      installed_package_content_sha256: installedPackageContentSha256,
      bin: "node_modules/.bin/agent-workbench-mcp",
      bin_realpath: installedBinRealPath,
      bin_resolved_inside_install: true
    },
    clients: [
      { provider_label: "codex", kind: "provider_labelled_mcp_session" },
      { provider_label: "claude_code", kind: "provider_labelled_mcp_session" }
    ],
    real_agent_cli_executed: false,
    limitation: "Provider-labelled MCP sessions are not proof that Codex or Claude Code loaded the plugin.",
    daemon: {
      pid: codexFinalDaemon.pid,
      connected_clients: Math.max(
        codexFinalDaemon.connected_clients,
        claudeFinalDaemon.connected_clients
      ),
      controller_generation: codexFinalDaemon.controller_generation,
      execution_id: codexFinalDaemon.execution_id,
      started_generation: codexFinalDaemon.started_generation,
      requested_generation: codexFinalDaemon.requested_generation,
      worker_invocations_before: baselineWorkerInvocations,
      worker_invocations_after: finalWorkerInvocations,
      worker_invocation_delta: 1
    },
    snapshots: {
      previous: oldSnapshotId,
      replacement: replacementSnapshotId,
      deleted_paths_absent: true,
      validity: "valid"
    },
    queries: {
      find_references: stableReferences,
      docs_search: stableDocsHits,
      deleted_symbol_count: deletedSymbol.data.symbols.length,
      deleted_docs_count: deletedDocs.data.hits.length,
      docs_authority_ranking: authorityRanking
    },
    trust: {
      health: codexFinalHealth.meta.verification_status,
      status: codexFinalStatus.meta.verification_status,
      find_references: references.meta.verification_status,
      docs_search: docs.meta.verification_status
    }
  };
}

async function verifyAuthorityRanking({ codex, claude, snapshotId }) {
  // The exact concern term matches SessionStart while the additional tokens keep
  // the lexical supporting hits in the partial-FTS band. This proves the
  // specified relevance ordering: an intent owner outranks partial lexical
  // matches without pretending ownership beats stronger all-token relevance.
  const query = "SessionStart launch contract";
  const expectedPaths = [
    "docs/design/coding-agent-integration-design.md",
    "docs/reference/documentation-map.md",
    "docs/runbooks/install-agent-workbench.md"
  ];
  const complete = await callTool(codex, "docs_search", {
    query,
    max_results: 10,
    include_snippets: true
  });
  assertTrustedFreshMeta(complete.meta, "complete authority docs_search");
  assert(complete.data.snapshot_id === snapshotId, "authority ranking uses the replacement snapshot");
  assert(complete.data.trust_state === "complete_ranked_universe", "authority ranking is complete");
  assert(complete.data.truncated === false, "complete authority query is not paginated");
  assertDeepEqual(
    [...complete.data.hits.map((hit) => hit.path)].sort(),
    [...expectedPaths].sort(),
    "authority candidate union paths"
  );
  const fixtureScores = complete.data.hits
    .map((hit) => ({ path: hit.path, score: hit.score, lexical_score: hit.lexical_score }))
    .sort((left, right) => left.path.localeCompare(right.path));
  assertDeepEqual(fixtureScores, [
    { path: "docs/design/coding-agent-integration-design.md", score: 13.25, lexical_score: undefined },
    { path: "docs/reference/documentation-map.md", score: 18.43587474697314, lexical_score: -4.185874746973141 },
    { path: "docs/runbooks/install-agent-workbench.md", score: 0, lexical_score: 1.5714128163270238 }
  ], "fixture-specific legacy and lexical scores");

  const owner = complete.data.hits[0];
  assert(owner?.path === expectedPaths[0], "canonical intent owner ranks first");
  assert(owner.candidate_source === "matched_owner", "owner-only candidate identifies its source");
  assert(owner.concern_match_state === "matched", "owner-only candidate records the intent match");
  assert(owner.governing_owner_tier === "valid_owner", "owner-only candidate records valid ownership");
  assert(owner.lexical_score === undefined, "owner-only candidate does not invent a lexical score");
  assert(owner.final_rank_components?.relevance_band === "intent_owner_match", "owner tuple records intent relevance");
  assert(owner.final_rank_components?.lexical_score === undefined, "owner tuple preserves absent lexical score");
  assert(owner.final_rank_components?.normalized_path === owner.path, "owner tuple contains its stable path");
  assert(Number.isFinite(owner.score), "owner exposes the compatibility score");
  assert(Array.isArray(owner.ranking_reasons) && owner.ranking_reasons.length > 0, "owner explains its rank");

  for (const hit of complete.data.hits.slice(1)) {
    assert(hit.candidate_source === "fts", `${hit.path} identifies lexical admission`);
    assert(Number.isFinite(hit.lexical_score), `${hit.path} exposes lexical score`);
    assert(Number.isFinite(hit.score), `${hit.path} exposes compatibility score`);
    assert(
      hit.final_rank_components?.lexical_score === hit.lexical_score,
      `${hit.path} tuple preserves lexical score`
    );
    assert(hit.final_rank_components?.normalized_path === hit.path, `${hit.path} tuple contains stable path`);
    assert(Array.isArray(hit.ranking_reasons) && hit.ranking_reasons.length > 0, `${hit.path} explains its rank`);
  }

  assertRankingCounts(complete.data, { page: 3, fts: 2, owners: 1, union: 3 });

  const pages = [];
  let cursor;
  for (let pageIndex = 0; pageIndex < expectedPaths.length; pageIndex += 1) {
    const session = pageIndex % 2 === 0 ? codex : claude;
    const page = await callTool(session, "docs_search", {
      query,
      max_results: 1,
      include_snippets: true,
      ...(cursor === undefined ? {} : { cursor })
    });
    assertTrustedFreshMeta(page.meta, `authority docs_search page ${pageIndex + 1}`);
    assert(page.data.snapshot_id === snapshotId, `page ${pageIndex + 1} preserves snapshot identity`);
    assert(page.data.ranking_policy_version === complete.data.ranking_policy_version, `page ${pageIndex + 1} preserves policy identity`);
    assertRankingCounts(page.data, { page: 1, fts: 2, owners: 1, union: 3 });
    if (pages.length > 0) {
      assert(page.data.universe_id === pages[0].data.universe_id, `page ${pageIndex + 1} preserves universe identity`);
    }
    pages.push(page);
    cursor = page.data.cursor;
  }
  assert(cursor === undefined, "final authority page has no continuation cursor");
  assert(pages[0].data.truncated === true && pages[1].data.truncated === true, "non-final pages are truncated");
  assert(pages[2].data.truncated === false, "final page is terminal");
  const concatenatedPaths = pages.flatMap((page) => page.data.hits.map((hit) => hit.path));
  assertDeepEqual(concatenatedPaths, complete.data.hits.map((hit) => hit.path), "cursor concatenation order");

  return {
    query,
    snapshot_id: snapshotId,
    complete_universe_id: complete.data.universe_id,
    paged_universe_id: pages[0].data.universe_id,
    ranking_policy_version: complete.data.ranking_policy_version,
    stable_hit_paths: complete.data.hits.map((hit) => hit.path),
    providers: pages.map((_, index) => index % 2 === 0 ? "codex" : "claude_code"),
    counts: complete.data.counts,
    assertions: {
      owner_first: true,
      owner_only_admitted: true,
      compatibility_and_lexical_scores_verified: true,
      rank_tuple_and_reasons_verified: true,
      exact_count_and_filter_bases_verified: true,
      cursor_concatenation_equivalent: true
    }
  };
}

function assertRankingCounts(data, expected) {
  const counts = data.counts;
  assert(data.result_count === expected.page, "compatibility result_count uses page meaning");
  assert(data.result_count_basis === "page", "compatibility result_count basis is explicit");
  assert(data.indexed_docs_count === counts.searchable_snapshot_documents_count, "indexed_docs_count retains snapshot meaning");
  assert(counts.searchable_snapshot_documents_count === 5, "searchable snapshot document count is exact");
  assert(counts.searchable_scope_documents_count === 5, "repository scope document count is exact");
  assert(counts.returned_page_documents_count === expected.page, "returned page count is exact");
  assert(counts.fts_candidate_documents_count === expected.fts, "FTS candidate count is exact");
  assert(counts.matched_owner_candidate_documents_count === expected.owners, "owner candidate count is exact");
  assert(counts.candidate_union_documents_count === expected.union, "candidate union count is exact");
  assert(counts.ranked_candidate_universe_count === expected.union, "ranked universe count is exact");
  assert(counts.priority_scan_eligible_markdown_files_count === 5, "priority eligible Markdown count is exact");
  assert(counts.priority_scan_indexed_markdown_files_count === 5, "priority indexed Markdown count is exact");
  assert(counts.priority_scan_skipped_markdown_files_count === 0, "priority skipped Markdown count is exact");
  assert(counts.priority_scan_coverage_state === "complete", "priority coverage state is complete");
  assert(counts.priority_scan_truncated === false, "priority coverage is not truncated");
  assert(
    counts.priority_scan_coverage_note === "Docs index scan covered docs priority roots independently from graph seed order.",
    `priority coverage note is exact (actual=${JSON.stringify(counts.priority_scan_coverage_note)})`
  );
  assert(counts.searchable_filter_basis === "merged_graph_and_priority_markdown", "searchable filter basis is exact");
  assert(counts.scope_filter_basis === "repo_root", "scope filter basis is exact");
  assert(
    counts.query_filter_basis?.fts_candidate_documents_count === "normalized_fts_match_within_scope",
    "FTS filter basis is exact"
  );
  assert(
    counts.query_filter_basis?.matched_owner_candidate_documents_count === "exact_matched_concern_owners_within_scope",
    "owner filter basis is exact"
  );
  assert(
    counts.query_filter_basis?.candidate_union_documents_count === "distinct_fts_and_exact_owner_union_within_scope",
    "union filter basis is exact"
  );
  assert(
    counts.query_filter_basis?.ranked_candidate_universe_count === "distinct_fts_and_exact_owner_union_within_scope",
    "ranked universe filter basis is exact"
  );
  assert(counts.page_filter_basis === "frozen_universe_position_and_requested_page_size", "page filter basis is exact");
  assert(counts.priority_scan_filter_basis === "configured_priority_roots", "priority scan filter basis is exact");
  assert(data.docs_index_state === counts.priority_scan_coverage_state, "docs_index_state alias matches canonical coverage");
  assert(data.docs_scan_truncated === counts.priority_scan_truncated, "docs_scan_truncated alias matches canonical coverage");
  assert(data.coverage_note === counts.priority_scan_coverage_note, "coverage_note alias matches canonical coverage");
}

function packCheckout() {
  const result = run("npm", ["pack", "--json", "--pack-destination", packRoot], {
    cwd: repoRoot,
    env: isolatedEnv,
    timeout: 180_000
  });
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error("npm pack did not return its JSON receipt.");
  }
  const filename = parsed?.[0]?.filename;
  assert(typeof filename === "string" && filename.length > 0, "npm pack returned a tarball name");
  const tarballPath = path.join(packRoot, filename);
  assert(fs.existsSync(tarballPath), "npm pack created the tarball");
  return {
    tarballPath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(tarballPath)).digest("hex"),
    integrity: requiredString(parsed?.[0]?.integrity, "npm pack integrity"),
    shasum: requiredString(parsed?.[0]?.shasum, "npm pack shasum")
  };
}

function installTarball(tarballPath) {
  run("npm", [
    "install",
    "--prefix",
    installRoot,
    "--no-audit",
    "--no-fund",
    tarballPath
  ], {
    cwd: tempRoot,
    env: isolatedEnv,
    timeout: 600_000
  });
}

function createWorkspaceFixture() {
  fs.cpSync(path.join(repoRoot, "tests", "fixtures", "fixture-mcp-tool-sweep"), workspaceRoot, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.cache${path.sep}`)
  });
  fs.writeFileSync(
    path.join(workspaceRoot, "src", "deleted-evidence.py"),
    "def DeletedEvidenceSentinel() -> str:\n    return 'deleted'\n"
  );
  fs.writeFileSync(
    path.join(workspaceRoot, "docs", "deleted-evidence.md"),
    "# Deleted Evidence\n\nThe deleted evidence sentinel must disappear after refresh.\n"
  );
  for (const directory of ["design", "reference", "runbooks"]) {
    fs.mkdirSync(path.join(workspaceRoot, "docs", directory), { recursive: true });
  }
  fs.writeFileSync(
    path.join(workspaceRoot, "docs", "reference", "documentation-map.md"),
    [
      "---",
      "title: Documentation map",
      "status: current",
      "---",
      "",
      "# Documentation Map",
      "",
      "| Concern | Canonical owner | Intent terms | Notes |",
      "| --- | --- | --- | --- |",
      "| Coding-agent integrations | [Coding agent integration design](../design/coding-agent-integration-design.md) | SessionStart | The owner is admitted even without a lexical match. |",
      ""
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(workspaceRoot, "docs", "design", "coding-agent-integration-design.md"),
    [
      "---",
      "title: Coding agent integration design",
      "status: current",
      "---",
      "",
      "# Coding Agent Integration Design",
      "",
      "## Lifecycle Hooks",
      "",
      "The canonical owner governs coding-agent lifecycle hook parity without repeating the mapped intent alias.",
      ""
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(workspaceRoot, "docs", "runbooks", "install-agent-workbench.md"),
    [
      "---",
      "title: Agent Workbench installation",
      "status: draft",
      "---",
      "",
      "# Agent Workbench Installation",
      "",
      "SessionStart behavior appears in this supporting guide. SessionStart behavior is repeated for lexical pressure: SessionStart behavior, SessionStart behavior.",
      ""
    ].join("\n")
  );
}

function startInstalledSession(input) {
  daemonLaunchPossible = true;
  const child = spawn(input.binPath, ["--repo-root", workspaceRoot], {
    cwd: workspaceRoot,
    env: {
      ...isolatedEnv,
      AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS: "200",
      AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: String(input.startupRefreshDelayMs),
      AGENT_WORKBENCH_PROVIDER: input.provider,
      AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
      AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: input.pluginVersion
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  const nonJsonStdout = [];
  let nextId = 1;
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        nonJsonStdout.push(line);
        continue;
      }
      if (typeof message.id !== "number") continue;
      const waiter = pending.get(message.id);
      if (waiter !== undefined) {
        pending.delete(message.id);
        waiter.resolve(message);
      }
    }
  });
  child.once("error", (error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });
  child.once("exit", (code, signal) => {
    if (pending.size === 0) return;
    const error = new Error(
      `installed bin exited early (code=${code}, signal=${signal}): ${boundedText(stderr)}`
    );
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });

  return {
    child,
    stderr: () => stderr,
    stdoutRemainder: () => stdout,
    nonJsonStdout: () => [...nonJsonStdout],
    call(method, params = {}, timeoutMs = 15_000) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`timed out waiting for ${method} id=${id}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (message) => {
            clearTimeout(timeout);
            if (message.error !== undefined) {
              reject(new Error(`MCP ${method} returned an error response.`));
              return;
            }
            resolve(message);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    },
    notify(method, params = {}) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
    async close() {
      for (const waiter of pending.values()) {
        waiter.reject(new Error("installed MCP session closed before response"));
      }
      pending.clear();
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 2_000);
        child.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };
}

function trackSession(session) {
  sessions.push(session);
  return session;
}

async function initializeSession(session, provider) {
  const response = await session.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: `agent-workbench-installed-smoke-${provider}`,
      version: "1"
    }
  }, 30_000);
  assert(response.result?.serverInfo?.name === "agent-workbench", `${provider} initialized installed bin`);
  session.notify("notifications/initialized", {});
}

async function readStatus(session) {
  return parseEnvelope(await session.call("resources/read", { uri: "repo:///status" }, 30_000));
}

async function readHealth(session) {
  return parseEnvelope(await session.call(
    "resources/read",
    { uri: "integration:///health/agent-workbench" },
    30_000
  ));
}

async function callTool(session, name, args) {
  return parseEnvelope(await session.call("tools/call", { name, arguments: args }, 30_000));
}

function parseEnvelope(message) {
  const text = message.result?.content?.[0]?.text ?? message.result?.contents?.[0]?.text;
  assert(typeof text === "string", "MCP response contains a JSON envelope");
  return JSON.parse(text);
}

async function waitForFreshStatus(session, previousSnapshotId, timeoutMs) {
  const started = Date.now();
  let last;
  while (Date.now() - started <= timeoutMs) {
    last = await readStatus(session);
    if (
      last.data?.freshness === "fresh" &&
      typeof last.data?.snapshot_id === "string" &&
      last.data.snapshot_id !== previousSnapshotId
    ) {
      return last;
    }
    await sleep(100);
  }
  throw new Error(`fresh status did not arrive; last state=${safeState(last)}`);
}

async function waitForReplacementHealth(session, oldSnapshotId, timeoutMs) {
  const started = Date.now();
  let last;
  while (Date.now() - started <= timeoutMs) {
    last = await readHealth(session);
    const daemon = last.data?.daemon;
    if (
      daemon?.warmup_state === "complete" &&
      daemon.publication_state === "published" &&
      daemon.graph_freshness === "fresh" &&
      daemon.visible_snapshot_id !== oldSnapshotId
    ) {
      return last;
    }
    await sleep(100);
  }
  throw new Error(`replacement health did not arrive; last state=${safeState(last)}`);
}

function assertProviderIdentity(envelope, provider, version) {
  assert(envelope.data?.provider === provider, `${provider} provider label is preserved`);
  assert(
    envelope.data?.provider_identity?.provenance === "launcher",
    `${provider} provider identity provenance is explicit`
  );
  const plugin = envelope.data?.identities?.find((identity) => identity.artifact === "provider_plugin");
  assert(plugin?.version === version, `${provider} provider plugin version matches installed package`);
}

function assertSharedTerminalDiagnostics(first, second, oldSnapshotId) {
  const fields = [
    "pid",
    "controller_generation",
    "execution_id",
    "started_generation",
    "requested_generation",
    "target_snapshot_id",
    "visible_snapshot_id",
    "warmup_state",
    "publication_state",
    "graph_freshness",
    "worker_invocations"
  ];
  for (const field of fields) {
    assert(first[field] === second[field], `both clients agree on daemon ${field}`);
  }
  assert(first.visible_snapshot_id !== oldSnapshotId, "replacement snapshot identity advances");
  assert(first.target_snapshot_id === first.visible_snapshot_id, "published target is visible");
  assert(first.started_generation === first.requested_generation, "accepted generation is complete");
  assert(first.warmup_state === "complete", "refresh execution is complete");
  assert(first.publication_state === "published", "replacement is published");
  assert(first.graph_freshness === "fresh", "replacement graph is fresh");
  assert(first.activity_lease_held === false, "terminal execution releases activity lease");
  assert(first.last_failure === undefined, "terminal execution has no failure");
}

function assertTrustedFreshMeta(meta, label) {
  assert(meta?.analysis_validity === "valid", `${label} analysis is valid`);
  assert(meta?.freshness === "fresh", `${label} metadata is fresh`);
  assert(meta?.verification_status !== "blocked", `${label} is not blocked`);
}

function requiredDaemon(envelope) {
  assert(envelope.data?.daemon !== undefined, "integration health contains daemon diagnostics");
  return envelope.data.daemon;
}

function requiredString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} is present`);
  return value;
}

function requiredNonNegativeInteger(value, label) {
  assert(Number.isInteger(value) && value >= 0, `${label} is a non-negative integer`);
  return value;
}

function assertSessionsQuiet() {
  for (const session of sessions) {
    assert(session.stderr() === "", "installed bin stderr remains quiet");
    assert(session.stdoutRemainder() === "", "installed bin stdout has no partial line");
    assert(session.nonJsonStdout().length === 0, "installed bin stdout contains only JSON-RPC");
  }
}

async function cleanupSmoke() {
  const metadataDir = path.join(workspaceRoot, ".cache", "agent-workbench", "daemon");
  let clientsClosed = false;
  let daemonStopped = false;
  let socketRemoved = false;
  let metadataRemoved = false;
  let temporaryRootRemoved = false;
  try {
    const closeResults = await Promise.allSettled(sessions.splice(0).map((session) => session.close()));
    clientsClosed = closeResults.every((result) => result.status === "fulfilled");
  } catch {
    clientsClosed = false;
  }
  try { discoverDaemonMetadata(metadataDir); } catch { /* continue with any health-attributed identity */ }
  const daemonIdentityObserved = Number.isInteger(daemonPid) && daemonPid > 1 &&
    typeof daemonSocketPath === "string" && daemonMetadataObserved;
  daemonStopped = !daemonLaunchPossible;
  if (daemonIdentityObserved) {
    try {
      daemonStopped = await waitForProcessExit(daemonPid, 10_000);
      if (!daemonStopped && isOwnedDaemonProcess(daemonPid)) {
        try { process.kill(daemonPid, "SIGTERM"); } catch { /* already absent */ }
        daemonStopped = await waitForProcessExit(daemonPid, 2_000);
      }
      if (!daemonStopped && isOwnedDaemonProcess(daemonPid)) {
        try { process.kill(daemonPid, "SIGKILL"); } catch { /* already absent */ }
        daemonStopped = await waitForProcessExit(daemonPid, 2_000);
      }
    } catch {
      daemonStopped = false;
    }
  }
  if (daemonStopped && typeof daemonSocketPath === "string" && isInside(runtimeRoot, daemonSocketPath)) {
    try { fs.rmSync(daemonSocketPath, { force: true }); } catch { /* reported below */ }
  }
  try {
    socketRemoved = !daemonLaunchPossible || (daemonIdentityObserved && !fs.existsSync(daemonSocketPath));
  } catch {
    socketRemoved = false;
  }
  if (daemonStopped) {
    try { fs.rmSync(metadataDir, { recursive: true, force: true }); } catch { /* reported below */ }
  }
  try {
    metadataRemoved = !daemonLaunchPossible || (daemonMetadataObserved && (
      !fs.existsSync(metadataDir) || listFiles(metadataDir, 100)
        .every((file) => !file.endsWith(".json") && !file.endsWith(".lock"))
    ));
  } catch {
    metadataRemoved = false;
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch { /* reported below */ }
  try { fs.rmSync(runtimeRoot, { recursive: true, force: true }); } catch { /* reported below */ }
  temporaryRootRemoved = !fs.existsSync(tempRoot) && !fs.existsSync(runtimeRoot);
  return {
    clients_closed: clientsClosed,
    daemon_stopped: daemonStopped,
    socket_removed: socketRemoved,
    metadata_removed: metadataRemoved,
    temporary_root_removed: temporaryRootRemoved
  };
}

function discoverDaemonMetadata(metadataDir) {
  if (!fs.existsSync(metadataDir)) return;
  for (const file of listFiles(metadataDir, 100)) {
    if (!file.endsWith(".json")) continue;
    try {
      const metadata = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        Number.isInteger(metadata.pid) && metadata.pid > 1 &&
        typeof metadata.socketPath === "string" &&
        isInside(runtimeRoot, metadata.socketPath) &&
        (daemonPid === undefined || daemonPid === metadata.pid) &&
        (daemonSocketPath === undefined || daemonSocketPath === metadata.socketPath)
      ) {
        daemonPid ??= metadata.pid;
        daemonSocketPath ??= metadata.socketPath;
        daemonMetadataObserved = true;
        return;
      }
    } catch {
      // A malformed record is left for the metadata cleanup check to report.
    }
  }
}

function observeDaemonMetadata() {
  const metadataDir = path.join(workspaceRoot, ".cache", "agent-workbench", "daemon");
  const deadline = Date.now() + 2_000;
  do {
    discoverDaemonMetadata(metadataDir);
    if (daemonMetadataObserved) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  } while (Date.now() <= deadline);
  throw new Error("Daemon metadata did not corroborate the attributed process and socket.");
}

function listFiles(root, limit) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile()) files.push(absolute);
      assert(files.length <= limit, "daemon cleanup inventory stays within its bound");
    }
  }
  return files;
}

function isOwnedDaemonProcess(pid) {
  if (process.platform !== "linux" || typeof installedPackageRootObserved !== "string") return false;
  try {
    const commandLine = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
    return commandLine.includes("agent-workbench") && commandLine.includes(installedPackageRootObserved);
  } catch {
    return false;
  }
}

async function waitForProcessExit(pid, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await sleep(50);
  }
  return false;
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeout
  });
  if (result.error !== undefined) {
    throw new Error(`${command} failed to start: ${safeErrorMessage(result.error)}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}: ${safeText(result.stderr)}`);
  }
  return result;
}

function hashDirectory(root) {
  const entries = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isSymbolicLink()) {
        entries.push([relative, `symlink:${fs.readlinkSync(absolute)}`]);
      } else if (entry.isFile()) {
        const digest = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
        entries.push([relative, `file:${digest}`]);
      }
      assert(entries.length <= 50_000, "installed package content hash stays within its file bound");
    }
  }
  entries.sort(([left], [right]) => left.localeCompare(right));
  const digest = crypto.createHash("sha256");
  for (const [relative, content] of entries) digest.update(relative).update("\0").update(content).update("\0");
  return digest.digest("hex");
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(
    actualJson === expectedJson,
    `${label} matches expected evidence (actual=${boundedText(actualJson)})`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeState(envelope) {
  const daemon = envelope?.data?.daemon;
  return JSON.stringify({
    freshness: envelope?.data?.freshness ?? envelope?.meta?.freshness,
    verification_status: envelope?.meta?.verification_status,
    snapshot_id: envelope?.data?.snapshot_id,
    warmup_state: daemon?.warmup_state,
    graph_freshness: daemon?.graph_freshness
  });
}

function safeErrorMessage(error) {
  return safeText(error instanceof Error ? error.message : String(error));
}

function boundedText(value) {
  return String(value ?? "").replace(/[\r\n\t]+/gu, " ").slice(0, 1000);
}

function safeText(value) {
  let text = String(value ?? "").replace(/[\r\n\t]+/gu, " ");
  for (const secret of inheritedSensitiveValues) text = text.replaceAll(secret, "[REDACTED]");
  return text
    .replaceAll(tempRoot, "[ISOLATED_TEMP_ROOT]")
    .replaceAll(runtimeRoot, "[ISOLATED_RUNTIME_ROOT]")
    .replace(/((?:api[_-]?key|auth(?:orization)?|token|password|passwd|secret|credential|cookie|session)\s*[:=]\s*)[^\s,;]+/giu, "$1[REDACTED]")
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/giu, "$1[REDACTED]@")
    .slice(0, 1000);
}

function collectInheritedSensitiveValues(env) {
  const values = new Set();
  for (const [name, value] of Object.entries(env)) {
    if (
      typeof value === "string" && value.length >= 4 &&
      /KEY|TOKEN|SECRET|CREDENTIAL|AUTH|PASSWORD|PASSWD|COOKIE|SESSION/iu.test(name)
    ) {
      values.add(value);
    }
  }
  for (const name of ["HTTP_PROXY", "HTTPS_PROXY"]) {
    const value = env[name];
    if (typeof value === "string" && value.length >= 4 && urlContainsCredentials(value)) values.add(value);
  }
  return values;
}

function urlContainsCredentials(value) {
  try {
    const url = new URL(value);
    return url.username.length > 0 || url.password.length > 0;
  } catch {
    return true;
  }
}

function categorizedFailure(category, error) {
  return {
    category,
    message: safeErrorMessage(error)
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
