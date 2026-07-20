/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  IntegrationHealth,
  IntegrationDaemonHealth,
  IntegrationHealthRequest,
  IntegrationConnectionIdentity,
  IntegrationSessionEvidence,
  IntegrationSurfaceHealth,
  IntegrationSurfaceStatus,
  McpSurfaceKind,
  NextAction,
  ResponseMetadata,
  RuntimeError,
  SnapshotRefreshDiagnosticsReceipt,
  ToolCapabilityClass
} from "../../contracts/index.js";
import { snapshotRefreshDiagnosticsReceiptSchema } from "../../contracts/index.js";
import type { SnapshotRefreshDiagnosticsPort } from "../../ports/index.js";
import { invalidResponseMeta } from "./response-metadata.js";

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
  connection_identity?: IntegrationConnectionIdentity;
  surfaces: readonly IntegrationSurfaceInput[];
  root_policy?: {
    authority: "launch_root";
    debug_repo_root_override: boolean;
  };
  daemon?: {
    pid: number;
    socket_path: string;
    repo_root: string;
    connected_clients: number;
    diagnostics: SnapshotRefreshDiagnosticsPort;
  };
};

export type GetIntegrationHealthResult = {
  health: IntegrationHealth;
  meta: ResponseMetadata;
  errors?: RuntimeError[];
};

const DIAGNOSTICS_UNAVAILABLE_MESSAGE = "Authoritative refresh diagnostics are unavailable.";

export async function getIntegrationHealth(input: GetIntegrationHealthInput): Promise<GetIntegrationHealthResult> {
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

  const providerIdentity = input.connection_identity?.provider_identity;
  const identities = input.connection_identity?.identities;

  const baseHealth = {
      repo_root: repoRoot,
      runtime_version: input.runtime_version,
      profile: input.profile,
      provider: providerIdentity?.provider,
      provider_identity: providerIdentity,
      identities,
      session,
      surfaces,
      counts: countSurfaces(surfaces),
      root_policy: input.root_policy,
      next_actions: [
        ...buildIdentityRecoveryActions(providerIdentity?.provider, identities),
        ...buildNextActions(surfaces)
      ]
  } satisfies Omit<IntegrationHealth, "daemon">;

  if (input.daemon === undefined) {
    return {
      health: baseHealth,
      meta: healthyMeta(repoRoot)
    };
  }

  let diagnostics: SnapshotRefreshDiagnosticsReceipt;
  try {
    const received = await input.daemon.diagnostics.getDiagnostics({ repo_root: repoRoot });
    diagnostics = snapshotRefreshDiagnosticsReceiptSchema.parse(received);
    if (diagnostics.repo_identity !== repoRoot || input.daemon.repo_root !== repoRoot) {
      throw new TypeError("Authoritative refresh diagnostics repository identity mismatch.");
    }
  } catch {
    return {
      health: baseHealth,
      meta: invalidResponseMeta({
        repoRoot,
        analysis_validity: "invalid_due_to_environment"
      }),
      errors: [{
        code: "provider_unavailable",
        message: DIAGNOSTICS_UNAVAILABLE_MESSAGE,
        retryable: true
      }]
    };
  }

  const daemon: IntegrationDaemonHealth = {
    pid: input.daemon.pid,
    socket_path: input.daemon.socket_path,
    repo_root: input.daemon.repo_root,
    connected_clients: input.daemon.connected_clients,
    controller_generation: diagnostics.controller_generation,
    diagnostic_revision: diagnostics.diagnostic_revision,
    execution_id: diagnostics.execution_id,
    started_generation: diagnostics.started_generation,
    requested_generation: diagnostics.requested_generation,
    target_snapshot_id: diagnostics.target_snapshot_id,
    visible_snapshot_id: diagnostics.visible_snapshot_id,
    warmup_state: diagnostics.execution_state,
    publication_state: diagnostics.publication_state,
    graph_freshness: diagnostics.graph_freshness,
    activity_lease_held: diagnostics.activity_lease_held,
    worker_termination_state: diagnostics.worker_termination_state,
    last_failure: diagnostics.last_failure
  };
  return {
    health: { ...baseHealth, daemon },
    meta: diagnosticsMeta(repoRoot, diagnostics)
  };
}

function healthyMeta(repoRoot: string): ResponseMetadata {
  return {
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
  };
}

function diagnosticsMeta(
  repoRoot: string,
  diagnostics: SnapshotRefreshDiagnosticsReceipt
): ResponseMetadata {
  const refreshing = diagnostics.execution_state === "planned" || diagnostics.execution_state === "running";
  const blocked = diagnostics.execution_state === "failed" || diagnostics.graph_freshness !== "fresh";
  return {
    ...healthyMeta(repoRoot),
    freshness: refreshing ? "refreshing" : diagnostics.graph_freshness,
    verification_status: blocked || refreshing ? "blocked" : "done"
  };
}

function buildIdentityRecoveryActions(
  provider: IntegrationConnectionIdentity["provider_identity"]["provider"] | undefined,
  identities: IntegrationConnectionIdentity["identities"] | undefined
): NextAction[] {
  const runtime = identities?.find((identity) => identity.artifact === "runtime");
  if (!isComparableAgentWorkbenchIdentity(runtime)) {
    return [];
  }
  const mismatches = identities
    ?.filter((identity) => identity.artifact === "provider_plugin" || identity.artifact === "client_cache")
    .filter(isComparableAgentWorkbenchIdentity)
    .filter((identity) => identity.version !== runtime.version) ?? [];
  if (mismatches.length === 0) return [];

  const providerLabel = provider === "claude_code"
    ? "Claude Code"
    : provider === "kiro"
      ? "Kiro"
      : provider === "codex"
        ? "Codex"
        : "the active client";
  const mismatchSummary = mismatches
    .map((identity) => `${identity.artifact} ${identity.version}`)
    .join(" and ");
  return [{
    tool: "context_for_task",
    args: {
      task: `Reinstall the Agent Workbench runtime, refresh or reinstall the Agent Workbench plugin/cache for ${providerLabel}, reload the client, and start a new session; runtime ${runtime.version} differs from ${mismatchSummary}.`
    }
  }];
}

function isComparableAgentWorkbenchIdentity(
  identity: IntegrationConnectionIdentity["identities"][number] | undefined
): identity is IntegrationConnectionIdentity["identities"][number] & { version: string } {
  return identity?.state === "observed" &&
    identity.version !== undefined &&
    (identity.name === "agent-workbench" || identity.name === "@auriora/agent-workbench");
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
