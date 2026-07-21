#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Real-provider installed-plugin smoke (Spec 042, T009). Unlike the package
// MCP smoke, this command registers the packed plugin with the named agent CLI
// and makes that CLI load and call the plugin-provided MCP server.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const options = parseArgs(process.argv.slice(2));
const provider = options.provider;
const expectedVersion = options.expectedVersion;
const providerId = provider === "claude" ? "claude_code" : "codex";
const cliName = provider;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `awb-${provider}-plugin-smoke-`));
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-provider-runtime-"));
const packRoot = path.join(tempRoot, "pack");
const installRoot = path.join(tempRoot, "install");
const homeRoot = path.join(tempRoot, "home");
const clientRoot = provider === "codex" ? path.join(tempRoot, "codex-home") : path.join(homeRoot, ".claude");
const npmCacheRoot = path.join(tempRoot, "npm-cache");
const workspaceRoot = path.join(tempRoot, "workspace");
for (const root of [packRoot, installRoot, homeRoot, clientRoot, npmCacheRoot, workspaceRoot, runtimeRoot]) {
  fs.mkdirSync(root, { recursive: true });
}

const sourceHome = process.env.HOME;
const inheritedExecutionSecrets = new Set();
const hostPath = process.env.PATH ?? "";
const isolatedEnv = {
  PATH: hostPath,
  LANG: process.env.LANG ?? "C.UTF-8",
  LC_ALL: process.env.LC_ALL ?? process.env.LANG ?? "C.UTF-8",
  HOME: homeRoot,
  USERPROFILE: homeRoot,
  CODEX_HOME: provider === "codex" ? clientRoot : path.join(homeRoot, ".codex"),
  CLAUDE_CONFIG_DIR: provider === "claude" ? clientRoot : path.join(homeRoot, ".claude"),
  LOCALAPPDATA: path.join(homeRoot, "AppData", "Local"),
  XDG_CACHE_HOME: path.join(homeRoot, "cache"),
  XDG_CONFIG_HOME: path.join(homeRoot, "config"),
  XDG_DATA_HOME: path.join(homeRoot, "data"),
  XDG_STATE_HOME: path.join(homeRoot, "state"),
  TMPDIR: runtimeRoot,
  TMP: runtimeRoot,
  TEMP: runtimeRoot,
  npm_config_cache: npmCacheRoot,
  AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS: "60000"
};
if (process.env.CXXFLAGS || Number(process.versions.node.split(".")[0]) >= 24) {
  isolatedEnv.CXXFLAGS = process.env.CXXFLAGS || "-std=c++20";
}
for (const name of ["SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR"]) {
  if (process.env[name] !== undefined) isolatedEnv[name] = process.env[name];
}
if (process.env.NODE_ENV === "test" && process.env.AWB_FAKE_REPO_ROOT) {
  isolatedEnv.AWB_FAKE_REPO_ROOT = process.env.AWB_FAKE_REPO_ROOT;
}
if (process.env.NODE_ENV === "test" && process.env.AWB_FAKE_INSTALL_FAILURE) {
  isolatedEnv.AWB_FAKE_INSTALL_FAILURE = process.env.AWB_FAKE_INSTALL_FAILURE;
}
if (process.env.NODE_ENV === "test" && process.env.AWB_FAKE_MARKETPLACE_FAILURE) {
  isolatedEnv.AWB_FAKE_MARKETPLACE_FAILURE = process.env.AWB_FAKE_MARKETPLACE_FAILURE;
}

let registrationAttempted = false;
let marketplaceAttempted = false;
let codexMarketplaceLink;
let clientStarted = false;
let clientFinished = false;
let activeClient;
let daemonPid;
let daemonSocketPath;
let daemonMetadataValidated = false;
let cleanupDaemonMetadataObserved = false;
let installedRuntimeRoot;
let observedPluginRoot;
let smokeReceipt;
let failure;
let cleanup = emptyCleanup();
const expectedOccurrences = expectedFixtureOccurrences();
const claudeAllowedTools = [
  "ToolSearch",
  "ReadMcpResourceTool",
  "mcp__agent-workbench__integration_health",
  "mcp__agent-workbench__find_references",
  "mcp__plugin_agent-workbench_agent-workbench__integration_health",
  "mcp__plugin_agent-workbench_agent-workbench__find_references"
].join(",");

try {
  smokeReceipt = await runSmoke();
} catch (error) {
  failure = error;
} finally {
  try {
    cleanup = await cleanupSmoke();
  } catch (error) {
    failure ??= error;
  }
}
if (!Object.values(cleanup).every(Boolean)) {
  failure ??= new Error("one or more installed-provider cleanup checks failed");
}

const receipt = {
  schema_version: "1",
  ok: failure === undefined,
  provider,
  expected_version: expectedVersion,
  real_agent_cli_executed: smokeReceipt?.real_agent_cli_executed ?? clientStarted,
  ...(smokeReceipt ?? {}),
  cleanup
};
process.stdout.write(`installed-provider-plugin-smoke ${failure === undefined ? "OK" : "FAIL"} ${JSON.stringify(receipt)}\n`);
if (failure !== undefined) {
  process.stderr.write(`installed-provider-plugin-smoke FAIL: ${safeErrorMessage(failure)}\n`);
  process.exitCode = 1;
}

async function runSmoke() {
  assertCliIdentity();
  const packed = packCheckout();
  installTarball(packed.tarballPath);
  const installedPackageRoot = path.join(installRoot, "node_modules", "@auriora", "agent-workbench");
  installedRuntimeRoot = installedPackageRoot;
  const packageManifest = readJson(path.join(installedPackageRoot, "package.json"));
  assert(packageManifest.name === "@auriora/agent-workbench", "npm package identity matches");
  assert(packageManifest.version === expectedVersion, "npm package version matches expected version");
  createWorkspaceFixture();
  registerPlugin(installedPackageRoot);
  observedPluginRoot = discoverPluginRoot();
  const artifacts = verifyInstalledArtifacts(observedPluginRoot, installedPackageRoot);

  copyProviderCredential();
  const execution = await executeRealClient(installedPackageRoot);
  clientFinished = true;
  const evidence = execution.evidence ?? parseClaudeClientEvidence(execution.stdout);
  assert(evidence.status !== undefined, "real client read repo status");
  assert(evidence.health !== undefined, "integration health envelope is present");
  assert(evidence.status.data?.freshness === "fresh", "installed runtime status is fresh");

  const health = evidence.health;
  assert(health.data?.provider === providerId, "launcher reports the requested provider");
  assert(health.data?.provider_identity?.provenance === "launcher", "provider identity is attributed to the launcher");
  assert(health.data?.runtime_version === expectedVersion, "runtime reports expected version");
  const runtimeIdentity = health.data?.identities?.find((identity) => identity.artifact === "runtime");
  const pluginIdentity = health.data?.identities?.find((identity) => identity.artifact === "provider_plugin");
  assert(runtimeIdentity?.version === expectedVersion, "runtime identity version matches");
  assert(pluginIdentity?.version === expectedVersion, "provider-plugin identity version matches");
  daemonPid = health.data?.daemon?.pid;
  daemonSocketPath = health.data?.daemon?.socket_path;
  assert(Number.isInteger(daemonPid) && daemonPid > 1, "attributed health contains a valid daemon PID");
  assert(typeof daemonSocketPath === "string" && daemonSocketPath.length > 0, "attributed health contains a daemon socket");
  assert(
    health.data?.daemon?.repo_root === workspaceRoot,
    `attributed daemon uses the isolated workspace root: observed=${
      typeof health.data?.daemon?.repo_root === "string" && isInside(tempRoot, health.data.daemon.repo_root)
        ? relativeToTemp(health.data.daemon.repo_root)
        : "<outside-isolated-root>"
    }`
  );
  assert(isInside(runtimeRoot, daemonSocketPath), "daemon socket is isolated under the runtime root");
  validateDaemonMetadata(daemonPid, daemonSocketPath);

  const referenceOutcome = verifyReferencePages(evidence.referenceCalls);
  return {
    real_agent_cli_executed: true,
    cli: {
      command: cliName,
      version: execution.version,
      exit_status: execution.status
    },
    package: {
      name: packageManifest.name,
      expected_version: expectedVersion,
      observed_version: packageManifest.version,
      tarball: path.basename(packed.tarballPath),
      tarball_sha256: packed.sha256,
      installed_root: relativeToTemp(installedPackageRoot)
    },
    plugin: {
      observed_version: expectedVersion,
      installed_root: relativeToTemp(observedPluginRoot),
      artifacts
    },
    runtime: {
      observed_version: health.data.runtime_version,
      provider_plugin_version: pluginIdentity.version,
      provider: health.data.provider
    },
    reference: referenceOutcome
  };
}

function parseArgs(args) {
  let providerValue;
  let expectedVersionValue;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--provider") providerValue = args[++index];
    else if (args[index] === "--expected-version") expectedVersionValue = args[++index];
    else throw new Error(`unknown argument: ${args[index]}`);
  }
  assert(providerValue === "codex" || providerValue === "claude", "--provider must be codex or claude");
  assert(/^\d+\.\d+\.\d+$/u.test(expectedVersionValue ?? ""), "--expected-version must be a semver version");
  return { provider: providerValue, expectedVersion: expectedVersionValue };
}

function assertCliIdentity() {
  const result = run(cliName, ["--version"], { cwd: repoRoot, env: isolatedEnv, timeout: 15_000 });
  const versionText = `${result.stdout}\n${result.stderr}`;
  const expectedMarker = provider === "codex" ? /codex(?:-cli)?/iu : /claude code/iu;
  assert(expectedMarker.test(versionText), `${provider} executable reports the expected client identity`);
}

function copyProviderCredential() {
  if (!sourceHome) return;
  const candidates = provider === "codex"
    ? [path.join(sourceHome, ".codex", "auth.json"), path.join(sourceHome, ".codex", "auth.json.api_key")]
    : [path.join(sourceHome, ".claude", ".credentials.json")];
  for (const source of candidates) {
    if (!fs.existsSync(source)) continue;
    const destination = path.join(clientRoot, path.basename(source));
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, 0o600);
  }
}

function packCheckout() {
  const result = run("npm", ["pack", "--json", "--pack-destination", packRoot], {
    cwd: repoRoot, env: isolatedEnv, timeout: 180_000
  });
  const parsed = parseJson(result.stdout, "npm pack receipt");
  const filename = parsed?.[0]?.filename;
  assert(typeof filename === "string" && filename.length > 0, "npm pack returned a tarball name");
  const tarballPath = path.join(packRoot, filename);
  assert(fs.existsSync(tarballPath), "npm pack created the tarball");
  return {
    tarballPath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(tarballPath)).digest("hex")
  };
}

function installTarball(tarballPath) {
  run("npm", ["install", "--prefix", installRoot, "--no-audit", "--no-fund", tarballPath], {
    cwd: tempRoot, env: isolatedEnv, timeout: 600_000
  });
}

function createWorkspaceFixture() {
  fs.cpSync(path.join(repoRoot, "tests", "fixtures", "fixture-reference-completeness"), workspaceRoot, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.cache${path.sep}`)
  });
}

function registerPlugin(installedPackageRoot) {
  const marketplaceRoot = path.join(installedPackageRoot, "plugins", "agent-workbench");
  if (provider === "codex") {
    run(process.execPath, [
      path.join(installedPackageRoot, "scripts", "install-codex-hooks.mjs"),
      "--package-root", installedPackageRoot,
      "--codex-home", clientRoot
    ], providerCommandOptions());
    codexMarketplaceLink = path.join(isolatedEnv.XDG_DATA_HOME, "agent-workbench", "codex-plugin");
    fs.mkdirSync(path.dirname(codexMarketplaceLink), { recursive: true });
    fs.symlinkSync(marketplaceRoot, codexMarketplaceLink, "dir");
    assert(!codexMarketplaceLink.includes("@"), "Codex marketplace source path is free of ref syntax");
    assert(
      isInside(installedPackageRoot, fs.realpathSync(codexMarketplaceLink)),
      "Codex marketplace symlink resolves into the isolated installed package"
    );
    marketplaceAttempted = true;
    run(cliName, ["plugin", "marketplace", "add", codexMarketplaceLink], providerCommandOptions());
    registrationAttempted = true;
    run(cliName, ["plugin", "add", "agent-workbench@agent-workbench-local", "--json"], providerCommandOptions());
  } else {
    marketplaceAttempted = true;
    run(cliName, ["plugin", "marketplace", "add", marketplaceRoot], providerCommandOptions());
    registrationAttempted = true;
    run(cliName, ["plugin", "install", "agent-workbench@agent-workbench-local", "--scope", "user"], providerCommandOptions());
  }
  const listing = run(cliName, ["plugin", "list", ...(provider === "claude" ? ["--json"] : [])], providerCommandOptions());
  assert(listing.stdout.includes("agent-workbench"), "provider reports the plugin installed");
  if (provider === "claude") {
    const details = run(cliName, ["plugin", "details", "agent-workbench@agent-workbench-local"], providerCommandOptions());
    assert(details.stdout.includes("agent-workbench"), "Claude discovers the installed plugin component inventory");
  }
}

function discoverPluginRoot() {
  const manifestSuffix = provider === "codex"
    ? path.join(".codex-plugin", "plugin.json")
    : path.join(".claude-plugin", "plugin.json");
  const candidates = walkFiles(clientRoot, 12_000)
    .filter((candidate) => candidate.endsWith(manifestSuffix))
    .filter((candidate) => {
      try {
        const manifest = readJson(candidate);
        return manifest.name === "agent-workbench" && manifest.version === expectedVersion;
      } catch {
        return false;
      }
    });
  assert(candidates.length === 1, `exactly one installed ${provider} plugin manifest is discovered`);
  return path.dirname(path.dirname(candidates[0]));
}

function verifyInstalledArtifacts(pluginRoot, installedPackageRoot) {
  assert(isInside(clientRoot, pluginRoot), "provider plugin is under isolated client state");
  assert(!isInside(repoRoot, pluginRoot), "provider plugin does not resolve into the checkout");
  const manifestRelative = provider === "codex" ? ".codex-plugin/plugin.json" : ".claude-plugin/plugin.json";
  const paths = {
    manifest: path.join(pluginRoot, manifestRelative),
    launcher: path.join(pluginRoot, "mcp-launch.mjs"),
    hook: path.join(pluginRoot, "hooks", "session-start.js"),
    skill: path.join(pluginRoot, "skills", "agent-workbench", "SKILL.md")
  };
  for (const [artifact, artifactPath] of Object.entries(paths)) {
    assert(fs.existsSync(artifactPath), `${artifact} is installed`);
    assert(isInside(pluginRoot, fs.realpathSync(artifactPath)), `${artifact} originates under installed plugin root`);
  }
  const manifest = readJson(paths.manifest);
  assert(manifest.version === expectedVersion, "installed provider manifest version matches");
  if (provider === "codex") {
    const hooksPath = path.join(clientRoot, "hooks.json");
    const hooksText = fs.readFileSync(hooksPath, "utf8");
    const installedHook = path.join(installedPackageRoot, "plugins", "agent-workbench", "hooks", "session-start.js");
    assert(hooksText.includes(installedHook), "Codex SessionStart registration points to the isolated package");
    paths.hook_registration = hooksPath;
  }
  const pointerPath = path.join(homeRoot, ".local", "share", "agent-workbench", "runtime-root");
  assert(fs.existsSync(pointerPath), "installed package wrote the isolated runtime pointer");
  assert(fs.realpathSync(fs.readFileSync(pointerPath, "utf8").trim()) === fs.realpathSync(installedPackageRoot), "runtime pointer resolves to installed package");
  return Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, relativeToTemp(value)]));
}

async function executeRealClient(installedPackageRoot) {
  const env = executionEnvironment(installedPackageRoot);
  const timeout = process.env.NODE_ENV === "test" && process.env.AWB_FAKE_CLIENT_TIMEOUT_MS
    ? Number(process.env.AWB_FAKE_CLIENT_TIMEOUT_MS)
    : 240_000;
  if (provider === "codex") {
    const result = await executeCodexAppServer(env, timeout);
    return {
      ...result,
      version: run(cliName, ["--version"], { cwd: workspaceRoot, env, timeout: 15_000 }).stdout.trim()
    };
  }
  const prompt = [
    "Use only the installed agent-workbench plugin MCP surfaces for this verification.",
    "Read repo:///status and integration:///health/agent-workbench.",
    "Call find_references with symbol buildSessionStartContext, max_depth 1, and max_results 100.",
    "If the result is partial, invoke its callable continuation verbatim until the reference evidence is complete.",
    "Do not use shell search, filesystem search, source reads, another parser, or any non-agent-workbench tool.",
    "Return a brief completion statement after the calls."
  ].join(" ");
  const args = [
    "-p", "--no-session-persistence", "--output-format", "stream-json", "--verbose",
    "--allowedTools", claudeAllowedTools, "--permission-mode", "dontAsk", prompt
  ];
  const result = await runAsync(cliName, args, { cwd: workspaceRoot, env, timeout });
  clientFinished = true;
  return {
    ...result,
    version: run(cliName, ["--version"], { cwd: workspaceRoot, env, timeout: 15_000 }).stdout.trim()
  };
}

async function executeCodexAppServer(env, timeout) {
  const client = createCodexAppServerClient(env, timeout);
  try {
    await client.request(0, "initialize", {
      clientInfo: {
        name: "agent_workbench_provider_smoke",
        title: "Agent Workbench Provider Smoke",
        version: expectedVersion
      }
    });
    client.notify("initialized", {});
    const started = await client.request(1, "thread/start", {
      cwd: workspaceRoot,
      ephemeral: true,
      sandbox: "read-only"
    });
    const threadId = started?.thread?.id;
    assert(typeof threadId === "string" && threadId.length > 0, "Codex app-server returned an ephemeral thread ID");

    const discovered = await client.request(2, "mcpServerStatus/list", { threadId });
    const discoveryKeys = discovered && Object.keys(discovered).sort().join(",");
    assert(discoveryKeys === "data" || discoveryKeys === "data,nextCursor", "Codex MCP status response has only data and its optional cursor");
    if (discovered.nextCursor !== undefined) assert(discovered.nextCursor === null, "Codex MCP status discovery is exhausted");
    assert(Array.isArray(discovered.data), "Codex MCP status data is an array");
    const server = discovered.data.find((entry) => entry?.name === "agent-workbench");
    assert(server !== undefined, "Codex app-server discovered the installed agent-workbench server");
    assert(server.serverInfo?.version === expectedVersion, "Codex app-server reports the installed MCP server version");
    assert(server.tools && typeof server.tools.find_references === "object", "Codex app-server exposes find_references");

    let requestId = 3;
    let status;
    const freshnessDeadline = Date.now() + 60_000;
    do {
      const statusResult = await client.request(requestId++, "mcpServer/resource/read", {
        threadId,
        server: "agent-workbench",
        uri: "repo:///status"
      });
      status = parseAppServerResourceEnvelope(statusResult, "repo:///status", "Codex status resource result");
      if (
        status.data?.freshness === "fresh" &&
        status.data?.snapshot_validity?.state === "valid" &&
        status.data?.snapshot_validity?.complete === true
      ) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() <= freshnessDeadline);
    assert(status?.data?.freshness === "fresh", "Codex installed workspace reaches a fresh snapshot");
    assert(status.data?.snapshot_validity?.state === "valid", "Codex installed workspace snapshot validity is valid");
    assert(status.data?.snapshot_validity?.complete === true, "Codex installed workspace snapshot validity is complete");

    const healthResult = await client.request(requestId++, "mcpServer/resource/read", {
      threadId,
      server: "agent-workbench",
      uri: "integration:///health/agent-workbench"
    });
    const health = parseAppServerResourceEnvelope(
      healthResult,
      "integration:///health/agent-workbench",
      "Codex health resource result"
    );

    const referenceCalls = [];
    let input = { symbol: "buildSessionStartContext", max_depth: 1, max_results: 100 };
    for (let page = 0; page < 100; page += 1) {
      const callId = requestId++;
      const result = await client.request(callId, "mcpServer/tool/call", {
        threadId,
        server: "agent-workbench",
        tool: "find_references",
        arguments: input
      });
      assert(result?.isError !== true, "Codex find_references direct result is not an MCP error");
      const envelope = parseToolEnvelope(result, "Codex find_references direct result", "find_references");
      referenceCalls.push({ id: String(callId), kind: "find_references", transport: "tool", input, envelope });
      if (envelope.data?.coverage?.state === "complete") break;
      const action = envelope.data?.next_actions?.find((entry) => entry?.tool === "find_references");
      const continuationDiagnostic = JSON.stringify({
        coverage_state: envelope.data?.coverage?.state,
        data_keys: Object.keys(envelope.data ?? {}).sort(),
        meta_keys: Object.keys(envelope.meta ?? {}).sort(),
        data_action_tools: Array.isArray(envelope.data?.next_actions)
          ? envelope.data.next_actions.map((entry) => entry?.tool).filter((entry) => typeof entry === "string").slice(0, 10)
          : [],
        meta_action_tools: Array.isArray(envelope.meta?.next_actions)
          ? envelope.meta.next_actions.map((entry) => entry?.tool).filter((entry) => typeof entry === "string").slice(0, 10)
          : []
      }).slice(0, 800);
      assert(
        action?.args && typeof action.args === "object" && !Array.isArray(action.args),
        `partial reference result supplies a callable continuation: ${continuationDiagnostic}`
      );
      assert(action.args.cursor === envelope.data?.cursor, "callable continuation carries the page cursor exactly");
      input = action.args;
    }
    assert(referenceCalls.at(-1)?.envelope?.data?.coverage?.state === "complete", "Codex reference sequence completes within the smoke page bound");
    client.assertHealthy();
    await client.close();
    clientFinished = true;
    return {
      status: client.child.exitCode,
      signal: client.child.signalCode,
      stdout: "",
      stderr: client.stderr(),
      evidence: { status, health, referenceCalls }
    };
  } catch (error) {
    await client.abort();
    throw error;
  }
}

function createCodexAppServerClient(env, timeout) {
  const child = spawn("codex", ["app-server"], {
    cwd: workspaceRoot,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });
  activeClient = child;
  clientStarted = true;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stderrText = "";
  let protocolError;
  let closed = false;
  const pending = new Map();
  const lines = readline.createInterface({ input: child.stdout });
  const timer = setTimeout(() => fail(new Error(`codex app-server timed out after ${timeout}ms`)), timeout);

  child.stderr.on("data", (chunk) => { stderrText = boundedText(`${stderrText}${chunk}`); });
  lines.on("line", (line) => {
    if (line.length > 2_000_000) return fail(new Error("Codex app-server response line exceeds the smoke bound"));
    let message;
    try { message = JSON.parse(line); } catch { return fail(new Error("Codex app-server emitted malformed JSONL")); }
    if (message && typeof message === "object" && message.id !== undefined) {
      const waiter = pending.get(message.id);
      if (waiter === undefined) return fail(new Error(`Codex app-server response has an unmatched ID: ${boundedToolName(message.id)}`));
      pending.delete(message.id);
      const keys = Object.keys(message).sort().join(",");
      if (message.error !== undefined) {
        waiter.reject(new Error(`Codex app-server ${waiter.method} failed: ${boundedText(message.error?.message)}`));
      } else if (keys !== "id,result") {
        waiter.reject(new Error(`Codex app-server ${waiter.method} response has an invalid shape`));
      } else {
        waiter.resolve(message.result);
      }
      return;
    }
    const itemType = message?.method === "item/started" ? message.params?.item?.type : undefined;
    if (["commandExecution", "fileChange", "webSearch"].includes(itemType)) {
      fail(new Error(`Codex app-server emitted a forbidden non-workbench item: ${boundedToolName(itemType)}`));
    }
  });
  child.once("error", (error) => fail(new Error(`codex app-server failed to start: ${safeErrorMessage(error)}`)));
  child.once("exit", (code, signal) => {
    closed = true;
    clearTimeout(timer);
    if (pending.size > 0) fail(new Error(`codex app-server exited with status ${code ?? signal}: ${boundedText(stderrText)}`));
  });

  function fail(error) {
    protocolError ??= error;
    for (const waiter of pending.values()) waiter.reject(protocolError);
    pending.clear();
  }
  function request(id, method, params) {
    if (protocolError !== undefined) return Promise.reject(protocolError);
    assert(Number.isInteger(id) && !pending.has(id), "Codex app-server request ID is unique");
    return new Promise((resolve, reject) => {
      pending.set(id, { method, resolve, reject });
      child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }
  function notify(method, params) {
    if (protocolError !== undefined) throw protocolError;
    child.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }
  async function close() {
    if (protocolError !== undefined) throw protocolError;
    child.stdin.end();
    const exited = await waitForChildExit(child, 2_000);
    if (!exited) {
      child.kill("SIGTERM");
      await waitForChildExit(child, 2_000);
    }
    clearTimeout(timer);
    if (protocolError !== undefined) throw protocolError;
    assert(closed || child.exitCode !== null || child.signalCode !== null, "Codex app-server process closed after direct verification");
  }
  async function abort() {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await waitForChildExit(child, 2_000);
  }
  return {
    child,
    request,
    notify,
    close,
    abort,
    assertHealthy: () => { if (protocolError !== undefined) throw protocolError; },
    stderr: () => stderrText
  };
}

function executionEnvironment(installedPackageRoot) {
  const env = {
    ...isolatedEnv,
    AGENT_WORKBENCH_INSTALL_ROOT: installedPackageRoot,
    AGENT_WORKBENCH_DEFAULT_REPO_ROOT: workspaceRoot
  };
  const exact = new Set([
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN",
    "AWS_PROFILE", "AWS_REGION", "AWS_DEFAULT_REGION",
    "GOOGLE_APPLICATION_CREDENTIALS"
  ]);
  const prefixes = ["ANTHROPIC_", "CLAUDE_CODE_USE_"];
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || (!exact.has(name) && !prefixes.some((prefix) => name.startsWith(prefix)))) continue;
    env[name] = value;
    if (/KEY|TOKEN|SECRET|CREDENTIAL/iu.test(name)) inheritedExecutionSecrets.add(value);
  }
  if (process.env.NODE_ENV === "test" && process.env.AWB_FAKE_SCENARIO) {
    env.AWB_FAKE_SCENARIO = process.env.AWB_FAKE_SCENARIO;
  }
  return env;
}

function parseClaudeClientEvidence(stdout) {
  const events = stdout.split(/\r?\n/u).filter(Boolean).map((line) => parseJson(line, "provider JSONL event"));
  return parseClaudeEvents(events);
}

function parseClaudeEvents(events) {
  const calls = new Map();
  const completed = [];
  for (const event of events) {
    const blocks = event?.message?.content;
    if (!Array.isArray(blocks) || (event.type !== "assistant" && event.type !== "user")) continue;
    for (const block of blocks) {
      if (event.type === "assistant" && block?.type === "tool_use") {
        assert(typeof block.id === "string" && !calls.has(block.id), "Claude tool-use ID is unique");
        calls.set(block.id, claudeDescriptor(block));
      } else if (event.type === "user" && block?.type === "tool_result") {
        const call = calls.get(block.tool_use_id);
        assert(call !== undefined, "Claude tool result has a matching tool-use ID");
        assert(!completed.some((entry) => entry.id === block.tool_use_id), "Claude tool use has one result");
        assert(
          block.is_error !== true,
          `Claude ${call.kind} tool result did not fail: ${claudeToolErrorDiagnostic(block.content)}`
        );
        completed.push({
          id: block.tool_use_id,
          ...call,
          envelope: call.transport === "provider_discovery"
            ? validateClaudeDiscoveryResult(block)
            : parseAttributedResult(call, block.content, `Claude ${call.kind} MCP result`)
        });
      }
    }
  }
  assert(calls.size === completed.length, "every Claude tool use has exactly one result");
  return classifyAttributedCalls(completed);
}

function claudeDescriptor(block) {
  if (block.name === "ToolSearch") {
    assert(block.input && typeof block.input === "object" && !Array.isArray(block.input), "Claude ToolSearch input is an object");
    const toolSearchKeys = Object.keys(block.input).sort();
    assert(
      toolSearchKeys.join(",") === "max_results,query",
      `Claude ToolSearch input contains only max_results and query: keys=${JSON.stringify(toolSearchKeys).slice(0, 300)}`
    );
    assert(
      Number.isInteger(block.input.max_results) && block.input.max_results >= 1 && block.input.max_results <= 50,
      `Claude ToolSearch max_results is bounded from 1 through 50: value=${JSON.stringify(block.input.max_results).slice(0, 40)}`
    );
    assert(
      typeof block.input.query === "string" && block.input.query.length >= 1 && block.input.query.length <= 300,
      "Claude ToolSearch query is a bounded non-empty string"
    );
    return { kind: "provider_discovery", transport: "provider_discovery", input: block.input, identity: { name: block.name } };
  }
  if (
    block.name === "mcp__agent-workbench__integration_health" ||
    block.name === "mcp__plugin_agent-workbench_agent-workbench__integration_health"
  ) {
    return { kind: "integration_health", transport: "tool", input: block.input, identity: { name: block.name } };
  }
  if (
    block.name === "mcp__agent-workbench__find_references" ||
    block.name === "mcp__plugin_agent-workbench_agent-workbench__find_references"
  ) {
    return { kind: "find_references", transport: "tool", input: block.input, identity: { name: block.name } };
  }
  assert(
    block.name === "ReadMcpResourceTool",
    `Claude tool-use name is an expected exact surface: ${boundedToolName(block.name)}`
  );
  assert(block.input && typeof block.input === "object", "Claude resource arguments are an object");
  assert(Object.keys(block.input).sort().join(",") === "server,uri", "Claude resource arguments contain only server and uri");
  assert(
    block.input.server === "agent-workbench" || block.input.server === "plugin:agent-workbench:agent-workbench",
    `Claude resource argument names the installed server: ${JSON.stringify({ server: block.input.server, uri: block.input.uri }).slice(0, 400)}`
  );
  const kind = resourceKind(block.input.uri);
  assert(kind !== undefined, "Claude resource URI is an expected exact surface");
  return { kind, transport: "resource", input: block.input, identity: { name: block.name, uri: block.input.uri } };
}

function validateClaudeDiscoveryResult(block) {
  assert(block.is_error !== true, "Claude ToolSearch discovery did not fail");
  assert(block.content !== undefined && block.content !== null, "Claude ToolSearch discovery returned content");
  return undefined;
}

function claudeToolErrorDiagnostic(content) {
  const texts = Array.isArray(content)
    ? content.filter((entry) => entry?.type === "text" && typeof entry.text === "string").map((entry) => entry.text)
    : typeof content === "string" ? [content] : [];
  return boundedText(texts.join(" ")).slice(0, 500);
}

function resourceKind(uri) {
  if (uri === "repo:///status") return "status";
  if (uri === "integration:///health/agent-workbench") return "integration_health";
  return undefined;
}

function boundedToolName(value) {
  return (JSON.stringify(value) ?? '"<undefined>"').slice(0, 150);
}

function classifyAttributedCalls(completed) {
  const statusCalls = completed.filter((call) => call.kind === "status");
  const healthCalls = completed.filter((call) => call.kind === "integration_health");
  const referenceCalls = completed.filter((call) => call.kind === "find_references");
  assert(statusCalls.length === 1, "exactly one attributed status call/result is present");
  assert(healthCalls.length === 1, "exactly one attributed integration_health call/result is present");
  assert(referenceCalls.length > 0, "at least one attributed find_references call/result is present");
  return {
    status: statusCalls[0].envelope,
    health: healthCalls[0].envelope,
    referenceCalls
  };
}

function parseArguments(value) {
  if (typeof value === "string") return parseJson(value, "MCP call arguments");
  assert(value && typeof value === "object" && !Array.isArray(value), "MCP call arguments are an object");
  return value;
}

function parseAttributedResult(call, value, label) {
  if (call.transport === "resource") return parseResourceEnvelope(value, call.input.uri, label);
  return parseToolEnvelope(value, label, call.kind);
}

function parseToolEnvelope(value, label, callKind) {
  if (isRuntimeEnvelope(value)) return value;
  let text;
  if (typeof value === "string") text = value;
  else if (Array.isArray(value)) {
    assert(value.length === 1 && value[0]?.type === "text" && typeof value[0].text === "string", `${label} has one text content block`);
    text = value[0].text;
  } else if (value && typeof value === "object" && Array.isArray(value.content)) {
    assert(value.content.length === 1 && value.content[0]?.type === "text" && typeof value.content[0].text === "string", `${label} has one text content block`);
    text = value.content[0].text;
  }
  assert(
    typeof text === "string",
    `${label} contains direct MCP text evidence: ${resultShapeDiagnostic(callKind, value)}`
  );
  assert(text.length <= 2_000_000, `${label} text stays within the smoke bound`);
  const envelope = parseJson(text, label);
  assert(isRuntimeEnvelope(envelope), `${label} is a runtime envelope`);
  return envelope;
}

function resultShapeDiagnostic(callKind, value) {
  const shape = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  const keys = value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
  return JSON.stringify({ call_kind: callKind, shape, keys }).slice(0, 300);
}

function parseAppServerResourceEnvelope(value, expectedUri, label) {
  assert(
    value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === "contents" && Array.isArray(value.contents),
    `${label} is an exact app-server resource response`
  );
  return parseResourceEnvelope({ server: "agent-workbench", uri: expectedUri, contents: value.contents }, expectedUri, label);
}

function parseResourceEnvelope(value, expectedUri, label) {
  let wrapper = value;
  if (typeof wrapper === "string") {
    assert(wrapper.length <= 2_000_000, `${label} resource wrapper stays within the smoke bound`);
    wrapper = parseJson(wrapper, `${label} resource wrapper`);
  } else if (Array.isArray(wrapper)) {
    assert(wrapper.length === 1 && wrapper[0]?.type === "text" && typeof wrapper[0].text === "string", `${label} has one resource-wrapper text block`);
    assert(wrapper[0].text.length <= 2_000_000, `${label} resource wrapper stays within the smoke bound`);
    wrapper = parseJson(wrapper[0].text, `${label} resource wrapper`);
  } else if (wrapper && typeof wrapper === "object" && Array.isArray(wrapper.content)) {
    assert(wrapper.content.length === 1 && wrapper.content[0]?.type === "text" && typeof wrapper.content[0].text === "string", `${label} has one resource-wrapper text block`);
    assert(wrapper.content[0].text.length <= 2_000_000, `${label} resource wrapper stays within the smoke bound`);
    wrapper = parseJson(wrapper.content[0].text, `${label} resource wrapper`);
  }
  const wrapperKeys = wrapper && typeof wrapper === "object" ? Object.keys(wrapper).sort().join(",") : "";
  assert(
    (wrapperKeys === "contents" || wrapperKeys === "contents,server,uri") && Array.isArray(wrapper.contents),
    `${label} is an exact resource wrapper: ${resultShapeDiagnostic("resource", wrapper)}`
  );
  if (wrapperKeys === "contents,server,uri") {
    assert(wrapper.server === "agent-workbench", `${label} wrapper names the installed server`);
    assert(wrapper.uri === expectedUri, `${label} wrapper URI matches the attributed call`);
  }
  assert(wrapper.contents.length === 1, `${label} contains exactly one resource record`);
  const record = wrapper.contents[0];
  const keys = Object.keys(record ?? {}).sort().join(",");
  assert(keys === "text,uri" || keys === "mimeType,text,uri", `${label} resource record has only uri, mimeType, and text`);
  assert(record.uri === expectedUri, `${label} resource URI matches the attributed call`);
  assert(typeof record.text === "string" && record.text.length <= 2_000_000, `${label} resource text stays within the smoke bound`);
  if (record.mimeType !== undefined) assert(typeof record.mimeType === "string", `${label} resource mimeType is a string`);
  const envelope = parseJson(record.text, `${label} resource text`);
  assert(isRuntimeEnvelope(envelope), `${label} resource text is one runtime envelope`);
  return envelope;
}

function isRuntimeEnvelope(value) {
  return value && typeof value === "object" && !Array.isArray(value) && value.data && value.meta;
}

function expectedFixtureOccurrences() {
  return [
    "catalog/001-codex-session-start.js:3:16",
    "catalog/001-codex-session-start.js:7:28",
    "catalog/001-codex-session-start.js:8:27",
    "catalog/001-codex-session-start.js:9:28",
    "catalog/001-codex-session-start.js:10:26",
    "catalog/002-claude-session-start.js:3:16",
    "catalog/002-claude-session-start.js:7:29",
    "catalog/002-claude-session-start.js:8:28",
    "catalog/002-claude-session-start.js:9:29",
    "catalog/101-session-start-consumers.fixture.ts:3:20",
    "catalog/101-session-start-consumers.fixture.ts:4:20",
    "catalog/101-session-start-consumers.fixture.ts:5:20"
  ];
}

function verifyReferencePages(calls) {
  const pages = calls.map((call) => call.envelope);
  const firstInput = calls[0].input;
  assert(firstInput.symbol === "buildSessionStartContext", "first reference call uses the fixture symbol");
  assert(firstInput.max_depth === 1 && firstInput.max_results === 100, "first reference call uses the declared bounds");
  assert(firstInput.cursor === undefined, "first reference call has no continuation cursor");
  for (let index = 1; index < calls.length; index += 1) {
    const previousCursor = pages[index - 1].data?.cursor;
    const continuation = pages[index - 1].data?.next_actions?.find((entry) => entry?.tool === "find_references");
    assert(typeof previousCursor === "string" && previousCursor.length > 0, "non-terminal reference page supplies a cursor");
    assert(continuation?.args && typeof continuation.args === "object", "non-terminal reference page supplies a callable continuation");
    assertDeepEqual(calls[index].input, continuation.args, "reference continuation invokes the emitted arguments verbatim");
    assert(calls[index].input.cursor === previousCursor, "reference continuation consumes the prior page cursor exactly");
  }
  const references = pages.flatMap((page) => page.data.references);
  const terminal = pages.at(-1);
  const complete = terminal.data.coverage.state === "complete" && terminal.data.coverage.catalog_exhausted === true;
  assert(complete, "reference sequence reaches complete evidence");
  assert(terminal.meta?.analysis_validity === "valid", "complete reference evidence is valid");
  assert(terminal.meta?.truncated === false, "complete reference evidence is not truncated");
  assert(terminal.data.coverage.complete_matches === references.length, "reference count reconciles across pages");
  const ordered = references.map((reference) => `${reference.source_file_path}:${reference.source_range?.start_line}:${reference.source_range?.start_column}`);
  assert(new Set(ordered).size === ordered.length, "reference occurrences are unique across pages");
  assert(
    JSON.stringify(ordered) === JSON.stringify(expectedOccurrences),
    `references match the checked-in path/line/column oracle exactly: ${JSON.stringify({ expected: expectedOccurrences, observed: ordered }).slice(0, 3_000)}`
  );
  assert(references.every((reference) => reference.status === "unresolved"), "lexical occurrences remain unresolved");
  return {
    state: "complete",
    pages: pages.length,
    occurrence_count: references.length,
    callable_continuation_used: pages.length > 1,
    ordered_occurrences: ordered
  };
}

function validateDaemonMetadata(pid, socketPath) {
  const metadataDir = path.join(workspaceRoot, ".cache", "agent-workbench", "daemon");
  const deadline = Date.now() + 2_000;
  do {
    if (fs.existsSync(metadataDir)) {
      const records = walkFiles(metadataDir, 100).filter((file) => file.endsWith(".json")).map((file) => {
        try { return readJson(file); } catch { return undefined; }
      }).filter(Boolean);
      daemonMetadataValidated = records.some((record) => record.pid === pid && record.socketPath === socketPath);
      if (daemonMetadataValidated) break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  } while (Date.now() <= deadline);
  assert(daemonMetadataValidated, "daemon metadata corroborates the attributed PID and socket");
}

async function cleanupSmoke() {
  if (activeClient !== undefined && activeClient.exitCode === null && activeClient.signalCode === null) {
    activeClient.kill("SIGTERM");
    await waitForChildExit(activeClient, 2_000);
    if (activeClient.exitCode === null && activeClient.signalCode === null) activeClient.kill("SIGKILL");
  }
  clientFinished = !clientStarted || activeClient === undefined || activeClient.exitCode !== null || activeClient.signalCode !== null;
  terminateProviderProcessGroup();
  discoverDaemonMetadata();
  let pluginUnregistered = !registrationAttempted;
  let marketplaceRemoved = !marketplaceAttempted;
  if (registrationAttempted && fs.existsSync(clientRoot)) {
    const removeArgs = provider === "codex"
      ? ["plugin", "remove", "agent-workbench@agent-workbench-local", "--json"]
      : ["plugin", "uninstall", "agent-workbench@agent-workbench-local", "--scope", "user", "--yes"];
    try {
      const removal = run(cliName, removeArgs, providerCommandOptions());
      if (provider === "claude") {
        const listing = run(cliName, ["plugin", "list", "--json"], providerCommandOptions());
        pluginUnregistered = !listing.stdout.includes("agent-workbench@agent-workbench-local");
      } else {
        const parsed = parseJson(removal.stdout, "Codex plugin removal receipt");
        pluginUnregistered = parsed.pluginId === "agent-workbench@agent-workbench-local" &&
          parsed.name === "agent-workbench" &&
          parsed.marketplaceName === "agent-workbench-local" &&
          Object.keys(parsed).sort().join(",") === "marketplaceName,name,pluginId";
      }
    } catch {
      pluginUnregistered = false;
    }
  }
  if (marketplaceAttempted && fs.existsSync(clientRoot)) {
    try {
      run(cliName, ["plugin", "marketplace", "remove", "agent-workbench-local"], providerCommandOptions());
      const listing = run(cliName, ["plugin", "marketplace", "list"], providerCommandOptions());
      marketplaceRemoved = !listing.stdout.includes("agent-workbench-local");
    } catch {
      try {
        const listing = run(cliName, ["plugin", "marketplace", "list"], providerCommandOptions());
        marketplaceRemoved = !listing.stdout.includes("agent-workbench-local");
      } catch {
        marketplaceRemoved = false;
      }
    }
  }

  const processClosed = clientFinished && !providerProcessGroupExists();
  let daemonStopped = !clientStarted;
  if (Number.isInteger(daemonPid) && daemonPid > 1) {
    daemonStopped = waitForProcessExit(daemonPid, 2_000);
    if (!daemonStopped && isOwnedDaemonProcess(daemonPid)) {
      process.kill(daemonPid, "SIGTERM");
      daemonStopped = waitForProcessExit(daemonPid, 2_000);
      if (!daemonStopped && isOwnedDaemonProcess(daemonPid)) {
        process.kill(daemonPid, "SIGKILL");
        daemonStopped = waitForProcessExit(daemonPid, 2_000);
      }
    }
  }
  if (daemonStopped && typeof daemonSocketPath === "string" && isInside(runtimeRoot, daemonSocketPath)) {
    fs.rmSync(daemonSocketPath, { force: true });
  }
  const metadataDir = path.join(workspaceRoot, ".cache", "agent-workbench", "daemon");
  if (daemonStopped && fs.existsSync(metadataDir)) fs.rmSync(metadataDir, { recursive: true, force: true });
  const socketRemoved = !clientStarted || (
    (daemonMetadataValidated || cleanupDaemonMetadataObserved) &&
    typeof daemonSocketPath === "string" &&
    !fs.existsSync(daemonSocketPath)
  );
  const metadataRemoved = !fs.existsSync(metadataDir) ||
    fs.readdirSync(metadataDir).every((entry) => !entry.endsWith(".json") && !entry.endsWith(".lock"));
  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  const installRootRemoved = !fs.existsSync(installRoot);
  const clientStateRemoved = !fs.existsSync(clientRoot);
  const temporaryRootsRemoved = !fs.existsSync(tempRoot) && !fs.existsSync(runtimeRoot);
  return {
    provider_process_closed: processClosed,
    daemon_stopped: daemonStopped,
    socket_removed: socketRemoved,
    metadata_removed: metadataRemoved,
    plugin_unregistered: pluginUnregistered,
    marketplace_removed: marketplaceRemoved,
    install_root_removed: installRootRemoved,
    client_state_removed: clientStateRemoved,
    temporary_roots_removed: temporaryRootsRemoved
  };
}

function discoverDaemonMetadata() {
  const metadataDir = path.join(workspaceRoot, ".cache", "agent-workbench", "daemon");
  if (!fs.existsSync(metadataDir)) return;
  for (const file of walkFiles(metadataDir, 100)) {
    if (!file.endsWith(".json")) continue;
    try {
      const metadata = readJson(file);
      if (
        Number.isInteger(metadata.pid) && metadata.pid > 1 &&
        typeof metadata.socketPath === "string" &&
        isInside(runtimeRoot, metadata.socketPath)
      ) {
        daemonPid = metadata.pid;
        daemonSocketPath = metadata.socketPath;
        cleanupDaemonMetadataObserved = true;
        return;
      }
    } catch {
      // A transient or incomplete metadata file remains a failed cleanup check.
    }
  }
}

function terminateProviderProcessGroup() {
  if (activeClient === undefined || process.platform === "win32") return;
  try { process.kill(-activeClient.pid, "SIGTERM"); } catch { return; }
  const deadline = Date.now() + 2_000;
  while (Date.now() <= deadline && providerProcessGroupExists()) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  }
  if (providerProcessGroupExists()) {
    try { process.kill(-activeClient.pid, "SIGKILL"); } catch { /* already absent */ }
  }
}

function providerProcessGroupExists() {
  if (activeClient === undefined || process.platform === "win32") {
    return activeClient !== undefined && activeClient.exitCode === null && activeClient.signalCode === null;
  }
  try { process.kill(-activeClient.pid, 0); return true; } catch { return false; }
}

function isOwnedDaemonProcess(pid) {
  if (process.platform !== "linux" || typeof installedRuntimeRoot !== "string") return false;
  try {
    const commandLine = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
    return commandLine.includes("agent-workbench") && commandLine.includes(installedRuntimeRoot);
  } catch {
    return false;
  }
}

function emptyCleanup() {
  return {
    provider_process_closed: false,
    daemon_stopped: false,
    socket_removed: false,
    metadata_removed: false,
    plugin_unregistered: false,
    marketplace_removed: false,
    install_root_removed: false,
    client_state_removed: false,
    temporary_roots_removed: false
  };
}

function providerCommandOptions() {
  return { cwd: workspaceRoot, env: isolatedEnv, timeout: 60_000 };
}

function walkFiles(root, maximum) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile()) files.push(candidate);
      assert(files.length + pending.length <= maximum, "isolated client state scan remains bounded");
    }
  }
  return files;
}

function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    try { process.kill(pid, 0); } catch { return true; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
  return false;
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeout,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.error !== undefined) throw new Error(`${command} failed to start: ${safeErrorMessage(result.error)}`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}: ${boundedText(result.stderr)}`);
  return result;
}

function runAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    activeClient = child;
    clientStarted = true;
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out after ${options.timeout}ms`));
    }, options.timeout);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`${command} failed to start: ${safeErrorMessage(error)}`));
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const diagnostic = command === "claude" ? claudeFailureDiagnostic(stdout) : "";
        reject(new Error(`${command} exited with status ${code ?? signal}: ${boundedText(stderr)} ${diagnostic}`));
        return;
      }
      resolve({ status: code, signal, stdout, stderr });
    });
  });
}

function claudeFailureDiagnostic(stdout) {
  const summaries = [];
  for (const line of stdout.split(/\r?\n/u).filter(Boolean).slice(-20)) {
    try {
      const event = JSON.parse(line);
      const summary = {
        type: event?.type,
        subtype: event?.subtype,
        is_error: event?.is_error === true ? true : undefined,
        errors: Array.isArray(event?.errors)
          ? event.errors.map((entry) => boundedText(entry?.message ?? entry)).slice(0, 3)
          : undefined,
        result: typeof event?.result === "string" && event?.is_error === true
          ? boundedText(event.result).slice(0, 300)
          : undefined
      };
      summaries.push(Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined)));
    } catch {
      summaries.push({ type: "malformed_jsonl" });
    }
  }
  return `events=${JSON.stringify(summaries).slice(0, 900)}`;
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => { clearTimeout(timeout); resolve(true); });
  });
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function parseJson(value, label) {
  try { return JSON.parse(value); } catch { throw new Error(`${label} is not valid JSON`); }
}
function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function relativeToTemp(value) {
  assert(isInside(tempRoot, value), "reported installed path is isolated");
  return path.relative(tempRoot, value);
}
function assertDeepEqual(actual, expected, label) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), label);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function safeErrorMessage(error) { return boundedText(error instanceof Error ? error.message : String(error)); }
function boundedText(value) {
  let text = String(value ?? "").replace(/[\r\n\t]+/gu, " ");
  for (const secret of inheritedExecutionSecrets) text = text.replaceAll(secret, "[REDACTED]");
  return text
    .replace(/((?:api[_-]?key|token|secret|credential)\s*[:=]\s*)[^ ]+/giu, "$1[REDACTED]")
    .slice(0, 1200);
}
