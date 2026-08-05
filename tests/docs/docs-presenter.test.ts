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
        direct_read_caveat: "Use docs_read_section for precise claims.",
        docs: [
          {
            path: ".\\docs\\z.md",
            title: "Z",
            title_truncated: false,
            headings: [
              { id: "late", id_truncated: false, text: "Late", text_truncated: false },
              { id: "early", id_truncated: false, text: "Early", text_truncated: false }
            ],
            heading_sample_count: 2,
            heading_samples_truncated: false,
            total_heading_count: 2,
            total_link_count: 1,
            authority: "canonical",
            currency_state: "current",
            canonical_owner: ".\\docs\\z.md"
          },
          {
            path: "README.md",
            title: "Readme",
            title_truncated: false,
            heading_sample_count: 0,
            heading_samples_truncated: false,
            total_heading_count: 0,
            total_link_count: 0,
            headings: []
          }
        ],
        warnings: [
          { path: "vendor", reason: "generated_or_vendor", message: "Vendor docs skipped." },
          { path: "dist", reason: "generated_or_vendor", message: "Generated docs skipped." }
        ],
        warning_count: 2,
        warning_samples_truncated: false,
        truncated: true,
        next_actions: [{ tool: "docs_search", args: { query: "guide" } }]
      },
      meta: meta()
    } satisfies DocsMapUseCaseResult);

    expect(envelope.data.truncated).toBe(true);
    expect(envelope.data.cursor).toBeUndefined();
    expect(envelope.data.docs.map((doc) => doc.path)).toEqual(["docs/z.md", "README.md"]);
    expect(envelope.data.docs[0]?.headings.map((heading) => heading.id)).toEqual(["early", "late"]);
    expect(envelope.data.docs[0]).toMatchObject({
      authority: "canonical",
      currency_state: "current",
      canonical_owner: "docs/z.md"
    });
    expect(envelope.data.direct_read_caveat).toContain("docs_read_section");
    expect(envelope.data.warnings.map((warning) => warning.path)).toEqual(["dist", "vendor"]);
    expect(envelope.meta.budget).toEqual({ row_limit: 20 });
  });

  it("bounds docs-map envelopes with a cursor and preserves UTF-8 code points", () => {
    const repeated = "😀".repeat(200);
    const envelope = buildDocsMapEnvelope({
      map: {
        repo_root: "/repo",
        status: "done",
        direct_read_caveat: "Use docs_read_section for precise claims.",
        docs: Array.from({ length: 20 }, (_, index) => ({
          path: `docs/page-${String(index).padStart(2, "0")}.md`,
          title: repeated,
          title_truncated: true,
          headings: [{
            id: repeated,
            id_truncated: true,
            text: repeated,
            text_truncated: true
          }],
          heading_sample_count: 1,
          heading_samples_truncated: true,
          total_heading_count: 4,
          total_link_count: 0
        })),
        warnings: Array.from({ length: 20 }, (_, index) => ({
          path: `vendor/${index}`,
          reason: "generated_or_vendor" as const,
          message: repeated
        })),
        warning_count: 20,
        warning_samples_truncated: false,
        truncated: true,
        next_actions: []
      },
      meta: {
        ...meta(),
        truncated: true
      },
      presentation: {
        cursor_offset: 0,
        has_more: false,
        source_truncated: false,
        max_docs: 20,
        max_headings_per_doc: 10
      }
    });

    const serialized = JSON.stringify(envelope, null, 2);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(32_768);
    expect(envelope.data.cursor).toEqual(expect.any(String));
    expect(envelope.data.docs.length).toBeGreaterThan(0);
    expect(envelope.data.docs.length).toBeLessThan(20);
    expect(envelope.data.docs[0]?.title).not.toContain("\uFFFD");
    expect(envelope.data.docs[0]?.headings[0]?.text).not.toContain("\uFFFD");
    expect(envelope.data.warning_count).toBe(20);
    expect(envelope.data.warning_samples_truncated).toBe(true);
    expect(envelope.meta.truncated).toBe(true);
  });

  it("returns a bounded blocked envelope when one exact path cannot be represented", () => {
    const exactPath = `docs/${"a".repeat(33_000)}.md`;
    const envelope = buildDocsMapEnvelope({
      map: {
        repo_root: "/repo",
        status: "done",
        direct_read_caveat: "Use docs_read_section for precise claims.",
        docs: [{
          path: exactPath,
          title: "Oversized path",
          title_truncated: false,
          headings: [],
          heading_sample_count: 0,
          heading_samples_truncated: false,
          total_heading_count: 0,
          total_link_count: 0
        }],
        warnings: [],
        warning_count: 0,
        warning_samples_truncated: false,
        truncated: false,
        result_count: 1,
        next_actions: []
      },
      meta: meta(),
      presentation: {
        cursor_offset: 0,
        has_more: false,
        source_truncated: false,
        max_docs: 1,
        max_headings_per_doc: 1
      }
    });

    const serialized = JSON.stringify(envelope, null, 2);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(32_768);
    expect(envelope.data).toMatchObject({
      status: "blocked",
      blocker: "payload_too_large",
      docs: [],
      truncated: false
    });
    expect(serialized).not.toContain(exactPath);
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
