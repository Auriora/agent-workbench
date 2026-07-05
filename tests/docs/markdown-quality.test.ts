/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkMarkdownDocument,
  checkMarkdownSet
} from "../../src/application/use-cases/check-markdown-quality.js";
import {
  checkMarkdownDocumentResultSchema,
  checkMarkdownSetResultSchema,
  markdownQualityFindingSchema
} from "../../src/contracts/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import {
  MarkdownParserAdapter,
  MarkdownStructureCheckerAdapter
} from "../../src/infrastructure/markdown/index.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-markdown-quality-repo");

describe("Markdown quality checker", () => {
  it("reports parser-aware structure, frontmatter, link, list, and table findings", async () => {
    const fixture = copyFixture();
    try {
      const result = await checkFixtureDocument(fixture.root, "docs/problem.md");
      const check = checkMarkdownDocumentResultSchema.parse(result.check);

      expect(check.status).toBe("done");
      expect(check.findings.map((finding) => finding.rule_id)).toEqual([
        "markdown.frontmatter.missing_required",
        "markdown.heading.skipped_level",
        "markdown.heading.duplicate",
        "markdown.list.numbering",
        "markdown.link.broken_relative",
        "markdown.table.readability"
      ]);
      expect(check.findings.every((finding) => finding.path === "docs/problem.md")).toBe(true);
      expect(check.findings.every((finding) => finding.evidence_kinds.includes("direct_read"))).toBe(true);
      expect(check.findings.some((finding) => finding.evidence?.includes("Fenced Heading"))).toBe(false);
      expect(result.meta).toMatchObject({
        capability_level: "resource_backed",
        evidence_kinds: ["docs", "direct_read"],
        verification_status: "needed"
      });
      for (const finding of check.findings) {
        markdownQualityFindingSchema.parse(finding);
      }
    } finally {
      fixture.dispose();
    }
  });

  it("returns a quiet clean success envelope for a valid document", async () => {
    const fixture = copyFixture();
    try {
      const result = await checkFixtureDocument(fixture.root, "docs/clean.md");
      const check = checkMarkdownDocumentResultSchema.parse(result.check);

      expect(check).toMatchObject({
        status: "done",
        findings: [],
        warnings: [],
        truncated: false,
        next_actions: []
      });
      expect(check.summary).toContain("no quality findings");
      expect(result.meta).toMatchObject({
        verification_status: "done",
        analysis_validity: "valid"
      });
    } finally {
      fixture.dispose();
    }
  });

  it("allows repeated spec section labels under different parent headings", async () => {
    const fixture = copyFixture();
    try {
      const result = await checkFixtureDocument(fixture.root, "docs/spec-requirements.md");
      const check = checkMarkdownDocumentResultSchema.parse(result.check);

      expect(check).toMatchObject({
        status: "done",
        findings: [],
        warnings: [],
        truncated: false
      });
    } finally {
      fixture.dispose();
    }
  });

  it("skips generated or vendor paths before reading document text", async () => {
    const fixture = copyFixture();
    try {
      const result = await checkFixtureDocument(fixture.root, "dist/generated.md");
      const check = checkMarkdownDocumentResultSchema.parse(result.check);

      expect(check).toMatchObject({
        status: "skipped",
        findings: [],
        warnings: [
          expect.objectContaining({
            path: "dist",
            reason: "generated_or_vendor"
          })
        ]
      });
      expect(result.meta).toMatchObject({
        verification_status: "not_applicable",
        analysis_validity: "partial"
      });
    } finally {
      fixture.dispose();
    }
  });

  it("blocks workspace escape paths with repo-relative warnings", async () => {
    const fixture = copyFixture();
    try {
      const result = await checkFixtureDocument(fixture.root, "../outside.md");
      const check = checkMarkdownDocumentResultSchema.parse(result.check);

      expect(check).toMatchObject({
        path: "../outside.md",
        status: "blocked",
        findings: [],
        warnings: [
          expect.objectContaining({
            path: "../outside.md",
            reason: "workspace_escape"
          })
        ]
      });
      expect(result.meta).toMatchObject({
        verification_status: "blocked",
        analysis_validity: "invalid"
      });
    } finally {
      fixture.dispose();
    }
  });

  it("preserves finding budgets and reports truncation", async () => {
    const fixture = copyFixture();
    try {
      const result = await checkFixtureDocument(fixture.root, "docs/problem.md", {
        max_findings: 2,
        max_evidence_bytes: 24
      });
      const check = checkMarkdownDocumentResultSchema.parse(result.check);

      expect(check.findings).toHaveLength(2);
      expect(check.truncated).toBe(true);
      expect(check.findings.every((finding) => (finding.evidence ?? "").length <= 24)).toBe(true);
      expect(result.meta).toMatchObject({
        analysis_validity: "partial",
        truncated: true
      });
    } finally {
      fixture.dispose();
    }
  });

  it("aggregates explicit Markdown document checks with bounded findings", async () => {
    const fixture = copyFixture();
    try {
      const result = await checkFixtureSet(fixture.root, {
        paths: ["docs/problem.md", "docs/clean.md"],
        max_findings: 3
      });
      const check = checkMarkdownSetResultSchema.parse(result.check);

      expect(check.status).toBe("done");
      expect(check.checked_documents).toEqual(["docs/clean.md", "docs/problem.md"]);
      expect(check.skipped_documents).toEqual([]);
      expect(check.findings).toHaveLength(3);
      expect(check.truncated).toBe(true);
      expect(result.meta).toMatchObject({
        verification_status: "needed",
        analysis_validity: "partial"
      });
    } finally {
      fixture.dispose();
    }
  });

  it("checks scoped Markdown sets without implicit unbounded reads", async () => {
    const fixture = copyFixture();
    try {
      const scoped = await checkFixtureSet(fixture.root, {
        scope_path: "docs",
        max_documents: 1
      });
      const blocked = await checkFixtureSet(fixture.root, {});

      expect(checkMarkdownSetResultSchema.parse(scoped.check)).toMatchObject({
        status: "done",
        checked_documents: expect.arrayContaining([expect.stringMatching(/^docs\//u)]),
        truncated: true
      });
      expect(checkMarkdownSetResultSchema.parse(blocked.check)).toMatchObject({
        status: "blocked",
        findings: [],
        warnings: [
          expect.objectContaining({
            message: expect.stringContaining("explicit paths or a bounded scope_path")
          })
        ]
      });
    } finally {
      fixture.dispose();
    }
  });
});

async function checkFixtureDocument(
  root: string,
  docPath: string,
  overrides: Partial<Parameters<typeof checkMarkdownDocument>[0]["request"]> = {}
) {
  return checkMarkdownDocument({
    request: {
      path: docPath,
      repo_root: root,
      max_findings: 50,
      max_evidence_bytes: 240,
      max_file_bytes: 200_000,
      required_frontmatter: ["title", "doc_type", "status", "owner", "last_reviewed"],
      ...overrides
    },
    scanner: new FileCatalogScannerAdapter(),
    workspace: new WorkspaceFileAdapter({ repoRoot: root }),
    parser: new MarkdownParserAdapter(),
    checker: new MarkdownStructureCheckerAdapter(),
    default_repo_root: "."
  });
}

async function checkFixtureSet(
  root: string,
  overrides: Partial<Parameters<typeof checkMarkdownSet>[0]["request"]>
) {
  return checkMarkdownSet({
    request: {
      repo_root: root,
      paths: [],
      max_documents: 20,
      max_findings: 100,
      max_evidence_bytes: 240,
      max_file_bytes: 200_000,
      required_frontmatter: ["title", "doc_type", "status", "owner", "last_reviewed"],
      ...overrides
    },
    scanner: new FileCatalogScannerAdapter(),
    workspace: new WorkspaceFileAdapter({ repoRoot: root }),
    parser: new MarkdownParserAdapter(),
    checker: new MarkdownStructureCheckerAdapter(),
    default_repo_root: "."
  });
}

function copyFixture(): { root: string; dispose: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-md-quality-"));
  fs.cpSync(fixtureRoot, root, { recursive: true });
  return {
    root,
    dispose: () => {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}
