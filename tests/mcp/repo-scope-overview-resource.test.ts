import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getRepoOverview,
  type GetRepoOverviewResult
} from "../../src/application/use-cases/get-repo-overview.js";
import { getRepoScope, type GetRepoScopeResult } from "../../src/application/use-cases/get-repo-scope.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";
import { repoOverviewResource } from "../../src/interface-adapters/mcp/registries/resources/repo-overview.js";
import { repoScopeResource } from "../../src/interface-adapters/mcp/registries/resources/repo-scope.js";
import { createAgentWorkbenchServer } from "../../src/server.js";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import type { SnapshotPort } from "../../src/ports/index.js";

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

  it("prioritizes durable root and guide docs over templates and update notes", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-overview-docs-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "docs", "guides"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "docs", "templates"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "docs", "updates"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "AGENTS.md"), "# Agent Guidance\n");
      fs.writeFileSync(path.join(repoRoot, "README.md"), "# Project\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "guides", "developer.md"), "# Developer Guide\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "templates", "spec.md"), "# Template\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "updates", "2026-06-05-note.md"), "# Update\n");

      const result = await getRepoOverview({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter()
      });

      expect(result.overview.key_docs.map((doc) => doc.path).slice(0, 3)).toEqual([
        "AGENTS.md",
        "README.md",
        "docs/guides/developer.md"
      ]);
      expect(result.overview.key_docs.map((doc) => doc.path).indexOf("docs/templates/spec.md")).toBeGreaterThan(
        result.overview.key_docs.map((doc) => doc.path).indexOf("docs/guides/developer.md")
      );
      expect(result.overview.key_docs.map((doc) => doc.path).indexOf("docs/updates/2026-06-05-note.md")).toBeGreaterThan(
        result.overview.key_docs.map((doc) => doc.path).indexOf("docs/guides/developer.md")
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("prioritizes CMake and source topology over incidental package scripts in overview", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-cmake-cpp-repo");
    const result = await getRepoOverview({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter()
    });

    expect(result.overview.platforms).toEqual(expect.arrayContaining(["cmake", "node"]));
    expect(result.overview.key_files.map((file) => file.path).slice(0, 4)).toEqual([
      "CMakeLists.txt",
      "src/App/CMakeLists.txt",
      "package.json",
      "src/App/DocumentObject.cpp"
    ]);
    expect(result.overview.validation_hints.map((hint) => hint.command)).toEqual([
      "manual_review cmake-build-test"
    ]);
  });

  it("surfaces devcontainer and Docker evidence as environment hints", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-overview-devcontainer-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".devcontainer"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, ".devcontainer", "devcontainer.json"), "{\"name\":\"fixture\"}\n");
      fs.writeFileSync(path.join(repoRoot, ".devcontainer", "Dockerfile"), "FROM debian:stable\n");
      fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"fixture\"}\n");

      const result = await getRepoOverview({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter()
      });

      expect(result.overview.platforms).toEqual(expect.arrayContaining(["devcontainer", "docker", "node"]));
      expect(result.overview.validation_hints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: "manual_review devcontainer-validation-environment"
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("prioritizes durable docs and skill guidance over fixture docs in docs-heavy repositories", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-overview-docs-heavy-"));
    try {
      fs.mkdirSync(path.join(repoRoot, "docs", "design"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "docs", "reference"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "skills", "spec-lifecycle-manager"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "tests", "fixtures", "skill-validation", "example"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "README.md"), "# Fixture\n");
      fs.writeFileSync(path.join(repoRoot, "AGENTS.md"), "# Agent Guidance\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "design", "runtime-design.md"), "# Runtime Design\n");
      fs.writeFileSync(path.join(repoRoot, "docs", "reference", "documentation-map.md"), "# Documentation Map\n");
      fs.writeFileSync(path.join(repoRoot, "skills", "spec-lifecycle-manager", "SKILL.md"), "# Spec Lifecycle\n");
      fs.writeFileSync(
        path.join(repoRoot, "tests", "fixtures", "skill-validation", "example", "fixture.md"),
        "# Fixture Doc\n"
      );

      const result = await getRepoOverview({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter()
      });

      expect(result.overview.key_docs.map((doc) => doc.path).slice(0, 5)).toEqual([
        "AGENTS.md",
        "README.md",
        "skills/spec-lifecycle-manager/SKILL.md",
        "docs/design/runtime-design.md",
        "docs/reference/documentation-map.md"
      ]);
      expect(result.overview.key_docs.map((doc) => doc.path).indexOf("tests/fixtures/skill-validation/example/fixture.md")).toBe(-1);
      expect(result.overview.validation_hints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: "manual_review docs-config-syntax"
          })
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("prioritizes package, source, and test anchors over workflow-heavy config noise", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-overview-workflow-heavy-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".github", "workflows"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "src", "services"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "src", "generated"), { recursive: true });
      fs.mkdirSync(path.join(repoRoot, "tests", "fixtures", "sample"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"overview-fixture\"}\n");
      fs.writeFileSync(path.join(repoRoot, "src", "main.ts"), "export const main = () => undefined;\n");
      fs.writeFileSync(path.join(repoRoot, "src", "services", "orders.ts"), "export const listOrders = () => [];\n");
      fs.writeFileSync(path.join(repoRoot, "src", "generated", "client.ts"), "export const generated = true;\n");
      fs.writeFileSync(path.join(repoRoot, "tests", "orders.test.ts"), "import '../src/main';\n");
      fs.writeFileSync(path.join(repoRoot, "tests", "fixtures", "sample", "fixture.ts"), "export const fixture = true;\n");
      for (const workflow of ["build", "lint", "release", "docs", "nightly"]) {
        fs.writeFileSync(path.join(repoRoot, ".github", "workflows", `${workflow}.yml`), `name: ${workflow}\n`);
      }

      const result = await getRepoOverview({
        repo_root: repoRoot,
        scanner: new FileCatalogScannerAdapter()
      });
      const keyFiles = result.overview.key_files;
      const paths = keyFiles.map((file) => file.path);
      const firstWorkflowIndex = paths.findIndex((filePath) => filePath.startsWith(".github/workflows/"));

      expect(paths.slice(0, 4)).toEqual([
        "src/main.ts",
        "package.json",
        "src/services/orders.ts",
        "tests/orders.test.ts"
      ]);
      expect(firstWorkflowIndex).toBeGreaterThan(paths.indexOf("tests/orders.test.ts"));
      expect(paths.indexOf("src/generated/client.ts")).toBeGreaterThan(paths.indexOf("tests/orders.test.ts"));
      expect(paths.indexOf("tests/fixtures/sample/fixture.ts")).toBeGreaterThan(paths.indexOf("tests/orders.test.ts"));
      expect(keyFiles.find((file) => file.path === "src/main.ts")?.reason).toContain("application entrypoint");
      expect(keyFiles.find((file) => file.path === "package.json")?.reason).toContain("package configuration");
      expect(keyFiles.find((file) => file.path === "tests/orders.test.ts")?.reason).toContain("test");
      expect(keyFiles.find((file) => file.path === ".github/workflows/build.yml")?.reason).toContain("workflow configuration");
      expect(keyFiles.find((file) => file.path === "src/generated/client.ts")?.reason).toContain(
        "downranked generated/vendor/fixture path"
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("promotes .NET solution, project, app, Razor, and test anchors", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-dotnet-web-repo");
    const result = await getRepoOverview({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter()
    });

    expect(result.overview.platforms).toContain("dotnet");
    expect(result.overview.languages).toEqual(expect.arrayContaining(["config", "csharp", "json"]));
    expect(result.overview.key_files.map((file) => file.path).slice(0, 7)).toEqual([
      "ModenaFixture.sln",
      "src/WebApi/WebApi.csproj",
      "src/WebApp/WebApp.csproj",
      "tests/WebApi.Tests/WebApi.Tests.csproj",
      "src/WebApi/Program.cs",
      "src/WebApi/Controllers/OrdersController.cs",
      "src/WebApp/Pages/Index.razor"
    ]);
    expect(result.overview.validation_hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "verification_plan",
          reason: expect.stringContaining("ModenaFixture.sln")
        }),
        expect.objectContaining({
          command: "dotnet test",
          reason: expect.stringContaining("tests/WebApi.Tests/WebApi.Tests.csproj")
        })
      ])
    );
    expect(result.overview.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/WebApi/bin",
          reason: "generated_or_vendor"
        }),
        expect.objectContaining({
          path: "src/WebApi/obj",
          reason: "generated_or_vendor"
        })
      ])
    );
  });

  it("promotes SAM templates, Lambda handlers, and infra validation hints", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-sam-lambda-repo");
    const result = await getRepoOverview({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter()
    });

    expect(result.overview.platforms).toEqual(expect.arrayContaining(["aws_lambda", "cloudformation", "sam", "python"]));
    expect(result.overview.key_files.map((file) => file.path).slice(0, 4)).toEqual([
      "infra/sam/orders/template.yaml",
      "src/orders/app.py",
      "pyproject.toml",
      "tests/infra/test_orders_template.py"
    ]);
    expect(result.overview.key_files.map((file) => file.path)).not.toContain("template-generated.yaml");
    expect(result.overview.validation_hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "verification_plan",
          reason: expect.stringContaining("infra/sam/orders/template.yaml")
        })
      ])
    );
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

  it("reports Go source coverage and skips Go cache roots", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-go-service-repo");
    const result = await getRepoScope({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter()
    });

    expect(result.scope.skipped_roots).toContain(".gocache");
    expect(result.scope.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".gocache",
          reason: "generated_or_vendor"
        })
      ])
    );
    expect(result.scope.languages).toEqual(expect.arrayContaining(["go", "text"]));
    expect(result.scope.file_counts).toMatchObject({
      go: 2
    });
    expect(result.scope.capability_counts.resource_backed).toBeGreaterThanOrEqual(2);
  });

  it("reports C++ headers, sources, and Python stubs in CMake C++ shaped scope", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-cmake-cpp-repo");
    const result = await getRepoScope({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter()
    });

    expect(result.scope.languages).toEqual(expect.arrayContaining(["cpp", "json", "python", "text"]));
    expect(result.scope.file_counts).toMatchObject({
      cpp: 3,
      python: 1
    });
    expect(result.scope.capability_counts).toMatchObject({
      partial_semantic: 1,
      resource_backed: expect.any(Number)
    });
  });

  it("aligns scope freshness with an available fresh snapshot", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-cmake-cpp-repo");
    const result = await getRepoScope({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter(),
      snapshots: snapshotPort(snapshot({ repoRoot, freshness: "fresh" }))
    });

    expect(result.meta.freshness).toBe("fresh");
    expect(result.meta.scope.languages).toEqual(expect.arrayContaining(["cpp", "python"]));
  });

  it("aligns overview freshness with an available fresh snapshot", async () => {
    const repoRoot = path.resolve("tests/fixtures/fixture-go-service-repo");
    const result = await getRepoOverview({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter(),
      snapshots: snapshotPort(snapshot({ repoRoot, freshness: "fresh" }))
    });

    expect(result.meta.freshness).toBe("fresh");
    expect(result.meta.scope.languages).toEqual(expect.arrayContaining(["go"]));
  });
});

function snapshot(input: {
  repoRoot: string;
  freshness: SnapshotState["freshness"];
}): SnapshotState {
  return {
    id: "snap-fixture",
    repo_root: input.repoRoot,
    workspace_root: input.repoRoot,
    repo_identity: "fixture",
    config_identity: "default",
    schema_version: 1,
    freshness: input.freshness,
    analysis_validity: "valid",
    owner_state: "owner",
    created_at: "2026-06-05T12:00:00.000Z",
    updated_at: "2026-06-05T12:00:00.000Z"
  };
}

function snapshotPort(value: SnapshotState | null): SnapshotPort {
  return {
    async getSnapshot() {
      return value;
    },
    async listSnapshots() {
      return value === null ? [] : [value];
    },
    async upsertSnapshot() {},
    async markSnapshotFreshness() {}
  };
}
