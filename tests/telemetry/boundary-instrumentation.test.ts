import { describe, expect, it } from "vitest";
import {
  InMemoryTelemetryAdapter,
  runTelemetryBoundary,
  type TelemetryBoundaryKind
} from "../../src/infrastructure/telemetry/index.js";

describe("runtime telemetry boundary instrumentation", () => {
  it("records use-case, graph/query, worker, cache, presentation, and degraded-state boundaries", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const boundaries: Array<{
      boundary: TelemetryBoundaryKind;
      name: string;
      attributes?: Record<string, unknown>;
    }> = [
      {
        boundary: "use_case",
        name: "context_for_task",
        attributes: { verification_status: "needed" }
      },
      {
        boundary: "graph_query",
        name: "search_nodes",
        attributes: { row_limit: 20, traversal_depth: 2 }
      },
      {
        boundary: "worker",
        name: "python_tree_sitter_extract",
        attributes: { timeout_ms: 1000 }
      },
      {
        boundary: "cache",
        name: "runtime_cache_get",
        attributes: { cache_state: "hit", namespace: "query" }
      },
      {
        boundary: "presentation",
        name: "status_envelope",
        attributes: { contract_version: "0.1" }
      },
      {
        boundary: "degraded_state",
        name: "parser_timeout",
        attributes: { degraded_mode_count: 1, analysis_validity: "partial" }
      }
    ];

    for (const boundary of boundaries) {
      await expect(
        runTelemetryBoundary({
          telemetry,
          ...boundary,
          run: () => "ok"
        })
      ).resolves.toBe("ok");
    }

    expect(telemetry.records).toHaveLength(boundaries.length);
    expect(telemetry.records).toEqual(
      expect.arrayContaining(
        boundaries.map((boundary) =>
          expect.objectContaining({
            name: "runtime.boundary",
            properties: expect.objectContaining({
              boundary_kind: boundary.boundary,
              boundary_name: boundary.name,
              outcome: boundary.boundary === "degraded_state" ? "degraded" : "ok"
            })
          })
        )
      )
    );
    expect(telemetry.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          properties: expect.objectContaining({
            boundary_kind: "cache",
            cache_state: "hit",
            namespace: "query"
          })
        }),
        expect.objectContaining({
          properties: expect.objectContaining({
            boundary_kind: "degraded_state",
            outcome: "degraded",
            degraded_mode_count: 1
          })
        })
      ])
    );
  });

  it("records error-boundary failures without replacing the thrown error", async () => {
    const telemetry = new InMemoryTelemetryAdapter();
    const failure = new Error("graph transaction failed");

    await expect(
      runTelemetryBoundary({
        telemetry,
        boundary: "error_boundary",
        name: "replace_snapshot_extraction",
        attributes: {
          snapshot_id: "snap-1"
        },
        run: () => {
          throw failure;
        }
      })
    ).rejects.toBe(failure);

    expect(telemetry.records).toEqual([
      expect.objectContaining({
        name: "error",
        properties: expect.objectContaining({
          boundary_kind: "error_boundary",
          boundary_name: "replace_snapshot_extraction",
          outcome: "error",
          snapshot_id: "snap-1",
          error_name: "Error",
          error_message: "graph transaction failed"
        })
      })
    ]);
  });
});
