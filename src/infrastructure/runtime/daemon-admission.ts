/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DAEMON_ADMISSION_REJECTED_MESSAGE,
  GUARANTEED_DAEMON_SESSION_INPUT_BYTES,
  MAX_DAEMON_MESSAGES,
  MAX_DAEMON_SESSIONS,
  MAX_DAEMON_SESSION_INPUT_BYTES,
  MAX_DAEMON_SESSION_MESSAGES,
  MAX_DAEMON_SHARED_INPUT_BYTES
} from "../../contracts/daemon-admission-contracts.js";
import type {
  DaemonAdmissionSnapshot,
  DaemonRequestId
} from "../../contracts/daemon-admission-contracts.js";
import type {
  DaemonAdmissionBudgetPort,
  DaemonSessionAdmissionPort
} from "../../ports/daemon-admission.js";

type RequestLease = {
  bytes: number;
  started: boolean;
  handlerSettled: boolean;
  responseComplete: boolean;
  cancelled: boolean;
  abortListener?: () => void;
  abortSignal?: AbortSignal;
};

function admissionError(): Error {
  return new Error(DAEMON_ADMISSION_REJECTED_MESSAGE);
}

function validBytes(bytes: number): boolean {
  return Number.isSafeInteger(bytes) && bytes >= 0;
}

/** One daemon-wide, fixed admission policy. */
export class DaemonAdmissionBudget implements DaemonAdmissionBudgetPort {
  private sessionCount = 0;
  private inputBytes = 0;
  private sharedInputBytes = 0;
  private messageCount = 0;
  private readonly quiescentWaiters = new Set<() => void>();

  tryOpenSession(): DaemonSessionAdmissionPort | undefined {
    if (this.sessionCount >= MAX_DAEMON_SESSIONS) return undefined;
    this.sessionCount += 1;
    return new DaemonSessionAdmission(this);
  }

  snapshot(): DaemonAdmissionSnapshot {
    return {
      sessions: this.sessionCount,
      input_bytes: this.inputBytes,
      shared_input_bytes: this.sharedInputBytes,
      messages: this.messageCount
    };
  }

  whenQuiescent(): Promise<void> {
    if (this.sessionCount === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.quiescentWaiters.add(resolve));
  }

  private adjustInput(delta: number, oldSessionBytes: number, newSessionBytes: number): void {
    this.inputBytes += delta;
    this.sharedInputBytes +=
      Math.max(0, newSessionBytes - GUARANTEED_DAEMON_SESSION_INPUT_BYTES) -
      Math.max(0, oldSessionBytes - GUARANTEED_DAEMON_SESSION_INPUT_BYTES);
  }

  private tryMessage(): boolean {
    if (this.messageCount >= MAX_DAEMON_MESSAGES) return false;
    this.messageCount += 1;
    return true;
  }

  private releaseMessage(): void {
    this.messageCount -= 1;
  }

  private closeSession(): void {
    this.sessionCount -= 1;
    if (this.sessionCount !== 0) return;
    for (const resolve of this.quiescentWaiters) resolve();
    this.quiescentWaiters.clear();
  }

  private canReserveInput(sessionBytes: number, bytes: number): boolean {
    if (!validBytes(bytes) || bytes > MAX_DAEMON_SESSION_INPUT_BYTES - sessionBytes) return false;
    const nextShared = this.sharedInputBytes +
      Math.max(0, sessionBytes + bytes - GUARANTEED_DAEMON_SESSION_INPUT_BYTES) -
      Math.max(0, sessionBytes - GUARANTEED_DAEMON_SESSION_INPUT_BYTES);
    return nextShared <= MAX_DAEMON_SHARED_INPUT_BYTES;
  }

  private reserveInput(sessionBytes: number, bytes: number): boolean {
    if (!this.canReserveInput(sessionBytes, bytes)) return false;
    this.adjustInput(bytes, sessionBytes, sessionBytes + bytes);
    return true;
  }

  private releaseInput(sessionBytes: number, bytes: number): void {
    if (!validBytes(bytes) || bytes > sessionBytes) return;
    this.adjustInput(-bytes, sessionBytes, sessionBytes - bytes);
  }

  private tryMessageLease(): boolean {
    return this.tryMessage();
  }

  private releaseSessionIfNeeded(session: DaemonSessionAdmission): void {
    if (session.isClosed() && !session.hasCharges() && !session.isSessionReleased()) {
      session.markSessionReleased();
      this.closeSession();
    }
  }

  // Exposed only to the session implementation in this module.
  _reserveInput(sessionBytes: number, bytes: number): boolean { return this.reserveInput(sessionBytes, bytes); }
  _releaseInput(sessionBytes: number, bytes: number): void { this.releaseInput(sessionBytes, bytes); }
  _tryMessage(): boolean { return this.tryMessageLease(); }
  _releaseMessage(): void { this.releaseMessage(); }
  _releaseSessionIfNeeded(session: DaemonSessionAdmission): void { this.releaseSessionIfNeeded(session); }
}

class DaemonSessionAdmission implements DaemonSessionAdmissionPort {
  private closed = false;
  private sessionReleased = false;
  private sessionInputBytes = 0;
  private unleasedInputBytes = 0;
  private readonly requests = new Map<DaemonRequestId, RequestLease>();
  private readonly controls = new Set<() => void>();

  constructor(private readonly budget: DaemonAdmissionBudget) {}

  reserveInput(bytes: number): boolean {
    if (this.closed || !this.budget._reserveInput(this.sessionInputBytes, bytes)) return false;
    this.sessionInputBytes += bytes;
    this.unleasedInputBytes += bytes;
    return true;
  }

  releaseInput(bytes: number): void {
    if (!validBytes(bytes) || bytes > this.unleasedInputBytes) return;
    this.unleasedInputBytes -= bytes;
    this.sessionInputBytes -= bytes;
    this.budget._releaseInput(this.sessionInputBytes + bytes, bytes);
    this.maybeReleaseSession();
  }

  admitRequest(id: DaemonRequestId, bytes: number): boolean {
    if (this.closed || !validBytes(bytes) || this.requests.has(id)) return false;
    if (this.requests.size + this.controls.size >= MAX_DAEMON_SESSION_MESSAGES || bytes > this.unleasedInputBytes) return false;
    if (!this.budget._tryMessage()) return false;
    this.unleasedInputBytes -= bytes;
    this.requests.set(id, {
      bytes,
      started: false,
      handlerSettled: false,
      responseComplete: false,
      cancelled: false
    });
    return true;
  }

  admitControl(bytes: number): (() => void) | undefined {
    if (this.closed || !validBytes(bytes) || bytes > this.unleasedInputBytes) return undefined;
    if (this.controls.size + this.requests.size >= MAX_DAEMON_SESSION_MESSAGES) return undefined;
    if (!this.budget._tryMessage()) return undefined;
    this.unleasedInputBytes -= bytes;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      this.controls.delete(release);
      this.sessionInputBytes -= bytes;
      this.budget._releaseInput(this.sessionInputBytes + bytes, bytes);
      this.budget._releaseMessage();
      this.maybeReleaseSession();
    };
    this.controls.add(release);
    return release;
  }

  async runRequest<T>(
    id: DaemonRequestId,
    signal: AbortSignal,
    operation: () => T | Promise<T>
  ): Promise<T> {
    const request = this.requests.get(id);
    if (request === undefined || request.started) {
      throw admissionError();
    }
    if (this.closed || request.cancelled || signal.aborted) {
      if (!request.started) {
        request.cancelled = true;
        request.handlerSettled = true;
        this.releaseRequestIfReady(id, request);
      }
      throw admissionError();
    }
    request.started = true;
    const onAbort = (): void => this.cancelRequest(id);
    request.abortListener = onAbort;
    request.abortSignal = signal;
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      request.cancelled = true;
      request.handlerSettled = true;
      this.releaseRequestIfReady(id, request);
      throw admissionError();
    }
    try {
      return await operation();
    } finally {
      request.handlerSettled = true;
      this.releaseRequestIfReady(id, request);
    }
  }

  completeResponse(id: DaemonRequestId): void {
    const request = this.requests.get(id);
    if (request === undefined) return;
    request.responseComplete = true;
    this.releaseRequestIfReady(id, request);
  }

  cancelRequest(id: DaemonRequestId): void {
    const request = this.requests.get(id);
    if (request === undefined) return;
    request.cancelled = true;
    if (!request.started) request.handlerSettled = true;
    this.releaseRequestIfReady(id, request);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const [id, request] of [...this.requests]) {
      if (!request.started || request.handlerSettled) {
        this.releaseRequest(id, request);
      }
    }
    if (this.unleasedInputBytes > 0) {
      const bytes = this.unleasedInputBytes;
      this.unleasedInputBytes = 0;
      this.sessionInputBytes -= bytes;
      this.budget._releaseInput(this.sessionInputBytes + bytes, bytes);
    }
    this.maybeReleaseSession();
  }

  hasCharges(): boolean {
    return this.sessionInputBytes > 0 || this.requests.size > 0 || this.controls.size > 0;
  }

  isClosed(): boolean { return this.closed; }
  isSessionReleased(): boolean { return this.sessionReleased; }
  markSessionReleased(): void { this.sessionReleased = true; }

  private releaseRequestIfReady(id: DaemonRequestId, request: RequestLease): void {
    if (!request.started) {
      if (!request.responseComplete && !request.cancelled && !this.closed) return;
      this.releaseRequest(id, request);
      return;
    }
    if (!request.handlerSettled) return;
    if (request.started && !request.responseComplete && !request.cancelled && !this.closed) return;
    this.releaseRequest(id, request);
  }

  private releaseRequest(id: DaemonRequestId, request: RequestLease): void {
    if (!this.requests.delete(id)) return;
    if (request.abortListener !== undefined) {
      request.abortSignal?.removeEventListener("abort", request.abortListener);
      request.abortListener = undefined;
      request.abortSignal = undefined;
    }
    this.sessionInputBytes -= request.bytes;
    this.budget._releaseInput(this.sessionInputBytes + request.bytes, request.bytes);
    this.budget._releaseMessage();
    this.maybeReleaseSession();
  }

  private maybeReleaseSession(): void {
    this.budget._releaseSessionIfNeeded(this);
  }
}
