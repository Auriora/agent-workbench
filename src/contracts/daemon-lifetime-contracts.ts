/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";

export const DAEMON_LIFETIME_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const DAEMON_LIFETIME_EVIDENCE_MAX_BYTES = 4096 as const;

const daemonIdSchema = z.string().regex(/^[A-Fa-f0-9]{64}$/u);
const launchTokenSchema = z.string().uuid();
const buildFingerprintSchema = z.string().regex(/^[A-Fa-f0-9]{64}$/u);
const runtimeVersionSchema = z.string().regex(/^v?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/u);

export const daemonLifetimeFatalOriginSchema = z.enum([
  "uncaughtException",
  "unhandledRejection"
]);
export type DaemonLifetimeFatalOrigin = z.infer<typeof daemonLifetimeFatalOriginSchema>;

export const daemonLifetimeSignalSchema = z.literal("SIGTERM");
export type DaemonLifetimeSignal = z.infer<typeof daemonLifetimeSignalSchema>;

export const daemonLifetimePhaseSchema = z.enum([
  "ready",
  "fatal",
  "signal",
  "exit",
  "owner_loss"
]);
export type DaemonLifetimePhase = z.infer<typeof daemonLifetimePhaseSchema>;

export const daemonLifetimeReasonSchema = z.enum([
  "admitted",
  "uncaughtException",
  "unhandledRejection",
  "sigterm",
  "exit",
  "unknown_prior_owner_loss"
]);
export type DaemonLifetimeReason = z.infer<typeof daemonLifetimeReasonSchema>;

export const daemonLifetimeLaunchSchema = z
  .object({
    daemon_id: daemonIdSchema,
    launch_token: launchTokenSchema,
    pid: z.number().int().positive(),
    runtime_version: runtimeVersionSchema,
    build_fingerprint: buildFingerprintSchema.optional(),
    started_at: z.string().datetime({ offset: true })
  })
  .strict();
export type DaemonLifetimeLaunch = z.infer<typeof daemonLifetimeLaunchSchema>;

export const daemonLifetimeRecordSchema = daemonLifetimeLaunchSchema
  .extend({
    timestamp: z.string().datetime({ offset: true }),
    phase: daemonLifetimePhaseSchema,
    reason: daemonLifetimeReasonSchema,
    observed_code: z.number().int().nonnegative().nullable().optional(),
    observed_signal: daemonLifetimeSignalSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.phase === "ready" && value.reason !== "admitted") {
      context.addIssue({ code: "custom", path: ["reason"], message: "Ready records must use admitted reason." });
    }
    if (value.phase === "fatal" && !isFatalReason(value.reason)) {
      context.addIssue({ code: "custom", path: ["reason"], message: "Fatal records must use a fatal reason." });
    }
    if (value.phase === "signal" && !isFatalReason(value.reason) && value.reason !== "sigterm") {
      context.addIssue({ code: "custom", path: ["reason"], message: "Signal records must use sigterm or preserve a fatal reason." });
    }
    if (value.phase === "exit" && !isFatalReason(value.reason) && value.reason !== "sigterm" && value.reason !== "exit") {
      context.addIssue({ code: "custom", path: ["reason"], message: "Exit records must use exit, sigterm, or preserve a fatal reason." });
    }
    if (value.phase === "owner_loss" && value.reason !== "unknown_prior_owner_loss") {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Owner-loss records must use unknown_prior_owner_loss."
      });
    }
    if (value.reason === "unknown_prior_owner_loss" && value.phase !== "owner_loss") {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "unknown_prior_owner_loss records must use owner_loss phase."
      });
    }
    if (value.phase === "owner_loss" && (value.observed_code !== undefined || value.observed_signal !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "Owner-loss records cannot invent observed code or signal."
      });
    }
    if (value.observed_code !== undefined && value.phase !== "exit") {
      context.addIssue({ code: "custom", path: ["observed_code"], message: "Observed code is only valid on exit." });
    }
    if (value.observed_signal !== undefined && value.phase !== "signal" && value.phase !== "exit") {
      context.addIssue({ code: "custom", path: ["observed_signal"], message: "Observed signal is only valid on signal or exit." });
    }
    if (value.observed_signal !== undefined && value.phase === "ready") {
      context.addIssue({
        code: "custom",
        path: ["observed_signal"],
        message: "An admitted record cannot contain an observed signal."
      });
    }
  });
export type DaemonLifetimeRecord = z.infer<typeof daemonLifetimeRecordSchema>;

function isFatalReason(reason: DaemonLifetimeReason): boolean {
  return reason === "uncaughtException" || reason === "unhandledRejection";
}

export const daemonLifetimeEvidenceUnavailableReasonSchema = z.enum([
  "not_admitted",
  "invalid_launch",
  "store_missing",
  "store_unreadable",
  "store_corrupt",
  "store_oversized",
  "store_unsafe",
  "store_unwritable",
  "stale_generation",
  "invalid_observation",
  "lock_contention"
]);
export type DaemonLifetimeEvidenceUnavailableReason = z.infer<
  typeof daemonLifetimeEvidenceUnavailableReasonSchema
>;

export const daemonLifetimeEvidenceAvailableSchema = z
  .object({
    status: z.literal("available"),
    current: daemonLifetimeRecordSchema,
    previous: daemonLifetimeRecordSchema.optional()
  })
  .strict();
export type DaemonLifetimeEvidenceAvailable = z.infer<
  typeof daemonLifetimeEvidenceAvailableSchema
>;

export const daemonLifetimeEvidenceUnavailableSchema = z
  .object({
    status: z.literal("unavailable"),
    reason: daemonLifetimeEvidenceUnavailableReasonSchema
  })
  .strict();
export type DaemonLifetimeEvidenceUnavailable = z.infer<
  typeof daemonLifetimeEvidenceUnavailableSchema
>;

export const daemonLifetimeEvidenceSchema = z.discriminatedUnion("status", [
  daemonLifetimeEvidenceAvailableSchema,
  daemonLifetimeEvidenceUnavailableSchema
]);
export type DaemonLifetimeEvidence = z.infer<typeof daemonLifetimeEvidenceSchema>;

export const daemonLifetimeEvidenceFileSchema = z
  .object({
    schema_version: z.literal(DAEMON_LIFETIME_EVIDENCE_SCHEMA_VERSION),
    generation: z.number().int().positive(),
    current: daemonLifetimeRecordSchema,
    previous: daemonLifetimeRecordSchema.optional()
  })
  .strict();
export type DaemonLifetimeEvidenceFile = z.infer<typeof daemonLifetimeEvidenceFileSchema>;
