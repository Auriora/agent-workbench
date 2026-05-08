import { describe, expect, it } from "vitest";
import { extractPythonSymbols } from "../../src/infrastructure/tree-sitter/python-parser.js";

describe("python tree-sitter adapter", () => {
  it("extracts classes and functions without alternate parser fallbacks", () => {
    const symbols = extractPythonSymbols(`
class Runner:
    def run(self):
        return helper()

def helper():
    return "ok"
`);

    expect(symbols.map((symbol) => `${symbol.kind}:${symbol.name}`)).toEqual([
      "class:Runner",
      "function:run",
      "function:helper"
    ]);
  });
});
