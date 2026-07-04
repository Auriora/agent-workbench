#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Cross-platform MCP launch smoke (spec 033). Launches the portable plugin shim
// (plugins/agent-workbench/mcp-launch.mjs) against this checkout as the runtime
// root and asserts a JSON-RPC initialize handshake over stdio — proving the
// shell-free shim -> entrypoint -> server path starts on this OS.
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const launcher = path.join(repoRoot, "plugins", "agent-workbench", "mcp-launch.mjs");
const TIMEOUT_MS = 60_000;

function fail(message) {
  process.stderr.write(`mcp-launch-smoke FAIL: ${message}\n`);
  process.exit(1);
}

const child = spawn(process.execPath, [launcher], {
  cwd: repoRoot,
  env: { ...process.env, AGENT_WORKBENCH_INSTALL_ROOT: repoRoot },
  stdio: ["pipe", "pipe", "inherit"]
});

let settled = false;
const timer = setTimeout(() => {
  if (!settled) {
    child.kill();
    fail(`no initialize response within ${TIMEOUT_MS}ms`);
  }
}, TIMEOUT_MS);

child.on("error", (err) => fail(`failed to spawn launcher: ${err.message}`));
child.on("exit", (code, signal) => {
  if (!settled) fail(`launcher exited early (code=${code}, signal=${signal})`);
});

let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue; // tolerate non-JSON banner lines
    }
    if (message.id === 1 && message.result && message.result.serverInfo) {
      settled = true;
      clearTimeout(timer);
      process.stdout.write(
        `mcp-launch-smoke OK on ${process.platform}: ${message.result.serverInfo.name}\n`
      );
      child.kill();
      process.exit(0);
    }
  }
});

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "agent-workbench-ci-smoke", version: "0" }
  }
};
child.stdin.write(`${JSON.stringify(initialize)}\n`);
