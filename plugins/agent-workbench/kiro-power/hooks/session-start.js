#!/usr/bin/env node
import {
  buildSessionStartContext
} from "../../hooks/session-start.js";
import {
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "../../hooks/hook-common.js";

export function buildKiroSessionStartContext(payload, env = process.env) {
  return buildSessionStartContext(payload, env);
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildKiroSessionStartContext(payload);
  if (context) {
    process.stdout.write(`${context}\n`);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
