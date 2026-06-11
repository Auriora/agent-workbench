import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoStatusResource } from "../../src/interface-adapters/mcp/registries/resources/repo-status.js";
import type { GetRepoStatusResult } from "../../src/application/use-cases/get-repo-status.js";
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

describe("repo status MCP resource", () => {
  it("uses the injected status provider for repo:///status", async () => {
    let registered: RegisteredResource | undefined;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };
    const result: GetRepoStatusResult = {
      status: {
        repo_root: "/fixture",
        runtime_state: "fresh",
        freshness: "fresh",
        indexed_roots: ["."],
        skipped_roots: [],
        adapter_coverage: [
          {
            domain: "language",
            name: "typescript",
            capability_level: "unsupported",
            evidence_kinds: [],
            paths: ["src/app.ts"],
            provenance: "file_identity",
            confidence: "high",
            metadata: {}
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
          languages: ["typescript"]
        },
        capability_level: "unsupported",
        evidence_kinds: [],
        verification_status: "needed",
        truncated: false
      }
    };

    repoStatusResource.register(server as never, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => ({
        ...result,
        status: {
          ...result.status,
          repo_root
        }
      })
    });

    expect(registered).toMatchObject({
      name: "status",
      uri: "repo:///status"
    });

    const response = await registered?.handler({ repo_root: "/requested" });
    const parsed = JSON.parse(response?.contents[0]?.text ?? "{}") as {
      data: GetRepoStatusResult["status"];
    };

    expect(parsed.data.repo_root).toBe("/requested");
    expect(parsed.data.adapter_coverage).toEqual(result.status.adapter_coverage);
  });

  it("returns a structured invalid-input envelope before provider execution", async () => {
    let registered: RegisteredResource | undefined;
    let providerCalled = false;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };

    repoStatusResource.register(server as never, {
      repoRoot: "/repo",
      getRepoStatus: () => {
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

  it("returns structured provider-not-configured state without synthesizing status", async () => {
    let registered: RegisteredResource | undefined;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };

    repoStatusResource.register(server as never, {
      repoRoot: "/repo"
    });

    const response = await registered?.handler({});
    const parsed = JSON.parse(response?.contents[0]?.text ?? "{}") as {
      data: { freshness: string; adapter_coverage: unknown[] };
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; message: string; retryable: boolean }>;
    };

    expect(parsed.data.freshness).toBe("unknown");
    expect(parsed.data.adapter_coverage).toEqual([]);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        message: "repo:///status provider is not configured.",
        retryable: false
      })
    ]);
  });

  it("keeps default status bounded without scanned coverage when no snapshot exists", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-status-cold-"));
    try {
      fs.writeFileSync(path.join(repoRoot, "package.json"), "{\"name\":\"cold-fixture\"}\n");
      const server = createAgentWorkbenchServer(repoRoot, {
        startGraphWarmup: false
      }) as unknown as {
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

      const response = await server._registeredResources["repo:///status"].readCallback({});
      const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
        data: GetRepoStatusResult["status"];
        meta: GetRepoStatusResult["meta"];
      };

      expect(parsed.data.adapter_coverage).toEqual([]);
      expect(parsed.meta.scope.languages).toEqual([]);
      expect(parsed.meta.caveats).toBeUndefined();
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("preserves no-coverage status caveats in the MCP resource envelope", async () => {
    let registered: RegisteredResource | undefined;
    const server = {
      resource(name: string, uri: string, handler: RegisteredResource["handler"]) {
        registered = { name, uri, handler };
      }
    };

    repoStatusResource.register(server as never, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => ({
        status: {
          repo_root,
          runtime_state: "partial",
          freshness: "unknown",
          indexed_roots: ["."],
          skipped_roots: [],
          adapter_coverage: []
        },
        meta: {
          analysis_validity: "partial",
          freshness: "unknown",
          scope: {
            repo_root,
            indexed_roots: ["."],
            skipped_roots: [],
            languages: []
          },
          capability_level: "unsupported",
          evidence_kinds: [],
          verification_status: "needed",
          truncated: false,
          caveats: [
            {
              kind: "no_adapter_coverage",
              severity: "warning",
              message: "No scanner-visible adapter coverage was observed.",
              evidence_kinds: []
            }
          ]
        }
      })
    });

    const response = await registered?.handler({});
    const parsed = JSON.parse(response?.contents[0]?.text ?? "{}") as {
      meta: GetRepoStatusResult["meta"];
      errors: unknown[];
    };

    expect(parsed.errors).toEqual([]);
    expect(parsed.meta.caveats).toEqual([
      expect.objectContaining({
        kind: "no_adapter_coverage"
      })
    ]);
  });
});
