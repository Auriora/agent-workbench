#!/usr/bin/env node
import {
  buildPostEditContext
} from "../../hooks/post-edit-feedback.js";
import {
  emitAdditionalContext,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "../../hooks/hook-common.js";

export function buildClaudePostEditContext(payload, env = process.env) {
  return buildPostEditContext(payload, env);
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildClaudePostEditContext(payload);
  if (context) {
    emitAdditionalContext("PostToolUse", context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
