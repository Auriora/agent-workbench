/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(".");
const script = path.join(repoRoot, "scripts", "ci", "installed-provider-plugin-smoke.mjs");
const packageVersion = (JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
  version: string;
}).version;
let fakeRoot: string;
let fakeBin: string;

beforeAll(() => {
  fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-provider-smoke-test-"));
  fakeBin = path.join(fakeRoot, "bin");
  fs.mkdirSync(fakeBin, { recursive: true });
  for (const name of ["npm", "codex", "claude"]) {
    fs.writeFileSync(path.join(fakeBin, name), fakeProviderCli(name), { mode: 0o755 });
  }
});

afterAll(() => {
  fs.rmSync(fakeRoot, { recursive: true, force: true });
});

describe("installed provider plugin smoke", () => {
  for (const provider of ["codex", "claude"] as const) {
    it(`uses the real ${provider} CLI contract and emits a complete cleanup receipt`, () => {
      const stdout = execFileSync(process.execPath, [
        script,
        "--provider", provider,
        "--expected-version", packageVersion
      ], {
        cwd: repoRoot,
        env: {
          ...process.env,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
          AWB_FAKE_REPO_ROOT: repoRoot
        },
        encoding: "utf8",
        timeout: 60_000
      });
      const receipt = JSON.parse(stdout.slice(stdout.indexOf("{")));
      expect(receipt).toMatchObject({
        ok: true,
        provider,
        expected_version: packageVersion,
        real_agent_cli_executed: true,
        package: {
          name: "@auriora/agent-workbench",
          observed_version: packageVersion
        },
        plugin: { observed_version: packageVersion },
        runtime: {
          observed_version: packageVersion,
          provider_plugin_version: packageVersion,
          provider: provider === "claude" ? "claude_code" : "codex"
        },
        reference: {
          state: "complete",
          occurrence_count: 12
        }
      });
      expect(Object.values(receipt.cleanup)).toEqual(Array(9).fill(true));
      expect(receipt.plugin.artifacts).toEqual(expect.objectContaining({
        manifest: expect.stringContaining("plugin.json"),
        launcher: expect.stringContaining("mcp-launch.mjs"),
        hook: expect.stringContaining("session-start.js"),
        skill: expect.stringContaining("SKILL.md")
      }));
    });
  }

  it("bounds Claude ToolSearch discovery without treating it as evidence", () => {
    expect(runFixture("claude", "provider-discovery").status).toBe(0);
    expect(runFixture("claude", "resource-provider-discovery").status).toBe(0);
    const broad = runFixture("claude", "broad-provider-discovery");
    expect(broad.status).toBe(1);
    expect(broad.stderr).toContain("ToolSearch max_results is bounded from 1 through 50");
  }, 15_000);

  it("bounds direct-tool result diagnostics to kind and top-level shape", () => {
    const result = runFixture("codex", "unexpected-result-shape");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"call_kind":"find_references"');
    expect(result.stderr).toContain('"keys":["mystery"]');
    expect(result.stderr).not.toContain("do-not-leak");
    expect(result.stderr.length).toBeLessThan(1_500);
  });

  it("rejects a forbidden Codex app-server item even when result evidence is valid", () => {
    const result = runFixture("codex", "command-execution");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("forbidden non-workbench item");
  });

  it("fails an incomplete client result while still proving complete cleanup", () => {
    const result = spawnSync(process.execPath, [
      script,
      "--provider", "codex",
      "--expected-version", packageVersion
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        AWB_FAKE_REPO_ROOT: repoRoot,
          AWB_FAKE_SCENARIO: "missing"
      },
      encoding: "utf8",
      timeout: 60_000
    });
    expect(result.status).toBe(1);
    const receipt = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
    expect(receipt).toMatchObject({ ok: false, real_agent_cli_executed: true });
    expect(Object.values(receipt.cleanup)).toEqual(Array(9).fill(true));
  });

  it("does not claim real CLI execution when package installation fails first", () => {
    const result = runFixture("codex", undefined, { AWB_FAKE_INSTALL_FAILURE: "1" });
    expect(result.status).toBe(1);
    const receipt = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
    expect(receipt).toMatchObject({ ok: false, real_agent_cli_executed: false });
    expect(Object.values(receipt.cleanup)).toEqual(Array(9).fill(true));
  });

  it("uses an at-free Codex marketplace link and proves cleanup when add fails", () => {
    const result = runFixture("codex", undefined, { AWB_FAKE_MARKETPLACE_FAILURE: "1" });
    expect(result.status).toBe(1);
    const receipt = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
    expect(receipt).toMatchObject({
      ok: false,
      real_agent_cli_executed: false,
      cleanup: { marketplace_removed: true, temporary_roots_removed: true }
    });
  });

  for (const scenario of [
    "decoy", "unmatched", "duplicate-result", "malformed-response", "rpc-error", "response-extra-key",
    "duplicate", "arbitrary",
    "missing", "extra", "forged-page", "missing-metadata", "resource-extra-key",
    "resource-mismatch", "resource-multiple", "resource-nested",
    "wrong-wrapper-server", "wrong-wrapper-uri", "wrapper-extra-key"
  ]) {
    it(`rejects ${scenario} evidence`, () => {
      const result = runFixture("codex", scenario);
      expect(result.status).toBe(1);
      const receipt = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
      expect(receipt.ok).toBe(false);
      if (scenario === "decoy") {
        expect(receipt.cleanup).toMatchObject({ daemon_stopped: true, socket_removed: true });
      }
    });
  }

  it("rejects Codex discovery that omits the required direct tool", () => {
    const result = runFixture("codex", "unexpected-codex-tool");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("exposes find_references");
  });

  it("bounds unexpected Claude tool-name diagnostics", () => {
    const result = runFixture("claude", "unexpected-claude-tool");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unexpected_fixture_tool");
    expect(result.stderr).not.toContain("do-not-leak");
    expect(result.stderr.length).toBeLessThan(1_500);
  });

  for (const provider of ["codex", "claude"] as const) {
    it(`accepts ${provider} native resource-attributed health`, () => {
      expect(runFixture(provider, "health-resource").status).toBe(0);
    });
  }

  it("does not expose unrelated inherited environment variables to any phase", () => {
    const result = runFixture("claude", undefined, { AWB_SECRET_SENTINEL: "must-not-cross" });
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain("must-not-cross");
  });

  for (const provider of ["codex", "claude"] as const) {
    it(`accepts only an exactly chained ${provider} continuation sequence`, () => {
      const valid = runFixture(provider, "paged");
      expect(valid.status).toBe(0);
      expect(JSON.parse(valid.stdout.slice(valid.stdout.indexOf("{"))).reference).toMatchObject({
        pages: 2,
        callable_continuation_used: true,
        occurrence_count: 12
      });
      expect(runFixture(provider, "bad-cursor").status).toBe(1);
    });
  }

  it("redacts allowlisted execution credentials from client failures", () => {
    const secret = "test-auth-secret-value";
    const result = runFixture("claude", "secret-failure", { ANTHROPIC_API_KEY: secret });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    expect(result.stderr).toContain("[REDACTED]");
  });

  it("terminates an owned non-idling daemon and provider descendants", () => {
    for (const scenario of ["non-idling", "descendant"]) {
      const result = runFixture("codex", scenario);
      expect(result.status).toBe(0);
      const receipt = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
      expect(Object.values(receipt.cleanup)).toEqual(Array(9).fill(true));
    }
  }, 15_000);

  it("terminates the provider process group after timeout or signal", () => {
    const timedOut = runFixture("codex", "timeout", { AWB_FAKE_CLIENT_TIMEOUT_MS: "200" });
    const signalled = runFixture("codex", "signal");
    expect(timedOut.status).toBe(1);
    expect(signalled.status).toBe(1);
    for (const result of [timedOut, signalled]) {
      const receipt = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
      expect(receipt.cleanup.provider_process_closed).toBe(true);
      expect(receipt.cleanup.temporary_roots_removed).toBe(true);
    }
  }, 15_000);
});

function runFixture(provider: "codex" | "claude", scenario?: string, extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script, "--provider", provider, "--expected-version", packageVersion], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
      AWB_FAKE_REPO_ROOT: repoRoot,
      ...(scenario ? { AWB_FAKE_SCENARIO: scenario } : {}),
      ...extraEnv
    },
    encoding: "utf8",
    timeout: 20_000
  });
}

function fakeProviderCli(commandName: string): string {
  return `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";
const command = ${JSON.stringify(commandName)};
const args = process.argv.slice(2);
const repo = process.env.AWB_FAKE_REPO_ROOT;
const version = ${JSON.stringify(packageVersion)};
const exact = (expected) => JSON.stringify(args) === JSON.stringify(expected);
const failArgv = () => { process.stderr.write("unexpected argv: " + JSON.stringify(args)); process.exit(93); };
if (command === "npm") {
  if (args[0] === "pack") {
    if (args.length !== 4 || args[1] !== "--json" || args[2] !== "--pack-destination") failArgv();
    const root = args[args.indexOf("--pack-destination") + 1];
    const filename = "auriora-agent-workbench-" + version + ".tgz";
    fs.writeFileSync(path.join(root, filename), "fixture");
    process.stdout.write(JSON.stringify([{ filename }]) + "\\n");
  } else if (args[0] === "install") {
    if (process.env.AWB_FAKE_INSTALL_FAILURE === "1") { process.stderr.write("fixture install failed"); process.exit(86); }
    if (args.length !== 6 || args[1] !== "--prefix" || args[3] !== "--no-audit" || args[4] !== "--no-fund") failArgv();
    const prefix = args[args.indexOf("--prefix") + 1];
    const target = path.join(prefix, "node_modules", "@auriora", "agent-workbench");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(repo, "plugins"), path.join(target, "plugins"), { recursive: true });
    fs.mkdirSync(path.join(target, "scripts"), { recursive: true });
    fs.copyFileSync(path.join(repo, "scripts", "install-codex-hooks.mjs"), path.join(target, "scripts", "install-codex-hooks.mjs"));
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "@auriora/agent-workbench", version }));
    const pointer = path.join(process.env.HOME, ".local", "share", "agent-workbench", "runtime-root");
    fs.mkdirSync(path.dirname(pointer), { recursive: true });
    fs.writeFileSync(pointer, target + "\\n");
  } else failArgv();
  process.exit(0);
}
if (args[0] === "--version") {
  if (!exact(["--version"])) failArgv();
  process.stdout.write(command === "codex" ? "codex-cli 0.144.6\\n" : "2.1.216 (Claude Code)\\n");
  process.exit(0);
}
const state = command === "codex" ? process.env.CODEX_HOME : process.env.CLAUDE_CONFIG_DIR;
const marker = path.join(state, "marketplace-source");
const cache = path.join(state, "plugins", "cache", "agent-workbench-local", "agent-workbench", version);
if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "add") {
  if (args.length !== 4) failArgv();
  if (command === "codex" && args[3].includes("@")) { process.stderr.write("Codex marketplace path contains ref syntax"); process.exit(87); }
  if (process.env.AWB_FAKE_MARKETPLACE_FAILURE === "1") { process.stderr.write("fixture marketplace add failed"); process.exit(88); }
  fs.mkdirSync(state, { recursive: true }); fs.writeFileSync(marker, args[3]); process.exit(0);
}
if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "remove") {
  if (!exact(["plugin", "marketplace", "remove", "agent-workbench-local"])) failArgv();
  if (!fs.existsSync(marker)) { process.stderr.write("marketplace not registered"); process.exit(89); }
  fs.rmSync(marker, { force: true }); process.exit(0);
}
if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "list") {
  if (!exact(["plugin", "marketplace", "list"])) failArgv();
  if (fs.existsSync(marker)) process.stdout.write("agent-workbench-local " + fs.readFileSync(marker, "utf8") + "\\n");
  process.exit(0);
}
const installing = args[0] === "plugin" && (args[1] === "add" || args[1] === "install");
if (installing) {
  const expected = command === "codex"
    ? ["plugin", "add", "agent-workbench@agent-workbench-local", "--json"]
    : ["plugin", "install", "agent-workbench@agent-workbench-local", "--scope", "user"];
  if (!exact(expected)) failArgv();
  const source = fs.realpathSync(fs.readFileSync(marker, "utf8"));
  const pluginSource = command === "codex" ? source : path.join(source, "claude-plugin");
  fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.cpSync(pluginSource, cache, { recursive: true });
  process.stdout.write(command === "codex" ? JSON.stringify({ installed: "agent-workbench@agent-workbench-local" }) : "installed\\n");
  process.exit(0);
}
const removing = args[0] === "plugin" && (args[1] === "remove" || args[1] === "uninstall");
if (removing) {
  const expected = command === "codex"
    ? ["plugin", "remove", "agent-workbench@agent-workbench-local", "--json"]
    : ["plugin", "uninstall", "agent-workbench@agent-workbench-local", "--scope", "user", "--yes"];
  if (!exact(expected)) failArgv();
  fs.rmSync(path.join(state, "plugins"), { recursive: true, force: true });
  if (command === "codex") process.stdout.write(JSON.stringify({ pluginId: "agent-workbench@agent-workbench-local", name: "agent-workbench", marketplaceName: "agent-workbench-local" }) + "\\n");
  process.exit(0);
}
if (args[0] === "plugin" && args[1] === "list") {
  if (!exact(command === "claude" ? ["plugin", "list", "--json"] : ["plugin", "list"])) failArgv();
  if (fs.existsSync(cache)) process.stdout.write(command === "claude" ? JSON.stringify([{ id: "agent-workbench@agent-workbench-local" }]) : "agent-workbench@agent-workbench-local\\n");
  else if (command === "claude") process.stdout.write("[]\\n");
  process.exit(0);
}
if (args[0] === "plugin" && args[1] === "details") {
  if (!exact(["plugin", "details", "agent-workbench@agent-workbench-local"])) failArgv();
  process.stdout.write("agent-workbench components\\n"); process.exit(0);
}
const isExecution = command === "codex" ? exact(["app-server"]) : args[0] === "-p";
if (!isExecution) failArgv();
if (process.env.AWB_SECRET_SENTINEL) { process.stderr.write(process.env.AWB_SECRET_SENTINEL); process.exit(94); }
if (command === "codex") {
  if (!exact(["app-server"])) failArgv();
} else {
  const allowed = [
    "ToolSearch", "ReadMcpResourceTool",
    "mcp__agent-workbench__integration_health", "mcp__agent-workbench__find_references",
    "mcp__plugin_agent-workbench_agent-workbench__integration_health",
    "mcp__plugin_agent-workbench_agent-workbench__find_references"
  ].join(",");
  if (args.length !== 10 || args.join("|") !== ["-p", "--no-session-persistence", "--output-format", "stream-json", "--verbose", "--allowedTools", allowed, "--permission-mode", "dontAsk", args[9]].join("|")) failArgv();
}
const provider = command === "claude" ? "claude_code" : "codex";
const envelope = (data, meta = {}) => ({ data, meta: { analysis_validity: "valid", truncated: false, ...meta } });
const status = envelope({
  snapshot_id: "fixture-snapshot",
  freshness: "fresh",
  snapshot_validity: { state: "valid", complete: true, missing_paths: [], inaccessible_paths: [] }
});
const socketPath = path.join(process.env.TMPDIR, "agent-workbench-fixture.sock");
fs.writeFileSync(socketPath, "socket");
const metadataDir = path.join(process.cwd(), ".cache", "agent-workbench", "daemon");
fs.mkdirSync(metadataDir, { recursive: true });
const scenario = process.env.AWB_FAKE_SCENARIO;
let daemonPid = process.pid;
if (scenario === "non-idling") {
  const daemon = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "agent-workbench", process.env.AGENT_WORKBENCH_INSTALL_ROOT], { detached: true, stdio: "ignore" });
  daemon.unref(); daemonPid = daemon.pid;
}
if (scenario === "descendant") {
  const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "agent-workbench-descendant"], { stdio: "ignore" });
  descendant.unref();
}
if (scenario !== "missing-metadata") fs.writeFileSync(path.join(metadataDir, "fixture.json"), JSON.stringify({ pid: daemonPid, socketPath }));
const health = envelope({
  runtime_version: version, provider,
  provider_identity: { provider, provenance: "launcher", state: "configured" },
  identities: [{ artifact: "runtime", version }, { artifact: "provider_plugin", version }],
  daemon: { pid: daemonPid, socket_path: socketPath, repo_root: process.cwd() }
});
const oracle = [
  ["catalog/001-codex-session-start.js",3,16], ["catalog/001-codex-session-start.js",7,28],
  ["catalog/001-codex-session-start.js",8,27], ["catalog/001-codex-session-start.js",9,28],
  ["catalog/001-codex-session-start.js",10,26], ["catalog/002-claude-session-start.js",3,16],
  ["catalog/002-claude-session-start.js",7,29], ["catalog/002-claude-session-start.js",8,28],
  ["catalog/002-claude-session-start.js",9,29], ["catalog/101-session-start-consumers.fixture.ts",3,20],
  ["catalog/101-session-start-consumers.fixture.ts",4,20], ["catalog/101-session-start-consumers.fixture.ts",5,20]
];
const refs = oracle.map(([file, line, column]) => ({ source_file_path: file, source_range: { start_line: line, start_column: column }, status: "unresolved" }));
const references = envelope({ references: refs, coverage: { state: "complete", catalog_exhausted: true, complete_matches: 12 } });
if (scenario === "missing") {
  references.data.references.pop();
  references.data.coverage.complete_matches = 11;
}
if (scenario === "duplicate") references.data.references[11] = references.data.references[0];
if (scenario === "arbitrary") references.data.references = refs.map((ref, index) => ({ ...ref, source_range: { start_line: index + 1, start_column: 1 } }));
if (scenario === "extra") { references.data.references.push({ ...references.data.references[0], source_range: { start_line: 99, start_column: 1 } }); references.data.coverage.complete_matches = 13; }
const content = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const resourceContent = (uri, value) => ({ server: "agent-workbench", uri, contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value) }] });
if (command === "codex") {
  if (scenario === "secret-failure") { process.stderr.write("token=" + process.env.OPENAI_API_KEY); process.exit(95); }
  if (scenario === "signal") process.kill(process.pid, "SIGTERM");
  if (scenario === "timeout") setInterval(() => {}, 1000);
  const continuationArgs = {
    symbol: "buildSessionStartContext", max_depth: 1, max_results: 100,
    cursor: scenario === "bad-cursor" ? "wrong-cursor" : "cursor-page-2"
  };
  const firstPage = envelope({
    references: refs.slice(0, 6), cursor: "cursor-page-2",
    coverage: { state: "partial", catalog_exhausted: false },
    next_actions: [{ tool: "find_references", args: continuationArgs, reason: "Continue." }]
  }, { analysis_validity: "partial", truncated: true });
  const lastPage = envelope({ references: refs.slice(6), coverage: { state: "complete", catalog_exhausted: true, complete_matches: 12 }, next_actions: [] });
  const rl = readline.createInterface({ input: process.stdin });
  let toolPage = 0;
  const send = (message) => process.stdout.write(JSON.stringify(message) + "\\n");
  const reply = (request, result) => {
    const id = scenario === "unmatched" && request.id === 0 ? 999 : request.id;
    if (scenario === "malformed-response" && request.id === 0) { process.stdout.write("{malformed\\n"); return; }
    if (scenario === "rpc-error" && request.method === "mcpServerStatus/list") {
      send({ id, error: { code: -32000, message: "fixture RPC failure" } }); return;
    }
    const response = { id, result };
    if (scenario === "response-extra-key" && request.method === "initialize") response.unexpected = true;
    send(response);
    if (scenario === "duplicate-result" && request.id === 0) send(response);
  };
  rl.on("line", (line) => {
    const request = JSON.parse(line);
    if (scenario === "command-execution" && request.id === 0) {
      send({ method: "item/started", params: { item: { type: "commandExecution" } } });
    }
    if (request.method === "initialize") return reply(request, { userAgent: "fixture" });
    if (request.method === "initialized") return;
    if (request.method === "thread/start") {
      if (request.params?.cwd !== process.cwd() || request.params?.ephemeral !== true || request.params?.sandbox !== "read-only") process.exit(92);
      return reply(request, { thread: { id: "fixture-thread" } });
    }
    if (request.method === "mcpServerStatus/list") {
      const tools = scenario === "decoy" || scenario === "unexpected-codex-tool" ? {} : { find_references: { name: "find_references" } };
      return reply(request, { data: [{ name: "agent-workbench", serverInfo: { version }, tools, resources: [], resourceTemplates: [], authStatus: "unsupported" }], nextCursor: null });
    }
    if (request.method === "mcpServer/resource/read") {
      const uri = request.params?.uri;
      const value = uri === "repo:///status" ? status : health;
      const record = { uri, mimeType: "application/json", text: JSON.stringify(value) };
      const result = { contents: [record] };
      if (uri === "repo:///status") {
        if (["resource-mismatch", "wrong-wrapper-uri", "wrong-wrapper-server"].includes(scenario)) record.uri = "repo:///wrong";
        if (scenario === "resource-multiple") result.contents.push({ ...record });
        if (scenario === "resource-nested") record.text = JSON.stringify({ wrapper: value });
        if (scenario === "wrapper-extra-key") record.unexpected = true;
        if (scenario === "resource-extra-key") result.unexpected = true;
      }
      return reply(request, result);
    }
    if (request.method === "mcpServer/tool/call") {
      if (request.params?.server !== "agent-workbench" || request.params?.tool !== "find_references") process.exit(91);
      if (scenario === "unexpected-result-shape") return reply(request, { mystery: "do-not-leak" });
      if (scenario === "forged-page") {
        const partial = envelope({ references: refs.slice(0, 11), cursor: "next-page", coverage: { state: "partial", catalog_exhausted: false }, next_actions: [] }, { analysis_validity: "partial", truncated: true });
        return reply(request, content(partial));
      }
      if (scenario === "paged" || scenario === "bad-cursor") return reply(request, content(toolPage++ === 0 ? firstPage : lastPage));
      return reply(request, content(references));
    }
    process.exit(90);
  });
}
if (command !== "codex") {
  let events;
  const uses = [
    { type: "tool_use", id: "health-1", name: "mcp__plugin_agent-workbench_agent-workbench__integration_health", input: {} },
    { type: "tool_use", id: "status-1", name: "ReadMcpResourceTool", input: { server: "agent-workbench", uri: "repo:///status" } },
    { type: "tool_use", id: "refs-1", name: "mcp__plugin_agent-workbench_agent-workbench__find_references", input: { symbol: "buildSessionStartContext", max_depth: 1, max_results: 100 } }
  ];
  const results = [
    { type: "tool_result", tool_use_id: "health-1", content: [{ type: "text", text: JSON.stringify(health) }] },
    { type: "tool_result", tool_use_id: "status-1", content: [{ type: "text", text: JSON.stringify(resourceContent("repo:///status", status)) }] },
    { type: "tool_result", tool_use_id: "refs-1", content: [{ type: "text", text: JSON.stringify(references) }] }
  ];
  events = [{ type: "assistant", message: { content: uses } }, { type: "user", message: { content: results } }];
if (["provider-discovery", "resource-provider-discovery", "broad-provider-discovery"].includes(scenario)) {
  uses.unshift({
    type: "tool_use",
    id: "discovery-1",
    name: "ToolSearch",
    input: {
      query: scenario === "provider-discovery"
        ? "select:mcp__agent-workbench__find_references"
        : scenario === "resource-provider-discovery"
          ? "read MCP resource list resources"
          : "select:Bash",
      max_results: scenario === "broad-provider-discovery" ? 51 : 5
    }
  });
  results.unshift({ type: "tool_result", tool_use_id: "discovery-1", content: [{ type: "text", text: "tool loaded" }] });
}
if (scenario === "decoy") events = [{ type: "assistant", message: { content: [{ type: "text", text: JSON.stringify(references) }] } }];
if (scenario === "unmatched") {
  if (command === "codex") events.find((event) => event.type === "item.completed").item.id = "wrong-id";
  else events[1].message.content[0].tool_use_id = "wrong-id";
}
if (scenario === "resource-extra-key" && command === "codex") {
  for (const event of events.filter((entry) => entry.item?.id === "status-1")) {
    event.item.arguments = { uri: "repo:///status", unexpected: true };
  }
}
if (scenario === "resource-diagnostic" && command === "codex") {
  for (const event of events.filter((entry) => entry.item?.id === "status-1")) {
    event.item.arguments = { uri: "repo:///wrong", server: "agent-workbench", ignored: "do-not-leak" };
  }
}
if (scenario === "unexpected-codex-tool" && command === "codex") {
  for (const event of events.filter((entry) => entry.item?.id === "refs-1")) {
    event.item.tool = "unexpected_fixture_tool";
    event.item.arguments = { secret: "do-not-leak" };
  }
}
if (scenario === "unexpected-result-shape" && command === "codex") {
  events.find((entry) => entry.type === "item.completed" && entry.item?.id === "refs-1").item.result = { mystery: "do-not-leak" };
}
if (scenario === "unexpected-claude-tool" && command === "claude") {
  const use = events[0].message.content.find((block) => block.id === "refs-1");
  use.name = "unexpected_fixture_tool";
  use.input = { secret: "do-not-leak" };
}
if ((scenario === "health-resource" || scenario === "unknown-health-resource") && command === "codex") {
  const uri = scenario === "health-resource" ? "integration:///health/agent-workbench" : "integration:///health/unknown";
  for (const event of events.filter((entry) => entry.item?.id === "health-1")) {
    event.item.tool = "read_mcp_resource";
    event.item.arguments = { server: "agent-workbench", uri };
    if (event.type === "item.completed") event.item.result = resourceContent(uri, health);
  }
}
if (scenario === "health-resource" && command === "claude") {
  const use = events[0].message.content.find((block) => block.id === "health-1");
  use.name = "ReadMcpResourceTool";
  use.input = { server: "agent-workbench", uri: "integration:///health/agent-workbench" };
  events[1].message.content.find((block) => block.tool_use_id === "health-1").content = [{ type: "text", text: JSON.stringify(resourceContent("integration:///health/agent-workbench", health)) }];
}
if (["resource-mismatch", "resource-multiple", "resource-nested"].includes(scenario) && command === "codex") {
  const completed = events.find((entry) => entry.type === "item.completed" && entry.item?.id === "status-1");
  if (scenario === "resource-mismatch") completed.item.result = resourceContent("repo:///wrong", status);
  if (scenario === "resource-multiple") {
    completed.item.result = resourceContent("repo:///status", status);
    completed.item.result.contents.push(...resourceContent("repo:///status", status).contents);
  }
  if (scenario === "resource-nested") completed.item.result = resourceContent("repo:///status", { wrapper: status });
}
if (["wrong-wrapper-server", "wrong-wrapper-uri", "wrapper-extra-key"].includes(scenario) && command === "codex") {
  const completed = events.find((entry) => entry.type === "item.completed" && entry.item?.id === "status-1");
  if (scenario === "wrong-wrapper-server") completed.item.result.server = "other-server";
  if (scenario === "wrong-wrapper-uri") completed.item.result.uri = "repo:///wrong";
  if (scenario === "wrapper-extra-key") completed.item.result.unexpected = true;
}
if (scenario === "duplicate-result") {
  if (command === "codex") events.push(events.find((event) => event.type === "item.completed" && event.item.id === "refs-1"));
  else events[1].message.content.push(events[1].message.content[2]);
}
if (scenario === "forged-page") {
  const partial = envelope({ references: refs.slice(0, 11), cursor: "next-page", coverage: { state: "partial", catalog_exhausted: false } }, { analysis_validity: "partial", truncated: true });
  if (command === "codex") events.find((event) => event.type === "item.completed" && event.item.id === "refs-1").item.result = content(partial);
  else events[1].message.content[2].content = [{ type: "text", text: JSON.stringify(partial) }];
  events.push({ type: "assistant", message: { content: [{ type: "text", text: JSON.stringify(envelope({ references: refs, coverage: { state: "complete", catalog_exhausted: true, complete_matches: 12 } })) }] } });
}
if (scenario === "paged" || scenario === "bad-cursor") {
  const firstPage = envelope({
    references: refs.slice(0, 6), cursor: "cursor-page-2", coverage: { state: "partial", catalog_exhausted: false },
    next_actions: [{
      tool: "find_references",
      args: { symbol: "buildSessionStartContext", max_depth: 1, max_results: 100, cursor: scenario === "bad-cursor" ? "wrong-cursor" : "cursor-page-2" },
      reason: "Continue."
    }]
  }, { analysis_validity: "partial", truncated: true });
  const lastPage = envelope({ references: refs.slice(6), coverage: { state: "complete", catalog_exhausted: true, complete_matches: 12 } });
  const cursor = scenario === "bad-cursor" ? "wrong-cursor" : "cursor-page-2";
  if (command === "codex") {
    events.find((event) => event.type === "item.completed" && event.item.id === "refs-1").item.result = content(firstPage);
    const input = { symbol: "buildSessionStartContext", max_depth: 1, max_results: 100, cursor };
    events.push(
      { type: "item.started", item: { id: "refs-2", type: "mcp_tool_call", server: "agent-workbench", tool: "find_references", arguments: input } },
      { type: "item.completed", item: { id: "refs-2", type: "mcp_tool_call", server: "agent-workbench", tool: "find_references", arguments: input, result: content(lastPage) } }
    );
  } else {
    events[1].message.content[2].content = [{ type: "text", text: JSON.stringify(firstPage) }];
    events.push(
      { type: "assistant", message: { content: [{ type: "tool_use", id: "refs-2", name: "mcp__plugin_agent-workbench_agent-workbench__find_references", input: { symbol: "buildSessionStartContext", max_depth: 1, max_results: 100, cursor } }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "refs-2", content: [{ type: "text", text: JSON.stringify(lastPage) }] }] } }
    );
  }
}
if (scenario === "command-execution" && command === "codex") {
  events.unshift({ type: "item.started", item: { id: "forbidden-1", type: "command_execution", command: "rg buildSessionStartContext" } });
}
if (scenario === "secret-failure") { process.stderr.write("token=" + process.env.ANTHROPIC_API_KEY); process.exit(95); }
if (scenario === "timeout") setInterval(() => {}, 1000);
if (scenario === "signal") process.kill(process.pid, "SIGTERM");
for (const event of events) process.stdout.write(JSON.stringify(event) + "\\n");
}
`;
}
