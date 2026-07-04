/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type {
  DocsMapUseCaseResult,
  DocsReadSectionUseCaseResult,
  DocsSearchUseCaseResult
} from "../../src/application/use-cases/query-docs.js";
import {
  buildDocsMapEnvelope,
  buildDocsReadSectionEnvelope,
  buildDocsSearchEnvelope,
  buildInvalidDocsSearchInputEnvelope
} from "../../src/presentation/docs-presenter.js";
import type { ResponseMetadata } from "../../src/contracts/index.js";

describe("docs presenter", () => {
  it("sanitizes docs maps with relative paths, direct-read caveats, truncation metadata, and stable ordering", () => {
    const envelope = buildDocsMapEnvelope({
      map: {
        repo_root: "/repo",
        status: "needed",
        docs: [
          {
            path: ".\\docs\\z.md",
            title: "Z",
            headings: [
              { id: "late", text: "Late", depth: 2, line: 10 },
              { id: "early", text: "Early", depth: 1, line: 1 }
            ],
            links: [
              { label: "B", target: "b.md", resolved_path: ".\\docs\\b.md", exists: true },
              { label: "A", target: "a.md", resolved_path: ".\\docs\\a.md", exists: false }
            ],
            capability_level: "resource_backed",
            evidence_kinds: ["direct_read", "docs"],
            direct_read_caveat: "Use docs_read_section for precise claims."
          },
          {
            path: "README.md",
            title: "Readme",
            headings: [],
            links: [],
            capability_level: "resource_backed",
            evidence_kinds: ["docs"],
            direct_read_caveat: "Use docs_read_section for precise claims."
          }
        ],
        warnings: [
          { path: "vendor", reason: "generated_or_vendor", message: "Vendor docs skipped." },
          { path: "dist", reason: "generated_or_vendor", message: "Generated docs skipped." }
        ],
        truncated: true,
        next_actions: [{ tool: "docs_search", args: { query: "guide" } }]
      },
      meta: meta()
    } satisfies DocsMapUseCaseResult);

    expect(envelope.data.truncated).toBe(true);
    expect(envelope.data.docs.map((doc) => doc.path)).toEqual(["README.md", "docs/z.md"]);
    expect(envelope.data.docs[1]?.headings.map((heading) => heading.id)).toEqual(["early", "late"]);
    expect(envelope.data.docs[1]?.links.map((link) => link.resolved_path)).toEqual(["docs/a.md", "docs/b.md"]);
    expect(envelope.data.docs[1]?.direct_read_caveat).toContain("docs_read_section");
    expect(envelope.data.warnings.map((warning) => warning.path)).toEqual(["dist", "vendor"]);
    expect(envelope.meta.budget).toEqual({ row_limit: 20 });
  });

  it("sorts search hits by score while preserving snippets and caveats", () => {
    const envelope = buildDocsSearchEnvelope({
      search: {
        repo_root: "/repo",
        query: "deploy",
        status: "done",
        hits: [
          {
            path: "docs/b.md",
            title: "B",
            score: 1,
            evidence_kinds: ["docs"],
            direct_read_caveat: "Routing only."
          },
          {
            path: ".\\docs\\a.md",
            title: "A",
            heading_id: "deploy",
            heading: "Deploy",
            snippet: "Deploy /api/orders from /home/example/.ssh/id_rsa with TOKEN=abc123.",
            score: 10,
            evidence_kinds: ["docs"],
            direct_read_caveat: "Routing only."
          }
        ],
        warnings: [],
        truncated: false,
        next_actions: []
      },
      meta: meta()
    } satisfies DocsSearchUseCaseResult);

    expect(envelope.data.hits.map((hit) => hit.path)).toEqual(["docs/a.md", "docs/b.md"]);
    expect(envelope.data.hits[0]).toMatchObject({
      heading_id: "deploy",
      snippet: "Deploy /api/orders from [REDACTED_ABSOLUTE_PATH] with TOKEN=[REDACTED].",
      direct_read_caveat: "Routing only."
    });
  });

  it("sanitizes direct section reads and invalid-input envelopes", () => {
    const envelope = buildDocsReadSectionEnvelope({
      read: {
        repo_root: "/repo",
        path: ".\\docs\\guide.md",
        heading_id: "configure",
        status: "done",
        heading: { id: "configure", text: "Configure", depth: 2, line: 4 },
        section: {
          path: ".\\docs\\guide.md",
          start_line: 4,
          end_line: 6,
          byte_count: 42,
          truncated: false,
          text: "## Configure\nUse /api/orders and /home/example/.ssh/id_rsa.",
          caveat: "Direct-read evidence."
        },
        warnings: [],
        next_actions: []
      },
      meta: meta()
    } satisfies DocsReadSectionUseCaseResult);
    const invalid = buildInvalidDocsSearchInputEnvelope({
      repoRoot: "/repo",
      query: "",
      message: "query is required"
    });

    expect(envelope.data.path).toBe("docs/guide.md");
    expect(envelope.data.section?.path).toBe("docs/guide.md");
    expect(envelope.data.section?.text).toContain("/api/orders");
    expect(envelope.data.section?.text).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(envelope.data.section?.text).not.toContain("/home/example");
    expect(envelope.data.section?.caveat).toContain("Direct-read");
    expect(invalid.data).toMatchObject({
      repo_root: "/repo",
      query: "",
      status: "blocked",
      hits: []
    });
    expect(invalid.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });
});

function meta(): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["markdown"]
    },
    capability_level: "resource_backed",
    evidence_kinds: ["docs"],
    verification_status: "done",
    truncated: false,
    budget: {
      row_limit: 20
    }
  };
}
