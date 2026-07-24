/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createDaemonIdentity, daemonPaths } from "../../src/mcp/daemon.js";

const ENTRYPOINT_SHUTDOWN_TIMEOUT_MS = 1_000;
const STDERR_CAPTURE_BYTES = 4096;
const CLOSE_RETRIES = 25;

type PendingCall = {
  resolve: (message: McpMessage) => void;
  reject: (error: Error) => void;
};

export type McpMessage = {
  id?: number;
  result?: {
    content?: Array<{ text: string }>;
    contents?: Array<{ text: string }>;
  };
  error?: unknown;
};

export type EntryPointSession = {
  repoRoot: string;
  child: ChildProcessWithoutNullStreams;
  stderr: () => string;
  stdoutRemainder: () => string;
  call: (method: string, params?: Record<string, unknown>, timeoutMs?: number) => Promise<McpMessage>;
  notify: (method: string, params?: Record<string, unknown>) => void;
  close: () => Promise<void>;
};

/**
 * Starts the checkout/source entrypoint at `src/mcp/stdio-entrypoint.mjs`.
 * This helper does not exercise an installed package bin or a real agent CLI.
 */
export async function startEntryPointSession(
  repoRoot: string,
  options: {
    idleGraceMs?: number;
    startupRefreshDelayMs?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<EntryPointSession> {
  const normalizedRepoRoot = path.resolve(repoRoot);
  const child = spawn(process.execPath, [
    "src/mcp/stdio-entrypoint.mjs",
    "--repo-root",
    normalizedRepoRoot
  ], {
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...options.env,
      // Keep ordinary integration cases isolated from the next fixture. Tests
      // that exercise reconnect/idle semantics opt into their required grace.
      AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS: String(options.idleGraceMs ?? 250),
      AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: String(
        options.startupRefreshDelayMs ?? 60_000
      )
    }
  });

  let stdout = "";
  let stderr = "";
  let terminalError: Error | null = null;
  let nextId = 1;
  let closeRequested = false;
  let closeResult: Promise<void> | null = null;
  const pending = new Map<number, PendingCall>();

  const boundedStderr = () => stderr.length <= STDERR_CAPTURE_BYTES
    ? stderr
    : `...[truncated]${stderr.slice(-STDERR_CAPTURE_BYTES)}`;
  const terminalMessage = (code: number | null, signal: NodeJS.Signals | null) => closeRequested
    ? `MCP entrypoint session intentionally closed before response.`
    : `MCP entrypoint child process exited unexpectedly (code=${String(code)}, signal=${String(signal)}). ` +
      `stderr=${boundedStderr()}`;
  const unexpectedTerminalError = (code: number | null, signal: NodeJS.Signals | null) =>
    new Error(terminalMessage(code, signal));
  const requestedCloseError = () => new Error("MCP entrypoint session intentionally closed before response.");

  const rejectPending = (error: Error) => {
    for (const waiter of pending.values()) {
      waiter.reject(error);
    }
    pending.clear();
  };
  const markTerminal = (error: Error) => {
    if (terminalError !== null) {
      return;
    }
    terminalError = error;
    rejectPending(error);
  };

  const setExitHandlers = (): void => {
    child.once("exit", (code, signal) => {
      markTerminal(unexpectedTerminalError(code, signal));
    });
    child.once("error", (error) => {
      markTerminal(new Error(`MCP entrypoint child process error before response: ${(error as Error).message}`));
    });
  };

  setExitHandlers();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
    if (stderr.length > STDERR_CAPTURE_BYTES) {
      stderr = stderr.slice(-STDERR_CAPTURE_BYTES);
    }
  });
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      let parsed: McpMessage;
      try {
        parsed = JSON.parse(line) as McpMessage;
      } catch (error) {
        markTerminal(new Error(
          `MCP entrypoint emitted malformed JSON: ${
            error instanceof Error ? error.message : String(error)
          }`
        ));
        continue;
      }
      if (typeof parsed.id !== "number") {
        continue;
      }
      const waiter = pending.get(parsed.id);
      if (waiter === undefined) {
        continue;
      }
      pending.delete(parsed.id);
      waiter.resolve(parsed);
    }
  });

  return {
    repoRoot: normalizedRepoRoot,
    child,
    stderr: () => stderr,
    stdoutRemainder: () => stdout,
    call(method: string, params: Record<string, unknown> = {}, timeoutMs = 6000) {
      if (terminalError !== null) {
        return Promise.reject(terminalError);
      }
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for ${method} id=${id}: stderr=${boundedStderr()}`));
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
      if (terminalError !== null) {
        throw terminalError;
      }
      child.stdin.write(`${JSON.stringify({
        jsonrpc: "2.0",
        method,
        params
      })}\n`);
    },
    async close() {
      if (closeResult !== null) {
        return closeResult;
      }
      if (terminalError !== null) {
        return;
      }
      closeRequested = true;
      rejectPending(requestedCloseError());
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      closeResult = (async () => {
        child.kill("SIGTERM");
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, ENTRYPOINT_SHUTDOWN_TIMEOUT_MS);
          child.once("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      })();
      return closeResult;
    }
  };
}

type TeardownRecord = {
  metadataPath: string;
  socketPath: string;
  startupLockPath: string;
  pids: number[];
};

function readDaemonPid(metadataPath: string): number | undefined {
  if (!fs.existsSync(metadataPath)) {
    return;
  }
  try {
    const candidate = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as {
      pid?: unknown;
      owner_pid?: unknown;
    };
    return typeof candidate.pid === "number"
      ? candidate.pid
      : typeof candidate.owner_pid === "number"
        ? candidate.owner_pid
        : undefined;
  } catch {
    return;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code?: string }).code
      : undefined;
    return code !== "ESRCH";
  }
}

async function waitForDetachedDaemonRelease(
  repoRoot: string,
  record: TeardownRecord
): Promise<void> {
  for (let attempt = 0; attempt < CLOSE_RETRIES; attempt += 1) {
    const metadataExists = fs.existsSync(record.metadataPath);
    const socketExists = fs.existsSync(record.socketPath);
    const startupLockExists = fs.existsSync(record.startupLockPath);
    const pidsAlive = record.pids.some((pid) => isProcessAlive(pid));
    if (!metadataExists && !socketExists && !startupLockExists && !pidsAlive) {
      return;
    }
    if (attempt + 1 < CLOSE_RETRIES) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      continue;
    }
    const activePids = record.pids.filter(isProcessAlive);
    throw new Error(
      `Timed out waiting for detached daemon teardown for ${repoRoot}. ` +
      `metadata=${metadataExists}, socket=${socketExists}, startup_lock=${startupLockExists}, ` +
      `active_pids=${JSON.stringify(activePids)}`
    );
  }
}

export async function closeSessionsAndWaitForDaemons({
  sessions,
  tempRoots
}: {
  sessions: EntryPointSession[];
  tempRoots: string[];
}): Promise<void> {
  const repos = new Map<string, TeardownRecord>();
  for (const session of sessions) {
    const paths = daemonPaths(createDaemonIdentity(session.repoRoot));
    const pids = new Set<number>();
    if (typeof session.child.pid === "number") {
      pids.add(session.child.pid);
    }
    const metadataPid = readDaemonPid(paths.metadataPath);
    if (metadataPid !== undefined) {
      pids.add(metadataPid);
    }
    const prior = repos.get(session.repoRoot);
    if (prior === undefined) {
      repos.set(session.repoRoot, {
        metadataPath: paths.metadataPath,
        socketPath: paths.socketPath,
        startupLockPath: paths.startupLockPath,
        pids: [...pids]
      });
      continue;
    }
    prior.pids.push(...[...pids].filter((pid) => !prior.pids.includes(pid)));
  }

  const closeResults = await Promise.allSettled(sessions.map((session) => session.close()));
  const closeFailures = closeResults.filter((result) => result.status === "rejected");
  const waitFailures: Error[] = [];
  for (const [repoRoot, record] of repos.entries()) {
    try {
      await waitForDetachedDaemonRelease(repoRoot, record);
    } catch (error) {
      waitFailures.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  if (closeFailures.length > 0 || waitFailures.length > 0) {
    const failures = closeFailures
      .map((failure, index) => `${index + 1}. close-${failure.status}: ` +
        `${failure.status === "rejected" ? String(failure.reason) : ""}`)
      .join("\n");
    const teardownFailures = waitFailures.map((failure) => `- ${failure.message}`).join("\n");
    throw new Error(
      `EntryPoint session teardown not clean: ${closeFailures.length + waitFailures.length} failures\n${failures}` +
        (teardownFailures ? `\n${teardownFailures}` : "")
    );
  }
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export async function initializeSession(
  session: EntryPointSession,
  timeoutMs = 15_000
): Promise<void> {
  await session.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "agent-workbench-entrypoint-test",
      version: "0.1.0"
    }
  }, timeoutMs);
  session.notify("notifications/initialized", {});
}

export function parseEnvelope(message: McpMessage): unknown {
  const text = message.result?.content?.[0]?.text ?? message.result?.contents?.[0]?.text;
  if (text === undefined) {
    throw new Error(`MCP response did not contain a JSON envelope: ${JSON.stringify(message)}`);
  }
  return JSON.parse(text);
}
