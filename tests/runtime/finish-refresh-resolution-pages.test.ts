/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it, vi } from "vitest";
import type { RepositoryGraphBuildSliceResult } from "../../src/application/use-cases/index-repository-graph.js";
import { finishRefreshResolutionPages } from "../../src/infrastructure/workers/finish-refresh-resolution-pages.js";

const partial = (cursor: string, kind: "publish_seed" | "continue_build" = "continue_build"): RepositoryGraphBuildSliceResult => ({
  outcome: "partial", snapshot_id: "snapshot", continuation_cursor: cursor, partial_kind: kind, coverage: []
});
const complete: RepositoryGraphBuildSliceResult = { outcome: "complete", snapshot_id: "snapshot", coverage: [] };

describe("resolution work within one refresh pass", () => {
  it("always returns the mandatory seed without running another canonical slice", async () => {
    const seed = partial("resolve:0", "publish_seed");
    const run = vi.fn(async () => complete);
    const phase = vi.fn(async () => true);
    await expect(finishRefreshResolutionPages({ result: seed, run_slice: run, is_resolving: phase, should_yield: () => false })).resolves.toBe(seed);
    expect(run).not.toHaveBeenCalled();
    expect(phase).not.toHaveBeenCalled();
  });

  it("does not mistake a legitimate extraction file name for numeric resolution progress", async () => {
    const extracted = partial("resolve:7");
    const run = vi.fn(async () => complete);
    await expect(finishRefreshResolutionPages({ result: extracted, run_slice: run, is_resolving: async () => false, should_yield: () => false })).resolves.toBe(extracted);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs successive canonical numeric pages until completion without redispatching a worker", async () => {
    const results = [partial("resolve:9"), partial("resolve:10"), complete];
    const run = vi.fn(async () => results.shift()!);
    await expect(finishRefreshResolutionPages({ result: partial("resolve:0"), run_slice: run, is_resolving: async () => true, should_yield: () => false })).resolves.toBe(complete);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("yields only the last already committed page when another page cannot be admitted", async () => {
    const last = partial("resolve:5000");
    const run = vi.fn(async () => last);
    const yieldPage = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(finishRefreshResolutionPages({ result: partial("resolve:0"), run_slice: run, is_resolving: async () => true, should_yield: yieldPage })).resolves.toBe(last);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each(["resolve:0", "resolve:8", "resolve:bad", "file.py"])("rejects nonadvancing or invalid next cursor %s", async cursor => {
    await expect(finishRefreshResolutionPages({ result: partial("resolve:9"), run_slice: async () => partial(cursor), is_resolving: async () => true, should_yield: () => false })).rejects.toThrow();
  });

  it("compares durable ordinals without losing integer precision", async () => {
    const results = [partial("resolve:9007199254740993"), complete];
    await expect(finishRefreshResolutionPages({ result: partial("resolve:9007199254740992"), run_slice: async () => results.shift()!, is_resolving: async () => true, should_yield: () => false })).resolves.toBe(complete);
  });

  it("propagates actual phase failure without returning a prior partial as success", async () => {
    const failure = new Error("resolution allowance exhausted");
    await expect(finishRefreshResolutionPages({ result: partial("resolve:0"), run_slice: async () => { throw failure; }, is_resolving: async () => true, should_yield: () => false })).rejects.toBe(failure);
  });
});
