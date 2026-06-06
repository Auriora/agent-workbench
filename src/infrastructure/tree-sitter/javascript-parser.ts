export const JS_TS_TREE_SITTER_GRAMMARS = {
  javascript: "tree-sitter-javascript",
  typescript: "tree-sitter-typescript",
  tsx: "tree-sitter-typescript"
} as const;

export type JsTsTreeSitterLanguage = keyof typeof JS_TS_TREE_SITTER_GRAMMARS;

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
