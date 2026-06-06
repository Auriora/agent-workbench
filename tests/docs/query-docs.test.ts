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

const fixtureRoot = path.resolve("tests/fixtures/fixture-docs-query-repo");

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

  it("searches path, title, heading, and content with direct-read caveats and truncation", async () => {
    const fixture = copyFixture();
    try {
      const result = await searchDocs({
        request: {
          repo_root: fixture.root,
          query: "rollback",
          max_results: 1,
          include_snippets: true
        },
        scanner: new FileCatalogScannerAdapter(),
        workspace: new WorkspaceFileAdapter({ repoRoot: fixture.root }),
        default_repo_root: "."
      });
      const search = docsSearchResultSchema.parse(result.search);

      expect(search.hits).toHaveLength(1);
      expect(search.hits[0]).toMatchObject({
        path: "docs/operations/runbook.md",
        evidence_kinds: ["docs"],
        direct_read_caveat: expect.stringContaining("routing evidence")
      });
      expect(search.hits[0]?.snippet).toContain("Rollback");
      expect(search.truncated).toBe(true);
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
