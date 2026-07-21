/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { getRepoOrientation } from "../../src/application/use-cases/get-repo-orientation.js";
import type { GetRepoStatusResult } from "../../src/application/use-cases/get-repo-status.js";
import { orientationReceiptSchema } from "../../src/contracts/index.js";
import { repoOrientationResource } from "../../src/interface-adapters/mcp/registries/resources/repo-orientation.js";
import { registerMcpResource } from "../helpers/mcp-harness.js";

describe("repo orientation receipt", () => {
  it("returns one compact receipt with detailed-resource links", async () => {
    const orientation = getRepoOrientation(statusResult());
    expect(orientationReceiptSchema.parse(orientation.orientation)).toMatchObject({
      snapshot_id: "snapshot-1",
      freshness: "fresh",
      trust_summary: { orientation_reusable: true },
      material_blockers: [],
      detail_resources: ["repo:///status", "repo:///scope", "repo:///overview"],
      refresh_required: false
    });

    const serialized = JSON.stringify(orientation.orientation);
    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(2048);
    expect(serialized).not.toMatch(/adapter_coverage|file_counts|key_files|key_docs/);
  });

  it("does not demand re-orientation for an ordinary stale content snapshot", () => {
    const orientation = getRepoOrientation(statusResult({
      freshness: "stale",
      runtime_state: "stale"
    })).orientation;

    expect(orientation).toMatchObject({
      freshness: "stale",
      refresh_required: false,
      ordinary_content_edit_requires_refresh: false,
      trust_summary: { orientation_reusable: true }
    });
  });

  it("keeps orientation reusable while ordinary content changes are pending", () => {
    const orientation = getRepoOrientation(statusResult({
      runtime_state: "refreshing",
      freshness: "refreshing",
      watcher_freshness: {
        status: "refreshing",
        queue_state: "pending",
        scope_status: "synchronized",
        ignore_rules_status: "synchronized"
      }
    })).orientation;

    expect(orientation).toMatchObject({
      freshness: "refreshing",
      refresh_required: false,
      ordinary_content_edit_requires_refresh: false,
      trust_summary: { orientation_reusable: true },
      material_blockers: []
    });
  });

  it("requires refresh only when orientation-relevant evidence is blocked", () => {
    const result = statusResult();
    result.status.watcher_freshness = {
      status: "stale",
      queue_state: "pending",
      scope_status: "changed",
      ignore_rules_status: "synchronized"
    };
    const orientation = getRepoOrientation(result).orientation;

    expect(orientation.refresh_required).toBe(true);
    expect(orientation.trust_summary.orientation_reusable).toBe(false);
    expect(orientation.material_blockers).toEqual([
      "Repository scope or ignore rules changed."
    ]);
  });

  it("preserves refresh for a genuinely invalid repository index", () => {
    const result = statusResult({ runtime_state: "invalid" });
    result.meta.analysis_validity = "invalid";
    result.meta.verification_status = "blocked";

    expect(getRepoOrientation(result).orientation).toMatchObject({
      refresh_required: true,
      trust_summary: { orientation_reusable: false },
      material_blockers: ["Repository index evidence is invalid."]
    });
  });

  it.each([
    {
      label: "complete ranking",
      receipt: { state: "ready", recovery: "none", authority_map: "present" } as const,
      validity: "valid" as const,
      reusable: true,
      refresh: false
    },
    {
      label: "no authority map",
      receipt: { state: "ready", recovery: "none", authority_map: "absent" } as const,
      validity: "partial" as const,
      reusable: true,
      refresh: false
    },
    {
      label: "invalid source",
      receipt: { state: "invalid", recovery: "source_repair", authority_map: "unknown" } as const,
      validity: "invalid" as const,
      reusable: false,
      refresh: false
    },
    {
      label: "refreshable unavailable ranking",
      receipt: { state: "unavailable", recovery: "refresh", authority_map: "unknown" } as const,
      validity: "invalid_due_to_environment" as const,
      reusable: false,
      refresh: true
    },
    {
      label: "environment repair",
      receipt: { state: "unavailable", recovery: "environment_repair", authority_map: "unknown" } as const,
      validity: "invalid_due_to_environment" as const,
      reusable: false,
      refresh: false
    },
    {
      label: "request repair",
      receipt: { state: "unavailable", recovery: "request_repair", authority_map: "unknown" } as const,
      validity: "invalid" as const,
      reusable: false,
      refresh: false
    }
  ])("projects $label without inventing a refresh path", ({ receipt, validity, reusable, refresh }) => {
    const result = statusResult({
      documentation_ranking: { snapshot_id: "snapshot-1", ...receipt }
    });
    result.meta.analysis_validity = validity;
    result.meta.verification_status = validity === "valid" || validity === "partial" ? "needed" : "blocked";

    const orientation = getRepoOrientation(result).orientation;
    expect(orientation).toMatchObject({
      refresh_required: refresh,
      trust_summary: { orientation_reusable: reusable }
    });
    expect(orientation.material_blockers.length === 0).toBe(reusable);
  });

  it.each([
    {
      label: "degraded watcher",
      watcher: {
        status: "degraded" as const,
        queue_state: "drained" as const,
        scope_status: "synchronized" as const,
        ignore_rules_status: "synchronized" as const
      },
      blocker: "Workspace watcher freshness is degraded or unavailable."
    },
    {
      label: "failed watcher queue",
      watcher: {
        status: "stale" as const,
        queue_state: "failed" as const,
        scope_status: "synchronized" as const,
        ignore_rules_status: "synchronized" as const
      },
      blocker: "Workspace watcher freshness is degraded or unavailable."
    },
    {
      label: "unavailable watcher queue",
      watcher: {
        status: "stale" as const,
        queue_state: "unavailable" as const,
        scope_status: "synchronized" as const,
        ignore_rules_status: "synchronized" as const
      },
      blocker: "Workspace watcher freshness is degraded or unavailable."
    },
    {
      label: "refreshing orientation state",
      watcher: {
        status: "refreshing" as const,
        queue_state: "pending" as const,
        scope_status: "unknown" as const,
        ignore_rules_status: "synchronized" as const
      },
      blocker: "Repository scope or ignore-rule synchronization is unknown."
    }
  ])("does not reuse orientation for $label", ({ watcher, blocker }) => {
    const orientation = getRepoOrientation(statusResult({ watcher_freshness: watcher })).orientation;

    expect(orientation).toMatchObject({
      refresh_required: true,
      trust_summary: { orientation_reusable: false }
    });
    expect(orientation.material_blockers).toContain(blocker);
  });

  it("exposes repo:///orientation through a thin MCP resource", async () => {
    const expected = getRepoOrientation(statusResult());
    const registered = registerMcpResource(repoOrientationResource, {
      repoRoot: "/repo",
      getRepoOrientation: () => expected
    });

    expect(registered).toMatchObject({
      name: "orientation",
      uri: "repo:///orientation"
    });
    const response = await registered.handler({});
    const parsed = JSON.parse(response.contents[0]?.text ?? "{}") as {
      data: typeof expected.orientation;
    };
    expect(parsed.data).toEqual(expected.orientation);
    expect(Buffer.byteLength(response.contents[0]?.text ?? "", "utf8")).toBeLessThanOrEqual(4096);
  });
});

function statusResult(overrides: Partial<GetRepoStatusResult["status"]> = {}): GetRepoStatusResult {
  return {
    status: {
      repo_root: "/repo",
      runtime_state: "fresh",
      freshness: "fresh",
      indexed_roots: ["."],
      skipped_roots: [],
      adapter_coverage: [],
      snapshot_id: "snapshot-1",
      owner_state: "owner",
      warmup_state: "complete",
      ...overrides
    },
    meta: {
      analysis_validity: "valid",
      freshness: overrides.freshness ?? "fresh",
      scope: {
        repo_root: "/repo",
        indexed_roots: ["."],
        skipped_roots: [],
        languages: ["typescript"]
      },
      capability_level: "semantic",
      evidence_kinds: ["sqlite"],
      verification_status: "needed",
      truncated: false
    }
  };
}
