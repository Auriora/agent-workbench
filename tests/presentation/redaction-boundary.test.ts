/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GetTaskContextResult } from "../../src/application/use-cases/get-task-context.js";
import type { SymbolReference } from "../../src/contracts/index.js";
import {
  classifyPresentationValue,
  redactPresentationText,
  redactPresentationValue,
  sanitizeSymbolReference
} from "../../src/presentation/redaction.js";
import { buildTaskContextEnvelope } from "../../src/presentation/task-context-presenter.js";

const fixturePath = path.resolve("tests/fixtures/fixture-redaction-boundary/src/routes.ts");

describe("presentation redaction boundary", () => {
  it("keeps route and URL-like source snippets visible", () => {
    const source = fs.readFileSync(fixturePath, "utf8");

    expect(source).toContain('"/api/orders"');
    expect(classifyPresentationValue("/api/orders", { context: "source" })).toMatchObject({
      kind: "source_text",
      redacted: false
    });
    expect(classifyPresentationValue("/assets/orders/list.json", { context: "source" })).toMatchObject({
      kind: "source_text",
      redacted: false
    });
    expect(redactPresentationValue("/api/orders", { context: "source" }).value).toBe("/api/orders");
  });

  it("classifies path-typed values without treating source routes as paths", () => {
    expect(classifyPresentationValue("src/routes/orders.ts", { context: "path" })).toMatchObject({
      kind: "repo_relative_path",
      redacted: false
    });
    expect(classifyPresentationValue("/api/orders", { context: "source" })).toMatchObject({
      kind: "source_text",
      redacted: false
    });
  });

  it("redacts absolute host paths, workspace escapes, and secret-like values", () => {
    expect(redactPresentationValue("/home/example/.ssh/id_rsa", { context: "message" })).toMatchObject({
      kind: "absolute_path",
      value: "[REDACTED_ABSOLUTE_PATH]",
      redacted: true
    });
    expect(redactPresentationValue("../outside/secrets.txt", { context: "message" })).toMatchObject({
      kind: "workspace_escape",
      value: "[REDACTED_WORKSPACE_ESCAPE]",
      redacted: true
    });
    expect(redactPresentationValue("TOKEN=abc123", { context: "source" })).toMatchObject({
      kind: "secret_like",
      value: "TOKEN=[REDACTED]",
      redacted: true
    });
  });

  it("redacts embedded unsafe tokens while preserving route fragments in source text", () => {
    const redacted = redactPresentationText(
      "GET /api/orders from /home/example/.ssh/id_rsa via ../outside/secrets.txt with TOKEN=abc123",
      { context: "source" }
    );

    expect(redacted).toContain("/api/orders");
    expect(redacted).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(redacted).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(redacted).toContain("TOKEN=[REDACTED]");
    expect(redacted).not.toContain("/home/example");
    expect(redacted).not.toContain("../outside");
  });

  it("sanitizes every free-text symbol field without changing typed paths or the input", () => {
    const input = fixtureSymbol();
    const original = structuredClone(input);

    const sanitized = sanitizeSymbolReference(input);

    expect(sanitized.path).toBe("src/routes/orders.ts");
    expect(sanitized.source_section?.path).toBe("src/routes/orders.ts");
    expect(sanitized.signature).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(sanitized.signature).toContain("/api/orders");
    expect(sanitized.docstring).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(sanitized.source_section?.text).toContain("TOKEN=[REDACTED]");
    expect(sanitized.source_section?.text).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(sanitized.source_section?.text).toContain("/api/orders");
    expect(JSON.stringify(sanitized)).not.toContain(fixtureValue("traversalLikeValue"));
    expect(JSON.stringify(sanitized)).not.toContain(fixtureValue("windowsHostPath"));
    expect(JSON.stringify(sanitized)).not.toContain(fixtureValue("absoluteHostPath"));
    expect(JSON.stringify(sanitized)).not.toContain("abc123");
    expect(input).toEqual(original);
  });

  it("applies symbol redaction parity to context_for_task ranked symbols", () => {
    const envelope = buildTaskContextEnvelope(taskContextResult(fixtureSymbol()));
    const symbol = envelope.data.ranked_symbols[0]?.symbol;

    expect(symbol?.path).toBe("src/routes/orders.ts");
    expect(symbol?.signature).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(symbol?.docstring).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(symbol?.source_section?.text).toContain("TOKEN=[REDACTED]");
    expect(symbol?.source_section?.text).toContain("/api/orders");
    expect(JSON.stringify(symbol)).not.toContain("abc123");
    expect(JSON.stringify(symbol)).not.toContain(fixtureValue("windowsHostPath"));
  });
});

function fixtureValue(name: string): string {
  const source = fs.readFileSync(fixturePath, "utf8");
  const match = new RegExp(`export const ${name} = ("(?:[^"\\\\]|\\\\.)*");`, "u").exec(source);
  if (match?.[1] === undefined) {
    throw new Error(`Fixture value ${name} was not found.`);
  }
  return JSON.parse(match[1]) as string;
}

function fixtureSymbol(): SymbolReference {
  return {
    node_id: "fixture-symbol",
    kind: "variable",
    name: "fixtureValue",
    qualified_name: "routes.fixtureValue",
    path: "src/routes/orders.ts",
    language: "typescript",
    source_range: { start_line: 7, start_column: 0, end_line: 14, end_column: 1 },
    signature: `fixtureValue(path = "${fixtureValue("traversalLikeValue")}", route = "${fixtureValue("orderRoute")}", token = "${fixtureValue("tokenLikeValue")}")`,
    docstring: `Reads ${fixtureValue("windowsHostPath")} and ${fixtureValue("absoluteHostPath")}`,
    capability_level: "partial_semantic",
    evidence_kinds: ["parser"],
    source_section: {
      path: "src/routes/orders.ts",
      start_line: 7,
      end_line: 14,
      byte_count: 300,
      truncated: false,
      text: [
        fixtureValue("mixedSource"),
        fixtureValue("windowsHostPath"),
        fixtureValue("traversalLikeValue")
      ].join("\n")
    }
  };
}

function taskContextResult(symbol: SymbolReference): GetTaskContextResult {
  return {
    context: {
      task: "Inspect redaction boundary",
      repo_root: "/fixture",
      summary: "Fixture context.",
      requested_files: [],
      related_files: [],
      ranked_symbols: [{ rank: 1, score: 1, symbol, reason: "Fixture symbol." }],
      governing_docs: [],
      lifecycle_evidence: [],
      validation_hints: [],
      skipped_work: [],
      completeness: { complete_enough: true, markers: [], caveats: [] },
      risks: [],
      next_actions: []
    },
    meta: {
      analysis_validity: "valid",
      freshness: "fresh",
      scope: { repo_root: "/fixture", indexed_roots: ["."], skipped_roots: [], languages: ["typescript"] },
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      verification_status: "needed",
      truncated: false
    }
  };
}
