import { describe, expect, it } from "vitest";
import { extractPython, extractPythonSymbols } from "../../src/infrastructure/tree-sitter/python-parser.js";

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

  it("extracts qualified names, signatures, docstrings, imports, and calls", () => {
    const extracted = extractPython(`
from sample_pkg import Runner

class Service:
    """Runs services."""
    def run(self) -> str:
        return helper()

def helper() -> str:
    return Runner()
`);

    expect(extracted.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "class",
          name: "Service",
          qualifiedName: "Service",
          docstring: "Runs services."
        }),
        expect.objectContaining({
          kind: "function",
          name: "run",
          qualifiedName: "Service.run",
          signature: "def run(self) -> str:"
        }),
        expect.objectContaining({
          kind: "function",
          name: "helper",
          qualifiedName: "helper"
        })
      ])
    );
    expect(extracted.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "import",
          name: "Runner"
        }),
        expect.objectContaining({
          kind: "call",
          name: "helper",
          sourceQualifiedName: "Service.run"
        }),
        expect.objectContaining({
          kind: "call",
          name: "Runner",
          sourceQualifiedName: "helper"
        })
      ])
    );
  });
});
