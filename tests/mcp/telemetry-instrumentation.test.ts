import { describe, expect, it } from "vitest";
import type { GetRepoStatusResult } from "../../src/application/use-cases/get-repo-status.js";
import type { GetTaskContextResult } from "../../src/application/use-cases/get-task-context.js";
import { InMemoryTelemetryAdapter } from "../../src/infrastructure/telemetry/index.js";
import { createAgentWorkbenchServer } from "../../src/interface-adapters/mcp/server.js";

describe("MCP telemetry instrumentation", () => {
  it("records tool dispatch outcomes without changing the MCP response schema", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const server = createAgentWorkbenchServer("/repo", {
      telemetry,
      getTaskContext: ({ request }) => ({
        context: {
          task: request.task,
          repo_root: "/repo",
          summary: "Injected context.",
          requested_files: [],
          related_files: [],
          governing_docs: [],
          validation_hints: [],
          risks: [],
          next_actions: []
        },
        meta: {
          analysis_validity: "valid",
          freshness: "fresh",
          scope: {
            repo_root: "/repo",
            indexed_roots: ["."],
            skipped_roots: [],
            languages: ["typescript"]
          },
          capability_level: "resource_backed",
          evidence_kinds: ["config"],
          verification_status: "needed",
          truncated: false,
          budget: {
            row_limit: 10
          }
        }
      } satisfies GetTaskContextResult)
    }) as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (args: unknown) => Promise<{
            content: Array<{ text: string }>;
          }>;
        }
      >;
    };

    const response = await server._registeredTools.context_for_task.handler({
      task: "Gather context",
      max_files: 10
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      contract_version: string;
      data: { task: string };
    };

    expect(parsed.contract_version).toBe("0.1");
    expect(parsed.data.task).toBe("Gather context");
    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.tool.dispatch",
        properties: expect.objectContaining({
          surface_kind: "tool",
          surface_name: "context_for_task",
          outcome: "ok",
          analysis_validity: "valid",
          verification_status: "needed",
          error_count: 0,
          row_limit: 10
        })
      })
    ]);
  });

  it("records invalid input as blocked telemetry without running providers", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    let providerCalled = false;
    const server = createAgentWorkbenchServer("/repo", {
      telemetry,
      getTaskContext: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    }) as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (args: unknown) => Promise<{
            content: Array<{ text: string }>;
          }>;
        }
      >;
    };

    const response = await server._registeredTools.context_for_task.handler({
      task: "",
      max_files: 10
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      errors: Array<{ code: string }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.errors).toEqual([expect.objectContaining({ code: "invalid_input" })]);
    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.tool.dispatch",
        properties: expect.objectContaining({
          surface_name: "context_for_task",
          outcome: "blocked",
          analysis_validity: "invalid",
          verification_status: "blocked",
          error_count: 1
        })
      })
    ]);
  });

  it("records resource dispatch metadata", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const server = createAgentWorkbenchServer("/repo", {
      telemetry,
      getRepoStatus: ({ repo_root }) => ({
        status: {
          repo_root,
          freshness: "fresh",
          indexed_roots: ["."],
          skipped_roots: [],
          adapter_coverage: []
        },
        meta: {
          analysis_validity: "valid",
          freshness: "fresh",
          scope: {
            repo_root,
            indexed_roots: ["."],
            skipped_roots: [],
            languages: []
          },
          capability_level: "unsupported",
          evidence_kinds: [],
          verification_status: "needed",
          truncated: false
        }
      } satisfies GetRepoStatusResult)
    }) as unknown as {
      _registeredResources: Record<
        string,
        {
          readCallback: (args: unknown) => Promise<{
            contents: Array<{ text: string }>;
          }>;
        }
      >;
    };

    await server._registeredResources["repo:///status"].readCallback({});

    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.resource.dispatch",
        properties: expect.objectContaining({
          surface_kind: "resource",
          surface_name: "status",
          uri: "repo:///status",
          outcome: "ok"
        })
      })
    ]);
  });
});
