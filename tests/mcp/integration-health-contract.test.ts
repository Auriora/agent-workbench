/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  integrationArtifactIdentitySchema,
  integrationHealthSchema,
  integrationProviderSchema,
  invalidationGenerationSchema,
  refreshDeadlineSchema,
  refreshExecutionStateSchema,
  refreshFailureSchema,
  snapshotPublicationStateSchema,
  snapshotRefreshDiagnosticsReceiptSchema,
  type IntegrationArtifactIdentity,
  type IntegrationHealth,
  type IntegrationSessionEvidence,
  type IntegrationSurfaceHealth
} from "../../src/contracts/index.js";
import { describeCodexIntegrationProfile } from "../../src/application/use-cases/describe-codex-integration-profile.js";
import { getIntegrationHealth } from "../../src/application/use-cases/get-integration-health.js";
import {
  mcpPrompts,
  mcpResources,
  mcpTools
} from "../../src/interface-adapters/mcp/registries/index.js";

type IntegrationSessionFixtureInput = {
  client?: string;
  discovery_state: IntegrationSessionEvidence["discovery_state"];
  discovered_tools?: string[];
  discovered_resources?: string[];
  discovered_prompts?: string[];
};

describe("integration health contract fixtures", () => {
  it("locks canonical refresh execution and publication vocabularies", () => {
    expect(refreshExecutionStateSchema.options).toEqual([
      "idle",
      "planned",
      "running",
      "complete",
      "failed"
    ]);
    expect(snapshotPublicationStateSchema.options).toEqual([
      "building",
      "published",
      "superseded",
      "failed"
    ]);
    expect(refreshExecutionStateSchema.safeParse("scheduled").success).toBe(false);
    expect(refreshExecutionStateSchema.safeParse("cancelled").success).toBe(false);
  });

  it("requires monotonic generation values and a finite positive refresh deadline", () => {
    expect(invalidationGenerationSchema.parse(0)).toBe(0);
    expect(invalidationGenerationSchema.safeParse(-1).success).toBe(false);
    expect(invalidationGenerationSchema.safeParse(1.5).success).toBe(false);

    const deadline = {
      timeout_ms: 30_000,
      deadline_at: "2026-07-19T12:00:30.000Z"
    };
    expect(refreshDeadlineSchema.parse(deadline)).toEqual(deadline);
    for (const timeout_ms of [0, -1, Number.POSITIVE_INFINITY]) {
      expect(refreshDeadlineSchema.safeParse({ ...deadline, timeout_ms }).success).toBe(false);
    }
    expect(refreshDeadlineSchema.safeParse({
      ...deadline,
      deadline_at: "not-a-timestamp"
    }).success).toBe(false);
  });

  it("accepts the complete authoritative diagnostics state matrix", () => {
    const base = {
      repo_identity: "repo-identity",
      controller_generation: 7,
      diagnostic_revision: 11,
      graph_freshness: "stale" as const,
      worker_termination_state: "not_required" as const
    };
    const failure = {
      code: "worker_timeout" as const,
      category: "worker" as const,
      message: "Refresh worker deadline expired.",
      execution_id: "exec-failed",
      target_snapshot_id: "snap-failed",
      occurred_at: "2026-07-19T12:00:00.000Z"
    };
    const legalReceipts = [
      {
        ...base,
        visible_snapshot_id: "snap-prior",
        execution_state: "idle",
        activity_lease_held: false
      },
      {
        ...base,
        graph_freshness: "fresh",
        execution_id: "exec-planned",
        started_generation: 12,
        requested_generation: 12,
        target_snapshot_id: "snap-building",
        visible_snapshot_id: "snap-prior",
        execution_state: "planned",
        publication_state: "building",
        activity_lease_held: true
      },
      {
        ...base,
        graph_freshness: "fresh",
        execution_id: "exec-running",
        started_generation: 12,
        requested_generation: 13,
        target_snapshot_id: "snap-building",
        visible_snapshot_id: "snap-prior",
        execution_state: "running",
        publication_state: "superseded",
        activity_lease_held: true
      },
      {
        ...base,
        graph_freshness: "fresh",
        execution_id: "exec-complete",
        started_generation: 13,
        requested_generation: 13,
        target_snapshot_id: "snap-current",
        visible_snapshot_id: "snap-current",
        execution_state: "complete",
        publication_state: "published",
        activity_lease_held: false
      },
      {
        ...base,
        execution_id: "exec-failed",
        started_generation: 13,
        requested_generation: 13,
        target_snapshot_id: "snap-failed",
        visible_snapshot_id: "snap-prior",
        execution_state: "failed",
        publication_state: "failed",
        activity_lease_held: false,
        worker_termination_state: "confirmed",
        last_failure: failure
      }
    ] as const;

    expect(legalReceipts.map((receipt) =>
      snapshotRefreshDiagnosticsReceiptSchema.parse(receipt)
    )).toEqual(legalReceipts);
  });

  it("rejects invalid diagnostics pairs and missing correlation identities", () => {
    const base = {
      repo_identity: "repo-identity",
      controller_generation: 7,
      diagnostic_revision: 11,
      graph_freshness: "stale",
      visible_snapshot_id: "snap-prior",
      worker_termination_state: "not_required"
    };
    const running = {
      ...base,
      execution_id: "exec-running",
      started_generation: 2,
      requested_generation: 2,
      target_snapshot_id: "snap-target",
      execution_state: "running",
      publication_state: "building",
      activity_lease_held: true
    };
    const complete = {
      ...base,
      graph_freshness: "fresh",
      execution_id: "exec-complete",
      started_generation: 2,
      requested_generation: 2,
      target_snapshot_id: "snap-target",
      visible_snapshot_id: "snap-target",
      execution_state: "complete",
      publication_state: "published",
      activity_lease_held: false
    };
    const failed = {
      ...base,
      execution_id: "exec-failed",
      started_generation: 2,
      requested_generation: 2,
      target_snapshot_id: "snap-failed",
      execution_state: "failed",
      publication_state: "failed",
      activity_lease_held: false,
      worker_termination_state: "unconfirmed",
      last_failure: {
        code: "worker_error",
        category: "worker",
        message: "Refresh worker failed.",
        execution_id: "exec-failed",
        target_snapshot_id: "snap-failed",
        occurred_at: "2026-07-19T12:00:00.000Z"
      }
    };
    const invalidReceipts: Array<[string, unknown]> = [
      ["idle holds lease", { ...base, execution_state: "idle", activity_lease_held: true }],
      ["idle has execution", { ...base, execution_id: "exec", execution_state: "idle", activity_lease_held: false }],
      ["idle has generation", { ...base, started_generation: 1, execution_state: "idle", activity_lease_held: false }],
      ["idle has target", { ...base, target_snapshot_id: "snap", publication_state: "building", execution_state: "idle", activity_lease_held: false }],
      ["planned misses identities", { ...base, execution_state: "planned", activity_lease_held: true }],
      ["planned drops lease", { ...running, execution_state: "planned", activity_lease_held: false }],
      ["planned has invalid publication", { ...running, execution_state: "planned", publication_state: "superseded" }],
      ["planned target is visible", { ...running, execution_state: "planned", visible_snapshot_id: "snap-target" }],
      ["running misses target", { ...running, target_snapshot_id: undefined, publication_state: undefined }],
      ["running drops lease", { ...running, activity_lease_held: false }],
      ["running has published target", { ...running, publication_state: "published" }],
      ["running target is visible", { ...running, visible_snapshot_id: "snap-target" }],
      ["started exceeds requested", { ...running, started_generation: 3, requested_generation: 2 }],
      ["complete holds lease", { ...complete, activity_lease_held: true }],
      ["complete target differs from visible", { ...complete, visible_snapshot_id: "snap-other" }],
      ["complete generations differ", { ...complete, requested_generation: 3 }],
      ["complete has failure", { ...complete, last_failure: failed.last_failure }],
      ["complete is not published", { ...complete, publication_state: "failed" }],
      ["failed misses failure", { ...failed, last_failure: undefined }],
      ["failed execution differs from failure", { ...failed, last_failure: { ...failed.last_failure, execution_id: "exec-other" } }],
      ["failed target differs from failure", { ...failed, last_failure: { ...failed.last_failure, target_snapshot_id: "snap-other" } }],
      ["failed target is visible", { ...failed, visible_snapshot_id: "snap-failed" }],
      ["failed has building target", { ...failed, publication_state: "building" }],
      ["failed holds lease", { ...failed, activity_lease_held: true }]
      , ["running reports termination", { ...running, worker_termination_state: "confirmed" }]
      , ["failed reports fresh graph", { ...failed, graph_freshness: "fresh" }]
      , ["missing visible snapshot is stale", { ...running, visible_snapshot_id: undefined }]
    ];

    const unexpectedlyAccepted = invalidReceipts
      .filter(([, receipt]) => snapshotRefreshDiagnosticsReceiptSchema.safeParse(receipt).success)
      .map(([label]) => label);
    expect(unexpectedlyAccepted).toEqual([]);
  });

  it("bounds failure evidence and rejects sentinel leakage", () => {
    const codeOwnedFailures = [
      ["worker_timeout", "worker", "Refresh worker deadline expired."],
      ["worker_error", "worker", "Refresh worker failed."],
      ["worker_exit_without_result", "worker", "Refresh worker exited without a valid result."],
      ["invalid_worker_result", "worker", "Refresh worker returned an invalid result."],
      ["store_failure", "store", "Refresh store operation failed."],
      ["permission_failure", "permission", "Refresh operation was not permitted."],
      ["ownership_lost", "ownership", "Repository refresh ownership was lost."],
      ["orphaned_build", "publication", "An orphaned snapshot build was recovered."],
      ["orphaned_pre_publication", "publication", "An unpublished legacy snapshot was recovered."]
    ] as const;
    for (const [code, category, message] of codeOwnedFailures) {
      const failure = {
        code,
        category,
        message,
        execution_id: "exec-1",
        occurred_at: "2026-07-19T12:00:00.000Z"
      };
      expect(refreshFailureSchema.parse(failure)).toEqual(failure);
      expect(new TextEncoder().encode(message).byteLength).toBeLessThanOrEqual(512);
    }
    const safeFailure = {
      code: "worker_error" as const,
      category: "worker" as const,
      message: "Refresh worker failed." as const,
      execution_id: "exec-1",
      occurred_at: "2026-07-19T12:00:00.000Z"
    };

    const unsafeMessages = [
      "/private/workspace/index.sqlite",
      "'/private/workspace/index.sqlite'",
      '"C:\\Users\\agent\\index.sqlite"',
      "../../outside/workspace.sqlite",
      "..\\..\\outside\\workspace.sqlite",
      "API_TOKEN=secret-value",
      "password: hunter2",
      "Authorization: Bearer secret-token",
      "postgres://user:password@localhost/database",
      "SELECT * FROM snapshots",
      "INSERT INTO snapshots VALUES (1)",
      "UPDATE snapshots SET freshness='fresh'",
      "DELETE FROM snapshots",
      "PRAGMA journal_mode",
      "stderr: database is locked at /private/index.sqlite",
      "Error at worker (/private/worker.ts:10:2)",
      "    at worker (/private/worker.ts:10:2)",
      "line one\nline two",
      "é".repeat(256),
      "é".repeat(257)
    ];
    expect(unsafeMessages.every((message) => refreshFailureSchema.safeParse({
      ...safeFailure,
      message
    }).success === false)).toBe(true);
    expect(refreshFailureSchema.safeParse({
      ...safeFailure,
      code: "permission_failure",
      category: "worker"
    }).success).toBe(false);
  });

  it("rejects synthetic daemon health before it can be presented as success", () => {
    const fixture = buildIntegrationHealthFixture({ discovery_state: "unknown" });
    const daemon = {
      pid: 1234,
      socket_path: "/tmp/agent-workbench.sock",
      repo_root: "/repo",
      connected_clients: 1,
      controller_generation: 7,
      diagnostic_revision: 11,
      warmup_state: "idle",
      graph_freshness: "cold",
      activity_lease_held: false,
      worker_termination_state: "not_required"
    };

    expect(integrationHealthSchema.safeParse({
      ...fixture,
      daemon: { ...daemon, warmup_state: "scheduled" }
    }).success).toBe(false);
    expect(integrationHealthSchema.safeParse({
      ...fixture,
      daemon: { ...daemon, graph_freshness: "unknown" }
    }).success).toBe(false);
  });

  it("keeps provider and artifact identities typed and explicit", () => {
    expect(integrationProviderSchema.options).toEqual([
      "codex",
      "claude_code",
      "kiro",
      "unknown"
    ]);

    const identities: IntegrationArtifactIdentity[] = [
      {
        artifact: "runtime",
        name: "@auriora/agent-workbench",
        version: "0.1.0",
        state: "observed",
        provenance: "package"
      },
      {
        artifact: "mcp_client",
        name: "claude-code",
        version: "1.2.3",
        state: "observed",
        provenance: "initialize"
      },
      {
        artifact: "provider_plugin",
        name: "agent-workbench",
        version: "0.1.0",
        state: "configured",
        provenance: "manifest"
      },
      {
        artifact: "client_cache",
        state: "unknown",
        provenance: "unknown"
      }
    ];

    expect(identities.map((identity) => integrationArtifactIdentitySchema.parse(identity))).toEqual(
      identities
    );
    expect(integrationArtifactIdentitySchema.safeParse({
      artifact: "plugin",
      state: "observed",
      provenance: "manifest"
    }).success).toBe(false);
  });

  it("can represent configured, registered, advertised, discovered, and callable surfaces", () => {
    const fixture = buildIntegrationHealthFixture({
      discovery_state: "provided",
      discovered_tools: ["context_for_task", "verification_plan"],
      discovered_resources: ["repo:///status", "repo:///scope", "repo:///overview"],
      discovered_prompts: []
    });

    expect(integrationHealthSchema.parse(fixture)).toEqual(fixture);
    expect(fixture.counts.available).toBe(5);
    expect(fixture.counts.unavailable).toBeGreaterThan(0);
    expect(
      fixture.surfaces.find((surface) => surface.name === "context_for_task")
    ).toMatchObject({
      configured: true,
      registered: true,
      advertised: true,
      caller_discovery: "discovered",
      callable: "callable",
      status: "available"
    });
    expect(fixture.surfaces.find((surface) => surface.name === "impact")).toMatchObject({
      configured: true,
      registered: true,
      advertised: true,
      caller_discovery: "not_discovered",
      callable: "not_callable",
      status: "unavailable"
    });
  });

  it("keeps caller discovery unknown when no active session evidence is provided", () => {
    const fixture = buildIntegrationHealthFixture({
      discovery_state: "unknown"
    });

    expect(integrationHealthSchema.parse(fixture)).toEqual(fixture);
    expect(fixture.counts.available).toBe(0);
    expect(fixture.counts.unknown).toBeGreaterThan(0);
    expect(
      fixture.surfaces.every(
        (surface) => surface.caller_discovery === "unknown" && surface.callable === "unknown"
      )
    ).toBe(true);
  });

  it("keeps the pre-provider health fixture valid as an additive compatibility shape", () => {
    const fixture = buildIntegrationHealthFixture({ discovery_state: "unknown" });
    const {
      provider: _provider,
      provider_identity: _providerIdentity,
      identities: _identities,
      ...legacyFixture
    } = fixture;

    expect(integrationHealthSchema.parse(legacyFixture)).toEqual(legacyFixture);
    expect(legacyFixture).toMatchObject({
      runtime_version: "0.1.0",
      profile: "codex"
    });
  });

  it("keeps the legacy Codex profile as a compatible subset of registered MCP surfaces", () => {
    const profile = describeCodexIntegrationProfile();
    const advertised = profile.mcp_bindings.map((binding) => `${binding.kind}:${binding.name}`).sort();
    const registered = registeredSurfaceKeys();

    expect(registered).toEqual(expect.arrayContaining(advertised));
    expect(advertised).not.toContain("resource:current-integration-profile");
    expect(advertised).not.toContain("tool:integration_health");
  });

  it("emits guidance only for comparable Agent Workbench artifact drift", async () => {
    const identity = {
      provider_identity: {
        provider: "claude_code" as const,
        state: "configured" as const,
        provenance: "launcher" as const
      },
      identities: [
        { artifact: "runtime" as const, name: "@auriora/agent-workbench", version: "2.0.0", state: "observed" as const, provenance: "package" as const },
        { artifact: "mcp_client" as const, version: "99.0.0", state: "observed" as const, provenance: "initialize" as const },
        { artifact: "provider_plugin" as const, name: "agent-workbench", version: "1.0.0", state: "observed" as const, provenance: "manifest" as const },
        { artifact: "client_cache" as const, name: "agent-workbench", version: "1.5.0", state: "observed" as const, provenance: "cache" as const }
      ]
    };
    const mismatched = await getIntegrationHealth({
      request: { discovery_state: "unknown", discovered_tools: [], discovered_resources: [], discovered_prompts: [] },
      default_repo_root: "/repo",
      runtime_version: "2.0.0",
      profile: "claude_code",
      connection_identity: identity,
      surfaces: []
    });

    expect(mismatched.health.next_actions).toEqual([
      expect.objectContaining({
        tool: "context_for_task",
        args: expect.objectContaining({ task: expect.stringMatching(/Claude Code.*new session/i) })
      })
    ]);

    identity.identities[2] = {
      artifact: "provider_plugin",
      name: "agent-workbench",
      version: "2.0.0",
      state: "observed",
      provenance: "manifest"
    };
    expect((await getIntegrationHealth({
      request: { discovery_state: "unknown", discovered_tools: [], discovered_resources: [], discovered_prompts: [] },
      default_repo_root: "/repo",
      runtime_version: "2.0.0",
      profile: "claude_code",
      connection_identity: identity,
      surfaces: []
    })).health.next_actions[0]?.args.task).toMatch(/client_cache 1\.5\.0/);

    identity.identities[3] = {
      artifact: "client_cache",
      name: "agent-workbench",
      version: "2.0.0",
      state: "observed",
      provenance: "cache"
    };
    expect((await getIntegrationHealth({
      request: { discovery_state: "unknown", discovered_tools: [], discovered_resources: [], discovered_prompts: [] },
      default_repo_root: "/repo",
      runtime_version: "2.0.0",
      profile: "claude_code",
      connection_identity: identity,
      surfaces: []
    })).health.next_actions).toEqual([]);

    identity.identities[2] = {
      artifact: "provider_plugin",
      name: "unrelated-plugin",
      version: "1.0.0",
      state: "observed",
      provenance: "manifest"
    };
    expect((await getIntegrationHealth({
      request: { discovery_state: "unknown", discovered_tools: [], discovered_resources: [], discovered_prompts: [] },
      default_repo_root: "/repo",
      runtime_version: "2.0.0",
      profile: "claude_code",
      connection_identity: identity,
      surfaces: []
    })).health.next_actions).toEqual([]);
  });
});

function buildIntegrationHealthFixture(input: IntegrationSessionFixtureInput): IntegrationHealth {
  const session: IntegrationSessionEvidence = {
    discovered_tools: [],
    discovered_resources: [],
    discovered_prompts: [],
    ...input
  };
  const surfaces = buildSurfaceFixtures(session);
  return {
    repo_root: "/repo",
    runtime_version: "0.1.0",
    profile: "codex",
    provider: "codex",
    provider_identity: {
      provider: "codex",
      state: "configured",
      provenance: "launcher"
    },
    identities: [
      {
        artifact: "runtime",
        name: "@auriora/agent-workbench",
        version: "0.1.0",
        state: "observed",
        provenance: "package"
      },
      {
        artifact: "mcp_client",
        name: session.client,
        state: session.client === undefined ? "unknown" : "observed",
        provenance: session.client === undefined ? "unknown" : "initialize"
      },
      {
        artifact: "provider_plugin",
        name: "agent-workbench",
        version: "0.1.0",
        state: "configured",
        provenance: "manifest"
      },
      {
        artifact: "client_cache",
        state: "unknown",
        provenance: "unknown"
      }
    ],
    session,
    surfaces,
    counts: countSurfaces(surfaces),
    next_actions: [
      {
        tool: "context_for_task",
        args: { task: "Inspect Agent Workbench integration health" }
      }
    ]
  };
}

function buildSurfaceFixtures(
  session: IntegrationSessionEvidence
): IntegrationSurfaceHealth[] {
  const profile = describeCodexIntegrationProfile();
  const advertised = new Map(
    profile.mcp_bindings.map((binding) => [`${binding.kind}:${binding.name}`, binding])
  );

  return [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => {
    const key = `${surface.kind}:${surface.name}`;
    const binding = advertised.get(key);
    const discovered = isDiscovered(surface, session);
    const callerDiscovery = session.discovery_state === "unknown"
      ? "unknown"
      : discovered
        ? "discovered"
        : "not_discovered";
    const callable = session.discovery_state === "unknown"
      ? "unknown"
      : discovered
        ? "callable"
        : "not_callable";

    return {
      name: surface.name,
      kind: surface.kind,
      uri: "uri" in surface ? surface.uri : undefined,
      configured: binding !== undefined,
      registered: true,
      advertised: binding !== undefined,
      caller_discovery: callerDiscovery,
      callable,
      status: callerDiscovery === "unknown" ? "unknown" : discovered ? "available" : "unavailable",
      reason: callerDiscovery === "unknown"
        ? "Caller-discovered MCP surface evidence was not provided."
        : discovered
          ? "The active client session discovered this registered MCP surface."
          : "The MCP surface is configured and registered but was not discovered by the active client session.",
      evidence_kinds: ["config"],
      capability_class: surface.metadata.capability_class
    };
  });
}

function isDiscovered(
  surface: (typeof mcpResources | typeof mcpTools | typeof mcpPrompts)[number],
  session: IntegrationSessionEvidence
): boolean {
  if (surface.kind === "resource") {
    return session.discovered_resources.includes(surface.uri);
  }
  if (surface.kind === "tool") {
    return session.discovered_tools.includes(surface.name);
  }
  return session.discovered_prompts.includes(surface.name);
}

function registeredSurfaceKeys(): string[] {
  return [...mcpResources, ...mcpTools, ...mcpPrompts]
    .map((surface) => `${surface.kind}:${surface.name}`)
    .sort();
}

function countSurfaces(surfaces: readonly IntegrationSurfaceHealth[]): IntegrationHealth["counts"] {
  return {
    available: surfaces.filter((surface) => surface.status === "available").length,
    unavailable: surfaces.filter((surface) => surface.status === "unavailable").length,
    blocked: surfaces.filter((surface) => surface.status === "blocked").length,
    hidden: surfaces.filter((surface) => surface.status === "hidden").length,
    unknown: surfaces.filter((surface) => surface.status === "unknown").length
  };
}
