import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";

export const JS_TS_TREE_SITTER_GRAMMARS = {
  javascript: "tree-sitter-javascript",
  typescript: "tree-sitter-typescript",
  tsx: "tree-sitter-typescript"
} as const;

export type JsTsTreeSitterLanguage = keyof typeof JS_TS_TREE_SITTER_GRAMMARS;

const parsers = new Map<JsTsTreeSitterLanguage, Parser>();

export function jsTsTreeSitterGrammarForLanguage(language: string): JsTsTreeSitterLanguage | null {
  if (language === "javascript") {
    return "javascript";
  }
  if (language === "typescript") {
    return "typescript";
  }
  return null;
}

export function jsTsTreeSitterGrammarForPath(filePath: string): JsTsTreeSitterLanguage | null {
  const lower = filePath.toLowerCase();
  if (/\.[cm]?jsx?$/u.test(lower)) {
    return "javascript";
  }
  if (lower.endsWith(".tsx")) {
    return "tsx";
  }
  if (/\.[cm]?ts$/u.test(lower)) {
    return "typescript";
  }
  return null;
}

export function parseJsTs(input: { filePath: string; language: string; content: string }): Parser.Tree {
  const grammar = jsTsTreeSitterGrammarForPath(input.filePath) ?? jsTsTreeSitterGrammarForLanguage(input.language);
  if (grammar === null) {
    throw new Error(`No JS/TS tree-sitter grammar is configured for ${input.language}:${input.filePath}`);
  }
  return parserFor(grammar).parse(input.content);
}

function parserFor(grammar: JsTsTreeSitterLanguage): Parser {
  const existing = parsers.get(grammar);
  if (existing !== undefined) {
    return existing;
  }
  const parser = new Parser();
  parser.setLanguage(languageFor(grammar) as Parser.Language);
  parsers.set(grammar, parser);
  return parser;
}

function languageFor(grammar: JsTsTreeSitterLanguage): unknown {
  if (grammar === "javascript") {
    return JavaScript;
  }
  return grammar === "tsx" ? TypeScript.tsx : TypeScript.typescript;
}
