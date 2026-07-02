import { describe, expect, it } from "vitest";
import type {
  CheckMarkdownDocumentRequest,
  CheckMarkdownSetRequest,
  DocsCurrentForTaskRequest,
  DocsMapRequest,
  DocsOutlineRequest,
  DocsOverviewRequest,
  DocsReadSectionRequest,
  DocsSearchRequest,
  ResponseMetadata
} from "../../src/contracts/index.js";
import type {
  CheckMarkdownDocumentUseCaseResult
} from "../../src/application/use-cases/check-markdown-quality.js";
import type { CheckMarkdownSetUseCaseResult } from "../../src/application/use-cases/check-markdown-quality.js";
import type {
  DocsMapUseCaseResult,
  DocsOutlineUseCaseResult,
  DocsOverviewUseCaseResult,
  DocsReadSectionUseCaseResult,
  DocsSearchUseCaseResult
} from "../../src/application/use-cases/query-docs.js";
import type { CurrentDocsForTaskUseCaseResult } from "../../src/application/use-cases/current-docs-for-task.js";
import { checkMarkdownDocumentTool } from "../../src/interface-adapters/mcp/registries/tools/check-markdown-document.js";
import { checkMarkdownSetTool } from "../../src/interface-adapters/mcp/registries/tools/check-markdown-set.js";
import { docsMapResource } from "../../src/interface-adapters/mcp/registries/resources/docs-map.js";
import { docsOverviewResource } from "../../src/interface-adapters/mcp/registries/resources/docs-overview.js";
import { docsOutlineTool } from "../../src/interface-adapters/mcp/registries/tools/docs-outline.js";
import { docsReadSectionTool } from "../../src/interface-adapters/mcp/registries/tools/docs-read-section.js";
import { docsScopeTool } from "../../src/interface-adapters/mcp/registries/tools/docs-scope.js";
import { docsSearchTool } from "../../src/interface-adapters/mcp/registries/tools/docs-search.js";
import { docsCurrentForTaskTool } from "../../src/interface-adapters/mcp/registries/tools/docs-current-for-task.js";
import type { DocsSessionScopeState } from "../../src/interface-adapters/mcp/registries/docs-session-scope.js";
import {
  registerMcpResource,
  registerMcpTool
} from "../helpers/mcp-harness.js";

describe("docs MCP resources", () => {
  it("uses the injected docs overview provider with parsed defaults", async () => {
    let parsedRequest: DocsOverviewRequest | undefined;
    const registered = registerResource(docsOverviewResource, {
      getDocsOverview: ({ request }) => {
        parsedRequest = request;
        return overviewResult(request.repo_root ?? "/missing");
      }
    });

    expect(registered).toMatchObject({
      name: "docs-overview",
      uri: "repo:///docs/overview"
    });

    const response = await registered.handler({ repo_root: "/fixture", scope_path: "docs/specs/032-example" });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: DocsOverviewUseCaseResult["overview"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/fixture",
      scope_path: "docs/specs/032-example",
      max_docs: 10,
      max_headings_per_doc: 5
    });
    expect(parsed.data.repo_root).toBe("/fixture");
    expect(parsed.data.important_docs[0]).toMatchObject({
      path: "README.md",
      direct_read_caveat: expect.stringContaining("docs_read_section")
    });
  });

  it("uses the injected docs map provider and returns stable map envelopes", async () => {
    let parsedRequest: DocsMapRequest | undefined;
    const registered = registerResource(docsMapResource, {
      getDocsMap: ({ request }) => {
        parsedRequest = request;
        return mapResult(request.repo_root ?? "/missing");
      }
    });

    const response = await registered.handler({
      repo_root: "/fixture",
      scope_path: "docs/specs/032-example",
      max_docs: 2,
      max_headings_per_doc: 1,
      cursor: "next-page"
    });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: DocsMapUseCaseResult["map"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/fixture",
      max_docs: 2,
      max_headings_per_doc: 1,
      cursor: "next-page",
      scope_path: "docs/specs/032-example"
    });
    expect(parsed.data.docs.map((doc) => doc.path)).toEqual(["README.md", "docs/guide.md"]);
    expect(parsed.data.truncated).toBe(false);
  });

  it("returns structured invalid input before docs resource providers run", async () => {
    let providerCalled = false;
    const registered = registerResource(docsMapResource, {
      getDocsMap: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ max_docs: 1000 });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: DocsMapUseCaseResult["map"];
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.data.status).toBe("blocked");
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });
});

describe("docs MCP tools", () => {
  it("uses the injected docs_search provider with default repo root", async () => {
    let parsedRequest: DocsSearchRequest | undefined;
    const registered = registerTool(docsSearchTool, {
      searchDocs: ({ request }) => {
        parsedRequest = request;
        return searchResult(request.repo_root ?? "/missing", request.query);
      }
    });

    const response = await registered.handler({
      query: "guide",
      scope_path: "docs/specs/032-example",
      cursor: "next-page"
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: DocsSearchUseCaseResult["search"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/repo",
      scope_path: "docs/specs/032-example",
      query: "guide",
      max_results: 10,
      include_snippets: true,
      cursor: "next-page"
    });
    expect(parsed.data.hits[0]).toMatchObject({
      path: "docs/guide.md",
      direct_read_caveat: expect.stringContaining("docs_read_section")
    });
  });

  it("uses the injected docs_current_for_task provider with default repo root", async () => {
    let parsedRequest: DocsCurrentForTaskRequest | undefined;
    const registered = registerTool(docsCurrentForTaskTool, {
      getCurrentDocsForTask: ({ request }) => {
        parsedRequest = request;
        return currentDocsResult(request.repo_root ?? "/missing", request.task);
      }
    });

    const response = await registered.handler({
      task: "Implement widget routing",
      files: ["src/widget.ts"],
      max_docs: 4
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: CurrentDocsForTaskUseCaseResult["current_docs"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/repo",
      task: "Implement widget routing",
      files: ["src/widget.ts"],
      max_docs: 4
    });
    expect(parsed.data.canonical_docs[0]).toMatchObject({
      path: "docs/guide.md",
      currency_state: "current"
    });
    expect(parsed.data.unknown_docs[0]).toMatchObject({
      path: "docs/unknown.md",
      currency_state: "unknown"
    });
  });

  it("sets a session docs scope and applies it to docs surfaces until cleared", async () => {
    const docsSessionScope: DocsSessionScopeState = {};
    let searchRequest: DocsSearchRequest | undefined;
    let mapRequest: DocsMapRequest | undefined;
    const scope = registerTool(docsScopeTool, { docsSessionScope });
    const search = registerTool(docsSearchTool, {
      docsSessionScope,
      searchDocs: ({ request }) => {
        searchRequest = request;
        return searchResult(request.repo_root ?? "/missing", request.query);
      }
    });
    const map = registerResource(docsMapResource, {
      docsSessionScope,
      getDocsMap: ({ request }) => {
        mapRequest = request;
        return mapResult(request.repo_root ?? "/missing");
      }
    });

    const setResponse = await scope.handler({
      action: "set",
      scope_path: "docs/specs/032-example/"
    });
    expect(JSON.parse(setResponse.content[0]?.text ?? "{}")).toMatchObject({
      data: {
        status: "set",
        scope_path: "docs/specs/032-example"
      }
    });

    await search.handler({ query: "guide" });
    await map.handler({ max_docs: 5 });
    expect(searchRequest).toMatchObject({
      scope_path: "docs/specs/032-example"
    });
    expect(mapRequest).toMatchObject({
      scope_path: "docs/specs/032-example"
    });

    await search.handler({ query: "guide", scope_path: "docs/specs/033-explicit" });
    expect(searchRequest).toMatchObject({
      scope_path: "docs/specs/033-explicit"
    });

    const clearResponse = await scope.handler({ action: "clear" });
    expect(JSON.parse(clearResponse.content[0]?.text ?? "{}")).toMatchObject({
      data: {
        status: "cleared"
      }
    });
    await search.handler({ query: "guide" });
    expect(searchRequest?.scope_path).toBeUndefined();
  });

  it("uses the injected docs_outline and docs_read_section providers", async () => {
    let outlineRequest: DocsOutlineRequest | undefined;
    let readRequest: DocsReadSectionRequest | undefined;
    const outline = registerTool(docsOutlineTool, {
      getDocsOutline: ({ request }) => {
        outlineRequest = request;
        return outlineResult(request.repo_root ?? "/missing", request.path);
      }
    });
    const read = registerTool(docsReadSectionTool, {
      readDocsSection: ({ request }) => {
        readRequest = request;
        return readSectionResult(request.repo_root ?? "/missing", request.path, request.heading_id);
      }
    });

    const outlineResponse = await outline.handler({ path: "docs/guide.md" });
    const readResponse = await read.handler({
      path: "docs/guide.md",
      heading_id: "setup",
      max_bytes: 200
    });
    const parsedOutline = JSON.parse(outlineResponse.content[0]?.text ?? "{}") as {
      data: DocsOutlineUseCaseResult["outline"];
    };
    const parsedRead = JSON.parse(readResponse.content[0]?.text ?? "{}") as {
      data: DocsReadSectionUseCaseResult["read"];
    };

    expect(outlineRequest).toMatchObject({
      repo_root: "/repo",
      path: "docs/guide.md"
    });
    expect(readRequest).toMatchObject({
      repo_root: "/repo",
      path: "docs/guide.md",
      heading_id: "setup",
      max_bytes: 200
    });
    expect(parsedOutline.data.headings.map((heading) => heading.id)).toEqual(["setup"]);
    expect(parsedRead.data.section).toMatchObject({
      path: "docs/guide.md",
      caveat: expect.stringContaining("Direct-read")
    });
  });

  it("returns structured invalid input before docs tool providers run", async () => {
    let providerCalled = false;
    const registered = registerTool(docsSearchTool, {
      searchDocs: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ query: "" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: DocsSearchUseCaseResult["search"];
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.data.status).toBe("blocked");
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });

  it("uses the injected check_markdown_document provider with default repo root", async () => {
    let parsedRequest: CheckMarkdownDocumentRequest | undefined;
    const registered = registerTool(checkMarkdownDocumentTool, {
      checkMarkdownDocument: ({ request }) => {
        parsedRequest = request;
        return markdownCheckResult(request.repo_root ?? "/missing", request.path);
      }
    });

    const response = await registered.handler({ path: "docs/guide.md" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: CheckMarkdownDocumentUseCaseResult["check"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/repo",
      path: "docs/guide.md",
      max_findings: 50,
      max_evidence_bytes: 240,
      max_file_bytes: 200_000
    });
    expect(parsed.data).toMatchObject({
      repo_root: "/repo",
      path: "docs/guide.md",
      status: "done",
      findings: [
        expect.objectContaining({
          rule_id: "markdown.heading.skipped_level",
          path: "docs/guide.md"
        })
      ]
    });
  });

  it("returns structured invalid input before check_markdown_document provider runs", async () => {
    let providerCalled = false;
    const registered = registerTool(checkMarkdownDocumentTool, {
      checkMarkdownDocument: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({ path: "" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: CheckMarkdownDocumentUseCaseResult["check"];
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.data.status).toBe("blocked");
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });

  it("returns structured blocked output when check_markdown_document provider is unavailable", async () => {
    const registered = registerTool(checkMarkdownDocumentTool, {});

    const response = await registered.handler({ path: "docs/guide.md" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: CheckMarkdownDocumentUseCaseResult["check"];
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(parsed.data).toMatchObject({
      path: "docs/guide.md",
      status: "blocked",
      findings: []
    });
    expect(parsed.errors[0]).toMatchObject({
      code: "invalid_input",
      retryable: false
    });
  });

  it("uses the injected check_markdown_set provider with default repo root", async () => {
    let parsedRequest: CheckMarkdownSetRequest | undefined;
    const registered = registerTool(checkMarkdownSetTool, {
      checkMarkdownSet: ({ request }) => {
        parsedRequest = request;
        return markdownSetResult(request.repo_root ?? "/missing");
      }
    });

    const response = await registered.handler({
      paths: ["docs/guide.md"],
      max_documents: 5
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: CheckMarkdownSetUseCaseResult["check"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/repo",
      paths: ["docs/guide.md"],
      max_documents: 5,
      max_findings: 100
    });
    expect(parsed.data).toMatchObject({
      repo_root: "/repo",
      status: "done",
      checked_documents: ["docs/guide.md"]
    });
  });

  it("returns structured blocked output when check_markdown_set provider is unavailable", async () => {
    const registered = registerTool(checkMarkdownSetTool, {});

    const response = await registered.handler({ paths: ["docs/guide.md"] });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: CheckMarkdownSetUseCaseResult["check"];
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(parsed.data).toMatchObject({
      status: "blocked",
      findings: []
    });
    expect(parsed.errors[0]).toMatchObject({
      code: "invalid_input",
      retryable: false
    });
  });
});

const registerResource: typeof registerMcpResource = registerMcpResource;
const registerTool: typeof registerMcpTool = registerMcpTool;

function overviewResult(repoRoot: string): DocsOverviewUseCaseResult {
  return {
    overview: {
      repo_root: repoRoot,
      status: "done",
      summary: "Docs overview found 1 important doc.",
      important_docs: [readmeDoc()],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function mapResult(repoRoot: string): DocsMapUseCaseResult {
  return {
    map: {
      repo_root: repoRoot,
      status: "done",
      docs: [guideDoc(), readmeDoc()],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function searchResult(repoRoot: string, query: string): DocsSearchUseCaseResult {
  return {
    search: {
      repo_root: repoRoot,
      query,
      status: "done",
      hits: [
        {
          path: "docs/guide.md",
          title: "Guide",
          heading_id: "setup",
          heading: "Setup",
          snippet: "Setup instructions.",
          score: 10,
          evidence_kinds: ["docs"],
          direct_read_caveat: "Docs search is routing evidence; use docs_read_section for precise claims."
        }
      ],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function currentDocsResult(repoRoot: string, task: string): CurrentDocsForTaskUseCaseResult {
  return {
    current_docs: {
      repo_root: repoRoot,
      task,
      status: "needed",
      canonical_docs: [
        {
          path: "docs/guide.md",
          title: "Guide",
          reason: "Current owner.",
          evidence_kinds: ["docs"],
          doc_status: "current",
          authority: "canonical",
          authority_caveat: "Current implementation guidance.",
          currency_state: "current",
          currency_caveats: []
        }
      ],
      supporting_docs: [],
      non_authoritative_docs: [],
      unknown_docs: [
        {
          path: "docs/unknown.md",
          title: "Unknown",
          reason: "Needs corroboration.",
          evidence_kinds: ["docs"],
          doc_status: "unknown",
          authority: "supporting",
          authority_caveat: "Needs corroboration.",
          currency_state: "unknown",
          currency_caveats: ["Document currency is unclear."]
        }
      ],
      warnings: [],
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function outlineResult(repoRoot: string, docPath: string): DocsOutlineUseCaseResult {
  return {
    outline: {
      repo_root: repoRoot,
      path: docPath,
      status: "done",
      title: "Guide",
      headings: [{ id: "setup", text: "Setup", depth: 2, line: 3 }],
      warnings: [],
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function readSectionResult(
  repoRoot: string,
  docPath: string,
  headingId: string
): DocsReadSectionUseCaseResult {
  return {
    read: {
      repo_root: repoRoot,
      path: docPath,
      heading_id: headingId,
      status: "done",
      heading: { id: headingId, text: "Setup", depth: 2, line: 3 },
      section: {
        path: docPath,
        start_line: 3,
        end_line: 5,
        byte_count: 40,
        truncated: false,
        text: "## Setup\nUse direct evidence.",
        caveat: "Direct-read evidence for precise documentation claims."
      },
      warnings: [],
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function markdownCheckResult(repoRoot: string, docPath: string): CheckMarkdownDocumentUseCaseResult {
  return {
    check: {
      repo_root: repoRoot,
      path: docPath,
      status: "done",
      summary: "Markdown document has 1 quality finding.",
      findings: [
        {
          category: "heading_structure",
          severity: "warning",
          rule_id: "markdown.heading.skipped_level",
          code: "markdown.heading.skipped_level",
          path: docPath,
          start_line: 4,
          start_column: 0,
          end_line: 4,
          end_column: 12,
          message: "Heading jumps from level 2 to level 4.",
          evidence: "#### Details",
          suggested_action: "Insert the missing intermediate heading level.",
          evidence_kinds: ["docs", "direct_read"]
        }
      ],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function markdownSetResult(repoRoot: string): CheckMarkdownSetUseCaseResult {
  return {
    check: {
      repo_root: repoRoot,
      status: "done",
      summary: "Markdown set check examined 1 document.",
      checked_documents: ["docs/guide.md"],
      skipped_documents: [],
      findings: [],
      warnings: [],
      truncated: false,
      next_actions: []
    },
    meta: meta(repoRoot)
  };
}

function readmeDoc() {
  return {
    path: "README.md",
    title: "Readme",
    headings: [{ id: "readme", text: "Readme", depth: 1, line: 1 }],
    links: [],
    capability_level: "resource_backed" as const,
    evidence_kinds: ["docs" as const],
    direct_read_caveat: "Docs search is routing evidence; use docs_read_section for precise claims."
  };
}

function guideDoc() {
  return {
    path: "docs/guide.md",
    title: "Guide",
    headings: [{ id: "setup", text: "Setup", depth: 2, line: 3 }],
    links: [],
    capability_level: "resource_backed" as const,
    evidence_kinds: ["docs" as const],
    direct_read_caveat: "Docs search is routing evidence; use docs_read_section for precise claims."
  };
}

function meta(repoRoot: string): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["markdown"]
    },
    capability_level: "resource_backed",
    evidence_kinds: ["docs"],
    verification_status: "done",
    truncated: false
  };
}
