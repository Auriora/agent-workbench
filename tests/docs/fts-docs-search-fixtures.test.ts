/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { searchDocs } from "../../src/application/use-cases/query-docs.js";
import { docsSearchResultSchema } from "../../src/contracts/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import {
  markdownTitleFromPath,
  parseMarkdownHeadings,
  selectedMarkdownText
} from "../../src/application/use-cases/markdown-docs.js";
import { openGraphStore, SCHEMA_VERSION, type GraphStore } from "../../src/infrastructure/sqlite/index.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-fts-docs-search-repo");
const scanner = new FileCatalogScannerAdapter();

describe("FTS docs search fixtures", () => {
  it("covers ranking, pagination, skipped docs, and degraded index state cases", async () => {
    const markdownFiles = listMarkdownFiles(fixtureRoot).map((file) =>
      path.relative(fixtureRoot, file).replaceAll("\\", "/")
    );
    const textByPath = new Map(
      markdownFiles.map((file) => [file, fs.readFileSync(path.join(fixtureRoot, file), "utf8")])
    );
    const scanned = await scanner.scan({
      repo_root: fixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 2000
    });
    const indexStates = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, "docs-index-states.json"), "utf8")
    ) as {
      states: Array<{ state: string; expected_status: string; reason: string }>;
    };

    expectFtsFixtureInventory(markdownFiles);
    expectRankingDocuments(textByPath);
    expectPaginationFixture(markdownFiles);
    expectFtsScannerSkipsGeneratedDocs(scanned);
    expectDegradedIndexStateCases(indexStates);
  });

  it("uses FTS docs search ranking, downranking, and cursor behavior", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      const phraseResult = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "docs query read surfaces",
          max_results: 5,
          include_snippets: true
        },
        docs_index: store,
        default_repo_root: "."
      });
      const phraseSearch = docsSearchResultSchema.parse(phraseResult.search);

      expect(phraseSearch.hits[0]).toMatchObject({
        path: "docs/reference/docs-query-read-surfaces.md",
        evidence_kinds: ["docs", "fts"]
      });
      expect(phraseSearch.hits[0]?.snippet?.toLowerCase()).toContain("docs query read surfaces");

      const genericResult = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "agent guide workbench",
          max_results: 5,
          include_snippets: false
        },
        docs_index: store,
        default_repo_root: "."
      });
      const genericSearch = docsSearchResultSchema.parse(genericResult.search);
      const templateIndex = genericSearch.hits.findIndex((hit) => hit.path === "docs/guides/ai-agent/template.md");
      const evaluationIndex = genericSearch.hits.findIndex(
        (hit) => hit.path === "docs/evaluations/agent-workbench-python-agent-ide.md"
      );

      expect(evaluationIndex).toBeGreaterThanOrEqual(0);
      expect(templateIndex).toBeGreaterThan(evaluationIndex);

      const pageResult = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "pagination",
          max_results: 2,
          include_snippets: false
        },
        docs_index: store,
        default_repo_root: "."
      });
      const pageSearch = docsSearchResultSchema.parse(pageResult.search);

      expect(pageSearch.truncated).toBe(true);
      expect(pageSearch.cursor).toEqual(expect.any(String));
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("marks and downranks archived or legacy docs behind current docs", async () => {
    const fixture = copyFixture();
    fs.mkdirSync(path.join(fixture.root, "docs", "runbooks"), { recursive: true });
    fs.mkdirSync(path.join(fixture.root, "docs", "history"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture.root, "docs", "runbooks", "canonical-source-priority.md"),
      [
        "---",
        "title: Canonical source priority",
        "status: current",
        "---",
        "# Canonical Source Priority",
        "",
        "The canonical source priority rule is current operational guidance."
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(fixture.root, "docs", "history", "canonical-source-priority-legacy.md"),
      [
        "---",
        "title: Canonical source priority legacy record",
        "status: archived",
        "---",
        "# Canonical Source Priority Legacy Record",
        "",
        "The canonical source priority rule appears here as historical delivery evidence only."
      ].join("\n")
    );
    const store = await indexFixtureDocs(fixture.root);
    try {
      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "canonical source priority",
          max_results: 5,
          include_snippets: true
        },
        docs_index: store,
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(result.search);
      const currentIndex = search.hits.findIndex((hit) => hit.path === "docs/runbooks/canonical-source-priority.md");
      const archivedIndex = search.hits.findIndex((hit) => hit.path === "docs/history/canonical-source-priority-legacy.md");

      expect(currentIndex).toBe(0);
      expect(archivedIndex).toBeGreaterThan(currentIndex);
      expect(search.hits[currentIndex]).toMatchObject({
        doc_status: "current",
        authority: "canonical"
      });
      expect(search.hits[archivedIndex]).toMatchObject({
        doc_status: "archived",
        authority: "non_authoritative",
        authority_caveat: expect.stringContaining("legacy or archived")
      });
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("uses the latest usable docs snapshot when a newer graph refresh is incomplete", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      await store.upsertSnapshot({
        snapshot: {
          id: "9102",
          repo_root: fixture.root,
          workspace_root: fixture.root,
          repo_identity: fixture.root,
          config_identity: "test",
          schema_version: SCHEMA_VERSION,
          freshness: "refreshing",
          owner_state: "owner",
          created_at: "2026-06-06T00:01:00.000Z",
          updated_at: "2026-06-06T00:01:00.000Z"
        }
      });

      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "docs query read surfaces",
          max_results: 5,
          include_snippets: true
        },
        docs_index: store,
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(result.search);

      expect(search.status).toBe("done");
      expect(search.hits[0]).toMatchObject({
        path: "docs/reference/docs-query-read-surfaces.md"
      });
      expect(result.meta).toMatchObject({
        analysis_validity: "valid",
        freshness: "fresh",
        verification_status: "done"
      });
    } finally {
      store.close();
      fixture.dispose();
    }
  });
});

function copyFixture(): {
  root: string;
  dispose: () => void;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-fts-docs-"));
  fs.cpSync(fixtureRoot, root, { recursive: true });
  return {
    root,
    dispose() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

async function indexFixtureDocs(root: string): Promise<GraphStore> {
  const cacheDir = path.join(root, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const store = openGraphStore(path.join(cacheDir, "agent-workbench-test.sqlite"));
  const snapshotId = "9101";
  const indexedAt = "2026-06-06T00:00:00.000Z";
  await store.upsertSnapshot({
    snapshot: {
      id: snapshotId,
      repo_root: root,
      workspace_root: root,
      repo_identity: root,
      config_identity: "test",
      schema_version: SCHEMA_VERSION,
      freshness: "fresh",
      owner_state: "owner",
      created_at: indexedAt,
      updated_at: indexedAt
    }
  });
  const scanned = await scanner.scan({
    repo_root: root,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 2000
  });
  const workspace = new WorkspaceFileAdapter({ repoRoot: root });
  const documents = [];
  for (const file of scanned.files.filter((candidate) => candidate.file_identity.language === "markdown")) {
    const content = await workspace.readText({ path: file.path });
    const headings = parseMarkdownHeadings(content);
    const selected = selectedMarkdownText({ content, max_bytes: 120_000 });
    documents.push({
      path: file.path,
      title: headings[0]?.text ?? markdownTitleFromPath(file.path),
      headings,
      selected_text: selected.text,
      content_hash: file.file_identity.content_hash,
      byte_count: file.file_identity.size_bytes,
      indexed_at: indexedAt,
      truncated: selected.truncated
    });
  }
  await store.replaceSnapshotDocs({
    snapshot_id: snapshotId,
    repo_root: root,
    documents
  });
  return store;
}

function listMarkdownFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listMarkdownFiles(entryPath);
    }
    return entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

function extractHeadings(text: string): string[] {
  return text
    .split(/\r?\n/u)
    .map((line) => /^(#{1,6})\s+(.+)$/u.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[2] ?? "");
}

function expectFtsFixtureInventory(markdownFiles: string[]): void {
  expect(markdownFiles).toEqual(
    expect.arrayContaining([
      "README.md",
      "docs/reference/docs-query-read-surfaces.md",
      "docs/evaluations/agent-workbench-python-agent-ide.md",
      "docs/guides/ai-agent/template.md",
      "docs/guides/ai-agent/general.md",
      "docs/reference/heading-match.md",
      "dist/generated-doc.md",
      "vendor/vendor-doc.md"
    ])
  );
}

function expectRankingDocuments(textByPath: Map<string, string>): void {
  expect(textByPath.get("docs/reference/docs-query-read-surfaces.md")?.toLowerCase()).toContain(
    "docs query read surfaces"
  );
  expect(extractHeadings(textByPath.get("docs/reference/heading-match.md") ?? "")).toContain(
    "Requirement 2 Docs Search"
  );
  expect(textByPath.get("docs/evaluations/agent-workbench-python-agent-ide.md")).toContain(
    "RepositoryResolver"
  );
  expect(textByPath.get("docs/guides/ai-agent/template.md")).toContain(
    "common terms such as agent, guide, workbench"
  );
}

function expectPaginationFixture(markdownFiles: string[]): void {
  expect(markdownFiles.filter((file) => file.startsWith("docs/pagination/page-"))).toHaveLength(6);
}

function expectFtsScannerSkipsGeneratedDocs(scanned: Awaited<ReturnType<FileCatalogScannerAdapter["scan"]>>): void {
  expect(scanned.files.map((file) => file.path)).not.toContain("dist/generated-doc.md");
  expect(scanned.files.map((file) => file.path)).not.toContain("vendor/vendor-doc.md");
  expect(scanned.skipped_paths).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "dist", reason: "generated_or_vendor" }),
      expect.objectContaining({ path: "vendor", reason: "generated_or_vendor" })
    ])
  );
}

function expectDegradedIndexStateCases(indexStates: {
  states: Array<{ state: string; expected_status: string; reason: string }>;
}): void {
  expect(indexStates.states.map((state) => state.state).sort()).toEqual([
    "cold",
    "invalid",
    "stale",
    "unavailable"
  ]);
}
