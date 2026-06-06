import { describe, expect, it } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import {
  JS_TS_TREE_SITTER_GRAMMARS,
  jsTsTreeSitterGrammarForLanguage,
  jsTsTreeSitterGrammarForPath
} from "../../src/infrastructure/tree-sitter/index.js";

describe("JavaScript/TypeScript tree-sitter parser path", () => {
  it("uses the approved JS/TS grammar packages without compiler or LSP dependencies", () => {
    expect(JS_TS_TREE_SITTER_GRAMMARS).toEqual({
      javascript: "tree-sitter-javascript",
      typescript: "tree-sitter-typescript",
      tsx: "tree-sitter-typescript"
    });
    expect(packageJson.dependencies).toMatchObject({
      "tree-sitter-javascript": expect.any(String),
      "tree-sitter-typescript": expect.any(String)
    });
    expect(packageJson.dependencies).not.toHaveProperty("typescript-eslint");
    expect(packageJson.dependencies).not.toHaveProperty("tsserver");
  });

  it("maps JS, TS, JSX, and TSX files to the parser grammar selected for T004 extraction", () => {
    expect(jsTsTreeSitterGrammarForLanguage("javascript")).toBe("javascript");
    expect(jsTsTreeSitterGrammarForLanguage("typescript")).toBe("typescript");
    expect(jsTsTreeSitterGrammarForLanguage("python")).toBeNull();
    expect(jsTsTreeSitterGrammarForPath("src/app.js")).toBe("javascript");
    expect(jsTsTreeSitterGrammarForPath("src/app.mjs")).toBe("javascript");
    expect(jsTsTreeSitterGrammarForPath("src/component.jsx")).toBe("javascript");
    expect(jsTsTreeSitterGrammarForPath("src/service.ts")).toBe("typescript");
    expect(jsTsTreeSitterGrammarForPath("src/page.tsx")).toBe("tsx");
    expect(jsTsTreeSitterGrammarForPath("src/service.py")).toBeNull();
  });
});
