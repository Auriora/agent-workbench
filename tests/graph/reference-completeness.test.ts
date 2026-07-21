/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-reference-completeness");

describe("reference-completeness boundary fixtures", () => {
  it("models row 101 and each file-atomic classification without materializing filler files", () => {
    const catalogPaths = [
      "catalog/001-codex-session-start.js",
      "catalog/002-claude-session-start.js",
      ...Array.from(
        { length: 98 },
        (_, index) => `catalog/${String(index + 3).padStart(3, "0")}-virtual-filler.txt`
      ),
      "catalog/101-session-start-consumers.fixture.ts",
      "catalog/102-missing-after-row-100.ts",
      "catalog/103-same-line-double.ts",
      "catalog/104-oversized-reference.ts",
      "catalog/105-unreadable-reference.ts",
      "catalog/106-changed-reference.ts",
      "generated/107-policy-excluded-reference.ts"
    ];

    expect(catalogPaths).toHaveLength(107);
    expect(catalogPaths[99]).toBe("catalog/100-virtual-filler.txt");
    expect(catalogPaths[100]).toBe("catalog/101-session-start-consumers.fixture.ts");
    expect(catalogPaths[101]).toBe("catalog/102-missing-after-row-100.ts");

    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[100]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[101]!))).toBe(false);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[102]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[103]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[104]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[105]!))).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, catalogPaths[106]!))).toBe(true);

    const firstWindow = catalogPaths.slice(0, 100);
    const continuation = catalogPaths.filter((candidate) => candidate > firstWindow.at(-1)!);
    expect(firstWindow).toHaveLength(100);
    expect(continuation[0]).toBe("catalog/101-session-start-consumers.fixture.ts");
    expect(continuation).toContain("generated/107-policy-excluded-reference.ts");
  });

  it("locks the configured boundary identity and classification evidence", () => {
    const boundaries = JSON.parse(
      fs.readFileSync(path.join(FIXTURE_ROOT, "catalog-boundaries.json"), "utf8")
    );

    expect(boundaries.missing_after_row_100).toEqual({
      path: "catalog/102-missing-after-row-100.ts",
      catalog_row: 102,
      read_outcome: "missing"
    });
    expect(boundaries.oversized).toMatchObject({
      declared_size_bytes: 128_001,
      classification: "searchable_unresolved"
    });
    expect(boundaries.oversized.declared_size_bytes).toBeGreaterThan(128_000);
    expect(boundaries.unreadable).toMatchObject({
      read_outcome: "read_failure",
      classification: "searchable_unresolved"
    });
    expect(boundaries.changed.indexed_content_hash).not.toBe(
      boundaries.changed.observed_content_hash
    );
    expect(boundaries.changed.classification).toBe("searchable_unresolved");
    expect(boundaries.policy_excluded).toEqual({
      path: "generated/107-policy-excluded-reference.ts",
      indexed: false,
      reason: "generated_or_vendor",
      classification: "outside_evidence_universe"
    });
  });

  it.todo("Phase 2: outgoing parser references prove zero, exact-limit, limit-plus-one, and multi-page exhaustion");
  it.todo("Phase 2: incoming parser references prove zero, exact-limit, limit-plus-one, and multi-page exhaustion");
  it.todo("Phase 2: unresolved parser references prove zero, exact-limit, limit-plus-one, and multi-page exhaustion");
  it.todo("Phase 2: mixed parser routes drain outgoing, incoming, then unresolved without lexical fallback");
  it.todo("Phase 2: a composite cursor preserves disjoint route ownership and expires after key rotation");
});
