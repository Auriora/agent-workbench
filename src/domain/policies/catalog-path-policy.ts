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
  "target",
  "test-artifacts",
  "testresults",
  "third_party",
  "thirdparty",
  "vendor",
  "venv"
] as const;

export const ALLOWED_HIDDEN_DIRECTORIES = [
  ".devcontainer",
  ".github"
] as const;

export const ALLOWED_HIDDEN_FILES = [
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

const DEFAULT_SKIPPED_DIRECTORY_NAMES = new Set<string>(DEFAULT_SKIPPED_ROOTS);
const ALLOWED_HIDDEN_DIRECTORY_NAMES = new Set<string>(ALLOWED_HIDDEN_DIRECTORIES);
const ALLOWED_HIDDEN_FILE_NAMES = new Set<string>(ALLOWED_HIDDEN_FILES);
const DEFAULT_SKIPPED_DIRECTORY_PREFIXES = ["cmake-build-"] as const;
const DEFAULT_SKIPPED_HIDDEN_DIRECTORY_SUFFIXES = ["-tests"] as const;
const DEFAULT_SKIPPED_FILE_EXTENSIONS = new Set([
  ".dll",
  ".exe",
  ".nupkg",
  ".pdb",
  ".snupkg",
  ".wasm"
]);
const SECRET_ENV_PATTERN = /(^|\/)\.env(?:$|\.(?!example$|sample$|template$)[^/]+$)/u;

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

export function shouldSkipCatalogPath(input: {
  relativePath: string;
  isDirectory: boolean;
  skippedRoots: readonly string[];
  gitignoreRules?: readonly GitignoreRule[];
}): boolean {
  const relativePath = normalizeCatalogPath(input.relativePath).replace(/^\.\/+/, "");
  if (relativePath.length === 0 || relativePath === ".") {
    return false;
  }
  if (isSecretEnvPath(relativePath)) {
    return true;
  }
  if (!input.isDirectory && hasSkippedFileExtension(relativePath)) {
    return true;
  }

  const segments = relativePath.split("/");
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  if (lowerSegments.some((segment) => DEFAULT_SKIPPED_DIRECTORY_NAMES.has(segment))) {
    return true;
  }
  if (lowerSegments.some((segment) => DEFAULT_SKIPPED_DIRECTORY_PREFIXES.some((prefix) => segment.startsWith(prefix)))) {
    return true;
  }
  if (
    lowerSegments.some((segment) =>
      segment.startsWith(".") &&
      DEFAULT_SKIPPED_HIDDEN_DIRECTORY_SUFFIXES.some((suffix) => segment.endsWith(suffix))
    )
  ) {
    return true;
  }
  if (hasSkippedRoot(relativePath, input.skippedRoots)) {
    return true;
  }
  if (isHiddenPathSkippedByDefault(relativePath, input.isDirectory)) {
    return true;
  }
  return isIgnoredByGitignore({
    relativePath,
    isDirectory: input.isDirectory,
    rules: input.gitignoreRules ?? []
  });
}

function hasSkippedFileExtension(relativePath: string): boolean {
  const basename = relativePath.slice(relativePath.lastIndexOf("/") + 1).toLowerCase();
  const dot = basename.lastIndexOf(".");
  return dot > 0 && DEFAULT_SKIPPED_FILE_EXTENSIONS.has(basename.slice(dot));
}

export function isExplicitHiddenCatalogPathAllowed(relativePath: string): boolean {
  const normalized = normalizeCatalogPath(relativePath).replace(/^\.\/+/, "");
  if (normalized.length === 0 || normalized === ".") {
    return true;
  }
  if (isSecretEnvPath(normalized)) {
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

function isSecretEnvPath(relativePath: string): boolean {
  return relativePath === ".env" || relativePath.endsWith("/.env") || SECRET_ENV_PATTERN.test(relativePath);
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
