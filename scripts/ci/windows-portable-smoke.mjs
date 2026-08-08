#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashPayload, PAYLOAD_HASH_EXCLUSIONS } from "./build-windows-portable.mjs";
import { runMcpLaunchSmoke } from "./mcp-launch-smoke.mjs";

const PORTABLE_STATUS_SMOKE_TIMEOUT_MS = 60_000;

export function parsePortableSmokeArgs(argv) {
  const result = { bundleRoot: "", expectedVersion: "", gitSha: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1] ?? "";
    if (argument === "--bundle-root") result.bundleRoot = value;
    else if (argument === "--expected-version") result.expectedVersion = value;
    else if (argument === "--git-sha") result.gitSha = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!result.bundleRoot) throw new Error("--bundle-root is required");
  if (!/^\d+\.\d+\.\d+$/.test(result.expectedVersion)) throw new Error("--expected-version must be X.Y.Z");
  if (!/^[0-9a-f]{40}$/i.test(result.gitSha)) throw new Error("--git-sha must be a full Git commit SHA");
  return result;
}

export function validatePortableManifest(manifest, { expectedVersion, gitSha }) {
  const expected = {
    schema_version: "1",
    package: "@auriora/agent-workbench",
    version: expectedVersion,
    git_sha: gitSha,
    platform: "win32",
    architecture: "x64",
    package_root: "runtime/node_modules/@auriora/agent-workbench",
    entrypoint: "agent-workbench.cmd",
    configure: "configure.cmd"
  };
  for (const [key, value] of Object.entries(expected)) {
    if (manifest?.[key] !== value) {
      throw new Error(`manifest ${key} is ${JSON.stringify(manifest?.[key])}, expected ${JSON.stringify(value)}`);
    }
  }
  if (!/^22\./.test(manifest.node_version ?? "")) throw new Error("manifest Node version is not Node 22");
  for (const key of ["source_package_sha256", "source_lock_sha256", "deployment_lock_sha256", "payload_sha256"]) {
    if (!/^[0-9a-f]{64}$/.test(manifest[key] ?? "")) throw new Error(`manifest ${key} is not SHA-256`);
  }
  if (JSON.stringify(manifest.payload_hash_exclusions) !== JSON.stringify(PAYLOAD_HASH_EXCLUSIONS)) {
    throw new Error("manifest payload hash exclusions do not match the portable configuration contract");
  }
  return expected;
}

export async function runWindowsPortableSmoke({ bundleRoot, expectedVersion, gitSha }) {
  if (process.platform !== "win32") throw new Error(`Windows portable smoke requires win32, got ${process.platform}`);
  const root = path.resolve(bundleRoot);
  const nodeExecutable = path.join(root, "node.exe");
  const packageRoot = path.join(root, "runtime", "node_modules", "@auriora", "agent-workbench");
  const manifestPath = path.join(root, "manifest.json");
  for (const requiredPath of [nodeExecutable, packageRoot, manifestPath, path.join(root, "configure.cmd")]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`Portable artifact is missing ${requiredPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validatePortableManifest(manifest, { expectedVersion, gitSha });
  if (hashPayload(root, manifest.payload_hash_exclusions) !== manifest.payload_sha256) {
    throw new Error("Portable payload SHA-256 does not match manifest");
  }

  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-windows-portable-state-"));
  try {
    const constrainedEnv = portableEnvironment(root, stateRoot);
    fs.mkdirSync(constrainedEnv.TEMP, { recursive: true });
    const nodeIdentity = spawnSync(
      nodeExecutable,
      ["-p", "JSON.stringify({version:process.versions.node,modules:process.versions.modules})"],
      { env: constrainedEnv, encoding: "utf8" }
    );
    assertSuccess(nodeIdentity, "bundled Node identity");
    const observedNode = JSON.parse(nodeIdentity.stdout);
    if (observedNode.version !== manifest.node_version || observedNode.modules !== manifest.node_modules_abi) {
      throw new Error("Bundled Node identity does not match manifest");
    }
    const configurePlan = buildWindowsCmdInvocation(`"${path.join(root, "configure.cmd")}"`, {
      cwd: root,
      env: constrainedEnv,
      encoding: "utf8"
    });
    const configured = spawnSync(configurePlan.command, configurePlan.args, configurePlan.options);
    assertSuccess(configured, "configure.cmd");
    assertMaterializedConfiguration(packageRoot, nodeExecutable, stateRoot);
    if (hashPayload(root, manifest.payload_hash_exclusions) !== manifest.payload_sha256) {
      throw new Error("Portable immutable payload changed during configuration");
    }
    assertNativeLoads(nodeExecutable, packageRoot, constrainedEnv);
    assertInstalledCodexHookRuns(stateRoot, constrainedEnv);
    const bundledEntrypointWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-windows-portable-workspace-"));
    let bundledEntrypointServerName;
    try {
      bundledEntrypointServerName = await runBundledEntrypointStatusSmoke({
        bundleRoot: root,
        workspaceRoot: bundledEntrypointWorkspaceRoot,
        env: constrainedEnv
      });
    } finally {
      fs.rmSync(bundledEntrypointWorkspaceRoot, { recursive: true, force: true });
    }
    const serverName = await runMcpLaunchSmoke({
      checkoutRoot: packageRoot,
      nodeExecutable,
      baseEnv: constrainedEnv,
      terminateChild: terminateWindowsProcessTree
    });
    const claudeServerName = await runMcpLaunchSmoke({
      checkoutRoot: packageRoot,
      nodeExecutable,
      baseEnv: constrainedEnv,
      launcherRelativePath: path.join("plugins", "agent-workbench", "claude-plugin", "mcp-launch.mjs"),
      terminateChild: terminateWindowsProcessTree
    });
    if (claudeServerName !== serverName) {
      throw new Error("Claude portable launcher server identity does not match Codex");
    }
    if (bundledEntrypointServerName !== serverName) {
      throw new Error("Bundled entrypoint server identity does not match the packaged launcher smoke");
    }
    return { version: expectedVersion, node_version: manifest.node_version, server_name: serverName };
  } finally {
    fs.rmSync(stateRoot, { recursive: true, force: true });
  }
}

export function buildBundledEntrypointStatusSmokePlan({ bundleRoot, workspaceRoot, env }) {
  return {
    child: buildWindowsCmdInvocation(`"${path.win32.join(bundleRoot, "agent-workbench.cmd")}"`, {
      cwd: workspaceRoot,
      env,
      stdio: /** @type {import("node:child_process").StdioOptions} */ (["pipe", "pipe", "pipe"])
    })
  };
}

export function buildWindowsCmdInvocation(command, options) {
  return {
    command: options.env.COMSPEC,
    args: ["/d", "/s", "/c", command],
    options: {
      ...options,
      windowsVerbatimArguments: true
    }
  };
}

function portableEnvironment(bundleRoot, stateRoot) {
  const systemRoot = process.env.SYSTEMROOT ?? process.env.WINDIR;
  const comspec = process.env.COMSPEC ?? (systemRoot ? path.join(systemRoot, "System32", "cmd.exe") : "");
  if (!systemRoot || !comspec) throw new Error("Windows SYSTEMROOT and COMSPEC are required");
  return {
    PATH: `${bundleRoot};${path.join(systemRoot, "System32")}`,
    SYSTEMROOT: systemRoot,
    WINDIR: systemRoot,
    COMSPEC: comspec,
    PATHEXT: process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD",
    HOME: stateRoot,
    USERPROFILE: stateRoot,
    LOCALAPPDATA: path.join(stateRoot, "AppData", "Local"),
    TEMP: path.join(stateRoot, "Temp"),
    TMP: path.join(stateRoot, "Temp"),
    CODEX_HOME: path.join(stateRoot, ".codex"),
    AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS: "250",
    AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: "60000"
  };
}

export function validateRepoStatusReadMessage(message, workspaceRoot) {
  const contents = message?.result?.contents;
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error("repo:///status did not return contents");
  }
  const content = contents[0];
  if (content?.uri !== "repo:///status") {
    throw new Error("repo:///status response did not preserve the expected URI");
  }
  if (typeof content?.text !== "string") {
    throw new Error("repo:///status did not return JSON text");
  }
  const envelope = JSON.parse(content.text);
  if (fs.realpathSync.native(envelope?.data?.repo_root) !== fs.realpathSync.native(workspaceRoot)) {
    throw new Error("repo:///status repo_root did not match the bundled entrypoint workspace");
  }
  if (typeof envelope?.data?.runtime_state !== "string" || typeof envelope?.data?.freshness !== "string") {
    throw new Error("repo:///status did not return runtime_state and freshness");
  }
  return envelope;
}

function assertMaterializedConfiguration(packageRoot, nodeExecutable, stateRoot) {
  const codex = readJson(path.join(packageRoot, "plugins", "agent-workbench", ".mcp.json"));
  const claude = readJson(path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", ".mcp.json"));
  const claudeHooks = readJson(path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "hooks.json"));
  if (codex.mcpServers?.["agent-workbench"]?.command !== nodeExecutable) throw new Error("Codex MCP command is not bundled node.exe");
  if (claude.mcpServers?.["agent-workbench"]?.command !== nodeExecutable) throw new Error("Claude MCP command is not bundled node.exe");
  for (const groups of Object.values(claudeHooks.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        if (hook.command !== nodeExecutable) throw new Error("Claude hook command is not bundled node.exe");
      }
    }
  }
  const codexHooksText = fs.readFileSync(path.join(stateRoot, ".codex", "hooks.json"), "utf8");
  if (!codexHooksText.includes(nodeExecutable)) throw new Error("Codex hooks do not use bundled node.exe");
}

function assertNativeLoads(nodeExecutable, packageRoot, env) {
  const code = [
    'const { createRequire } = require("node:module");',
    'const path = require("node:path");',
    'const load = createRequire(path.join(process.argv[1], "package.json"));',
    'for (const name of ["tree-sitter", "tree-sitter-go", "tree-sitter-javascript", "tree-sitter-python", "tree-sitter-ruby", "tree-sitter-typescript"]) load(name);',
    'const Database = load("better-sqlite3");',
    'const db = new Database(":memory:"); db.prepare("select 1").get(); db.close();'
  ].join("\n");
  assertSuccess(spawnSync(nodeExecutable, ["-e", code, packageRoot], { env, encoding: "utf8" }), "native loads");
}

function assertInstalledCodexHookRuns(stateRoot, env) {
  const config = readJson(path.join(stateRoot, ".codex", "hooks.json"));
  const commandWindows = config.hooks?.SessionStart?.[0]?.hooks?.[0]?.commandWindows;
  if (typeof commandWindows !== "string" || commandWindows.trim() === "") {
    throw new Error("Installed Codex SessionStart hook is missing commandWindows");
  }
  const hookPlan = buildWindowsCmdInvocation(commandWindows, {
    env,
    input: JSON.stringify({ hook_event_name: "SessionStart" }),
    encoding: "utf8"
  });
  const result = spawnSync(hookPlan.command, hookPlan.args, hookPlan.options);
  assertSuccess(result, "installed Codex SessionStart hook");
  if (!result.stdout.includes("invoke the packaged Agent Workbench skill")) {
    throw new Error("SessionStart hook did not emit the expected conditional skill pointer");
  }
}

async function runBundledEntrypointStatusSmoke({ bundleRoot, workspaceRoot, env }) {
  const { child: plan } = buildBundledEntrypointStatusSmokePlan({
    bundleRoot,
    workspaceRoot,
    env
  });
  const child = spawn(plan.command, plan.args, plan.options);
  return (await readPortableStatusHandshake({
    child,
    workspaceRoot
  })).serverName;
}

async function readPortableStatusHandshake({ child, workspaceRoot }) {
  return await new Promise((resolve, reject) => {
    let settled = false;
    let serverName;
    let stderr = "";
    let stdoutBuffer = "";
    const timer = setTimeout(() => {
      failAfterChildClose(new Error(`Bundled entrypoint smoke did not complete within ${PORTABLE_STATUS_SMOKE_TIMEOUT_MS}ms`));
    }, PORTABLE_STATUS_SMOKE_TIMEOUT_MS);

    const failAfterChildClose = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void terminatePortableChild(child).then(
        () => reject(attachPortableStderr(error, stderr)),
        reject
      );
    };

    child.on("error", (error) => {
      failAfterChildClose(new Error(`failed to spawn bundled entrypoint: ${error.message}`));
    });
    child.on("exit", (code, signal) => {
      if (!settled) {
        failAfterChildClose(new Error(`bundled entrypoint exited early (code=${code}, signal=${signal})`));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 8192) stderr = stderr.slice(-8192);
    });
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      let newline;
      while ((newline = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id === 1 && message.result?.serverInfo) {
          serverName = message.result.serverInfo.name;
          child.stdin.write(`${JSON.stringify({
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {}
          })}\n`);
          child.stdin.write(`${JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "resources/read",
            params: { uri: "repo:///status" }
          })}\n`);
        }
        if (message.id === 2 && message.result) {
          try {
            validateRepoStatusReadMessage(message, workspaceRoot);
            settled = true;
            clearTimeout(timer);
            void terminatePortableChild(child).then(
              () => resolve({ serverName }),
              reject
            );
          } catch (error) {
            failAfterChildClose(error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    });

    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "agent-workbench-windows-portable-smoke", version: "0" }
      }
    })}\n`);
  });
}

async function terminatePortableChild(child) {
  return terminateWindowsProcessTree(child);
}

export async function terminateWindowsProcessTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (!Number.isInteger(child.pid) || child.pid <= 1) {
    throw new Error("cannot terminate Windows launcher process tree without a valid PID");
  }
  const result = spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true
  });
  if (result.error) {
    throw new Error(`failed to terminate Windows launcher process tree: ${result.error.message}`);
  }
  if (result.status !== 0 && child.exitCode === null && child.signalCode === null) {
    throw new Error(
      `taskkill failed for Windows launcher process tree (${result.status}): ${result.stdout}\n${result.stderr}`
    );
  }
  await new Promise((resolve, reject) => {
    const onClose = () => {
      child.off("error", onError);
      resolve();
    };
    const onError = (error) => {
      child.off("close", onClose);
      reject(new Error(`failed to terminate bundled entrypoint: ${error.message}`));
    };

    child.once("close", onClose);
    child.once("error", onError);
    if (child.exitCode !== null || child.signalCode !== null) onClose();
  });
}

function attachPortableStderr(error, stderr) {
  if (!stderr.trim()) return error;
  return new Error(`${error.message}\nstderr:\n${stderr.trimEnd()}`);
}

function assertSuccess(result, label) {
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} exited ${result.status}:\n${result.stdout}\n${result.stderr}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runWindowsPortableSmoke(parsePortableSmokeArgs(process.argv.slice(2)))
    .then((receipt) => process.stdout.write(`windows-portable-smoke OK ${JSON.stringify(receipt)}\n`))
    .catch((error) => {
      process.stderr.write(`windows-portable-smoke FAIL: ${error.message}\n`);
      process.exitCode = 1;
    });
}
