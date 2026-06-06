import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyPresentationValue,
  redactPresentationText,
  redactPresentationValue
} from "../../src/presentation/redaction.js";

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
});
