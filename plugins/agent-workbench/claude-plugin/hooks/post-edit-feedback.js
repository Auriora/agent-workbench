#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  buildPostEditContext
} from "./post-edit-feedback.core.js";
import {
  emitAdditionalContext,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";

export function buildClaudePostEditContext(payload, env = process.env) {
  return buildPostEditContext(payload, withBasicDefault(env));
}

function withBasicDefault(env) {
  return {
    ...env,
    AGENT_WORKBENCH_HOOK_FEEDBACK: env.AGENT_WORKBENCH_HOOK_FEEDBACK || "basic"
  };
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
