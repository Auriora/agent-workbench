/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyPathPolicy, parseGitignoreRules } from "../../src/domain/policies/path-policy.js";

describe("pre-compilation policy parity", () => {
  it("preserves the 500 independently captured full pre-T003 policy outcomes", () => {
    const golden = JSON.parse(fs.readFileSync(new URL("../fixtures/path-policy-precompiled-golden.json", import.meta.url), "utf8")) as {
      source_commit: string;
      schema_version: number;
      policies: string[]; paths: string[]; outcomes: unknown[];
      cases: Array<[number, number, boolean, number]>;
    };
    expect(golden.source_commit).toBe("e287e1a");
    expect(golden.schema_version).toBe(1);
    expect(golden.cases).toHaveLength(500);
    for (const [policy, file, isDirectory, expected] of golden.cases) {
      expect(classifyPathPolicy({ relativePath: golden.paths[file], isDirectory,
        gitignoreRules: parseGitignoreRules(golden.policies[policy]) }),
      JSON.stringify({ policy: golden.policies[policy], path: golden.paths[file], isDirectory })).toEqual(golden.outcomes[expected]);
    }
  });
});
