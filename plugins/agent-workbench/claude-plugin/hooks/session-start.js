#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  shouldEmitSessionStartContext
} from "./session-start.core.js";
import {
  emitAdditionalContext,
  feedbackMode,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";

export function buildClaudeSessionStartContext(payload, env = process.env) {
  const effectiveEnv = withBasicDefault(env);
  if (feedbackMode(effectiveEnv) !== "basic" || !shouldEmitSessionStartContext(payload)) {
    return undefined;
  }

  return "For non-trivial repository investigation, change evidence, or validation planning, invoke `/agent-workbench:agent-workbench`; skip it for trivial tasks.";
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
