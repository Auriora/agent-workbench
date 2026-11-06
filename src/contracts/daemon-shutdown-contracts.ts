/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import { snapshotPublicationStateSchema } from "./snapshot-publication-contracts.js";

export const DAEMON_SHUTDOWN_BUDGET_MS = 1_000 as const;

export const daemonShutdownReceiptSchema = z.object({
  state: z.enum(["draining", "settled", "blocked"]),
  phase: z.enum(["admission", "refresh", "resources", "store", "ownership", "endpoint", "complete"]),
  cause: z.enum(["requested", "complete", "deadline", "startup_exclusion_unavailable", "refresh_unconfirmed", "cleanup_failed"]),
  worker_termination_state: z.enum(["not_required", "unconfirmed", "confirmed"]),
  activity_lease_held: z.boolean(),
  publication_state: snapshotPublicationStateSchema.optional()
}).strict().superRefine((receipt, context) => {
  if (receipt.phase === "complete" && receipt.state !== "settled")
    context.addIssue({ code: "custom", message: "Complete phase requires settled shutdown." });
  if (receipt.state === "settled" && (
    receipt.phase !== "complete" || receipt.cause !== "complete" ||
    receipt.activity_lease_held || receipt.worker_termination_state === "unconfirmed" ||
    receipt.publication_state === "building"
  )) context.addIssue({ code: "custom", message: "Settled shutdown requires confirmed safe terminal evidence." });
  if (receipt.state === "draining" && receipt.cause !== "requested")
    context.addIssue({ code: "custom", message: "Draining shutdown requires requested cause." });
  if (receipt.state === "blocked" && (receipt.cause === "requested" || receipt.cause === "complete"))
    context.addIssue({ code: "custom", message: "Blocked shutdown requires an explicit failure cause." });
});
export type DaemonShutdownReceipt = z.infer<typeof daemonShutdownReceiptSchema>;
