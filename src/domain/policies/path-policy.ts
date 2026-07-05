/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const DEFAULT_SKIPPED_ROOTS = [
  ".cache",
  ".claude",
  ".codex",
  ".devenv",
  ".direnv",
  ".git",
  ".gocache",
  ".gradle",
  ".home",
  ".local",
  ".m2",
  ".mypy_cache",
  ".nox",
  ".npm",
  ".nuxt",
  ".pixi",
  ".pnpm-store",
  ".pytest_cache",
  ".ruff_cache",
  ".sandbox",
  ".terraform",
  ".tox",
  ".venv",
  ".yarn",
  "__pycache__",
  "3rdparty",
  "artifacts",
  "bin",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "obj",
  "publish",
  "target",
  "test-artifacts",
  "testresults",
  "third_party",
  "thirdparty",
  "vendor",
  "venv"
] as const;

export const ALLOWED_HIDDEN_DIRECTORIES = [
  ".agent-workbench",
  ".devcontainer",
  ".github"
] as const;

export const ALLOWED_HIDDEN_FILES = [
  ".aiignore",
  ".dockerignore",
  ".editorconfig",
  ".env.example",
  ".env.sample",
  ".env.template",
  ".eslintignore",
  ".eslintrc",
  ".eslintrc.cjs",
  ".eslintrc.js",
  ".eslintrc.json",
  ".gitattributes",
  ".gitignore",
  ".node-version",
  ".npmrc",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc",
  ".prettierrc.cjs",
  ".prettierrc.js",
  ".prettierrc.json",
  ".python-version",
  ".ruby-version",
  ".tool-versions"
] as const;

export type GitignoreRule = {
  pattern: string;
  negated: boolean;
  directoryOnly: boolean;
  anchored: boolean;
  hasSlash: boolean;
};

export const ROOT_IGNORE_FILE_NAMES = [".gitignore", ".aiignore"] as const;
export type RootIgnoreFileName = (typeof ROOT_IGNORE_FILE_NAMES)[number];

export type RootIgnoreFileContent = {
  name: RootIgnoreFileName;
  content: string;
};

export type PathPolicyCategory =
  | "source"
  | "generated"
  | "vendor"
  | "hidden"
  | "secret"
  | "ignored"
  | "nested_repo"
  | "configured_skip";

export type PathPolicyReason =
  | "source"
  | "generated_or_vendor"
  | "configured_skip"
  | "hidden_path"
  | "gitignore"
  | "secret"
  | "nested_git_repository";

export type PathClassification = {
  relativePath: string;
  category: PathPolicyCategory;
  reason: PathPolicyReason;
  readPolicy: "allow" | "skip" | "caution";
  writePolicy: "allow" | "refuse";
  redactionPolicy: "none" | "path_only" | "secret";
};

export type CatalogSkipReason = Exclude<PathPolicyReason, "source">;

const DEFAULT_SKIPPED_DIRECTORY_NAMES = new Set<string>(DEFAULT_SKIPPED_ROOTS);
const ALLOWED_HIDDEN_DIRECTORY_NAMES = new Set<string>(ALLOWED_HIDDEN_DIRECTORIES);
const ALLOWED_HIDDEN_FILE_NAMES = new Set<string>(ALLOWED_HIDDEN_FILES);
const DEFAULT_SKIPPED_DIRECTORY_PREFIXES = ["cmake-build-"] as const;
const DEFAULT_SKIPPED_HIDDEN_DIRECTORY_SUFFIXES = ["-tests"] as const;
const DEFAULT_SKIPPED_FILE_EXTENSIONS = new Set([
  ".br",
  ".coverage",
  ".coveragexml",
  ".dll",
  ".exe",
  ".gz",
  ".map",
  ".nupkg",
  ".pdb",
  ".snupkg",
  ".trx",
  ".wasm"
]);
const SECRET_ENV_PATTERN = /(^|\/)\.env(?:$|\.(?!example$|sample$|template$)[^/]+$)/u;
const SECRET_BASENAME_PATTERN =
  /^(?:\.envrc|credentials(?:\.[^/]+)?|secrets(?:\.[^/]+)?|.+\.(?:key|pem|p12|pfx))$/iu;

export function normalizeCatalogPath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function mergeSkippedRoots(skippedRoots: readonly string[]): string[] {
  return Array.from(new Set([...DEFAULT_SKIPPED_ROOTS, ...skippedRoots])).sort();
}

export function parseGitignoreRules(content: string): GitignoreRule[] {
  const rules: GitignoreRule[] = [];
  for (const rawLine of content.split(/\r?\n/u)) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const negated = trimmed.startsWith("!");
    const rawPattern = negated ? trimmed.slice(1) : trimmed;
    if (rawPattern.length === 0) {
      continue;
    }
    const directoryOnly = rawPattern.endsWith("/");
    const anchored = rawPattern.startsWith("/");
    const pattern = rawPattern.replace(/^\/+/u, "").replace(/\/+$/u, "");
    if (pattern.length === 0) {
      continue;
    }
    rules.push({
      pattern,
      negated,
      directoryOnly,
      anchored,
      hasSlash: pattern.includes("/")
    });
  }
  return rules;
}

export function parseRootIgnoreFileRules(ignoreFiles: readonly RootIgnoreFileContent[]): GitignoreRule[] {
  return ignoreFiles.flatMap((ignoreFile) => parseGitignoreRules(ignoreFile.content));
}

export function classifyPathPolicy(input: {
  relativePath: string;
  isDirectory: boolean;
  skippedRoots?: readonly string[];
  generatedRoots?: readonly string[];
  vendorRoots?: readonly string[];
  gitignoreRules?: readonly GitignoreRule[];
  hasNestedGitRepository?: boolean;
}): PathClassification {
  const relativePath = normalizeCatalogPath(input.relativePath).replace(/^\.\/+/, "");
  const baseInput = {
    relativePath,
    isDirectory: input.isDirectory,
    skippedRoots: input.skippedRoots ?? [],
    generatedRoots: input.generatedRoots ?? [],
    vendorRoots: input.vendorRoots ?? [],
    gitignoreRules: input.gitignoreRules ?? [],
    hasNestedGitRepository: input.hasNestedGitRepository ?? false
  };

  if (relativePath.length === 0 || relativePath === ".") {
    return sourceClassification(relativePath);
  }
  if (isSecretPath(relativePath)) {
    return skippedClassification(relativePath, "secret", "secret");
  }
  if (baseInput.hasNestedGitRepository) {
    return skippedClassification(relativePath, "nested_repo", "nested_git_repository");
  }
  if (!input.isDirectory && hasSkippedFileExtension(relativePath)) {
    return skippedClassification(relativePath, "generated", "generated_or_vendor");
  }

  const segments = relativePath.split("/");
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  if (lowerSegments.some((segment) => DEFAULT_SKIPPED_DIRECTORY_NAMES.has(segment))) {
    return skippedClassification(relativePath, vendorOrGeneratedCategory(lowerSegments), "generated_or_vendor");
  }
  if (lowerSegments.some((segment) => DEFAULT_SKIPPED_DIRECTORY_PREFIXES.some((prefix) => segment.startsWith(prefix)))) {
    return skippedClassification(relativePath, "generated", "generated_or_vendor");
  }
  if (
    lowerSegments.some((segment) =>
      segment.startsWith(".") &&
      DEFAULT_SKIPPED_HIDDEN_DIRECTORY_SUFFIXES.some((suffix) => segment.endsWith(suffix))
    )
  ) {
    return skippedClassification(relativePath, "generated", "generated_or_vendor");
  }
  if (hasSkippedRoot(relativePath, baseInput.generatedRoots)) {
    return skippedClassification(relativePath, "generated", "generated_or_vendor");
  }
  if (hasSkippedRoot(relativePath, baseInput.vendorRoots)) {
    return skippedClassification(relativePath, "vendor", "generated_or_vendor");
  }
  if (hasSkippedRoot(relativePath, baseInput.skippedRoots)) {
    return skippedClassification(relativePath, "configured_skip", "configured_skip");
  }
  if (isHiddenPathSkippedByDefault(relativePath, input.isDirectory)) {
    return skippedClassification(relativePath, "hidden", "hidden_path");
  }
  if (
    isIgnoredByGitignore({
      relativePath,
      isDirectory: input.isDirectory,
      rules: baseInput.gitignoreRules
    })
  ) {
    return skippedClassification(relativePath, "ignored", "gitignore");
  }
  return sourceClassification(relativePath);
}

export function shouldSkipCatalogPath(input: {
  relativePath: string;
  isDirectory: boolean;
  skippedRoots: readonly string[];
  generatedRoots?: readonly string[];
  vendorRoots?: readonly string[];
  gitignoreRules?: readonly GitignoreRule[];
  hasNestedGitRepository?: boolean;
}): boolean {
  return catalogSkipReason(input) !== null;
}

export function catalogSkipReason(input: {
  relativePath: string;
  isDirectory: boolean;
  skippedRoots: readonly string[];
  generatedRoots?: readonly string[];
  vendorRoots?: readonly string[];
  gitignoreRules?: readonly GitignoreRule[];
  hasNestedGitRepository?: boolean;
}): CatalogSkipReason | null {
  const classification = classifyPathPolicy(input);
  return classification.reason === "source" ? null : classification.reason;
}

export function isExplicitHiddenCatalogPathAllowed(relativePath: string): boolean {
  const normalized = normalizeCatalogPath(relativePath).replace(/^\.\/+/, "");
  if (normalized.length === 0 || normalized === ".") {
    return true;
  }
  if (isSecretPath(normalized)) {
    return false;
  }
  const segments = normalized.split("/");
  return segments.every((segment, index) => {
    if (!segment.startsWith(".")) {
      return true;
    }
    if (index < segments.length - 1) {
      return ALLOWED_HIDDEN_DIRECTORY_NAMES.has(segment.toLowerCase());
    }
    return ALLOWED_HIDDEN_FILE_NAMES.has(segment.toLowerCase()) || ALLOWED_HIDDEN_DIRECTORY_NAMES.has(segment.toLowerCase());
  });
}

function sourceClassification(relativePath: string): PathClassification {
  return {
    relativePath,
    category: "source",
    reason: "source",
    readPolicy: "allow",
    writePolicy: "allow",
    redactionPolicy: "none"
  };
}

function skippedClassification(
  relativePath: string,
  category: Exclude<PathPolicyCategory, "source">,
  reason: CatalogSkipReason
): PathClassification {
  return {
    relativePath,
    category,
    reason,
    readPolicy: "skip",
    writePolicy: "refuse",
    redactionPolicy: category === "secret" ? "secret" : "path_only"
  };
}

function vendorOrGeneratedCategory(lowerSegments: readonly string[]): "generated" | "vendor" {
  return lowerSegments.some((segment) =>
    ["3rdparty", "node_modules", "third_party", "thirdparty", "vendor", "venv", ".venv"].includes(segment)
  )
    ? "vendor"
    : "generated";
}

function hasSkippedFileExtension(relativePath: string): boolean {
  const basename = relativePath.slice(relativePath.lastIndexOf("/") + 1).toLowerCase();
  const dot = basename.lastIndexOf(".");
  return dot > 0 && DEFAULT_SKIPPED_FILE_EXTENSIONS.has(basename.slice(dot));
}

function isHiddenPathSkippedByDefault(relativePath: string, isDirectory: boolean): boolean {
  const segments = relativePath.split("/");
  for (const [index, segment] of segments.entries()) {
    if (!segment.startsWith(".")) {
      continue;
    }
    const lower = segment.toLowerCase();
    const isLeaf = index === segments.length - 1;
    if (ALLOWED_HIDDEN_DIRECTORY_NAMES.has(lower) && (!isLeaf || isDirectory)) {
      continue;
    }
    if (isLeaf && !isDirectory && ALLOWED_HIDDEN_FILE_NAMES.has(lower)) {
      continue;
    }
    return true;
  }
  return false;
}

function isSecretPath(relativePath: string): boolean {
  const basename = relativePath.slice(relativePath.lastIndexOf("/") + 1);
  return (
    relativePath === ".env" ||
    relativePath.endsWith("/.env") ||
    SECRET_ENV_PATTERN.test(relativePath) ||
    SECRET_BASENAME_PATTERN.test(basename)
  );
}

function hasSkippedRoot(relativePath: string, skippedRoots: readonly string[]): boolean {
  return skippedRoots.some((root) => {
    const normalizedRoot = normalizeCatalogPath(root).replace(/^\/+|\/+$/g, "");
    return normalizedRoot.length > 0 && (relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`));
  });
}

function isIgnoredByGitignore(input: {
  relativePath: string;
  isDirectory: boolean;
  rules: readonly GitignoreRule[];
}): boolean {
  let ignored = false;
  for (const rule of input.rules) {
    if (!gitignoreRuleMatches(rule, input.relativePath, input.isDirectory)) {
      continue;
    }
    ignored = !rule.negated;
  }
  return ignored;
}

function gitignoreRuleMatches(rule: GitignoreRule, relativePath: string, isDirectory: boolean): boolean {
  if (rule.directoryOnly && !isDirectory && relativePath !== rule.pattern && !relativePath.startsWith(`${rule.pattern}/`)) {
    return false;
  }
  if (rule.anchored || rule.hasSlash) {
    return pathPatternMatches(rule.pattern, relativePath) || relativePath.startsWith(`${rule.pattern}/`);
  }
  return relativePath.split("/").some((segment) => pathPatternMatches(rule.pattern, segment));
}

function pathPatternMatches(pattern: string, value: string): boolean {
  if (!pattern.includes("*")) {
    return pattern === value;
  }
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}$`, "u").test(value);
}
