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
  PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES,
  classifyPresentationValue,
  redactPresentationText,
  redactPresentationValue,
  sanitizePublicMcpFailureMessage,
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

  it("redacts embedded tilde, srv/data, UNC, and extended Windows paths", () => {
    const redacted = redactPresentationText(
      [
        "Use ~/secrets/graph.sqlite",
        "mirror /srv/cache/index.db",
        "archive /data/exports/orders.json",
        String.raw`\\fileserver\share\secrets\graph.sqlite`,
        String.raw`\\?\C:\Users\example\secret.txt`,
        String.raw`\\?\UNC\fileserver\share\secret.txt`
      ].join(" "),
      { context: "message" }
    );

    expect(redacted).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(redacted).not.toContain("~/secrets/graph.sqlite");
    expect(redacted).not.toContain("/srv/cache/index.db");
    expect(redacted).not.toContain("/data/exports/orders.json");
    expect(redacted).not.toContain(String.raw`\\fileserver\share\secrets\graph.sqlite`);
    expect(redacted).not.toContain(String.raw`\\?\C:\Users\example\secret.txt`);
    expect(redacted).not.toContain(String.raw`\\?\UNC\fileserver\share\secret.txt`);
    expect(redactPresentationText(redacted, { context: "message" })).toBe(redacted);
  });

  it("redacts structured secret assignments and authorization headers", () => {
    const redacted = redactPresentationText(
      [
        '{"token": "abc123"}',
        "password: hunter2",
        "secret = topsecret",
        "api_key: key-123",
        "Authorization: Bearer bearer-token",
        "Authorization: Basic dXNlcjpwYXNz"
      ].join(" "),
      { context: "message" }
    );

    expect(redacted).toContain('"token": "[REDACTED]"');
    expect(redacted).toContain("password: [REDACTED]");
    expect(redacted).toContain("secret = [REDACTED]");
    expect(redacted).toContain("api_key: [REDACTED]");
    expect(redacted).toContain("Authorization: Bearer [REDACTED]");
    expect(redacted).toContain("Authorization: Basic [REDACTED]");
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("hunter2");
    expect(redacted).not.toContain("topsecret");
    expect(redacted).not.toContain("key-123");
    expect(redacted).not.toContain("bearer-token");
    expect(redacted).not.toContain("dXNlcjpwYXNz");
    expect(redactPresentationText(redacted, { context: "message" })).toBe(redacted);
  });

  it("redacts host paths after bracket and comma delimiters", () => {
    const hostile = String.raw`paths:[/data/secret.txt],~/private/key,[/srv/cache.db],\\fileserver\share\secret.txt,[\\?\C:\Users\example\secret.txt]`;
    const redacted = redactPresentationText(hostile, { context: "message" });

    expect(redacted).toBe(
      "paths:[[REDACTED_ABSOLUTE_PATH]],[REDACTED_ABSOLUTE_PATH],[[REDACTED_ABSOLUTE_PATH]],[REDACTED_ABSOLUTE_PATH],[[REDACTED_ABSOLUTE_PATH]]"
    );
    expect(redacted).not.toContain("/data/secret.txt");
    expect(redacted).not.toContain("~/private/key");
    expect(redacted).not.toContain("/srv/cache.db");
    expect(redacted).not.toContain(String.raw`\\fileserver\share\secret.txt`);
    expect(redacted).not.toContain(String.raw`\\?\C:\Users\example\secret.txt`);
    expect(redactPresentationText(redacted, { context: "message" })).toBe(redacted);
  });

  it("redacts embedded unsafe tokens while preserving route fragments in source text", () => {
    const redacted = redactPresentationText(
      "GET /api/orders from /home/example/.ssh/id_rsa via ../outside/secrets.txt with TOKEN=abc123 and Authorization: Bearer abc123",
      { context: "source" }
    );

    expect(redacted).toContain("/api/orders");
    expect(redacted).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(redacted).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(redacted).toContain("TOKEN=[REDACTED]");
    expect(redacted).toContain("Authorization: Bearer [REDACTED]");
    expect(redacted).not.toContain("/home/example");
    expect(redacted).not.toContain("../outside");
  });

  it("keeps safe routes, URLs, repo-relative paths, prose, and non-secret authorization text unchanged", () => {
    const source = redactPresentationText(
      "GET /api/orders, /data, and /srv from https://example.com/api/orders in src/routes/orders.ts; Retry: later; authorization required for access; Authorization: Basic access required; Authorization: Bearer access required.",
      { context: "source" }
    );

    expect(source).toContain("/api/orders");
    expect(source).toContain("/data");
    expect(source).toContain("/srv");
    expect(source).toContain("https://example.com/api/orders");
    expect(source).toContain("src/routes/orders.ts");
    expect(source).toContain("Retry: later");
    expect(source).toContain("authorization required for access;");
    expect(source).toContain("Authorization: Basic access required");
    expect(source).toContain("Authorization: Bearer access required");
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

  it("sanitizes public MCP failure messages with one idempotent bounded policy", () => {
    const hostile = [
      "Retry after the graph owner releases the lock.",
      "/home/example/private/graph.sqlite",
      String.raw`C:\Users\example\private\graph.sqlite`,
      "../outside/graph.sqlite",
      "TOKEN=abc123",
      "-----BEGIN PRIVATE KEY-----private-material-----END PRIVATE KEY-----"
    ].join(" ");

    const sanitized = sanitizePublicMcpFailureMessage(
      hostile,
      "The provider failed; inspect the error code and retry guidance."
    );

    expect(sanitized).toContain("Retry after the graph owner releases the lock.");
    expect(sanitized).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(sanitized).toContain("[REDACTED_WORKSPACE_ESCAPE]");
    expect(sanitized).toContain("TOKEN=[REDACTED]");
    expect(sanitized).toContain("[REDACTED_PRIVATE_KEY]");
    expect(sanitized).not.toContain("/home/example");
    expect(sanitized).not.toContain(String.raw`C:\Users\example`);
    expect(sanitized).not.toContain("../outside");
    expect(sanitized).not.toContain("abc123");
    expect(sanitizePublicMcpFailureMessage(sanitized, "unused fallback")).toBe(sanitized);
    expect(new TextEncoder().encode(sanitized).byteLength).toBeLessThanOrEqual(
      PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES
    );
  });

  it("uses the fixed caller fallback for empty or marker-only public failures", () => {
    const fallback = "The provider failed; inspect the error code and retry guidance.";

    expect(sanitizePublicMcpFailureMessage("", fallback)).toBe(fallback);
    expect(sanitizePublicMcpFailureMessage("/home/example/private.sqlite", fallback)).toBe(fallback);
    expect(sanitizePublicMcpFailureMessage("TOKEN=abc123", fallback)).toBe(fallback);
    expect(sanitizePublicMcpFailureMessage('{"token":"abc123"}', fallback)).toBe(fallback);
    expect(sanitizePublicMcpFailureMessage("Authorization: Bearer abc123", fallback)).toBe(fallback);
    expect(sanitizePublicMcpFailureMessage("[REDACTED_ABSOLUTE_PATH]", fallback)).toBe(fallback);
    expect(() => sanitizePublicMcpFailureMessage("safe", "TOKEN=abc123")).toThrow(
      "Public MCP failure fallback must contain fixed actionable text."
    );
  });

  it("bounds public failure text to 512 UTF-8 bytes without splitting a character", () => {
    const sanitized = sanitizePublicMcpFailureMessage(
      `Retry later. ${"🧭".repeat(200)}`,
      "The provider failed; retry later."
    );

    expect(new TextEncoder().encode(sanitized).byteLength).toBeLessThanOrEqual(
      PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES
    );
    expect(sanitized).toMatch(/🧭$/u);
    expect(sanitized).not.toContain("�");
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
