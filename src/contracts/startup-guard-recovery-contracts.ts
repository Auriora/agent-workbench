/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";

const decimalBigIntStringSchema = z.string()
  .regex(/^(?:0|[1-9][0-9]*)$/u)
  .max(39);

export const startupGuardOwnerScopeSchema = z.object({
  kind: z.literal("linux-pid-namespace-v1"),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/u)
}).strict();

export type StartupGuardOwnerScope = z.infer<typeof startupGuardOwnerScopeSchema>;

export const startupGuardFileIdentitySchema = z.object({
  dev: decimalBigIntStringSchema,
  ino: decimalBigIntStringSchema
}).strict();

export type StartupGuardFileIdentity = z.infer<typeof startupGuardFileIdentitySchema>;

export const startupGuardRecoveryExpectedSchema = startupGuardFileIdentitySchema.extend({
  pid: z.number().int().positive().max(2_147_483_647),
  created_at: z.string().min(1).max(128).refine(
    (value) => Number.isFinite(Date.parse(value)),
    "created_at must be a valid timestamp"
  ),
  token: z.string().min(1).max(256),
  owner_scope: startupGuardOwnerScopeSchema.optional()
}).strict();

export type StartupGuardRecoveryExpected = z.infer<typeof startupGuardRecoveryExpectedSchema>;

export const startupGuardRecoveryRequestSchema = z.object({
  guard_path: z.string().min(1).max(4096),
  expected: startupGuardRecoveryExpectedSchema
}).strict();

export type StartupGuardRecoveryRequest = z.infer<typeof startupGuardRecoveryRequestSchema>;

export const STARTUP_GUARD_RECOVERY_EXIT_CODES = {
  recovered: 0,
  already_recovered: 10,
  busy: 75,
  ambiguous: 77,
  native_module_rebuild_required: 78
} as const;

export const MAX_STARTUP_GUARD_RECOVERY_REQUEST_BYTES = 8192;
export const STARTUP_GUARD_RECOVERY_SQLITE_APPLICATION_ID = 0x41574252;
export const STARTUP_GUARD_RECOVERY_SQLITE_USER_VERSION = 1;

export type StartupGuardRecoveryOutcome = keyof typeof STARTUP_GUARD_RECOVERY_EXIT_CODES;

export function startupGuardRecoveryExitCode(
  outcome: StartupGuardRecoveryOutcome
): number {
  return STARTUP_GUARD_RECOVERY_EXIT_CODES[outcome];
}
