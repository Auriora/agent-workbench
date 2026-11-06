/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";

/** Canonical endpoint lifecycle; draining grants bounded waiting, never admission. */
export const daemonEndpointLifecycleStateSchema = z.enum([
  "starting", "ready", "draining", "failed"
]);
export type DaemonEndpointLifecycleState = z.infer<typeof daemonEndpointLifecycleStateSchema>;

export const daemonEndpointLifecyclePhaseSchema = z.enum([
  "launching", "ready", "draining", "terminal"
]);
export type DaemonEndpointLifecyclePhase = z.infer<typeof daemonEndpointLifecyclePhaseSchema>;
