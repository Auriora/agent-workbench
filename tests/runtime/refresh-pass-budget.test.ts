/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { RefreshPassBudget, RefreshPhaseBudgetError } from "../../src/infrastructure/workers/refresh-pass-budget.js";

function plan(start = 0) {
  let now = start;
  return { budget: new RefreshPassBudget({ deadline_at: new Date(60_000).toISOString(), timeout_ms: 60_000, now: () => now }),
    at: (value: number) => { now = value; } };
}

describe("refresh pass phase budgets", () => {
  it("retains the existing reserve and starts a fresh extraction allowance after preparation", () => {
    const { budget, at } = plan();
    expect(budget.snapshot()).toMatchObject({ hard_deadline_ms: 60_000, reserve_ms: 50_000,
      settlement_tail_ms: 5_000, preparation_allowance_ms: 4_000, extraction_soft_allowance_ms: 4_000, headroom_ms: 2_000 });
    at(3_500);
    budget.enter("docs");
    budget.enter("extraction");
    at(7_499);
    expect(budget.shouldYieldExtraction()).toBe(false);
    at(7_500);
    expect(budget.shouldYieldExtraction()).toBe(true);
    budget.enter("graph_write");
    at(8_000);
    budget.enter("finalizing");
    expect(budget.snapshot().elapsed_ms).toEqual({ preparation: 3_500, extraction: 4_000, resolution: 0, settlement: 500 });
    expect(budget.hard_deadline_ms).toBe(60_000);
  });

  it("charges worker admission overhead without moving the absolute deadline", () => {
    const { budget } = plan(1_000);
    expect(budget.snapshot()).toMatchObject({ started_at_ms: 1_000, hard_deadline_ms: 60_000,
      reserve_ms: 50_000, preparation_allowance_ms: 3_600, extraction_soft_allowance_ms: 3_600, headroom_ms: 1_800 });
    expect(() => plan(10_000)).toThrow(RefreshPhaseBudgetError);
  });

  it("rejects unfinished preparation rather than returning a zero-work continuation", () => {
    const { budget, at } = plan();
    budget.enter("catalog");
    at(4_000);
    expect(() => budget.check()).toThrow("preparation_allowance_exhausted");
    expect(() => budget.enter("extraction")).toThrow("preparation_allowance_exhausted");
  });

  it("does not let a noninterruptible extraction consume the required settlement reserve", () => {
    const { budget, at } = plan();
    budget.enter("extraction");
    at(10_001);
    expect(() => budget.check()).toThrow("required_settlement_reserve_unavailable");
    expect(() => budget.enter("graph_write")).toThrow("required_settlement_reserve_unavailable");
  });

  it("admits settlement of a complete file past the soft target but starts no further file", () => {
    const { budget, at } = plan();
    budget.enter("extraction");
    at(4_001);
    budget.check();
    expect(budget.shouldYieldExtraction()).toBe(true);
    budget.enter("graph_write");
    expect(budget.snapshot()).toMatchObject({ reserve_ms: 50_000, extraction_soft_allowance_ms: 4_000,
      elapsed_ms: { extraction: 4_001 } });
  });

  it("bounds final resolution independently while preserving the minimum tail", () => {
    const { budget, at } = plan();
    at(1_000);
    budget.enter("resolution");
    at(45_999);
    budget.check();
    at(46_000);
    expect(() => budget.check()).toThrow("resolution_allowance_exhausted");
    expect(budget.hard_deadline_ms).toBe(60_000);
  });

  it("uses one fixed resolution deadline across durable page settlements", () => {
    const { budget, at } = plan();
    at(1_000);
    budget.enter("resolution");
    at(30_000);
    budget.enter("graph_write");
    expect(budget.shouldYieldResolution()).toBe(false);
    at(44_999);
    expect(budget.shouldYieldResolution()).toBe(false);
    at(45_000);
    expect(budget.shouldYieldResolution()).toBe(true);
    budget.enter("resolution");
    at(46_000);
    expect(() => budget.check()).toThrow("resolution_allowance_exhausted");
  });

  it("does not admit a resolution page without measured admission headroom", () => {
    const { budget, at } = plan();
    budget.enter("extraction");
    budget.enter("graph_write");
    at(54_000);
    expect(budget.shouldYieldResolution()).toBe(true);
    at(55_001);
    expect(budget.shouldYieldResolution()).toBe(true);
    // The caller may retain the preceding durable partial receipt; no new
    // resolution page was started or accepted from an exhausted phase.
    expect(budget.snapshot().elapsed_ms.resolution).toBe(0);
  });

  it("never resets a phase allowance or accepts settlement past the hard boundary", () => {
    const { budget, at } = plan();
    at(1_000);
    budget.enter("extraction");
    budget.enter("graph_write");
    expect(() => budget.enter("extraction")).toThrow("phase_order_would_reset_allowance");
    at(59_999);
    budget.check();
    at(60_000);
    expect(() => budget.check()).toThrow("hard_deadline_reached");
  });

  it("rejects invalid or infeasible caller deadlines before any work is admitted", () => {
    expect(() => new RefreshPassBudget({ deadline_at: "invalid", timeout_ms: 60_000, now: () => 0 })).toThrow(TypeError);
    expect(() => new RefreshPassBudget({ deadline_at: new Date(60_000).toISOString(), timeout_ms: 0, now: () => 0 })).toThrow(TypeError);
    expect(() => new RefreshPassBudget({ deadline_at: new Date(5_000).toISOString(), timeout_ms: 5_000, now: () => 0 })).toThrow(RefreshPhaseBudgetError);
  });
});
