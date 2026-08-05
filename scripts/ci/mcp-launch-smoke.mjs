#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Cross-platform MCP launch smoke (spec 033). Launches the portable plugin shim
// (plugins/agent-workbench/mcp-launch.mjs) against this checkout as the runtime
// root and asserts a JSON-RPC initialize handshake over stdio — proving the
// shell-free shim -> entrypoint -> server path starts on this OS.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const TIMEOUT_MS = 60_000;
const checkoutRootFromScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

function fail(message) {
  process.stderr.write(`mcp-launch-smoke FAIL: ${message}\n`);
  process.exit(1);
}

export function buildMcpLaunchSmokePlan({ checkoutRoot, workspaceRoot }) {
  const launcher = path.join(checkoutRoot, "plugins", "agent-workbench", "mcp-launch.mjs");
  const env = { ...process.env };
  delete env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT;

  return {
    child: {
      command: process.execPath,
      args: [launcher],
      options: {
        cwd: workspaceRoot,
        env: { ...env, AGENT_WORKBENCH_INSTALL_ROOT: checkoutRoot },
        stdio: ["pipe", "pipe", "inherit"]
      }
    }
  };
}

export async function runMcpLaunchSmoke({ checkoutRoot = checkoutRootFromScript } = {}) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-mcp-launch-smoke-"));
  const { child: plan } = buildMcpLaunchSmokePlan({ checkoutRoot, workspaceRoot });
  const child = spawn(plan.command, plan.args, plan.options);

  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          child.kill();
          reject(new Error(`no initialize response within ${TIMEOUT_MS}ms`));
        }
      }, TIMEOUT_MS);

      child.on("error", (err) => reject(new Error(`failed to spawn launcher: ${err.message}`)));
      child.on("exit", (code, signal) => {
        if (!settled) {
          reject(new Error(`launcher exited early (code=${code}, signal=${signal})`));
        }
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
            child.kill();
            resolve(message.result.serverInfo.name);
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
    });
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  runMcpLaunchSmoke()
    .then((serverName) => {
      process.stdout.write(`mcp-launch-smoke OK on ${process.platform}: ${serverName}\n`);
      process.exit(0);
    })
    .catch((err) => {
      fail(err.message);
    });
}
