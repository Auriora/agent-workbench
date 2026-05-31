import fs from "node:fs";
import path from "node:path";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import { buildFileCatalogEntry } from "../../domain/policies/index.js";
import type { FileCatalogScanPort, FileCatalogScanResult, FileIdentityPort } from "../../ports/index.js";
import { FileIdentityAdapter } from "./file-identity.js";

const DEFAULT_SKIPPED_DIRECTORY_NAMES = new Set([
  ".cache",
  ".git",
  ".pytest_cache",
  ".ruff_cache",
  "__pycache__",
  "coverage",
  "dist",
  "node_modules"
]);

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function isInsideRoot(relativePath: string, root: string): boolean {
  const normalizedRoot = normalizePath(root).replace(/^\/+|\/+$/g, "");
  return normalizedRoot === "." || relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`);
}

function shouldSkipRelativePath(relativePath: string, skippedRoots: readonly string[]): boolean {
  const segments = relativePath.split("/");
  if (segments.some((segment) => DEFAULT_SKIPPED_DIRECTORY_NAMES.has(segment))) {
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
      skipped_roots: input.skipped_roots,
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
    children.sort((left, right) => left.name.localeCompare(right.name));

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
        await this.scanDirectory({ ...input, directory: absolutePath });
        continue;
      }

      if (!child.isFile()) {
        continue;
      }

      const content = fs.readFileSync(absolutePath, "utf8");
      const fileIdentity = await this.fileIdentity.compute({
        path: absolutePath,
        content
      });
      input.entries.push(
        buildFileCatalogEntry({
          file_identity: {
            ...fileIdentity,
            path: relativePath
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
