import { describe, expect, it } from "vitest";
import type {
  DocsMapRequest,
  DocsOutlineRequest,
  DocsOverviewRequest,
  DocsReadSectionRequest,
  DocsSearchRequest,
  ResponseMetadata
} from "../../src/contracts/index.js";
import type {
  DocsMapUseCaseResult,
  DocsOutlineUseCaseResult,
  DocsOverviewUseCaseResult,
  DocsReadSectionUseCaseResult,
  DocsSearchUseCaseResult
} from "../../src/application/use-cases/query-docs.js";
import { docsMapResource } from "../../src/interface-adapters/mcp/registries/resources/docs-map.js";
import { docsOverviewResource } from "../../src/interface-adapters/mcp/registries/resources/docs-overview.js";
import { docsOutlineTool } from "../../src/interface-adapters/mcp/registries/tools/docs-outline.js";
import { docsReadSectionTool } from "../../src/interface-adapters/mcp/registries/tools/docs-read-section.js";
import { docsSearchTool } from "../../src/interface-adapters/mcp/registries/tools/docs-search.js";
import type {
  McpRegistryContext,
  McpResourceDeclaration,
  McpToolDeclaration
} from "../../src/interface-adapters/mcp/registries/index.js";

type RegisteredResource = {
  name: string;
  uri: string;
  handler: (request: unknown) => Promise<{
    contents: Array<{
      uri: string;
      mimeType: string;
      text: string;
    }>;
  }>;
};

type RegisteredTool = {
  name: string;
  description: string;
  handler: (args: unknown) => Promise<{
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
};

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

    const response = await registered.handler({ repo_root: "/fixture" });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: DocsOverviewUseCaseResult["overview"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/fixture",
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
      max_docs: 2,
      max_headings_per_doc: 1
    });
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: DocsMapUseCaseResult["map"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/fixture",
      max_docs: 2,
      max_headings_per_doc: 1
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

    const response = await registered.handler({ query: "guide" });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: DocsSearchUseCaseResult["search"];
    };

    expect(parsedRequest).toMatchObject({
      repo_root: "/repo",
      query: "guide",
      max_results: 10,
      include_snippets: true
    });
    expect(parsed.data.hits[0]).toMatchObject({
      path: "docs/guide.md",
      direct_read_caveat: expect.stringContaining("docs_read_section")
    });
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
});

function registerResource(
  resource: McpResourceDeclaration,
  context: Partial<McpRegistryContext>
): RegisteredResource {
  let registered: RegisteredResource | undefined;
  const server = {
    resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
      registered = { name, uri, handler };
    }
  };
  resource.register(server as never, {
    repoRoot: "/repo",
    ...context
  });

  if (registered === undefined) {
    throw new Error(`${resource.name} did not register`);
  }
  return registered;
}

function registerTool(
  tool: McpToolDeclaration,
  context: Partial<McpRegistryContext>
): RegisteredTool {
  let registered: RegisteredTool | undefined;
  const server = {
    tool(
      name: string,
      description: string,
      _shape: unknown,
      handler: RegisteredTool["handler"]
    ) {
      registered = { name, description, handler };
    }
  };
  tool.register(server as never, {
    repoRoot: "/repo",
    ...context
  });

  if (registered === undefined) {
    throw new Error(`${tool.name} did not register`);
  }
  return registered;
}

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
