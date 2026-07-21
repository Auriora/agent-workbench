/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import {
  initializeSession,
  parseEnvelope,
  startEntryPointSession,
  type EntryPointSession,
  type McpMessage
} from "../helpers/mcp-entrypoint-session.js";

const sessions: EntryPointSession[] = [];
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.allSettled(sessions.splice(0).map((session) => session.close()));
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("daemon-backed documentation ranking integration", () => {
  it("pins Codex and Claude to one ranking-ready published snapshot and SessionStart result", async () => {
    const repoRoot = copyAuthorityRankingFixture();
    const codex = trackSession(await startProviderSession(repoRoot, "codex"));
    const claude = trackSession(await startProviderSession(repoRoot, "claude_code"));
    await Promise.all([initializeSession(codex), initializeSession(claude)]);

    const [codexStatus, claudeStatus] = await Promise.all([
      waitForRankingReadyStatus(codex),
      waitForRankingReadyStatus(claude)
    ]);
    const [codexHealth, claudeHealth] = await Promise.all([
      readHealth(codex),
      readHealth(claude)
    ]);

    expect(codexHealth.data.daemon?.pid).toEqual(expect.any(Number));
    expect(claudeHealth.data.daemon?.pid).toBe(codexHealth.data.daemon?.pid);
    expect(codexHealth.data.provider).toBe("codex");
    expect(claudeHealth.data.provider).toBe("claude_code");
    expect(identityVersions(claudeHealth)).toEqual(identityVersions(codexHealth));
    expect(identityVersions(codexHealth).provider_plugin).toBe(packageJson.version);
    expect(codexStatus.data.snapshot_id).toEqual(expect.any(String));
    expect(claudeStatus.data.snapshot_id).toBe(codexStatus.data.snapshot_id);

    const [codexOrientation, claudeOrientation, codexSearch, claudeSearch] = await Promise.all([
      readOrientation(codex),
      readOrientation(claude),
      searchSessionStart(codex, repoRoot),
      searchSessionStart(claude, repoRoot)
    ]);

    const expectedStatus = {
      freshness: "fresh",
      documentation_ranking: {
        snapshot_id: codexStatus.data.snapshot_id,
        state: "ready",
        recovery: "none"
      }
    };
    expect(codexStatus.data).toMatchObject(expectedStatus);
    expect(claudeStatus.data).toMatchObject(expectedStatus);

    const expectedOrientation = {
      snapshot_id: codexStatus.data.snapshot_id,
      freshness: "fresh",
      trust_summary: { orientation_reusable: true },
      refresh_required: false
    };
    expect(codexOrientation.data).toMatchObject(expectedOrientation);
    expect(claudeOrientation.data).toMatchObject(expectedOrientation);
    expect(codexOrientation.data.material_blockers).toEqual([]);
    expect(claudeOrientation.data.material_blockers).toEqual([]);

    const codexGoverningHit = governingHit(codexSearch);
    const claudeGoverningHit = governingHit(claudeSearch);
    expect(codexSearch.data).toMatchObject({
      snapshot_id: codexStatus.data.snapshot_id,
      trust_state: "complete_ranked_universe"
    });
    expect(claudeSearch.data).toMatchObject({
      snapshot_id: codexStatus.data.snapshot_id,
      trust_state: "complete_ranked_universe"
    });
    expect(codexGoverningHit).toMatchObject({
      path: "docs/design/coding-agent-integration-design.md",
      authority: "canonical",
      doc_status: "current",
      concern_match_state: "matched"
    });
    expect(codexGoverningHit.matched_concerns).toEqual(expect.arrayContaining([
      expect.objectContaining({ concern_key: "coding-agent-integrations" })
    ]));
    expect(hitParityFields(claudeGoverningHit)).toEqual(hitParityFields(codexGoverningHit));
  }, 30_000);
});

type StatusEnvelope = {
  data: {
    snapshot_id?: string;
    freshness: string;
    documentation_ranking?: {
      snapshot_id: string;
      state: string;
      recovery: string;
    };
  };
};

type OrientationEnvelope = {
  data: {
    snapshot_id?: string;
    freshness: string;
    trust_summary: { orientation_reusable: boolean };
    material_blockers: string[];
    refresh_required: boolean;
  };
};

type SearchEnvelope = {
  data: {
    snapshot_id?: string;
    trust_state: string;
    hits: SearchHit[];
  };
};

type SearchHit = {
  path: string;
  authority?: string;
  doc_status?: string;
  concern_match_state: string;
  matched_concerns: Array<{ concern_key: string }>;
};

function trackSession(session: EntryPointSession): EntryPointSession {
  sessions.push(session);
  return session;
}

function startProviderSession(
  repoRoot: string,
  provider: "codex" | "claude_code"
): Promise<EntryPointSession> {
  return startEntryPointSession(repoRoot, {
    idleGraceMs: 5_000,
    startupRefreshDelayMs: 0,
    env: {
      AGENT_WORKBENCH_PROVIDER: provider,
      AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
      AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: packageJson.version
    }
  });
}

async function waitForRankingReadyStatus(session: EntryPointSession): Promise<StatusEnvelope> {
  let lastEnvelope: StatusEnvelope | undefined;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    lastEnvelope = parseEnvelope(await session.call("resources/read", {
      uri: "repo:///status"
    }, 10_000)) as StatusEnvelope;
    const ranking = lastEnvelope.data.documentation_ranking;
    if (
      lastEnvelope.data.freshness === "fresh" &&
      lastEnvelope.data.snapshot_id !== undefined &&
      ranking?.snapshot_id === lastEnvelope.data.snapshot_id &&
      ranking.state === "ready" &&
      ranking.recovery === "none"
    ) {
      return lastEnvelope;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ranking-ready status: ${JSON.stringify(lastEnvelope)}`);
}

async function readHealth(session: EntryPointSession): Promise<{
  data: {
    provider: string;
    daemon?: { pid: number };
    identities: Array<{ artifact: string; version?: string }>;
  };
}> {
  return parseEnvelope(await session.call("resources/read", {
    uri: "integration:///health/agent-workbench"
  })) as {
    data: {
      provider: string;
      daemon?: { pid: number };
      identities: Array<{ artifact: string; version?: string }>;
    };
  };
}

async function readOrientation(session: EntryPointSession): Promise<OrientationEnvelope> {
  return parseEnvelope(await session.call("resources/read", {
    uri: "repo:///orientation"
  })) as OrientationEnvelope;
}

async function searchSessionStart(
  session: EntryPointSession,
  repoRoot: string
): Promise<SearchEnvelope> {
  return parseEnvelope(await session.call("tools/call", {
    name: "docs_search",
    arguments: {
      repo_root: repoRoot,
      query: "rule governing SessionStart behavior",
      max_results: 10,
      include_snippets: true
    }
  }, 10_000)) as SearchEnvelope;
}

function governingHit(envelope: SearchEnvelope): SearchHit {
  const hit = envelope.data.hits.find(({ path: hitPath }) =>
    hitPath === "docs/design/coding-agent-integration-design.md"
  );
  if (hit === undefined) {
    throw new Error(`Missing governing SessionStart hit: ${JSON.stringify(envelope)}`);
  }
  return hit;
}

function identityVersions(envelope: Awaited<ReturnType<typeof readHealth>>): Record<string, string | undefined> {
  return Object.fromEntries(
    envelope.data.identities
      .filter(({ artifact }) => artifact === "runtime" || artifact === "provider_plugin")
      .map(({ artifact, version }) => [artifact, version])
  );
}

function hitParityFields(hit: SearchHit): Pick<
  SearchHit,
  "path" | "authority" | "doc_status" | "concern_match_state" | "matched_concerns"
> {
  return {
    path: hit.path,
    authority: hit.authority,
    doc_status: hit.doc_status,
    concern_match_state: hit.concern_match_state,
    matched_concerns: hit.matched_concerns
  };
}

function copyAuthorityRankingFixture(): string {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-daemon-docs-ranking-"));
  fs.cpSync(path.resolve("tests/fixtures/fixture-docs-authority-ranking"), destination, {
    recursive: true,
    filter: (source) => path.basename(source) !== ".cache"
  });
  tempRoots.push(destination);
  return destination;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
