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

  return [
    "Agent Workbench MCP is available.",
    "Use repo:///status, repo:///scope, or repo:///overview when repository context is unclear."
  ].join(" ");
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildSessionStartContext(payload);
  if (context) {
    emitAdditionalContext("SessionStart", context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
