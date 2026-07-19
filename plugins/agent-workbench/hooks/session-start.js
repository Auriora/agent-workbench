#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  emitAdditionalContext,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";
import { buildSessionStartContext } from "./session-start.core.js";

export { buildSessionStartContext, shouldEmitSessionStartContext } from "./session-start.core.js";

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildSessionStartContext(payload, process.env, {
    skillReference: "the packaged Agent Workbench skill"
  });
  if (context) {
    emitAdditionalContext("SessionStart", context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
