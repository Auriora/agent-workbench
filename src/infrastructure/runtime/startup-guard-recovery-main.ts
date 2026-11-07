/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  MAX_STARTUP_GUARD_RECOVERY_REQUEST_BYTES,
  STARTUP_GUARD_RECOVERY_EXIT_CODES,
  startupGuardRecoveryRequestSchema
} from "../../contracts/startup-guard-recovery-contracts.js";
import {
  recoverStartupGuard,
  type StartupGuardRecoveryDatabaseConstructor
} from "./startup-guard-recovery.js";

export async function runStartupGuardRecoveryMain(): Promise<number> {
  const inputBytes = await readBoundedStdin();
  if (inputBytes === undefined) return STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous;
  let input: unknown;
  try {
    input = JSON.parse(inputBytes);
  } catch {
    return STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous;
  }
  const parsed = startupGuardRecoveryRequestSchema.safeParse(input);
  if (!parsed.success) return STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous;

  let databaseConstructor: StartupGuardRecoveryDatabaseConstructor;
  try {
    const module = await import("better-sqlite3");
    databaseConstructor = module.default as unknown as StartupGuardRecoveryDatabaseConstructor;
  } catch {
    return STARTUP_GUARD_RECOVERY_EXIT_CODES.native_module_rebuild_required;
  }

  try {
    return recoverStartupGuard(parsed.data, {
      database_constructor: databaseConstructor
    }).code;
  } catch {
    return STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous;
  }
}

async function readBoundedStdin(): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of process.stdin) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.byteLength;
      if (total > MAX_STARTUP_GUARD_RECOVERY_REQUEST_BYTES) return undefined;
      chunks.push(buffer);
    }
  } catch {
    return undefined;
  }
  return Buffer.concat(chunks).toString("utf8");
}

try {
  process.exitCode = await runStartupGuardRecoveryMain();
} catch {
  process.exitCode = STARTUP_GUARD_RECOVERY_EXIT_CODES.ambiguous;
}
