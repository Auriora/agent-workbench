import fs from "node:fs";
import path from "node:path";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { buildFileCatalogEntry } from "../../domain/policies/index.js";
import type { FileCatalogScanPort, FileCatalogScanResult, FileIdentityPort } from "../../ports/index.js";
import { FileIdentityAdapter } from "./file-identity.js";

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
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "test-artifacts",
  "third_party",
  "thirdparty",
  "vendor",
  "venv"
] as const;

const DEFAULT_SKIPPED_DIRECTORY_NAMES = new Set<string>(DEFAULT_SKIPPED_ROOTS);
const DEFAULT_SKIPPED_DIRECTORY_PREFIXES = ["cmake-build-"] as const;
const DEFAULT_SKIPPED_HIDDEN_DIRECTORY_SUFFIXES = ["-tests"] as const;

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function isInsideRoot(relativePath: string, root: string): boolean {
  const normalizedRoot = normalizePath(root).replace(/^\/+|\/+$/g, "");
  return normalizedRoot === "." || relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`);
}

function shouldSkipRelativePath(relativePath: string, skippedRoots: readonly string[]): boolean {
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

  return skippedRoots.some((root) => {
    const normalizedRoot = normalizePath(root).replace(/^\/+|\/+$/g, "");
    return normalizedRoot.length > 0 && isInsideRoot(relativePath, normalizedRoot);
  });
}

export class FileCatalogScannerAdapter implements FileCatalogScanPort {
  private readonly fileIdentity: FileIdentityPort;

  constructor(input: { fileIdentity?: FileIdentityPort } = {}) {
    this.fileIdentity = input.fileIdentity ?? new FileIdentityAdapter();
  }

  public async scan(input: {
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
    max_files: number;
  }): Promise<FileCatalogScanResult> {
    const repoRoot = path.resolve(input.repo_root);
    const indexedRoots = input.indexed_roots.length > 0 ? input.indexed_roots : ["."];
    const entries: FileCatalogEntry[] = [];
    let truncated = false;

    for (const indexedRoot of indexedRoots) {
      if (truncated) {
        break;
      }
      const absoluteRoot = path.resolve(repoRoot, indexedRoot);
      if (!isInsideRepo(repoRoot, absoluteRoot) || fs.existsSync(absoluteRoot) === false) {
        continue;
      }

      await this.scanDirectory({
        repoRoot,
        directory: absoluteRoot,
        indexedRoots,
        skippedRoots: input.skipped_roots,
        maxFiles: input.max_files,
        entries,
        setTruncated: () => {
          truncated = true;
        }
      });
    }

    entries.sort((left, right) => left.path.localeCompare(right.path));

    return {
      repo_root: repoRoot,
      indexed_roots: indexedRoots,
      skipped_roots: mergeSkippedRoots(input.skipped_roots),
      files: entries,
      truncated
    };
  }

  private async scanDirectory(input: {
    repoRoot: string;
    directory: string;
    indexedRoots: readonly string[];
    skippedRoots: readonly string[];
    maxFiles: number;
    entries: FileCatalogEntry[];
    setTruncated: () => void;
  }): Promise<void> {
    if (input.entries.length >= input.maxFiles) {
      input.setTruncated();
      return;
    }

    const children = fs.readdirSync(input.directory, { withFileTypes: true });
    children.sort(compareCatalogEntries);

    for (const child of children) {
      if (input.entries.length >= input.maxFiles) {
        input.setTruncated();
        return;
      }

      const absolutePath = path.join(input.directory, child.name);
      const relativePath = normalizePath(path.relative(input.repoRoot, absolutePath));
      if (shouldSkipRelativePath(relativePath, input.skippedRoots)) {
        continue;
      }

      if (child.isDirectory()) {
        if (isNestedGitRepository(input.repoRoot, absolutePath)) {
          continue;
        }
        await this.scanDirectory({ ...input, directory: absolutePath });
        continue;
      }

      if (!child.isFile()) {
        continue;
      }

      const stats = fs.statSync(absolutePath);
      const language = await this.fileIdentity.inferLanguage({ path: absolutePath });
      input.entries.push(
        buildFileCatalogEntry({
          file_identity: {
            path: relativePath,
            language,
            content_hash: `stat:${stats.size}:${Math.trunc(stats.mtimeMs)}`,
            size_bytes: stats.size,
            mtime_ms: stats.mtimeMs
          }
        })
      );
    }
  }
}

function isInsideRepo(repoRoot: string, absolutePath: string): boolean {
  const relative = path.relative(repoRoot, absolutePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isNestedGitRepository(repoRoot: string, absolutePath: string): boolean {
  if (path.resolve(repoRoot) === path.resolve(absolutePath)) {
    return false;
  }
  return fs.existsSync(path.join(absolutePath, ".git"));
}

function mergeSkippedRoots(skippedRoots: readonly string[]): string[] {
  return Array.from(new Set([...DEFAULT_SKIPPED_ROOTS, ...skippedRoots])).sort();
}

function compareCatalogEntries(left: fs.Dirent, right: fs.Dirent): number {
  return catalogTraversalPriority(left) - catalogTraversalPriority(right) || left.name.localeCompare(right.name);
}

function catalogTraversalPriority(entry: fs.Dirent): number {
  const name = entry.name.toLowerCase();
  if (entry.isDirectory()) {
    if (["src", "lib", "app", "cmd", "internal", "include"].includes(name)) return 0;
    if (["test", "tests", "__tests__"].includes(name)) return 5;
    if (["docs", "doc", "documentation"].includes(name)) return 60;
    if (name === ".github") return 70;
    return 30;
  }

  if (isProjectShapeFile(name)) return 0;
  if (isSourceLikeFile(name)) return 5;
  if (name.includes("test") || name.includes("spec")) return 8;
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".mdx")) return 60;
  if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".yml") || name.endsWith(".toml")) return 20;
  return 30;
}

function isProjectShapeFile(name: string): boolean {
  return [
    "pyproject.toml",
    "package.json",
    "go.mod",
    "go.work",
    "makefile",
    "cmakelists.txt",
    "dockerfile"
  ].includes(name);
}

function isSourceLikeFile(name: string): boolean {
  return /\.(py|pyi|ts|tsx|js|jsx|mjs|cjs|cs|go|rs|java|c|cc|cpp|cxx|h|hh|hpp|hxx|sh)$/u.test(name);
}
