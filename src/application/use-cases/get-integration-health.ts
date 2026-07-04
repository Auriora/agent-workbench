/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  IntegrationHealth,
  IntegrationHealthRequest,
  IntegrationSessionEvidence,
  IntegrationSurfaceHealth,
  IntegrationSurfaceStatus,
  McpSurfaceKind,
  NextAction,
  ResponseMetadata,
  ToolCapabilityClass
} from "../../contracts/index.js";

export type IntegrationSurfaceInput = {
  name: string;
  kind: McpSurfaceKind;
  uri?: string;
  configured: boolean;
  registered: boolean;
  advertised: boolean;
  capability_class?: ToolCapabilityClass;
  blocked_reason?: string;
  hidden_reason?: string;
  replacement_action?: NextAction;
  discovery_action?: NextAction;
};

export type GetIntegrationHealthInput = {
  request: IntegrationHealthRequest;
  default_repo_root: string;
  runtime_version: string;
  profile: string;
  surfaces: readonly IntegrationSurfaceInput[];
  root_policy?: {
    authority: "launch_root";
    debug_repo_root_override: boolean;
  };
};

export type GetIntegrationHealthResult = {
  health: IntegrationHealth;
  meta: ResponseMetadata;
};

export function getIntegrationHealth(input: GetIntegrationHealthInput): GetIntegrationHealthResult {
  const repoRoot = input.request.repo_root ?? input.default_repo_root;
  const session: IntegrationSessionEvidence = {
    client: input.request.client,
    discovery_state: input.request.discovery_state,
    discovered_tools: input.request.discovered_tools,
    discovered_resources: input.request.discovered_resources,
    discovered_prompts: input.request.discovered_prompts
  };
  const surfaces = input.surfaces
    .map((surface) => classifySurface(surface, session))
    .sort(compareSurfaces);

  return {
    health: {
      repo_root: repoRoot,
      runtime_version: input.runtime_version,
      profile: input.profile,
      session,
      surfaces,
      counts: countSurfaces(surfaces),
      root_policy: input.root_policy,
      next_actions: buildNextActions(surfaces)
    },
    meta: {
      analysis_validity: "valid",
      freshness: "fresh",
      scope: {
        repo_root: repoRoot,
        indexed_roots: ["."],
        skipped_roots: [],
        languages: []
      },
      capability_level: "resource_backed",
      evidence_kinds: ["config"],
      verification_status: "done",
      truncated: false
    }
  };
}

function classifySurface(
  surface: IntegrationSurfaceInput,
  session: IntegrationSessionEvidence
): IntegrationSurfaceHealth {
  if (surface.hidden_reason !== undefined) {
    return {
      ...baseSurface(surface, session),
      caller_discovery: "unknown",
      callable: "not_callable",
      status: "hidden",
      reason: surface.hidden_reason
    };
  }

  const discovered = isDiscovered(surface, session);
  const callerDiscovery = session.discovery_state === "unknown"
    ? "unknown"
    : discovered
      ? "discovered"
      : "not_discovered";

  if (surface.blocked_reason !== undefined) {
    return {
      ...baseSurface(surface, session),
      caller_discovery: callerDiscovery,
      callable: "not_callable",
      status: "blocked",
      reason: surface.blocked_reason
    };
  }

  if (!surface.registered) {
    return {
      ...baseSurface(surface, session),
      caller_discovery: callerDiscovery,
      callable: "not_callable",
      status: "unavailable",
      reason: "The MCP surface is configured or advertised but not registered in the runtime."
    };
  }

  if (session.discovery_state === "unknown") {
    return {
      ...baseSurface(surface, session),
      caller_discovery: "unknown",
      callable: "unknown",
      status: "unknown",
      reason: "Caller-discovered MCP surface evidence was not provided."
    };
  }

  if (!discovered) {
    return {
      ...baseSurface(surface, session),
      caller_discovery: "not_discovered",
      callable: "not_callable",
      status: "unavailable",
      reason: "The MCP surface is registered but was not discovered by the active client session."
    };
  }

  return {
    ...baseSurface(surface, session),
    caller_discovery: "discovered",
    callable: "callable",
    status: "available",
    reason: "The active client session discovered this registered MCP surface."
  };
}

function baseSurface(
  surface: IntegrationSurfaceInput,
  session: IntegrationSessionEvidence
): Omit<IntegrationSurfaceHealth, "caller_discovery" | "callable" | "status" | "reason"> {
  return {
    name: surface.name,
    kind: surface.kind,
    uri: surface.uri,
    configured: surface.configured,
    registered: surface.registered,
    advertised: surface.advertised,
    evidence_kinds: ["config"],
    capability_class: surface.capability_class,
    discovery_action: surface.discovery_action ?? defaultDiscoveryAction(session),
    replacement_action: surface.replacement_action
  };
}

function isDiscovered(
  surface: IntegrationSurfaceInput,
  session: IntegrationSessionEvidence
): boolean {
  if (surface.kind === "resource") {
    return surface.uri !== undefined && session.discovered_resources.includes(surface.uri);
  }
  if (surface.kind === "tool") {
    return session.discovered_tools.includes(surface.name);
  }
  return session.discovered_prompts.includes(surface.name);
}

function defaultDiscoveryAction(session: IntegrationSessionEvidence): NextAction | undefined {
  if (session.discovery_state === "provided") {
    return undefined;
  }
  return {
    tool: "context_for_task",
    args: { task: "Check current Agent Workbench MCP tool and resource availability" }
  };
}

function buildNextActions(surfaces: readonly IntegrationSurfaceHealth[]): NextAction[] {
  if (surfaces.some((surface) => surface.name === "context_for_task" && surface.callable === "callable")) {
    return [
      {
        tool: "context_for_task",
        args: { task: "Use integration health to choose the next Agent Workbench call" }
      }
    ];
  }
  return [];
}

function countSurfaces(surfaces: readonly IntegrationSurfaceHealth[]): IntegrationHealth["counts"] {
  return {
    available: countStatus(surfaces, "available"),
    unavailable: countStatus(surfaces, "unavailable"),
    blocked: countStatus(surfaces, "blocked"),
    hidden: countStatus(surfaces, "hidden"),
    unknown: countStatus(surfaces, "unknown")
  };
}

function countStatus(
  surfaces: readonly IntegrationSurfaceHealth[],
  status: IntegrationSurfaceStatus
): number {
  return surfaces.filter((surface) => surface.status === status).length;
}

function compareSurfaces(a: IntegrationSurfaceHealth, b: IntegrationSurfaceHealth): number {
  const byKind = a.kind.localeCompare(b.kind);
  if (byKind !== 0) {
    return byKind;
  }
  return a.name.localeCompare(b.name);
}
