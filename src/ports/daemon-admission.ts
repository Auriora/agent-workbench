/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { DaemonAdmissionSnapshot, DaemonRequestId } from "../contracts/daemon-admission-contracts.js";

export interface DaemonSessionAdmissionPort {
  /** Reserve retained input before copying or parsing it. */
  reserveInput(bytes: number): boolean;
  /** Release input that has not been transferred to a request/control lease. */
  releaseInput(bytes: number): void;
  /** Transfer already-reserved input to one request lease. */
  admitRequest(id: DaemonRequestId, bytes: number): boolean;
  /** Transfer already-reserved input to one control-message lease. */
  admitControl(bytes: number): (() => void) | undefined;
  /** Run a request handler while retaining its lease until terminal settlement. */
  runRequest<T>(
    id: DaemonRequestId,
    signal: AbortSignal,
    operation: () => T | Promise<T>
  ): Promise<T>;
  /** Mark a response send as settled. */
  completeResponse(id: DaemonRequestId): void;
  /** Mark a request cancelled; running work remains charged until it settles. */
  cancelRequest(id: DaemonRequestId): void;
  /** Stop new work and release only charges that are safe to release. */
  close(): void;
}

export interface DaemonAdmissionBudgetPort {
  tryOpenSession(): DaemonSessionAdmissionPort | undefined;
  snapshot(): DaemonAdmissionSnapshot;
  whenQuiescent(): Promise<void>;
}
