#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  buildSessionStartContext
} from "./session-start.core.js";
import {
  emitAdditionalContext,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";

export function buildClaudeSessionStartContext(payload, env = process.env) {
  return buildSessionStartContext(payload, withBasicDefault(env));
}

function withBasicDefault(env) {
  return {
    ...env,
    AGENT_WORKBENCH_HOOK_FEEDBACK: env.AGENT_WORKBENCH_HOOK_FEEDBACK || "basic"
  };
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
