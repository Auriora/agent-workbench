/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";

export function feedbackMode(env = process.env) {
  // Hooks are quiet and action-gated by default. Use an explicit `silent`
  // value only when a host integration wants no user-visible hook output.
  const mode = env.AGENT_WORKBENCH_HOOK_FEEDBACK || "basic";
  return mode === "basic" ? "basic" : "silent";
}

export function readStdin(stdin = process.stdin, timeoutMs = 1000) {
  return new Promise((resolve) => {
    let payload = "";
    const timer = setTimeout(() => {
      cleanup();
      resolve(payload);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      stdin.off("data", onData);
      stdin.off("end", onEnd);
      stdin.off("error", onEnd);
      stdin.pause();
    };
    const onData = (chunk) => {
      payload += chunk;
    };
    const onEnd = () => {
      cleanup();
      resolve(payload);
    };

    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    stdin.on("end", onEnd);
    stdin.on("error", onEnd);
  });
}

export function parsePayload(raw) {
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? parsed : {};
}

export function buildAdditionalContextOutput(hookEventName, message) {
  return {
    hookSpecificOutput: {
      hookEventName,
      additionalContext: message
    }
  };
}

export function emitAdditionalContext(hookEventName, message, stdout = process.stdout) {
  stdout.write(
    `${JSON.stringify(buildAdditionalContextOutput(hookEventName, message))}\n`
  );
}

export function appendHookLog(name, record, env = process.env) {
  const logPath =
    env.AGENT_WORKBENCH_HOOK_LOG_PATH ??
    path.join(os.homedir(), ".codex", "hooks", `${name}.log.jsonl`);
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(
      logPath,
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...record })}\n`,
      "utf8"
    );
  } catch {
    // Hook logs are diagnostic only. Never surface logging failures to Codex.
  }
}

export function hookDebugEnabled(env = process.env) {
  return /^(?:1|true|yes)$/iu.test(env.AGENT_WORKBENCH_HOOK_DEBUG ?? "");
}

export async function runQuietHook(main) {
  try {
    await main();
    return 0;
  } catch {
    return 0;
  }
}

export function isMain(importMetaUrl, argv = process.argv) {
  return typeof argv[1] === "string" && importMetaUrl === pathToFileURL(path.resolve(argv[1])).href;
}
