import { describe, expect, it } from "vitest";
import type { GetRepoOverviewResult } from "../../src/application/use-cases/get-repo-overview.js";
import type { GetRepoScopeResult } from "../../src/application/use-cases/get-repo-scope.js";
import { repoOverviewResource } from "../../src/interface-adapters/mcp/registries/resources/repo-overview.js";
import { repoScopeResource } from "../../src/interface-adapters/mcp/registries/resources/repo-scope.js";
import { createAgentWorkbenchServer } from "../../src/server.js";

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

type ResourceReadServer = {
  _registeredResources: Record<
    string,
    {
      readCallback: (request: unknown) => Promise<{
        contents: Array<{
          text: string;
        }>;
      }>;
    }
  >;
};

describe("repo scope MCP resource", () => {
  it("uses the injected scope provider for repo:///scope", async () => {
    let registered: RegisteredResource | undefined;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };
    const result: GetRepoScopeResult = {
      scope: {
        repo_root: "/fixture",
        indexed_roots: ["."],
        skipped_roots: [],
        languages: ["python"],
        file_counts: {
          python: 1
        },
        capability_counts: {
          semantic: 0,
          partial_semantic: 1,
          resource_backed: 0,
          unsupported: 0
        },
        generated_or_vendor_roots: []
      },
      meta: {
        analysis_validity: "valid",
        freshness: "fresh",
        scope: {
          repo_root: "/fixture",
          indexed_roots: ["."],
          skipped_roots: [],
          languages: ["python"]
        },
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"],
        verification_status: "needed",
        truncated: false
      }
    };

    repoScopeResource.register(server as never, {
      repoRoot: "/repo",
      getRepoScope: ({ repo_root }) => ({
        ...result,
        scope: {
          ...result.scope,
          repo_root
        }
      })
    });

    expect(registered).toMatchObject({
      name: "scope",
      uri: "repo:///scope"
    });

    const response = await registered?.handler({ repo_root: "/requested" });
    const parsed = JSON.parse(response?.contents[0]?.text ?? "{}") as {
      data: GetRepoScopeResult["scope"];
    };

    expect(parsed.data.repo_root).toBe("/requested");
    expect(parsed.data.file_counts).toEqual({ python: 1 });
  });

  it("returns a structured invalid-input envelope before provider execution", async () => {
    let registered: RegisteredResource | undefined;
    let providerCalled = false;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };

    repoScopeResource.register(server as never, {
      repoRoot: "/repo",
      getRepoScope: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered?.handler({ repo_root: 42 });
    const parsed = JSON.parse(response?.contents[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
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

describe("repo overview MCP resource", () => {
  it("uses the injected overview provider for repo:///overview", async () => {
    let registered: RegisteredResource | undefined;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };
    const result: GetRepoOverviewResult = {
      overview: {
        repo_root: "/fixture",
        summary: "fixture overview",
        languages: ["python"],
        platforms: ["python"],
        key_files: [],
        key_docs: [],
        validation_hints: [],
        recommended_first_calls: [
          {
            tool: "read_resource",
            args: {
              uri: "repo:///status"
            }
          }
        ]
      },
      meta: {
        analysis_validity: "valid",
        freshness: "fresh",
        scope: {
          repo_root: "/fixture",
          indexed_roots: ["."],
          skipped_roots: [],
          languages: ["python"]
        },
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"],
        verification_status: "needed",
        truncated: false
      }
    };

    repoOverviewResource.register(server as never, {
      repoRoot: "/repo",
      getRepoOverview: ({ repo_root }) => ({
        ...result,
        overview: {
          ...result.overview,
          repo_root
        }
      })
    });

    expect(registered).toMatchObject({
      name: "overview",
      uri: "repo:///overview"
    });

    const response = await registered?.handler({ repo_root: "/requested" });
    const parsed = JSON.parse(response?.contents[0]?.text ?? "{}") as {
      data: GetRepoOverviewResult["overview"];
    };

    expect(parsed.data.repo_root).toBe("/requested");
    expect(parsed.data.recommended_first_calls).toEqual(result.overview.recommended_first_calls);
  });
});

describe("repo scope and overview composed server resources", () => {
  it("represents mixed-language and platform scope from the default composed server", async () => {
    const server = createAgentWorkbenchServer(
      "tests/fixtures/fixture-mixed-language-platform",
      { startGraphWarmup: false }
    ) as unknown as ResourceReadServer;

    const scopeResponse = await server._registeredResources["repo:///scope"].readCallback({});
    const overviewResponse = await server._registeredResources["repo:///overview"].readCallback({});
    const scope = JSON.parse(scopeResponse.contents[0]?.text ?? "{}") as {
      data: GetRepoScopeResult["scope"];
    };
    const overview = JSON.parse(overviewResponse.contents[0]?.text ?? "{}") as {
      data: GetRepoOverviewResult["overview"];
    };

    expect(scope.data.languages).toEqual(["infrastructure", "json", "python", "typescript", "yaml"]);
    expect(scope.data.file_counts).toMatchObject({
      infrastructure: 1,
      json: 1,
      python: 1,
      typescript: 1,
      yaml: 1
    });
    expect(scope.data.capability_counts).toMatchObject({
      partial_semantic: 1,
      resource_backed: 3,
      unsupported: 1
    });
    expect(overview.data.platforms).toEqual(["docker", "github_actions", "node"]);
    expect(overview.data.key_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "Dockerfile", capability_level: "resource_backed" }),
        expect.objectContaining({ path: "package.json", capability_level: "resource_backed" }),
        expect.objectContaining({ path: "src/app.ts", capability_level: "unsupported" }),
        expect.objectContaining({ path: "src/service.py", capability_level: "partial_semantic" })
      ])
    );
    expect(overview.data.validation_hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "pnpm typecheck" }),
        expect.objectContaining({ command: "pnpm test" })
      ])
    );
    expect(overview.data.recommended_first_calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "read_resource",
          args: {
            uri: "repo:///status"
          }
        }),
        expect.objectContaining({
          tool: "read_resource",
          args: {
            uri: "repo:///scope"
          }
        }),
        expect.objectContaining({
          tool: "context_for_task"
        }),
        expect.objectContaining({
          tool: "verification_plan"
        })
      ])
    );
  });
});
