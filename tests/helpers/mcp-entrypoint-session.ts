/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type McpMessage = {
  id?: number;
  result?: {
    content?: Array<{ text: string }>;
    contents?: Array<{ text: string }>;
  };
  error?: unknown;
};

export type EntryPointSession = {
  child: ChildProcessWithoutNullStreams;
  stderr: () => string;
  stdoutRemainder: () => string;
  call: (method: string, params?: Record<string, unknown>, timeoutMs?: number) => Promise<McpMessage>;
  notify: (method: string, params?: Record<string, unknown>) => void;
  close: () => Promise<void>;
};

export async function startEntryPointSession(
  repoRoot: string,
  options: {
    idleGraceMs?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<EntryPointSession> {
  const child = spawn(process.execPath, [
    "src/mcp/stdio-entrypoint.mjs",
    "--repo-root",
    repoRoot
  ], {
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...options.env,
      AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS: String(options.idleGraceMs ?? 150)
    }
  });
  let stdout = "";
  let stderr = "";
  let nextId = 1;
  const pending = new Map<number, {
    resolve: (message: McpMessage) => void;
    reject: (error: Error) => void;
  }>();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const parsed = JSON.parse(line) as McpMessage;
      if (typeof parsed.id !== "number") {
        continue;
      }
      const waiter = pending.get(parsed.id);
      if (waiter !== undefined) {
        pending.delete(parsed.id);
        waiter.resolve(parsed);
      }
    }
  });

  return {
    child,
    stderr: () => stderr,
    stdoutRemainder: () => stdout,
    call(method: string, params: Record<string, unknown> = {}, timeoutMs = 6000) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for ${method} id=${id}: stderr=${stderr}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (message) => {
            clearTimeout(timeout);
            resolve(message);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });
        child.stdin.write(`${JSON.stringify({
          jsonrpc: "2.0",
          id,
          method,
          params
        })}\n`);
      });
    },
    notify(method: string, params: Record<string, unknown> = {}) {
      child.stdin.write(`${JSON.stringify({
        jsonrpc: "2.0",
        method,
        params
      })}\n`);
    },
    async close() {
      for (const waiter of pending.values()) {
        waiter.reject(new Error("MCP entrypoint session closed before response."));
      }
      pending.clear();
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 1000);
        child.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };
}

export async function initializeSession(session: EntryPointSession): Promise<void> {
  await session.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "agent-workbench-entrypoint-test",
      version: "0.1.0"
    }
  }, 15_000);
  session.notify("notifications/initialized", {});
}

export function parseEnvelope(message: McpMessage): unknown {
  const text = message.result?.content?.[0]?.text ?? message.result?.contents?.[0]?.text;
  if (text === undefined) {
    throw new Error(`MCP response did not contain a JSON envelope: ${JSON.stringify(message)}`);
  }
  return JSON.parse(text);
}
