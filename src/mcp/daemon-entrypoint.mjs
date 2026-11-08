/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../infrastructure/runtime/native-runtime-startup.mjs";
import fs from "node:fs";
import { register } from "tsx/esm/api";
import { validateTreeSitterSourceBuild } from "../infrastructure/runtime/native-runtime-guard.mjs";


try {
  validateTreeSitterSourceBuild();
  register({ parentURL: import.meta.url });
  await import("./daemon-main.ts");
} catch (error) {
  fs.writeSync(
    2,
    `agent-workbench: daemon failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
