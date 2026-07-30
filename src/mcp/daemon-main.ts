/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { runDaemonFromEnv } from "./daemon.js";

try {
  await runDaemonFromEnv();
} catch (error) {
  fs.writeSync(
    2,
    `agent-workbench: daemon failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
