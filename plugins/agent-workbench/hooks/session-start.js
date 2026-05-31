#!/usr/bin/env node
import {
  emitAdditionalContext,
  feedbackMode,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";

export function buildSessionStartContext(payload, env = process.env) {
  if (feedbackMode(env) !== "basic") {
    return undefined;
  }

  const cwd = typeof payload.cwd === "string" ? payload.cwd : undefined;
  if (!cwd) {
    return undefined;
  }

  return [
    "Agent Workbench MCP is available for this Codex session.",
    `Repo root candidate: ${cwd}`,
    "Start with repo:///status, then use integration:///profiles/codex when you need Codex surface details."
  ].join(" ");
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildSessionStartContext(payload);
  if (context) {
    emitAdditionalContext(context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
