/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });

const phase = process.argv[2];
if (phase !== "before-unlink" && phase !== "after-unlink") {
  process.exitCode = 77;
} else {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const { default: Database } = await import("better-sqlite3");
    const { recoverStartupGuard } = await import(
      "../../src/infrastructure/runtime/startup-guard-recovery.ts"
    );
    const unlink = fs.unlinkSync;
    fs.unlinkSync = (filePath) => {
      if (phase === "before-unlink") process.kill(process.pid, "SIGKILL");
      const result = unlink(filePath);
      if (phase === "after-unlink") process.kill(process.pid, "SIGKILL");
      return result;
    };
    process.exitCode = recoverStartupGuard(input, {
      database_constructor: Database
    }).code;
  } catch {
    process.exitCode = 77;
  }
}
