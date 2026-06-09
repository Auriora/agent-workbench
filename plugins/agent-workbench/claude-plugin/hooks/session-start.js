#!/usr/bin/env node
import {
  buildSessionStartContext
} from "../../hooks/session-start.js";
import {
  emitAdditionalContext,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "../../hooks/hook-common.js";

export function buildClaudeSessionStartContext(payload, env = process.env) {
  return buildSessionStartContext(payload, env);
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildClaudeSessionStartContext(payload);
  if (context) {
    emitAdditionalContext("SessionStart", context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
