/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkMarkdownSet } from "../../src/application/use-cases/check-markdown-quality.js";
import { MarkdownParserAdapter, MarkdownStructureCheckerAdapter } from "../../src/infrastructure/markdown/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import type { FileCatalogScanPort } from "../../src/ports/index.js";

describe("large Markdown audit chunking", () => {
  it("completes 120 durable docs in deterministic chunks and scans once per call", async () => {
    const fixture = createScaleFixture();
    try {
      const scanner = countingScanner();
      const checked = new Set<string>();
      let cursor: string | undefined;
      let pageCount = 0;
      const pageCoverage: Array<Record<string, unknown>> = [];
      do {
        const result = await runSet(fixture.root, scanner, {
          scope_path: "docs",
          exclude_active_specs: true,
          max_documents: 37,
          ...(cursor === undefined ? {} : { cursor })
        });
        pageCount += 1;
        pageCoverage.push({
          status: result.check.status,
          offset: result.check.coverage.offset,
          chunk_size: result.check.coverage.chunk_size,
          unchecked_count: result.check.coverage.unchecked_count,
          complete: result.check.coverage.complete
        });
        for (const doc of result.check.checked_documents) checked.add(doc);
        expect(result.check.coverage.total_documents).toBe(120);
        expect(result.check.coverage.excluded_active_spec_count).toBe(40);
        expect(result.check.document_results.some((receipt) => receipt.status === "unchecked"))
          .toBe(result.check.continuation.has_more);
        expect(result.check.next_actions.map((action) => action.tool)).toEqual(
          result.check.continuation.has_more ? ["check_markdown_set"] : []
        );
        cursor = result.check.continuation.next_cursor;
      } while (cursor !== undefined);

      expect(pageCount).toBe(4);
      expect(checked.size).toBe(120);
      expect(scanner.scanCount()).toBe(4);
      expect(pageCoverage).toEqual([
        { status: "partial", offset: 0, chunk_size: 37, unchecked_count: 83, complete: false },
        { status: "partial", offset: 37, chunk_size: 37, unchecked_count: 46, complete: false },
        { status: "partial", offset: 74, chunk_size: 37, unchecked_count: 9, complete: false },
        { status: "done", offset: 111, chunk_size: 9, unchecked_count: 0, complete: true }
      ]);
    } finally {
      fixture.dispose();
    }
  });

  it("supports explicit active-spec inclusion and rejects a stale cursor", async () => {
    const fixture = createScaleFixture();
    try {
      const scanner = countingScanner();
      const explicit = await runSet(fixture.root, scanner, {
        paths: ["docs/specs/062-active/doc-000.md"],
        exclude_active_specs: true,
        max_documents: 10
      });
      expect(explicit.check.coverage.total_documents).toBe(1);
      expect(explicit.check.document_results.map((receipt) => receipt.path))
        .toContain("docs/specs/062-active/doc-000.md");

      const first = await runSet(fixture.root, scanner, {
        scope_path: "docs/runbooks",
        max_documents: 10
      });
      fs.writeFileSync(path.join(fixture.root, "docs/runbooks/added.md"), validDocument("added"));
      const stale = await runSet(fixture.root, scanner, {
        scope_path: "docs/runbooks",
        max_documents: 10,
        cursor: first.check.continuation.next_cursor
      });
      expect(stale.check).toMatchObject({
        status: "blocked",
        coverage: { complete: false },
        warnings: [expect.objectContaining({ message: expect.stringContaining("cursor") })]
      });
    } finally {
      fixture.dispose();
    }
  });

  it("returns truthful empty exclusions and partial skip-only continuation", async () => {
    const fixture = createScaleFixture();
    try {
      const scanner = countingScanner();
      const excluded = await runSet(fixture.root, scanner, {
        scope_path: "docs/specs",
        exclude_active_specs: true,
        max_documents: 10
      });
      expect(excluded.check).toMatchObject({
        status: "done",
        coverage: {
          total_documents: 0,
          excluded_active_spec_count: 40,
          complete: true
        }
      });

      fs.mkdirSync(path.join(fixture.root, ".hidden"), { recursive: true });
      fs.writeFileSync(path.join(fixture.root, ".hidden/a.md"), validDocument("hidden-a"));
      fs.writeFileSync(path.join(fixture.root, ".hidden/b.md"), validDocument("hidden-b"));
      const skippedPage = await runSet(fixture.root, scanner, {
        paths: [".hidden/a.md", ".hidden/b.md"],
        scope_path: "docs/reference",
        max_documents: 2
      });
      expect(skippedPage.check).toMatchObject({
        status: "partial",
        skipped_documents: [".hidden/a.md", ".hidden/b.md"],
        continuation: { has_more: true },
        coverage: { checked_count: 0, skipped_count: 2, unchecked_count: 40 }
      });
    } finally {
      fixture.dispose();
    }
  });

  it("keeps scan truncation separate from per-document budget state", async () => {
    const fixture = createScaleFixture();
    try {
      const base = new FileCatalogScannerAdapter();
      const scanner: FileCatalogScanPort = {
        async scan(request) {
          return { ...(await base.scan(request)), truncated: true };
        }
      };
      const result = await runSet(fixture.root, scanner, {
        paths: ["docs/reference/doc-000.md"],
        max_documents: 1
      });
      expect(result.check).toMatchObject({
        status: "partial",
        truncated: true,
        document_results: [{
          path: "docs/reference/doc-000.md",
          status: "checked_clean",
          finding_count: 0
        }],
        coverage: {
          checked_clean_count: 1,
          budget_truncated_count: 0
        }
      });
    } finally {
      fixture.dispose();
    }
  });

  it("labels finding-budget truncation at document and coverage level", async () => {
    const fixture = createScaleFixture();
    try {
      fs.writeFileSync(path.join(fixture.root, "docs/reference/problem.md"), "# Jump\n\n### Skip\n\n### Skip again\n");
      const result = await runSet(fixture.root, countingScanner(), {
        paths: ["docs/reference/problem.md"],
        max_documents: 1,
        max_findings: 1
      });
      expect(result.check).toMatchObject({
        status: "partial",
        document_results: [expect.objectContaining({
          path: "docs/reference/problem.md",
          status: "budget_truncated"
        })],
        coverage: { budget_truncated_count: 1, complete: true }
      });
    } finally {
      fixture.dispose();
    }
  });
});

function countingScanner(): FileCatalogScanPort & { scanCount(): number } {
  const scanner = new FileCatalogScannerAdapter();
  let count = 0;
  return {
    async scan(request) {
      count += 1;
      return scanner.scan(request);
    },
    scanCount: () => count
  };
}

async function runSet(
  root: string,
  scanner: FileCatalogScanPort,
  overrides: Partial<Parameters<typeof checkMarkdownSet>[0]["request"]>
) {
  return checkMarkdownSet({
    request: {
      repo_root: root,
      paths: [],
      exclude_active_specs: false,
      max_documents: 20,
      max_findings: 100,
      max_evidence_bytes: 240,
      max_file_bytes: 200_000,
      required_frontmatter: ["title", "doc_type", "status", "owner", "last_reviewed"],
      ...overrides
    },
    scanner,
    workspace: new WorkspaceFileAdapter({ repoRoot: root }),
    parser: new MarkdownParserAdapter(),
    checker: new MarkdownStructureCheckerAdapter(),
    default_repo_root: root
  });
}

function createScaleFixture(): { root: string; dispose(): void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-markdown-audit-"));
  for (const [directory, count] of [
    ["docs/data-flow", 40],
    ["docs/reference", 40],
    ["docs/runbooks", 40],
    ["docs/specs/062-active", 40]
  ] as const) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
    for (let index = 0; index < count; index += 1) {
      const suffix = String(index).padStart(3, "0");
      fs.writeFileSync(path.join(root, directory, `doc-${suffix}.md`), validDocument(`${directory}-${suffix}`));
    }
  }
  return { root, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function validDocument(title: string): string {
  return `---\ntitle: ${title}\ndoc_type: reference\nstatus: current\nowner: platform\nlast_reviewed: 2026-08-06\n---\n\n# ${title}\n\nFixture content.\n`;
}
