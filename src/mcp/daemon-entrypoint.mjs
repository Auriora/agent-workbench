/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });

try {
  const { runDaemonFromEnv } = await import("./daemon.ts");
  await runDaemonFromEnv();
} catch (error) {
  process.stderr.write(
    `agent-workbench: daemon failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
