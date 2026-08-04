/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { ProjectUnitMarker } from "../../src/contracts/index.js";
import {
  discoverProjectUnits,
  type ProjectUnitAggregatorRelation,
  type ProjectUnitCandidate
} from "../../src/application/use-cases/project-unit-discovery.js";

describe("project-unit discovery", () => {
  it("associates selected files with the nearest containing unit and isolates unrelated siblings", () => {
    const result = discoverProjectUnits({
      candidates: [
        unit("services/api"),
        unit("services/web"),
        unit("services/api/nested")
      ],
      selected_paths: [
        "services/api/nested/src/handler.cs",
        "services/web/src/ignored.ts"
      ]
    });

    expect(result.units).toEqual([
      discovered("services/web", "containing"),
      discovered("services/api/nested", "containing")
    ]);
    expect(result.limitations).toEqual([]);
  });

  it("returns only units intersecting a selected subtree and admits explicit aggregators", () => {
    const result = discoverProjectUnits({
      candidates: [
        unit("apps/platform"),
        unit("apps/platform/service-a"),
        unit("apps/platform/service-b"),
        unit("apps/other")
      ],
      selected_subtrees: ["apps/platform"],
      explicit_aggregators: [
        {
          aggregator_root: "apps/platform",
          unit_root: "apps/platform/service-a"
        }
      ]
    });

    expect(result.units).toEqual([
      discovered("apps/platform", "explicit_aggregator"),
      discovered("apps/platform/service-a", "intersects_subtree"),
      discovered("apps/platform/service-b", "intersects_subtree")
    ]);
  });

  it("is deterministic across candidate, scope, and aggregator ordering", () => {
    const candidates = [
      unit("collection/root"),
      unit("collection/root/service-b"),
      unit("collection/root/service-a"),
      unit("independent")
    ];
    const explicitAggregators: ProjectUnitAggregatorRelation[] = [
      {
        aggregator_root: "collection/root",
        unit_root: "collection/root/service-a"
      },
      {
        aggregator_root: "collection/root",
        unit_root: "collection/root/service-b"
      }
    ];
    const baseline = discoverProjectUnits({
      candidates,
      selected_paths: [
        "collection/root/service-a/src/app.ts",
        "independent/src/main.rs"
      ],
      explicit_aggregators: explicitAggregators
    });

    const reordered = discoverProjectUnits({
      candidates: [...candidates].reverse(),
      selected_paths: [
        "independent/src/main.rs",
        "collection/root/service-a/src/app.ts"
      ],
      explicit_aggregators: [...explicitAggregators].reverse()
    });

    expect(reordered).toEqual(baseline);
  });

  it("caps discovered units deterministically", () => {
    const result = discoverProjectUnits({
      candidates: [
        unit("apps/a"),
        unit("apps/b"),
        unit("apps/c")
      ],
      selected_subtrees: ["apps"],
      max_units: 2
    });

    expect(result.units).toEqual([
      discovered("apps/a", "intersects_subtree"),
      discovered("apps/b", "intersects_subtree")
    ]);
    expect(result.limitations).toContainEqual({
      kind: "project_unit_cap_exceeded",
      limit: 2,
      omitted_count: 1,
      message: "Project-unit discovery was capped at 2 units."
    });
  });

  it("reuses a coherent broad-request root only when explicit aggregation covers nested units", () => {
    const result = discoverProjectUnits({
      candidates: [
        unit("workspace"),
        unit("workspace/service-a"),
        unit("workspace/service-b")
      ],
      explicit_aggregators: [
        {
          aggregator_root: "workspace",
          unit_root: "workspace/service-a"
        },
        {
          aggregator_root: "workspace",
          unit_root: "workspace/service-b"
        }
      ]
    });

    expect(result.units).toEqual([
      discovered("workspace", "broad_request_coherent_root")
    ]);
    expect(result.limitations).toEqual([]);
  });

  it("returns a bounded per-unit broad collection when no coherent root is evidenced", () => {
    const result = discoverProjectUnits({
      candidates: [
        unit("workspace"),
        unit("workspace/service-a"),
        unit("workspace/service-b")
      ]
    });

    expect(result.units).toEqual([
      discovered("workspace", "intersects_subtree"),
      discovered("workspace/service-a", "intersects_subtree"),
      discovered("workspace/service-b", "intersects_subtree")
    ]);
    expect(result.limitations).toContainEqual({
      kind: "broad_request_collection",
      unit_count: 3,
      message:
        "No coherent root project unit was evidenced for the broad request; returning bounded per-unit evidence without merging unrelated units."
    });
  });

  it("rejects unsafe scope paths and caps normalized scope inputs", () => {
    const result = discoverProjectUnits({
      candidates: [unit("apps/a"), unit("apps/b"), unit("apps/c")],
      selected_paths: [
        "./apps/a/src/file.ts",
        "apps/b/src/file.ts",
        "../escape.ts",
        "/absolute/path.ts"
      ],
      selected_subtrees: ["apps", "apps/b", "apps/c"],
      max_selected_scope_paths: 2
    });

    expect(result.units).toEqual([
      discovered("apps/a", "containing"),
      discovered("apps/b", "containing"),
      discovered("apps/c", "intersects_subtree")
    ]);
    expect(result.limitations).toEqual([
      {
        kind: "invalid_scope_path",
        path: "../escape.ts",
        message: "Scope paths must be normalized repo-relative paths."
      },
      {
        kind: "invalid_scope_path",
        path: "/absolute/path.ts",
        message: "Scope paths must be normalized repo-relative paths."
      },
      {
        kind: "selected_scope_path_cap_exceeded",
        limit: 2,
        omitted_count: 1,
        message: "Selected scope was capped at 2 normalized paths."
      }
    ]);
  });
});

function unit(root: string, kind: ProjectUnitCandidate["kind"] = "dotnet"): ProjectUnitCandidate {
  return {
    root,
    kind,
    markers: [marker(`${root}/marker`)]
  };
}

function marker(path: string): ProjectUnitMarker {
  return {
    path,
    kind: "csproj",
    evidence_source: "manifest"
  };
}

function discovered(root: string, selection: Parameters<typeof expectSelection>[1]) {
  return {
    root,
    kind: "dotnet",
    markers: [marker(`${root}/marker`)],
    selection
  };
}

function expectSelection(
  _root: string,
  selection: "containing" | "intersects_subtree" | "explicit_aggregator" | "broad_request_coherent_root"
) {
  return selection;
}
