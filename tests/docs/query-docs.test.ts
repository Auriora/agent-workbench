import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDocsMap,
  getDocsOutline,
  getDocsOverview,
  readDocsSection,
  searchDocs
} from "../../src/application/use-cases/query-docs.js";
import {
  docsMapSchema,
  docsOutlineResultSchema,
  docsOverviewSchema,
  docsReadSectionResultSchema,
  docsSearchResultSchema
} from "../../src/contracts/index.js";
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
import type { DocsIndexPort, DocsIndexSearchResult } from "../../src/ports/index.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-docs-query-repo");
const scanner = new FileCatalogScannerAdapter();

describe("docs query application contracts", () => {
  it("builds a compact docs overview with docs evidence labels and skipped-doc warnings", async () => {
    const fixture = copyFixture();
    try {
      const result = await getDocsOverview({
        request: {
          repo_root: fixture.root,
          max_docs: 3,
          max_headings_per_doc: 3
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const overview = docsOverviewSchema.parse(result.overview);

      expect(overview.status).toBe("needed");
      expect(overview.important_docs.map((doc) => doc.path)).toEqual(
        expect.arrayContaining(["README.md", "docs/guide.md", "docs/operations/runbook.md"])
      );
      expect(overview.important_docs[0]).toMatchObject({
        capability_level: "resource_backed",
        evidence_kinds: ["docs"],
        direct_read_caveat: expect.stringContaining("docs_read_section")
      });
      expect(overview.important_docs.every((doc) => doc.headings.length <= 3)).toBe(true);
      expect(overview.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "dist", reason: "generated_or_vendor" }),
          expect.objectContaining({ path: "vendor", reason: "generated_or_vendor" })
        ])
      );
      expect(result.meta).toMatchObject({
        capability_level: "resource_backed",
        evidence_kinds: ["docs"]
      });
    } finally {
      fixture.dispose();
    }
  });

  it("builds a bounded docs map and preserves duplicate heading identifiers", async () => {
    const fixture = copyFixture();
    try {
      const result = await getDocsMap({
        request: {
          repo_root: fixture.root,
          max_docs: 20,
          max_headings_per_doc: 20
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const map = docsMapSchema.parse(result.map);
      const guide = map.docs.find((doc) => doc.path === "docs/guide.md");

      expect(map.docs.length).toBeGreaterThan(10);
      expect(guide?.headings.map((heading) => heading.id)).toEqual([
        "guide",
        "install",
        "configure",
        "details",
        "duplicate",
        "duplicate-2"
      ]);
    } finally {
      fixture.dispose();
    }
  });

  it("exposes document currency metadata in docs inventory and indexed search", async () => {
    const fixture = copyFixture();
    try {
      fs.mkdirSync(path.join(fixture.root, "docs", "design"), { recursive: true });
      fs.mkdirSync(path.join(fixture.root, "docs", "reference"), { recursive: true });
      fs.writeFileSync(path.join(fixture.root, "docs", "design", "current.md"), [
        "---",
        "status: current",
        "---",
        "# Current Design",
        "",
        "Widget routing is current."
      ].join("\n"));
      fs.writeFileSync(path.join(fixture.root, "docs", "design", "old.md"), [
        "---",
        "status: current",
        "superseded_by: docs/design/current.md",
        "---",
        "# Old Design",
        "",
        "Widget routing is old."
      ].join("\n"));
      fs.writeFileSync(path.join(fixture.root, "docs", "reference", "documentation-map.md"), [
        "| Concern | Canonical owner | Notes |",
        "| --- | --- | --- |",
        "| Widget routing | [Current Design](../design/current.md) | Current owner. |"
      ].join("\n"));

      const mapResult = await getDocsMap({
        request: {
          repo_root: fixture.root,
          scope_path: "docs/design",
          max_docs: 10,
          max_headings_per_doc: 5
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const map = docsMapSchema.parse(mapResult.map);
      expect(map.docs.find((doc) => doc.path === "docs/design/current.md")).toMatchObject({
        currency_state: "current",
        modified_at: expect.any(String),
        currency_caveats: expect.arrayContaining([
          expect.stringContaining("Documentation map lists this document as owner")
        ])
      });
      expect(map.docs.find((doc) => doc.path === "docs/design/old.md")).toMatchObject({
        currency_state: "superseded",
        superseded_by: "docs/design/current.md"
      });

      const store = await indexFixtureDocs(fixture.root);
      try {
        const searchResult = await searchDocs({
          request: {
            repo_root: fixture.root,
            query: "Widget routing old",
            max_results: 5,
            include_snippets: true
          },
          docs_index: store,
          default_repo_root: "."
        });
        const search = docsSearchResultSchema.parse(searchResult.search);
        expect(search.hits.find((hit) => hit.path === "docs/design/old.md")).toMatchObject({
          currency_state: "superseded",
          superseded_by: "docs/design/current.md"
        });
      } finally {
        store.close();
      }
    } finally {
      fixture.dispose();
    }
  });

  it("paginates docs maps with opaque cursors", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-docs-pages-"));
    try {
      fs.mkdirSync(path.join(root, "docs"), { recursive: true });
      for (let index = 0; index < 5; index += 1) {
        fs.writeFileSync(
          path.join(root, "docs", `page-${String(index).padStart(2, "0")}.md`),
          `# Page ${index}\n\nPage content.\n`
        );
      }

      const first = await getDocsMap({
        request: {
          repo_root: root,
          max_docs: 2,
          max_headings_per_doc: 2
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: root }),
        default_repo_root: "."
      });
      const second = await getDocsMap({
        request: {
          repo_root: root,
          max_docs: 2,
          max_headings_per_doc: 2,
          cursor: first.map.cursor
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: root }),
        default_repo_root: "."
      });

      expect(first.map.docs.map((doc) => doc.path)).toEqual([
        "docs/page-00.md",
        "docs/page-01.md"
      ]);
      expect(first.map.truncated).toBe(true);
      expect(first.map.cursor).toEqual(expect.any(String));
      expect(first.map.result_count).toBe(5);
      expect(second.map.docs.map((doc) => doc.path)).toEqual([
        "docs/page-02.md",
        "docs/page-03.md"
      ]);
      expect(second.map.truncated).toBe(true);
      expect(second.map.cursor).toEqual(expect.any(String));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("searches path, title, heading, and content with direct-read caveats and truncation", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "rollback",
          max_results: 1,
          include_snippets: true
        },
        docs_index: store,
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(result.search);

      expect(search.hits).toHaveLength(1);
      expect(search.hits[0]).toMatchObject({
        path: "docs/operations/runbook.md",
        evidence_kinds: ["docs", "fts"],
        direct_read_caveat: expect.stringContaining("routing evidence")
      });
      expect(search.hits[0]?.snippet).toContain("Rollback");
      expect(search.truncated).toBe(false);
      expect(search.next_actions).toEqual([
        {
          tool: "docs_outline",
          args: {
            repo_root: fixture.root,
            path: "docs/operations/runbook.md"
          }
        },
        {
          tool: "docs_read_section",
          args: {
            repo_root: fixture.root,
            path: "docs/operations/runbook.md",
            heading_id: expect.any(String)
          }
        }
      ]);
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("returns a cursor when FTS docs search has more results", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      const firstPage = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "docs",
          max_results: 1,
          include_snippets: false
        },
        docs_index: store,
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(firstPage.search);

      expect(search.hits).toHaveLength(1);
      expect(search.truncated).toBe(true);
      expect(search.cursor).toEqual(expect.any(String));
      expect(search.result_count).toBe(1);
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("finds docs with multi-term queries without requiring an exact phrase", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "guide rollback",
          max_results: 5,
          include_snippets: true
        },
        docs_index: store,
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(result.search);

      expect(search.hits.map((hit) => hit.path)).toEqual(
        expect.arrayContaining(["docs/guide.md", "docs/operations/runbook.md"])
      );
      expect(search.hits.every((hit) => hit.direct_read_caveat.includes("docs_read_section"))).toBe(true);
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("limits docs map and FTS search results to scope_path", async () => {
    const fixture = copyFixture();
    const store = await indexFixtureDocs(fixture.root);
    try {
      const mapResult = await getDocsMap({
        request: {
          repo_root: fixture.root,
          scope_path: "docs/operations",
          max_docs: 20,
          max_headings_per_doc: 10
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const map = docsMapSchema.parse(mapResult.map);
      const searchResult = await searchDocs({
        request: {
          repo_root: fixture.root,
          scope_path: "docs/operations",
          query: "docs",
          max_results: 10,
          include_snippets: false
        },
        docs_index: store,
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(searchResult.search);

      expect(map.docs.map((doc) => doc.path)).toEqual(["docs/operations/runbook.md"]);
      expect(search.hits.length).toBeGreaterThan(0);
      expect(search.hits.every((hit) => hit.path.startsWith("docs/operations/"))).toBe(true);
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it("blocks docs search when the FTS index is cold instead of scanning files", async () => {
    const fixture = copyFixture();
    const store = openGraphStore(path.join(fixture.root, "cold.sqlite"));
    try {
      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "guide",
          max_results: 5,
          include_snippets: true
        },
        docs_index: store,
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(result.search);

      expect(search).toMatchObject({
        status: "blocked",
        hits: [],
        warnings: [
          expect.objectContaining({
            message: expect.stringContaining("docs FTS")
          })
        ]
      });
    } finally {
      store.close();
      fixture.dispose();
    }
  });

  it.each([
    ["stale", "stale graph snapshot"],
    ["invalid", "schema-incompatible docs index"],
    ["unavailable", "docs index storage is unavailable"]
  ] as const)("returns compact blocked docs search output for %s FTS state", async (reason, message) => {
    const result = await searchDocs({
      request: {
        repo_root: "/tmp/docs-fixture",
        query: "guide",
        max_results: 5,
        include_snippets: true
      },
      docs_index: blockedDocsIndex({
        reason,
        message
      }),
      default_repo_root: "."
    });
    const search = docsSearchResultSchema.parse(result.search);

    expect(search).toMatchObject({
      repo_root: "/tmp/docs-fixture",
      status: "blocked",
      hits: [],
      warnings: [
        expect.objectContaining({
          message
        })
      ],
      truncated: false
    });
    expect(result.meta).toMatchObject({
      analysis_validity: "valid",
      capability_level: "unsupported",
      evidence_kinds: [],
      verification_status: "blocked"
    });
  });

  it("summarizes large generated skipped-path sets in public docs results", async () => {
    const fixture = copyFixture();
    try {
      for (const generatedRoot of ["build", "coverage", "node_modules", "target", "bin", "obj"]) {
        fs.mkdirSync(path.join(fixture.root, generatedRoot), { recursive: true });
        fs.writeFileSync(path.join(fixture.root, generatedRoot, "generated.md"), "# Generated\n");
      }

      const result = await getDocsOverview({
        request: {
          repo_root: fixture.root,
          max_docs: 3,
          max_headings_per_doc: 3
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const overview = docsOverviewSchema.parse(result.overview);

      expect(overview.warnings).toEqual([
        expect.objectContaining({
          reason: "generated_or_vendor",
          message: expect.stringContaining("generated, dependency, cache, build, or vendor path(s)")
        })
      ]);
    } finally {
      fixture.dispose();
    }
  });

  it("returns outlines and direct section reads for stable heading identifiers", async () => {
    const fixture = copyFixture();
    try {
      const outlineResult = await getDocsOutline({
        request: {
          repo_root: fixture.root,
          path: "docs/guide.md"
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const outline = docsOutlineResultSchema.parse(outlineResult.outline);

      expect(outline.status).toBe("done");
      expect(outline.headings.map((heading) => heading.id)).toContain("configure");

      const readResult = await readDocsSection({
        request: {
          repo_root: fixture.root,
          path: "docs/guide.md",
          heading_id: "configure",
          max_bytes: 200
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const read = docsReadSectionResultSchema.parse(readResult.read);

      expect(read.status).toBe("done");
      expect(read.heading).toMatchObject({ id: "configure", text: "Configure" });
      expect(read.section).toMatchObject({
        path: "docs/guide.md",
        start_line: 9,
        truncated: false,
        caveat: expect.stringContaining("direct-read evidence")
      });
      expect(read.section?.text).toContain("Configuration guidance");
      expect(read.section?.text).not.toContain("First guide duplicate");
    } finally {
      fixture.dispose();
    }
  });

  it("blocks missing Markdown outlines with a missing-path warning", async () => {
    const fixture = copyFixture();
    try {
      const result = await getDocsOutline({
        request: {
          repo_root: fixture.root,
          path: "docs/missing.md"
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const outline = docsOutlineResultSchema.parse(result.outline);

      expect(outline).toMatchObject({
        status: "blocked",
        path: "docs/missing.md",
        headings: [],
        warnings: [
          expect.objectContaining({
            path: "docs/missing.md",
            reason: "missing",
            message: expect.stringContaining("was not found")
          })
        ]
      });
      expect(result.meta).toMatchObject({
        analysis_validity: "valid",
        verification_status: "needed"
      });
    } finally {
      fixture.dispose();
    }
  });

  it("returns existing no-heading Markdown as an explicit empty outline", async () => {
    const root = path.resolve("tests/fixtures/fixture-mcp-tool-sweep");
    const result = await getDocsOutline({
      request: {
        repo_root: root,
        path: "docs/no-heading.md"
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot: root }),
      default_repo_root: "."
    });
    const outline = docsOutlineResultSchema.parse(result.outline);

    expect(outline).toMatchObject({
      status: "done",
      path: "docs/no-heading.md",
      title: "no heading",
      headings: [],
      warnings: []
    });
    expect(outline.next_actions).toEqual([
      {
        tool: "docs_outline",
        args: {
          repo_root: root,
          path: "docs/no-heading.md"
        }
      }
    ]);
    expect(result.meta).toMatchObject({
      analysis_validity: "valid",
      verification_status: "done"
    });
  });

  it("reads a requested outline directly without scanning the repository", async () => {
    const fixture = copyFixture();
    try {
      const result = await getDocsOutline({
        request: {
          repo_root: fixture.root,
          path: "docs/guide.md"
        },
        scanner: {
          async scan() {
            throw new Error("scanner should not be used for docs_outline");
          }
        },
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });

      expect(result.outline.status).toBe("done");
      expect(result.outline.headings.map((heading) => heading.id)).toContain("configure");
      expect(result.meta.budget).toMatchObject({ row_limit: 1 });
    } finally {
      fixture.dispose();
    }
  });

  it("directly reads requested outline and section paths beyond the broad docs-map budget", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-docs-large-"));
    try {
      fs.mkdirSync(path.join(root, "docs"), { recursive: true });
      for (let index = 0; index < 220; index += 1) {
        fs.writeFileSync(
          path.join(root, "docs", `a-${String(index).padStart(3, "0")}.md`),
          `# Filler ${index}\n\nFiller content.\n`
        );
      }
      fs.writeFileSync(
        path.join(root, "docs", "zz-target.md"),
        "# Target\n\nIntro.\n\n## Direct Section\n\nRequested content.\n"
      );

      const outlineResult = await getDocsOutline({
        request: {
          repo_root: root,
          path: "docs/zz-target.md"
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: root }),
        default_repo_root: "."
      });
      const readResult = await readDocsSection({
        request: {
          repo_root: root,
          path: "docs/zz-target.md",
          heading_id: "direct-section",
          max_bytes: 200
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: root }),
        default_repo_root: "."
      });

      expect(outlineResult.outline.status).toBe("done");
      expect(outlineResult.outline.headings.map((heading) => heading.id)).toContain("direct-section");
      expect(outlineResult.meta.truncated).toBe(false);
      expect(outlineResult.meta.analysis_validity).toBe("valid");
      expect(readResult.read.status).toBe("done");
      expect(readResult.read.section?.text).toContain("Requested content.");
      expect(readResult.meta.truncated).toBe(false);
      expect(readResult.meta.analysis_validity).toBe("valid");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("blocks unsafe, missing, and generated read targets with structured warnings", async () => {
    const fixture = copyFixture();
    try {
      const unsafe = await getDocsOutline({
        request: {
          repo_root: fixture.root,
          path: "../outside.md"
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const generated = await readDocsSection({
        request: {
          repo_root: fixture.root,
          path: "dist/generated-doc.md",
          heading_id: "generated-doc",
          max_bytes: 200
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });

      expect(unsafe.outline).toMatchObject({
        status: "blocked",
        warnings: expect.arrayContaining([
          expect.objectContaining({ reason: "workspace_escape" })
        ])
      });
      expect(generated.read).toMatchObject({
        status: "blocked",
        warnings: expect.arrayContaining([
          expect.objectContaining({ path: "dist", reason: "generated_or_vendor" })
        ])
      });
    } finally {
      fixture.dispose();
    }
  });
});

function copyFixture(): {
  root: string;
  dispose: () => void;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-docs-query-"));
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
  const snapshotId = "9001";
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

function blockedDocsIndex(input: {
  reason: "stale" | "invalid" | "unavailable";
  message: string;
}): DocsIndexPort {
  return {
    async replaceSnapshotDocs() {
      throw new Error("replaceSnapshotDocs should not be called by docs search.");
    },
    async getState() {
      return {
        repo_root: "/tmp/docs-fixture",
        snapshot_id: "blocked-snapshot",
        freshness: input.reason === "stale" ? "stale" : "unknown",
        status: input.reason,
        reason: input.message,
        document_count: 0
      };
    },
    async search(): Promise<DocsIndexSearchResult> {
      return {
        status: "blocked",
        repo_root: "/tmp/docs-fixture",
        snapshot_id: "blocked-snapshot",
        freshness: input.reason === "stale" ? "stale" : "unknown",
        reason: input.reason,
        message: input.message,
        hits: [],
        truncated: false,
        result_count: 0
      };
    }
  };
}
