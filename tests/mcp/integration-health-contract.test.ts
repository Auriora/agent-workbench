/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  integrationArtifactIdentitySchema,
  integrationHealthSchema,
  integrationProviderSchema,
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

  it("emits guidance only for comparable Agent Workbench artifact drift", () => {
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
    const mismatched = getIntegrationHealth({
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
    expect(getIntegrationHealth({
      request: { discovery_state: "unknown", discovered_tools: [], discovered_resources: [], discovered_prompts: [] },
      default_repo_root: "/repo",
      runtime_version: "2.0.0",
      profile: "claude_code",
      connection_identity: identity,
      surfaces: []
    }).health.next_actions[0]?.args.task).toMatch(/client_cache 1\.5\.0/);

    identity.identities[3] = {
      artifact: "client_cache",
      name: "agent-workbench",
      version: "2.0.0",
      state: "observed",
      provenance: "cache"
    };
    expect(getIntegrationHealth({
      request: { discovery_state: "unknown", discovered_tools: [], discovered_resources: [], discovered_prompts: [] },
      default_repo_root: "/repo",
      runtime_version: "2.0.0",
      profile: "claude_code",
      connection_identity: identity,
      surfaces: []
    }).health.next_actions).toEqual([]);

    identity.identities[2] = {
      artifact: "provider_plugin",
      name: "unrelated-plugin",
      version: "1.0.0",
      state: "observed",
      provenance: "manifest"
    };
    expect(getIntegrationHealth({
      request: { discovery_state: "unknown", discovered_tools: [], discovered_resources: [], discovered_prompts: [] },
      default_repo_root: "/repo",
      runtime_version: "2.0.0",
      profile: "claude_code",
      connection_identity: identity,
      surfaces: []
    }).health.next_actions).toEqual([]);
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
