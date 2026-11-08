/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RepositoryGraphBuildSliceResult } from "../../application/use-cases/index-repository-graph.js";

/** Reuse this worker only for canonical, already committed resolution continuations. */
export async function finishRefreshResolutionPages(input: {
  result: RepositoryGraphBuildSliceResult;
  run_slice: () => Promise<RepositoryGraphBuildSliceResult>;
  is_resolving: () => Promise<boolean>;
  should_yield: () => boolean;
}): Promise<RepositoryGraphBuildSliceResult> {
  let result = input.result;
  while (result.outcome === "partial" && result.partial_kind === "continue_build") {
    // A real file name may be "resolve:7". Only authoritative durable phase
    // evidence permits another slice in this pass; extraction never loops here.
    if (!await input.is_resolving()) return result;
    const before = resolutionOrdinal(result.continuation_cursor);
    if (input.should_yield()) return result;
    const next = await input.run_slice();
    if (next.outcome === "partial") {
      if (next.partial_kind !== "continue_build" || resolutionOrdinal(next.continuation_cursor) <= before) {
        throw new Error("Refresh resolution continuation did not advance its durable numeric cursor.");
      }
    }
    result = next;
  }
  return result;
}

function resolutionOrdinal(cursor: string | undefined): bigint {
  const match = /^resolve:(0|[1-9]\d*)$/u.exec(cursor ?? "");
  if (match === null) throw new Error("Refresh resolution continuation has an invalid numeric cursor.");
  return BigInt(match[1]!);
}
