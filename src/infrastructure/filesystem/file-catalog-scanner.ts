import fs from "node:fs";
import path from "node:path";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import {
  buildFileCatalogEntry,
  mergeSkippedRoots,
  normalizeCatalogPath,
  parseGitignoreRules,
  shouldSkipCatalogPath,
  type GitignoreRule
} from "../../domain/policies/index.js";
import type { FileCatalogScanPort, FileCatalogScanResult, FileIdentityPort } from "../../ports/index.js";
import { FileIdentityAdapter } from "./file-identity.js";

function isInsideRoot(relativePath: string, root: string): boolean {
  const normalizedRoot = normalizeCatalogPath(root).replace(/^\/+|\/+$/g, "");
  return normalizedRoot === "." || relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`);
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
    const skippedRoots = new Set(input.skipped_roots);
    const gitignoreRules = readRootGitignoreRules(repoRoot);
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
        gitignoreRules,
        recordSkippedRoot: (root) => {
          skippedRoots.add(root);
        },
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
      skipped_roots: mergeSkippedRoots([...skippedRoots]),
      files: entries,
      truncated
    };
  }

  private async scanDirectory(input: {
    repoRoot: string;
    directory: string;
    indexedRoots: readonly string[];
    skippedRoots: readonly string[];
    gitignoreRules: readonly GitignoreRule[];
    recordSkippedRoot: (root: string) => void;
    maxFiles: number;
    entries: FileCatalogEntry[];
    setTruncated: () => void;
  }): Promise<void> {
    if (input.entries.length >= input.maxFiles) {
      input.setTruncated();
      return;
    }

    const children = readDirectoryOrSkip({
      repoRoot: input.repoRoot,
      directory: input.directory,
      recordSkippedRoot: input.recordSkippedRoot
    });
    if (children === null) {
      return;
    }
    children.sort(compareCatalogEntries);

    for (const child of children) {
      if (input.entries.length >= input.maxFiles) {
        input.setTruncated();
        return;
      }

      const absolutePath = path.join(input.directory, child.name);
      const relativePath = normalizeCatalogPath(path.relative(input.repoRoot, absolutePath));
      if (
        shouldSkipCatalogPath({
          relativePath,
          isDirectory: child.isDirectory(),
          skippedRoots: input.skippedRoots,
          gitignoreRules: input.gitignoreRules
        })
      ) {
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

      const stats = statFileOrSkip({
        repoRoot: input.repoRoot,
        absolutePath,
        recordSkippedRoot: input.recordSkippedRoot
      });
      if (stats === null) {
        continue;
      }
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

function readDirectoryOrSkip(input: {
  repoRoot: string;
  directory: string;
  recordSkippedRoot: (root: string) => void;
}): fs.Dirent[] | null {
  try {
    return fs.readdirSync(input.directory, { withFileTypes: true });
  } catch (error) {
    if (isSkippableFilesystemError(error)) {
      input.recordSkippedRoot(relativeCatalogPath(input.repoRoot, input.directory));
      return null;
    }
    throw error;
  }
}

function statFileOrSkip(input: {
  repoRoot: string;
  absolutePath: string;
  recordSkippedRoot: (root: string) => void;
}): fs.Stats | null {
  try {
    return fs.statSync(input.absolutePath);
  } catch (error) {
    if (isSkippableFilesystemError(error)) {
      input.recordSkippedRoot(relativeCatalogPath(input.repoRoot, input.absolutePath));
      return null;
    }
    throw error;
  }
}

function isSkippableFilesystemError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return ["EACCES", "EPERM", "ENOENT", "ENOTDIR"].includes(String(error.code));
}

function relativeCatalogPath(repoRoot: string, absolutePath: string): string {
  const relativePath = normalizeCatalogPath(path.relative(repoRoot, absolutePath));
  return relativePath.length === 0 ? "." : relativePath;
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

function compareCatalogEntries(left: fs.Dirent, right: fs.Dirent): number {
  return catalogTraversalPriority(left) - catalogTraversalPriority(right) || left.name.localeCompare(right.name);
}

function readRootGitignoreRules(repoRoot: string): GitignoreRule[] {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }
  try {
    return parseGitignoreRules(fs.readFileSync(gitignorePath, "utf8"));
  } catch (_error) {
    return [];
  }
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
