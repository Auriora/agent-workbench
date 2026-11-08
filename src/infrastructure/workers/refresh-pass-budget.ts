/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RefreshWorkerProgress } from "../../contracts/index.js";

type Phase = "preparation" | "extraction" | "resolution" | "settlement";

export class RefreshPhaseBudgetError extends Error {
  constructor(readonly phase: Phase, readonly reason: string) {
    super(`Refresh ${phase} budget could not be honored: ${reason}.`);
    this.name = "RefreshPhaseBudgetError";
  }
}

/** A pass-local cooperative plan; the parent remains the hard termination authority. */
export class RefreshPassBudget {
  readonly hard_deadline_ms: number;
  readonly reserve_ms: number;
  readonly settlement_tail_ms = 5_000;
  readonly resolution_page_admission_ms = 1_000;
  readonly preparation_allowance_ms: number;
  /** Soft next-file admission target; a whole file may settle while reserve remains. */
  readonly extraction_soft_allowance_ms: number;
  readonly headroom_ms: number;
  private readonly now: () => number;
  private readonly startedAt: number;
  private phase: Phase = "preparation";
  private phaseStartedAt: number;
  private resolutionDeadline: number | undefined;
  private extractionStarted = false;
  private readonly elapsed: Record<Phase, number> = { preparation: 0, extraction: 0, resolution: 0, settlement: 0 };

  constructor(input: { deadline_at: string; timeout_ms: number; now?: () => number }) {
    this.now = input.now ?? Date.now;
    this.startedAt = this.readNow();
    this.phaseStartedAt = this.startedAt;
    this.hard_deadline_ms = Date.parse(input.deadline_at);
    if (!Number.isFinite(this.hard_deadline_ms) || !Number.isSafeInteger(input.timeout_ms) || input.timeout_ms <= 0) {
      throw new TypeError("Refresh worker deadline and timeout must be valid.");
    }
    // Preserve the existing aggregate resolution/write/cleanup reserve exactly.
    this.reserve_ms = Math.max(5_000, Math.floor(input.timeout_ms * 5 / 6));
    const active = this.hard_deadline_ms - this.startedAt - this.reserve_ms;
    this.preparation_allowance_ms = Math.floor(active * 0.4);
    this.extraction_soft_allowance_ms = Math.floor(active * 0.4);
    this.headroom_ms = active - this.preparation_allowance_ms - this.extraction_soft_allowance_ms;
    if (this.preparation_allowance_ms <= 0 || this.extraction_soft_allowance_ms <= 0) {
      throw new RefreshPhaseBudgetError("preparation", "required_settlement_reserve_unavailable");
    }
  }

  enter(workerPhase: RefreshWorkerProgress["phase"]): void {
    this.check();
    const next = group(workerPhase);
    if (next === this.phase) return;
    if (next === "preparation" || next === "extraction" && (this.extractionStarted || this.phase !== "preparation")) {
      throw new RefreshPhaseBudgetError(next, "phase_order_would_reset_allowance");
    }
    const now = this.readNow();
    if (next === "settlement" && this.hard_deadline_ms - now < this.settlement_tail_ms) {
      throw new RefreshPhaseBudgetError(next, "minimum_tail_unavailable");
    }
    this.elapsed[this.phase] += Math.max(0, now - this.phaseStartedAt);
    this.phase = next;
    this.phaseStartedAt = now;
    if (next === "extraction") this.extractionStarted = true;
    if (next === "resolution") {
      this.resolutionDeadline ??= Math.min(now + this.reserve_ms - this.settlement_tail_ms,
        this.hard_deadline_ms - this.settlement_tail_ms);
    }
    this.check();
  }

  check(): void {
    const now = this.readNow();
    if (now >= this.hard_deadline_ms) throw new RefreshPhaseBudgetError(this.phase, "hard_deadline_reached");
    if (this.phase === "preparation" && now - this.phaseStartedAt >= this.preparation_allowance_ms) {
      throw new RefreshPhaseBudgetError(this.phase, "preparation_allowance_exhausted");
    }
    // Native extraction is noninterruptible within a file. The soft target
    // governs the next file, while this post-file safety fence protects settlement.
    if (this.phase === "extraction" && this.hard_deadline_ms - now < this.reserve_ms) {
      throw new RefreshPhaseBudgetError(this.phase, "required_settlement_reserve_unavailable");
    }
    if (this.phase === "resolution" && now >= this.resolutionDeadline!) {
      throw new RefreshPhaseBudgetError(this.phase, "resolution_allowance_exhausted");
    }
  }

  shouldYieldExtraction(): boolean {
    this.check();
    if (this.phase !== "extraction") throw new RefreshPhaseBudgetError(this.phase, "extraction_not_started");
    return this.readNow() - this.phaseStartedAt >= this.extraction_soft_allowance_ms;
  }

  /** Admission heuristic between durable pages, never a successful timed-out page. */
  shouldYieldResolution(): boolean {
    this.check();
    const now = this.readNow();
    const deadline = this.resolutionDeadline ?? Math.min(now + this.reserve_ms - this.settlement_tail_ms,
      this.hard_deadline_ms - this.settlement_tail_ms);
    return deadline - now <= this.resolution_page_admission_ms;
  }

  snapshot() {
    const elapsed = { ...this.elapsed };
    elapsed[this.phase] += Math.max(0, this.readNow() - this.phaseStartedAt);
    return { policy: "refresh-phase-budget-v1" as const, hard_deadline_ms: this.hard_deadline_ms,
      started_at_ms: this.startedAt, reserve_ms: this.reserve_ms, settlement_tail_ms: this.settlement_tail_ms,
      resolution_page_admission_ms: this.resolution_page_admission_ms,
      preparation_allowance_ms: this.preparation_allowance_ms, extraction_soft_allowance_ms: this.extraction_soft_allowance_ms,
      headroom_ms: this.headroom_ms, elapsed_ms: elapsed };
  }

  private readNow(): number {
    const now = this.now();
    if (!Number.isFinite(now)) throw new TypeError("Refresh budget clock must be finite.");
    return now;
  }
}

function group(phase: RefreshWorkerProgress["phase"]): Phase {
  if (phase === "composition" || phase === "catalog" || phase === "docs") return "preparation";
  if (phase === "extraction" || phase === "resolution") return phase;
  return "settlement";
}
