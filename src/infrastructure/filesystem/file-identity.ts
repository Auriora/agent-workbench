/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FileIdentityPort } from "../../ports/index.js";
import type { FileIdentity } from "../../domain/models/index.js";
import { catalogSkipReason, normalizeCatalogPath } from "../../domain/policies/index.js";
import { readRootIgnoreRules } from "./ignore-file-policy.js";

function hashText(value: string): string {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function hasRootPrefix(relativePath: string, roots: readonly string[]): boolean {
  return roots.some((root) => {
    const normalizedRoot = normalizeRelativePath(root).replace(/^\/+|\/+$/g, "");
    if (normalizedRoot.length === 0) {
      return false;
    }
    if (normalizedRoot === ".") {
      return true;
    }
    return relativePath === normalizedRoot || relativePath.startsWith(`${normalizedRoot}/`);
  });
}

export class FileIdentityAdapter implements FileIdentityPort {
  public async compute(input: { path: string; content: string }): Promise<FileIdentity> {
    const language = await this.inferLanguage({ path: input.path, content: input.content });
    const stats = fs.statSync(input.path);

    return {
      path: normalizeRelativePath(input.path),
      language,
      content_hash: hashText(input.content),
      size_bytes: stats.size,
      mtime_ms: stats.mtimeMs
    };
  }

  public async inferLanguage(input: { path: string; content?: string }): Promise<string> {
    const filename = normalizeRelativePath(path.basename(input.path)).toLowerCase();
    const ext = normalizeRelativePath(path.extname(input.path)).toLowerCase();
    const stem = filename.replace(/\.[^.]*$/, "");

    if (ext === ".py" || ext === ".pyi") {
      return "python";
    }

    if (ext === ".ts" || ext === ".tsx") {
      return "typescript";
    }

    if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
      return "javascript";
    }

    if (ext === ".cs" || ext === ".razor" || ext === ".cshtml") {
      return "csharp";
    }

    if (ext === ".go") {
      return "go";
    }

    if (ext === ".rs") {
      return "rust";
    }

    if (ext === ".java") {
      return "java";
    }

    if (ext === ".c") {
      return "c";
    }

    if (
      ext === ".cc" ||
      ext === ".cpp" ||
      ext === ".cxx" ||
      ext === ".h" ||
      ext === ".hh" ||
      ext === ".hpp" ||
      ext === ".hxx"
    ) {
      return "cpp";
    }

    if (ext === ".sh" || filename === "bashrc" || filename === "zshrc") {
      return "shell";
    }

    if (filename === "dockerfile" || ext === ".tf" || ext === ".tfvars") {
      return "infrastructure";
    }

    if (ext === ".yaml" || ext === ".yml") {
      return "yaml";
    }

    if (ext === ".md" || ext === ".markdown" || ext === ".mdx") {
      return "markdown";
    }

    if (ext === ".json" || ext === ".jsonc") {
      return "json";
    }

    if (ext === ".toml") {
      return "toml";
    }

    if (
      ext === ".cfg" ||
      ext === ".config" ||
      ext === ".ini" ||
      ext === ".env" ||
      ext === ".sln" ||
      ext === ".csproj" ||
      ext === ".fsproj" ||
      ext === ".vbproj" ||
      stem === "pyproject" ||
      filename === "pyproject.toml" ||
      filename === "setup.cfg" ||
      stem === "requirements" ||
      stem === "config" ||
      stem.startsWith(".")
    ) {
      return "config";
    }

    if (filename === "package.json") {
      return "json";
    }

    return "text";
  }

  public async isSkipped(input: {
    path: string;
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
  }): Promise<boolean> {
    const absoluteRepoRoot = path.resolve(input.repo_root);
    const absolutePath = path.resolve(input.path);

    const relativeToRepo = path.relative(absoluteRepoRoot, absolutePath);
    const isInsideRepo =
      relativeToRepo === "" || (!relativeToRepo.startsWith("..") && !path.isAbsolute(relativeToRepo));
    if (!isInsideRepo) {
      return true;
    }

    const relativePath = normalizeCatalogPath(relativeToRepo === "" ? "." : relativeToRepo);
    if (relativePath.length === 0 || relativePath === ".") {
      return false;
    }

    if (hasRootPrefix(relativePath, input.indexed_roots) === false && input.indexed_roots.length > 0) {
      return true;
    }

    const stats = statPathOrNull(absolutePath);
    return (
      catalogSkipReason({
        relativePath,
        isDirectory: stats?.isDirectory() ?? false,
        skippedRoots: input.skipped_roots,
        gitignoreRules: readRootIgnoreRules(absoluteRepoRoot),
        hasNestedGitRepository: stats?.isDirectory() === true && isNestedGitRepository(absoluteRepoRoot, absolutePath)
      }) !== null
    );
  }
}

function statPathOrNull(absolutePath: string): fs.Stats | null {
  try {
    return fs.statSync(absolutePath);
  } catch (_error) {
    return null;
  }
}

function isNestedGitRepository(repoRoot: string, absolutePath: string): boolean {
  if (path.resolve(repoRoot) === path.resolve(absolutePath)) {
    return false;
  }
  return fs.existsSync(path.join(absolutePath, ".git"));
}
