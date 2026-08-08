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
const DAEMON_SHUTDOWN_TIMEOUT_MS = 10_000;
const checkoutRootFromScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

function fail(message) {
  process.stderr.write(`mcp-launch-smoke FAIL: ${message}\n`);
  process.exit(1);
}

export function buildMcpLaunchSmokePlan({
  checkoutRoot,
  workspaceRoot,
  nodeExecutable = process.execPath,
  baseEnv = process.env,
  launcherRelativePath = path.join("plugins", "agent-workbench", "mcp-launch.mjs")
}) {
  const launcher = path.join(checkoutRoot, launcherRelativePath);
  const env = { ...baseEnv };
  delete env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT;

  return {
    child: {
      command: nodeExecutable,
      args: [launcher],
      options: {
        cwd: workspaceRoot,
        env: {
          ...env,
          AGENT_WORKBENCH_INSTALL_ROOT: checkoutRoot,
          AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS: "250",
          AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: "60000"
        },
        stdio: /** @type {import("node:child_process").StdioOptions} */ (["pipe", "pipe", "inherit"])
      }
    }
  };
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw new Error(`cannot verify daemon process ${pid}: ${error?.message ?? String(error)}`);
  }
}

export async function waitForDaemonExit(pid, timeoutMs = DAEMON_SHUTDOWN_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (isProcessAlive(pid)) {
    if (Date.now() >= deadline) {
      throw new Error(`daemon process ${pid} did not stop within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function readDaemonPid(message, workspaceRoot) {
  const text = message?.result?.contents?.[0]?.text;
  const envelope = typeof text === "string" ? JSON.parse(text) : undefined;
  const daemon = envelope?.data?.daemon;
  if (!Number.isInteger(daemon?.pid) || daemon.pid <= 1) {
    throw new Error("integration health did not identify the launched daemon process");
  }
  if (fs.realpathSync.native(daemon.repo_root) !== fs.realpathSync.native(workspaceRoot)) {
    throw new Error("integration health daemon repository did not match the smoke workspace");
  }
  return daemon.pid;
}

export async function terminateChildForCleanup(child) {
  await new Promise((resolve, reject) => {
    const onClose = () => {
      child.off("error", onError);
      resolve();
    };
    const onError = (err) => {
      child.off("close", onClose);
      reject(new Error(`failed to terminate launcher: ${err.message}`));
    };

    child.once("close", onClose);
    child.once("error", onError);
    if (child.exitCode === null && child.signalCode === null && !child.kill()) {
      child.off("close", onClose);
      child.off("error", onError);
      reject(new Error("failed to terminate launcher"));
    }
  });
}

export async function runMcpLaunchSmoke({
  checkoutRoot = checkoutRootFromScript,
  nodeExecutable = process.execPath,
  baseEnv = process.env,
  launcherRelativePath = path.join("plugins", "agent-workbench", "mcp-launch.mjs"),
  terminateChild = terminateChildForCleanup
} = {}) {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-mcp-launch-smoke-"));
  const { child: plan } = buildMcpLaunchSmokePlan({
    checkoutRoot,
    workspaceRoot,
    nodeExecutable,
    baseEnv,
    launcherRelativePath
  });
  const child = spawn(plan.command, plan.args, plan.options);

  try {
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      let serverName;
      const failAfterChildClose = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void terminateChild(child).then(() => reject(error), reject);
      };
      const timer = setTimeout(() => {
        failAfterChildClose(new Error(`MCP launch smoke did not complete within ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);

      child.on("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`failed to spawn launcher: ${err.message}`));
        }
      });
      child.on("exit", (code, signal) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
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
              params: { uri: "integration:///health/agent-workbench" }
            })}\n`);
          }
          if (message.id === 2 && message.result) {
            try {
              const daemonPid = readDaemonPid(message, workspaceRoot);
              settled = true;
              clearTimeout(timer);
              void terminateChild(child).then(
                () => resolve({ serverName, daemonPid }),
                reject
              );
            } catch (error) {
              failAfterChildClose(error instanceof Error ? error : new Error(String(error)));
            }
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
    await waitForDaemonExit(result.daemonPid);
    return result.serverName;
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
