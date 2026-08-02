/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  SKIPPED_PATH_SAMPLE_LIMIT,
  createSkippedPathPopulationAccumulator
} from "../../src/domain/policies/index.js";

describe("skipped-path population summary", () => {
  it("deduplicates, conserves exact counts, and retains lexical top-three samples", () => {
    const accumulator = createSkippedPathPopulationAccumulator<"generated_or_vendor" | "secret">();
    for (const path of ["vendor/z", "vendor/b", "vendor/a", "vendor/c", "vendor/a"]) {
      accumulator.record({ path, reason: "generated_or_vendor" });
    }
    accumulator.record({ path: ".env", reason: "secret" });

    expect(SKIPPED_PATH_SAMPLE_LIMIT).toBe(3);
    expect(accumulator.finalize()).toEqual({
      total_count: 5,
      groups: [
        {
          reason: "generated_or_vendor",
          count: 4,
          sample_paths: ["vendor/a", "vendor/b", "vendor/c"],
          sample_truncated: true
        },
        {
          reason: "secret",
          count: 1,
          sample_paths: [".env"],
          sample_truncated: false
        }
      ]
    });
  });

  it("is stable across input permutations and normalizes repository-relative separators", () => {
    const observations = ["dist\\z", "./dist/a/", "dist/m", "dist/b"];
    const summarize = (paths: readonly string[]) => {
      const accumulator = createSkippedPathPopulationAccumulator<"generated_or_vendor">();
      for (const path of paths) accumulator.record({ path, reason: "generated_or_vendor" });
      return accumulator.finalize();
    };

    expect(summarize(observations)).toEqual(summarize([...observations].reverse()));
    expect(summarize([])).toEqual({ total_count: 0, groups: [] });
  });
});
