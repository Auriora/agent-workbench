/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { searchRankedDocs } from "../../src/application/use-cases/query-docs.js";
import { getSnapshotRepoStatus } from "../../src/application/use-cases/get-repo-status.js";
import type { DocumentationConcernIndexPort } from "../../src/ports/index.js";
import { docsSearchTool } from "../../src/interface-adapters/mcp/registries/tools/docs-search.js";
import { repoStatusResource } from "../../src/interface-adapters/mcp/registries/resources/repo-status.js";
import { createDocsRankingCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { registerMcpResource, registerMcpTool } from "../helpers/mcp-harness.js";

describe("docs_search status recovery chain", () => {
  it.each([
    {
      label: "ready invalid",
      state: { status: "ready", snapshot_id: "snapshot-stable", state: "invalid" } as const,
      publicState: "invalid",
      recovery: "source_repair"
    },
    {
      label: "persisted concern invalid",
      state: { status: "unavailable", snapshot_id: "snapshot-stable", reason: "concern_index_invalid" } as const,
      publicState: "invalid",
      recovery: "source_repair"
    },
    ...(["snapshot_not_published", "snapshot_schema_incompatible", "concern_index_state_missing"] as const)
      .map((reason) => ({
        label: reason,
        state: { status: "unavailable" as const, snapshot_id: "snapshot-stable", reason },
        publicState: "unavailable",
        recovery: "refresh"
      })),
    {
      label: "snapshot not found",
      state: { status: "unavailable", snapshot_id: "snapshot-stable", reason: "snapshot_not_found" } as const,
      publicState: "unavailable",
      recovery: "request_repair"
    },
    {
      label: "foreign snapshot",
      state: { status: "ready", snapshot_id: "snapshot-foreign", state: "complete" } as const,
      publicState: "unavailable",
      recovery: "environment_repair"
    }
  ])("executes the emitted status action for $label", async ({ state, publicState, recovery }) => {
    const concerns = concernPort(async () => state);
    const search = registerMcpTool(docsSearchTool, {
      repoRoot: "/repo",
      searchRankedDocs: ({ request }) => searchRankedDocs({
        request,
        selected_snapshot_id: "snapshot-stable",
        docs_index: blockedAfterReadiness("docs index"),
        documentation_concerns: concerns,
        ranking_candidates: blockedAfterReadiness("ranking candidates"),
        ranking_cursor_codec: createDocsRankingCursorCodec({ key: Buffer.alloc(32, 4) }),
        ranked_universes: blockedAfterReadiness("ranked universes"),
        default_repo_root: "/repo",
        now_iso8601: "2026-07-21T12:00:00.000Z",
        universe_id: "unreachable"
      })
    });
    const searchEnvelope = JSON.parse((await search.handler({ query: "SessionStart behavior" })).content[0]!.text);
    expect(searchEnvelope).toMatchObject({
      data: {
        snapshot_id: "snapshot-stable",
        status: "blocked",
        blocker: "ranking_unavailable",
        trust_state: "blocked_ranking_unavailable",
        hits: []
      },
      meta: { verification_status: "blocked" }
    });
    const action = searchEnvelope.data.next_actions[0];
    expect(action).toMatchObject({ tool: "read_resource", args: { uri: "repo:///status" } });

    const status = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => getSnapshotRepoStatus({
        repo_root,
        selected_snapshot_id: "snapshot-stable",
        snapshots: {
          async getSnapshot() {
            return {
              id: "snapshot-stable", repo_root: "/repo", workspace_root: "/repo",
              repo_identity: "repo", config_identity: "config", schema_version: 1,
              freshness: "fresh", analysis_validity: "valid", owner_state: "owner",
              created_at: "2026-07-21T12:00:00.000Z", updated_at: "2026-07-21T12:00:00.000Z"
            };
          },
          async listSnapshots() { return []; }, async upsertSnapshot() {}, async markSnapshotFreshness() {}
        },
        catalog: {
          async listFiles() { return []; }, async getFile() { return null; },
          async upsertEntry() {}, async removeEntry() {}
        },
        documentation_concerns: concerns,
        refresh_triggers: blockedAfterReadiness("refresh trigger")
      })
    });
    const statusEnvelope = JSON.parse((await status.handler(action.args)).contents[0]!.text);
    expect(statusEnvelope).toMatchObject({
      data: {
        snapshot_id: "snapshot-stable",
        documentation_ranking: {
          snapshot_id: "snapshot-stable",
          state: publicState,
          recovery
        }
      },
      meta: { verification_status: "blocked" }
    });
    expect(JSON.stringify({ searchEnvelope, statusEnvelope })).not.toMatch(
      /private\.sqlite|token=secret|snapshot-foreign/
    );
  });

  it("maps a readiness-state throw to environment repair through the emitted status action", async () => {
    const concerns = concernPort(async () => {
      throw new Error("database locked at /home/example/private.sqlite token=secret");
    });
    const search = registerMcpTool(docsSearchTool, {
      repoRoot: "/repo",
      searchRankedDocs: ({ request }) => searchRankedDocs({
        request,
        selected_snapshot_id: "snapshot-stable",
        docs_index: blockedAfterReadiness("docs index"),
        documentation_concerns: concerns,
        ranking_candidates: blockedAfterReadiness("ranking candidates"),
        ranking_cursor_codec: createDocsRankingCursorCodec({ key: Buffer.alloc(32, 5) }),
        ranked_universes: blockedAfterReadiness("ranked universes"),
        default_repo_root: "/repo",
        now_iso8601: "2026-07-21T12:00:00.000Z",
        universe_id: "unreachable"
      })
    });
    const searchEnvelope = JSON.parse((await search.handler({ query: "runtime" })).content[0]!.text);
    const action = searchEnvelope.data.next_actions[0];
    expect(searchEnvelope.data).toMatchObject({ blocker: "ranking_unavailable", hits: [] });
    expect(action).toMatchObject({ tool: "read_resource", args: { uri: "repo:///status" } });

    const status = registerMcpResource(repoStatusResource, {
      repoRoot: "/repo",
      getRepoStatus: ({ repo_root }) => getSnapshotRepoStatus({
        repo_root,
        selected_snapshot_id: "snapshot-stable",
        snapshots: {
          async getSnapshot() {
            return {
              id: "snapshot-stable", repo_root: "/repo", workspace_root: "/repo",
              repo_identity: "repo", config_identity: "config", schema_version: 1,
              freshness: "fresh", analysis_validity: "valid", owner_state: "owner",
              created_at: "2026-07-21T12:00:00.000Z", updated_at: "2026-07-21T12:00:00.000Z"
            };
          },
          async listSnapshots() { return []; }, async upsertSnapshot() {}, async markSnapshotFreshness() {}
        },
        catalog: {
          async listFiles() { return []; }, async getFile() { return null; },
          async upsertEntry() {}, async removeEntry() {}
        },
        documentation_concerns: concerns,
        refresh_triggers: blockedAfterReadiness("refresh trigger")
      })
    });
    const statusEnvelope = JSON.parse((await status.handler(action.args)).contents[0]!.text);
    expect(statusEnvelope).toMatchObject({
      data: {
        snapshot_id: "snapshot-stable",
        documentation_ranking: {
          snapshot_id: "snapshot-stable",
          state: "unavailable",
          recovery: "environment_repair"
        }
      },
      meta: { verification_status: "blocked" }
    });
    expect(JSON.stringify({ searchEnvelope, statusEnvelope })).not.toMatch(/private\.sqlite|token=secret/);
  });
});

function concernPort(
  getState: DocumentationConcernIndexPort["getDocumentationConcernIndexState"]
): DocumentationConcernIndexPort {
  return {
    async replaceSnapshotDocumentationConcerns() {},
    getDocumentationConcernIndexState: getState,
    async listDocumentationConcernTerms() { throw new Error("terms must not be read"); },
    async listDocumentationConcernOwners() { throw new Error("owners must not be read"); }
  };
}

function blockedAfterReadiness(label: string): never {
  return new Proxy({}, {
    get() {
      return () => { throw new Error(`${label} must not be read`); };
    }
  }) as never;
}
