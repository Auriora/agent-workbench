/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });

try {
  await import("../infrastructure/runtime/startup-guard-recovery-main.ts");
} catch {
  process.exitCode = 77;
}
