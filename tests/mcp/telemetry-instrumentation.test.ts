import { describe, expect, it } from "vitest";
import type { FindReferencesUseCaseResult } from "../../src/application/use-cases/find-references.js";
import type { GetRepoStatusResult } from "../../src/application/use-cases/get-repo-status.js";
import type { SearchSymbolsResult } from "../../src/application/use-cases/search-symbols.js";
import { InMemoryTelemetryAdapter } from "../../src/infrastructure/telemetry/index.js";
import { instrumentMcpServer } from "../../src/interface-adapters/mcp/instrumentation.js";

type RegisteredTool = {
  handler: (args: unknown) => Promise<{
    content: Array<{ text: string }>;
  }>;
};

type RegisteredResource = {
  readCallback: (args: unknown) => Promise<{
    contents: Array<{ text: string }>;
  }>;
};

type InstrumentableServer = {
  tool: (
    name: string,
    description: string,
    shape: unknown,
    handler: RegisteredTool["handler"]
  ) => unknown;
  resource: (
    name: string,
    uri: string,
    handler: RegisteredResource["readCallback"]
  ) => unknown;
};

function createInstrumentedEndpoints(telemetry: InMemoryTelemetryAdapter): {
  registeredTools: Record<string, RegisteredTool>;
  registeredResources: Record<string, RegisteredResource>;
  server: InstrumentableServer;
} {
  const registeredTools: Record<string, RegisteredTool> = {};
  const registeredResources: Record<string, RegisteredResource> = {};

  const server = {
    tool: (name: string, _description: string, _shape: unknown, handler: RegisteredTool["handler"]) => {
      registeredTools[name] = {
        handler: async (args: unknown) => ({ ...(await handler(args)) })
      };
    },
    resource: (name: string, uri: string, handler: RegisteredResource["readCallback"]) => {
      registeredResources[uri] = {
        readCallback: async (args: unknown) => ({ ...(await handler(args)) })
      };
      return { name, uri };
    }
  } as InstrumentableServer;

  const instrumented = instrumentMcpServer({
    server: server as never,
    telemetry
  });

  return {
    registeredTools,
    registeredResources,
    server: instrumented as unknown as InstrumentableServer
  };
}

describe("MCP telemetry instrumentation", () => {
  it("records tool dispatch outcomes without changing the MCP response schema", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const { registeredTools, server } = createInstrumentedEndpoints(telemetry);

    server.tool(
      "context_for_task",
      "",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                contract_version: "0.1",
                data: {
                  task: "Gather context",
                  repo_root: "/repo",
                  summary: "Injected context.",
                  requested_files: [],
                  related_files: [],
                  ranked_symbols: [],
                  governing_docs: [],
                  validation_hints: [],
                  skipped_work: [],
                  completeness: {
                    complete_enough: true,
                    markers: ["telemetry_fixture"],
                    caveats: []
                  },
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
              },
              null,
              2
            )
          }
        ]
      })
    );

    const response = await registeredTools.context_for_task.handler({
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
          repo_root: "/repo",
          error_count: 0,
          invalid_input_count: 0,
          degraded_mode_count: 0,
          row_limit: 10
        })
      })
    ]);
  });

  it("records invalid input as blocked telemetry", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const { registeredTools, server } = createInstrumentedEndpoints(telemetry);

    server.tool(
      "context_for_task",
      "",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                data: { task: "" },
                errors: [{ code: "invalid_input" }],
                meta: {
                  analysis_validity: "invalid",
                  verification_status: "blocked"
                }
              },
              null,
              2
            )
          }
        ]
      })
    );

    const response = await registeredTools.context_for_task.handler({
      task: "",
      max_files: 10
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      errors: Array<{ code: string }>;
    };

    expect(parsed.errors).toEqual([expect.objectContaining({ code: "invalid_input" })]);
    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.tool.dispatch",
        properties: expect.objectContaining({
          surface_name: "context_for_task",
          outcome: "blocked",
          analysis_validity: "invalid",
          verification_status: "blocked",
          error_count: 1,
          invalid_input_count: 1,
          degraded_mode_count: 1
        })
      })
    ]);
  });

  it("records post-edit deferred reasons from response envelopes", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const { registeredTools, server } = createInstrumentedEndpoints(telemetry);

    server.tool(
      "post_edit_feedback_fixture",
      "",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                data: {
                  repo_root: "/repo",
                  status: "done",
                  outcome: "queued",
                  checked_files: ["src/a.ts", "src/b.ts", "src/c.ts"],
                  findings: [],
                  deferred_checks: [
                    {
                      reason: "too_many_files",
                      outcome: "queued",
                      count: 1,
                      paths: ["src/c.ts"],
                      follow_up_tool: "diagnostics_for_files"
                    },
                    {
                      reason: "provider_not_applicable",
                      outcome: "skipped",
                      count: 2,
                      paths: ["src/a.ts", "src/b.ts"]
                    }
                  ],
                  visible_message: undefined,
                  next_actions: []
                },
                meta: {
                  analysis_validity: "valid",
                  verification_status: "done",
                  truncated: false
                }
              },
              null,
              2
            )
          }
        ]
      })
    );

    await registeredTools.post_edit_feedback_fixture.handler({});

    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.tool.dispatch",
        properties: expect.objectContaining({
          surface_name: "post_edit_feedback_fixture",
          post_edit_outcome: "queued",
          post_edit_deferred_check_count: 3,
          post_edit_deferred_reason_count: 2,
          post_edit_deferred_reasons: ["provider_not_applicable", "too_many_files"],
          post_edit_deferred_reason_counts: {
            provider_not_applicable: 2,
            too_many_files: 1
          },
          post_edit_deferred_outcome_counts: {
            queued: 1,
            skipped: 2
          }
        })
      })
    ]);
  });

  it("records row-limit and source-byte caps for symbol-search dispatch", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const { registeredTools, server } = createInstrumentedEndpoints(telemetry);

    server.tool(
      "symbol_search",
      "",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                symbols: {
                  query: "auth",
                  repo_root: "/repo",
                  snapshot_id: "snapshot-id",
                  symbols: [],
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
                    row_limit: 12,
                    source_byte_limit: 256
                  }
                }
              } satisfies SearchSymbolsResult,
              null,
              2
            )
          }
        ]
      })
    );

    await registeredTools.symbol_search.handler({
      query: "auth",
      max_results: 12,
      source_byte_limit: 256
    });

    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.tool.dispatch",
        properties: expect.objectContaining({
          surface_kind: "tool",
          surface_name: "symbol_search",
          outcome: "ok",
          row_limit: 12,
          source_byte_limit: 256,
          invalid_input_count: 0,
          degraded_mode_count: 0
        })
      })
    ]);
  });

  it("records traversal cap and degraded runtime-state counts for resource dispatch", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const { registeredResources, server } = createInstrumentedEndpoints(telemetry);

    server.resource(
      "status",
      "repo:///status",
      async () => ({
        contents: [
          {
            uri: "repo:///status",
            text: JSON.stringify(
              {
                data: {
                  repo_root: "/repo",
                  runtime_state: "partial",
                  freshness: "stale",
                  indexed_roots: ["."],
                  skipped_roots: [],
                  adapter_coverage: []
                },
                meta: {
                  analysis_validity: "partial",
                  freshness: "stale",
                  scope: {
                    repo_root: "/repo",
                    indexed_roots: ["."],
                    skipped_roots: [],
                    languages: []
                  },
                  capability_level: "unsupported",
                  evidence_kinds: [],
                  verification_status: "needed",
                  truncated: false
                }
              } satisfies {
                data: GetRepoStatusResult["status"];
                meta: GetRepoStatusResult["meta"];
              },
              null,
              2
            )
          }
        ]
      })
    );

    await registeredResources["repo:///status"].readCallback({});

    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.resource.dispatch",
        properties: expect.objectContaining({
          surface_kind: "resource",
          surface_name: "status",
          uri: "repo:///status",
          outcome: "ok",
          runtime_state: "partial",
          degraded_mode_count: 1
        })
      })
    ]);
  });

  it("records traversal-depth caps for find-references dispatch", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const { registeredTools, server } = createInstrumentedEndpoints(telemetry);

    server.tool(
      "find_references",
      "",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                references: {
                  repo_root: "/repo",
                  snapshot_id: "snapshot-id",
                  references: [],
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
                    row_limit: 17,
                    traversal_depth: 3
                  }
                }
              } satisfies FindReferencesUseCaseResult,
              null,
              2
            )
          }
        ]
      })
    );

    await registeredTools.find_references.handler({
      symbol: "User",
      max_depth: 3,
      max_results: 17
    });

    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.tool.dispatch",
        properties: expect.objectContaining({
          surface_kind: "tool",
          surface_name: "find_references",
          outcome: "ok",
          row_limit: 17,
          traversal_depth: 3,
          invalid_input_count: 0,
          degraded_mode_count: 0
        })
      })
    ]);
  });

  it("records resource dispatch metadata", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const { registeredResources, server } = createInstrumentedEndpoints(telemetry);

    server.resource(
      "status",
      "repo:///status",
      async () => ({
        contents: [
          {
            uri: "repo:///status",
            text: JSON.stringify({
              data: {
                repo_root: "/repo",
                runtime_state: "fresh",
                freshness: "fresh",
                indexed_roots: ["."],
                skipped_roots: [],
                adapter_coverage: []
              } satisfies GetRepoStatusResult["status"],
              meta: {
                analysis_validity: "valid",
                freshness: "fresh",
                scope: {
                  repo_root: "/repo",
                  indexed_roots: ["."],
                  skipped_roots: [],
                  languages: []
                },
                capability_level: "unsupported",
                evidence_kinds: [],
                verification_status: "needed",
                truncated: false
              }
            } satisfies {
              data: GetRepoStatusResult["status"];
              meta: GetRepoStatusResult["meta"];
            })
          }
        ]
      })
    );

    await registeredResources["repo:///status"].readCallback({});

    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "mcp.resource.dispatch",
        properties: expect.objectContaining({
          surface_kind: "resource",
          surface_name: "status",
          uri: "repo:///status",
          outcome: "ok",
          runtime_state: "fresh",
          analysis_validity: "valid",
          verification_status: "needed",
          invalid_input_count: 0,
          degraded_mode_count: 0
        })
      })
    ]);
  });
});
