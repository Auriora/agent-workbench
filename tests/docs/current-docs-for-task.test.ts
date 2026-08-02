/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { getCurrentDocsForTask } from "../../src/application/use-cases/current-docs-for-task.js";
import { docsCurrentForTaskResultSchema } from "../../src/contracts/index.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import type { FileCatalogScanPort, WorkspaceFilePort } from "../../src/ports/index.js";

describe("docs_current_for_task corpus isolation", () => {
  it("excludes embedded fixture Markdown before scoring or reading content", async () => {
    const result = await getCurrentDocsForTask({
      request: {
        repo_root: "/repo",
        task: "current fixture leak",
        files: [],
        max_docs: 10
      },
      scanner: scannerFor([
        "README.md",
        "docs/current.md",
        "tests/fixtures/embedded/docs/leak.md"
      ]),
      workspace: workspaceFor({
        "README.md": "# Project\n\nCurrent overview.\n",
        "docs/current.md": "---\nstatus: current\n---\n# Current\n\nCurrent fixture guidance.\n",
        "tests/fixtures/embedded/docs/leak.md": "# Leak\n\nfixture leak\n"
      }, ["tests/fixtures/embedded/docs/leak.md"]),
      default_repo_root: "/repo"
    });
    const currentDocs = docsCurrentForTaskResultSchema.parse(result.current_docs);
    const allPaths = [
      ...currentDocs.canonical_docs,
      ...currentDocs.supporting_docs,
      ...currentDocs.non_authoritative_docs,
      ...currentDocs.unknown_docs
    ].map((doc) => doc.path);

    expect(allPaths).not.toContain("tests/fixtures/embedded/docs/leak.md");
    expect(currentDocs.documentation_corpus).toEqual({
      policy_version: "production-docs-v1",
      discovered_markdown_files: 3,
      eligible_markdown_files: 2,
      excluded_markdown_files: 1,
      exclusions: [{ reason: "embedded_fixture", count: 1 }]
    });
  });

  it("keeps the same Markdown eligible when the fixture directory is selected as root", async () => {
    const result = await getCurrentDocsForTask({
      request: {
        repo_root: "/repo/tests/fixtures/embedded",
        task: "fixture guidance",
        files: ["docs/leak.md"],
        max_docs: 10
      },
      scanner: scannerFor(["README.md", "docs/leak.md"]),
      workspace: workspaceFor({
        "README.md": "# Fixture\n\nFixture readme.\n",
        "docs/leak.md": "---\nstatus: current\n---\n# Fixture Docs\n\nfixture guidance\n"
      }),
      default_repo_root: "/repo/tests/fixtures/embedded"
    });
    const currentDocs = docsCurrentForTaskResultSchema.parse(result.current_docs);
    const allPaths = [
      ...currentDocs.canonical_docs,
      ...currentDocs.supporting_docs,
      ...currentDocs.non_authoritative_docs,
      ...currentDocs.unknown_docs
    ].map((doc) => doc.path);

    expect(allPaths).toContain("docs/leak.md");
    expect(currentDocs.documentation_corpus).toMatchObject({
      discovered_markdown_files: 2,
      eligible_markdown_files: 2,
      excluded_markdown_files: 0
    });
  });
});

function scannerFor(paths: readonly string[]): FileCatalogScanPort {
  return {
    async scan(input) {
      return {
        repo_root: input.repo_root,
        indexed_roots: input.indexed_roots,
        skipped_roots: input.skipped_roots,
        files: paths.map((path, index) => buildFileCatalogEntry({
          file_identity: {
            path,
            language: "markdown",
            content_hash: `hash-${index}`,
            size_bytes: 32,
            mtime_ms: index
          }
        })),
        truncated: false
      };
    }
  };
}

function workspaceFor(
  files: Record<string, string>,
  forbiddenReads: readonly string[] = []
): WorkspaceFilePort {
  const forbidden = new Set(forbiddenReads);
  return {
    async readText(input) {
      if (forbidden.has(input.path)) {
        throw new Error(`Excluded content was read: ${input.path}`);
      }
      const content = files[input.path];
      if (content === undefined) throw new Error(`Missing fixture content: ${input.path}`);
      return content;
    },
    async readBinary() {
      return new Uint8Array();
    },
    async writeText() {},
    async writeBinary() {},
    async stat(input) {
      return {
        exists: files[input.path] !== undefined,
        is_file: files[input.path] !== undefined,
        size_bytes: Buffer.byteLength(files[input.path] ?? ""),
        mtime_ms: 0
      };
    },
    async deletePath() {},
    async ensureDirectory() {}
  };
}
