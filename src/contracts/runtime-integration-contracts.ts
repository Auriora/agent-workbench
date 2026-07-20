/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";
import {
  evidenceKindSchema,
  nextActionSchema,
  toolCapabilityClassSchema
} from "./runtime-core-contracts.js";

export const mcpSurfaceKindSchema = z.enum(["tool", "resource", "prompt"]);
export type McpSurfaceKind = z.infer<typeof mcpSurfaceKindSchema>;

export const integrationSurfaceStatusSchema = z.enum([
  "available",
  "unavailable",
  "blocked",
  "hidden",
  "unknown"
]);
export type IntegrationSurfaceStatus = z.infer<typeof integrationSurfaceStatusSchema>;

export const callerDiscoveryStateSchema = z.enum([
  "discovered",
  "not_discovered",
  "unknown"
]);
export type CallerDiscoveryState = z.infer<typeof callerDiscoveryStateSchema>;

export const callableStateSchema = z.enum(["callable", "not_callable", "unknown"]);
export type CallableState = z.infer<typeof callableStateSchema>;

export const integrationProviderSchema = z.enum(["codex", "claude_code", "kiro", "unknown"]);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

export const integrationEvidenceStateSchema = z.enum([
  "observed",
  "configured",
  "inferred_not_allowed",
  "unknown"
]);
export type IntegrationEvidenceState = z.infer<typeof integrationEvidenceStateSchema>;

export const integrationIdentityProvenanceSchema = z.enum([
  "initialize",
  "launcher",
  "manifest",
  "cache",
  "package",
  "unknown"
]);
export type IntegrationIdentityProvenance = z.infer<typeof integrationIdentityProvenanceSchema>;

export const integrationProviderIdentitySchema = z.object({
  provider: integrationProviderSchema,
  state: integrationEvidenceStateSchema,
  provenance: integrationIdentityProvenanceSchema
}).strict();
export type IntegrationProviderIdentity = z.infer<typeof integrationProviderIdentitySchema>;

export const integrationArtifactIdentitySchema = z.object({
  artifact: z.enum(["runtime", "mcp_client", "provider_plugin", "client_cache"]),
  name: z.string().optional(),
  version: z.string().optional(),
  state: integrationEvidenceStateSchema,
  provenance: integrationIdentityProvenanceSchema
}).strict();
export type IntegrationArtifactIdentity = z.infer<typeof integrationArtifactIdentitySchema>;

export const integrationLauncherIdentitySchema = z.object({
  provider: integrationProviderSchema,
  plugin_name: z.string().min(1).max(200).optional(),
  plugin_version: z.string().min(1).max(100).optional(),
  cache_name: z.string().min(1).max(200).optional(),
  cache_version: z.string().min(1).max(100).optional()
}).strict();
export type IntegrationLauncherIdentity = z.infer<typeof integrationLauncherIdentitySchema>;

export const integrationConnectionIdentitySchema = z.object({
  provider_identity: integrationProviderIdentitySchema,
  identities: z.array(integrationArtifactIdentitySchema)
}).strict();
export type IntegrationConnectionIdentity = z.infer<typeof integrationConnectionIdentitySchema>;

export const integrationSurfaceHealthSchema = z
  .object({
    name: z.string(),
    kind: mcpSurfaceKindSchema,
    uri: z.string().optional(),
    configured: z.boolean(),
    registered: z.boolean(),
    advertised: z.boolean(),
    caller_discovery: callerDiscoveryStateSchema,
    callable: callableStateSchema,
    status: integrationSurfaceStatusSchema,
    reason: z.string(),
    evidence_kinds: z.array(evidenceKindSchema),
    capability_class: toolCapabilityClassSchema.optional(),
    discovery_action: nextActionSchema.optional(),
    replacement_action: nextActionSchema.optional()
  })
  .strict();
export type IntegrationSurfaceHealth = z.infer<typeof integrationSurfaceHealthSchema>;

export const integrationSessionEvidenceSchema = z
  .object({
    client: z.string().max(200).optional(),
    discovery_state: z.enum(["provided", "unknown"]),
    discovered_tools: z.array(z.string().max(300)).max(200).default([]),
    discovered_resources: z.array(z.string().max(500)).max(200).default([]),
    discovered_prompts: z.array(z.string().max(300)).max(200).default([])
  })
  .strict();
export type IntegrationSessionEvidence = z.infer<typeof integrationSessionEvidenceSchema>;

export const refreshExecutionStateSchema = z.enum([
  "idle",
  "planned",
  "running",
  "complete",
  "failed"
]);
export type RefreshExecutionState = z.infer<typeof refreshExecutionStateSchema>;

export const snapshotPublicationStateSchema = z.enum([
  "building",
  "published",
  "superseded",
  "failed"
]);
export type SnapshotPublicationState = z.infer<typeof snapshotPublicationStateSchema>;

export const authoritativeGraphFreshnessSchema = z.enum(["fresh", "stale", "cold"]);
export type AuthoritativeGraphFreshness = z.infer<typeof authoritativeGraphFreshnessSchema>;

export const workerTerminationStateSchema = z.enum([
  "not_required",
  "unconfirmed",
  "confirmed"
]);
export type WorkerTerminationState = z.infer<typeof workerTerminationStateSchema>;

export const invalidationGenerationSchema = z.number().int().nonnegative();
export type InvalidationGeneration = z.infer<typeof invalidationGenerationSchema>;

export const refreshDeadlineSchema = z
  .object({
    timeout_ms: z.number().finite().int().positive(),
    deadline_at: z.string().datetime({ offset: true })
  })
  .strict();
export type RefreshDeadline = z.infer<typeof refreshDeadlineSchema>;

export const refreshFailureCodeSchema = z.enum([
  "worker_timeout",
  "worker_error",
  "worker_exit_without_result",
  "invalid_worker_result",
  "store_failure",
  "permission_failure",
  "ownership_lost",
  "orphaned_build",
  "orphaned_pre_publication"
]);
export type RefreshFailureCode = z.infer<typeof refreshFailureCodeSchema>;

export const refreshFailureCategorySchema = z.enum([
  "worker",
  "store",
  "permission",
  "ownership",
  "publication"
]);
export type RefreshFailureCategory = z.infer<typeof refreshFailureCategorySchema>;

export const refreshFailureMessageSchema = z.enum([
  "Refresh worker deadline expired.",
  "Refresh worker failed.",
  "Refresh worker exited without a valid result.",
  "Refresh worker returned an invalid result.",
  "Refresh store operation failed.",
  "Refresh operation was not permitted.",
  "Repository refresh ownership was lost.",
  "An orphaned snapshot build was recovered.",
  "An unpublished legacy snapshot was recovered."
]);
export type RefreshFailureMessage = z.infer<typeof refreshFailureMessageSchema>;

export const refreshFailureCategoryByCode: Readonly<Record<RefreshFailureCode, RefreshFailureCategory>> = {
  worker_timeout: "worker",
  worker_error: "worker",
  worker_exit_without_result: "worker",
  invalid_worker_result: "worker",
  store_failure: "store",
  permission_failure: "permission",
  ownership_lost: "ownership",
  orphaned_build: "publication",
  orphaned_pre_publication: "publication"
};

export const refreshFailureMessageByCode: Readonly<Record<RefreshFailureCode, RefreshFailureMessage>> = {
  worker_timeout: "Refresh worker deadline expired.",
  worker_error: "Refresh worker failed.",
  worker_exit_without_result: "Refresh worker exited without a valid result.",
  invalid_worker_result: "Refresh worker returned an invalid result.",
  store_failure: "Refresh store operation failed.",
  permission_failure: "Refresh operation was not permitted.",
  ownership_lost: "Repository refresh ownership was lost.",
  orphaned_build: "An orphaned snapshot build was recovered.",
  orphaned_pre_publication: "An unpublished legacy snapshot was recovered."
};

export const refreshFailureSchema = z
  .object({
    code: refreshFailureCodeSchema,
    category: refreshFailureCategorySchema,
    message: refreshFailureMessageSchema,
    execution_id: z.string().min(1).max(200),
    target_snapshot_id: z.string().min(1).max(200).optional(),
    occurred_at: z.string().datetime({ offset: true })
  })
  .strict()
  .superRefine((value, context) => {
    if (new TextEncoder().encode(value.message).byteLength > 512) {
      context.addIssue({
        code: "custom",
        message: "Refresh failure message must not exceed 512 UTF-8 bytes.",
        path: ["message"]
      });
    }
    if (refreshFailureCategoryByCode[value.code] !== value.category) {
      context.addIssue({
        code: "custom",
        message: "Refresh failure category must match its stable failure code.",
        path: ["category"]
      });
    }
    if (refreshFailureMessageByCode[value.code] !== value.message) {
      context.addIssue({
        code: "custom",
        message: "Refresh failure message must match its stable failure code.",
        path: ["message"]
      });
    }
  });
export type RefreshFailure = z.infer<typeof refreshFailureSchema>;

export function createRefreshFailure(input: {
  code: RefreshFailureCode;
  execution_id: string;
  target_snapshot_id?: string;
  occurred_at: string;
}): RefreshFailure {
  return refreshFailureSchema.parse({
    code: input.code,
    category: refreshFailureCategoryByCode[input.code],
    message: refreshFailureMessageByCode[input.code],
    execution_id: input.execution_id,
    target_snapshot_id: input.target_snapshot_id,
    occurred_at: input.occurred_at
  });
}

export const snapshotRefreshDiagnosticsReceiptSchema = z
  .object({
    repo_identity: z.string().min(1).max(512),
    controller_generation: z.number().int().positive(),
    diagnostic_revision: z.number().int().nonnegative(),
    execution_id: z.string().min(1).max(200).optional(),
    started_generation: invalidationGenerationSchema.optional(),
    requested_generation: invalidationGenerationSchema.optional(),
    target_snapshot_id: z.string().min(1).max(200).optional(),
    visible_snapshot_id: z.string().min(1).max(200).optional(),
    execution_state: refreshExecutionStateSchema,
    publication_state: snapshotPublicationStateSchema.optional(),
    graph_freshness: authoritativeGraphFreshnessSchema,
    activity_lease_held: z.boolean(),
    worker_termination_state: workerTerminationStateSchema,
    last_failure: refreshFailureSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string, path: string): void => {
      context.addIssue({ code: "custom", message, path: [path] });
    };
    const hasExecutionIdentity = value.execution_id !== undefined;
    const hasTargetIdentity = value.target_snapshot_id !== undefined;

    if (value.started_generation !== undefined && value.requested_generation !== undefined &&
        value.started_generation > value.requested_generation) {
      issue("started_generation cannot exceed requested_generation.", "started_generation");
    }
    if (hasTargetIdentity !== (value.publication_state !== undefined)) {
      issue(
        "target_snapshot_id and publication_state must either both be present or both be absent.",
        "publication_state"
      );
    }
    if ((value.visible_snapshot_id === undefined) !== (value.graph_freshness === "cold")) {
      issue(
        "Cold graph diagnostics require no visible snapshot, and a visible snapshot cannot be cold.",
        "graph_freshness"
      );
    }

    if (value.execution_state === "idle") {
      if (hasExecutionIdentity || value.started_generation !== undefined ||
          value.requested_generation !== undefined || hasTargetIdentity || value.activity_lease_held ||
          value.worker_termination_state !== "not_required") {
        issue("Idle diagnostics cannot identify active execution state or hold an activity lease.", "execution_state");
      }
      return;
    }

    if (!hasExecutionIdentity || value.started_generation === undefined ||
        value.requested_generation === undefined) {
      issue(
        "Non-idle diagnostics require execution_id, started_generation, and requested_generation.",
        "execution_id"
      );
    }

    if (value.execution_state === "planned") {
      if (!value.activity_lease_held) {
        issue("Planned diagnostics must hold the activity lease.", "activity_lease_held");
      }
      if (value.publication_state !== undefined && value.publication_state !== "building") {
        issue("A planned target may only be building.", "publication_state");
      }
      if (hasTargetIdentity && value.target_snapshot_id === value.visible_snapshot_id) {
        issue("A planned target cannot already be the visible snapshot.", "target_snapshot_id");
      }
      if (value.worker_termination_state !== "not_required") {
        issue("Planned diagnostics cannot report worker termination settlement.", "worker_termination_state");
      }
      return;
    }

    if (value.execution_state === "running") {
      if (!value.activity_lease_held) {
        issue("Running diagnostics must hold the activity lease.", "activity_lease_held");
      }
      if (value.started_generation === undefined || !hasTargetIdentity ||
          (value.publication_state !== "building" && value.publication_state !== "superseded")) {
        issue(
          "Running diagnostics require a started generation and a building or superseded target.",
          "publication_state"
        );
      }
      if (value.target_snapshot_id === value.visible_snapshot_id) {
        issue("A running target cannot be the visible snapshot.", "target_snapshot_id");
      }
      if (value.worker_termination_state !== "not_required") {
        issue("Running diagnostics cannot report worker termination settlement.", "worker_termination_state");
      }
      return;
    }

    if (value.activity_lease_held) {
      issue("Terminal diagnostics cannot hold the activity lease.", "activity_lease_held");
    }

    if (value.execution_state === "complete") {
      if (value.started_generation === undefined || value.publication_state !== "published" ||
          !hasTargetIdentity || value.visible_snapshot_id !== value.target_snapshot_id ||
          value.started_generation !== value.requested_generation || value.last_failure !== undefined ||
          value.graph_freshness !== "fresh" || value.worker_termination_state !== "not_required") {
        issue(
          "Complete diagnostics require matching published target/visible identities, a completed requested generation, and no failure.",
          "execution_state"
        );
      }
      return;
    }

    if (value.last_failure === undefined) {
      issue("Failed diagnostics require last_failure.", "last_failure");
    } else if (value.execution_id !== value.last_failure.execution_id) {
      issue("Failed diagnostics and last_failure must identify the same execution.", "last_failure");
    } else if (value.target_snapshot_id !== value.last_failure.target_snapshot_id) {
      issue("Failed diagnostics and last_failure must identify the same target.", "last_failure");
    }
    if (value.publication_state !== undefined &&
        value.publication_state !== "failed" && value.publication_state !== "superseded") {
      issue("A failed target must be failed or superseded.", "publication_state");
    }
    if (hasTargetIdentity && value.target_snapshot_id === value.visible_snapshot_id) {
      issue("A failed target cannot be the visible snapshot.", "target_snapshot_id");
    }
    if (value.graph_freshness === "fresh") {
      issue("Failed diagnostics cannot report a fresh graph.", "graph_freshness");
    }
  });
export type SnapshotRefreshDiagnosticsReceipt = z.infer<
  typeof snapshotRefreshDiagnosticsReceiptSchema
>;

export const integrationDaemonHealthSchema = z
  .object({
    pid: z.number().int().positive(),
    socket_path: z.string(),
    repo_root: z.string(),
    connected_clients: z.number().int().nonnegative(),
    controller_generation: z.number().int().positive(),
    diagnostic_revision: z.number().int().nonnegative(),
    execution_id: z.string().min(1).max(200).optional(),
    started_generation: invalidationGenerationSchema.optional(),
    requested_generation: invalidationGenerationSchema.optional(),
    target_snapshot_id: z.string().min(1).max(200).optional(),
    visible_snapshot_id: z.string().min(1).max(200).optional(),
    warmup_state: refreshExecutionStateSchema,
    publication_state: snapshotPublicationStateSchema.optional(),
    graph_freshness: authoritativeGraphFreshnessSchema,
    activity_lease_held: z.boolean(),
    worker_termination_state: workerTerminationStateSchema,
    last_failure: refreshFailureSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    const diagnostics = snapshotRefreshDiagnosticsReceiptSchema.safeParse({
      repo_identity: value.repo_root,
      controller_generation: value.controller_generation,
      diagnostic_revision: value.diagnostic_revision,
      execution_id: value.execution_id,
      started_generation: value.started_generation,
      requested_generation: value.requested_generation,
      target_snapshot_id: value.target_snapshot_id,
      visible_snapshot_id: value.visible_snapshot_id,
      execution_state: value.warmup_state,
      publication_state: value.publication_state,
      graph_freshness: value.graph_freshness,
      activity_lease_held: value.activity_lease_held,
      worker_termination_state: value.worker_termination_state,
      last_failure: value.last_failure
    });
    if (!diagnostics.success) {
      context.addIssue({
        code: "custom",
        message: "Daemon refresh diagnostics contain an invalid state combination.",
        path: ["warmup_state"]
      });
    }
  });
export type IntegrationDaemonHealth = z.infer<typeof integrationDaemonHealthSchema>;

export const integrationHealthSchema = z
  .object({
    repo_root: z.string(),
    runtime_version: z.string(),
    profile: z.string(),
    provider: integrationProviderSchema.optional(),
    provider_identity: integrationProviderIdentitySchema.optional(),
    identities: z.array(integrationArtifactIdentitySchema).optional(),
    session: integrationSessionEvidenceSchema,
    surfaces: z.array(integrationSurfaceHealthSchema),
    counts: z
      .object({
        available: z.number().int().nonnegative(),
        unavailable: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
        hidden: z.number().int().nonnegative(),
        unknown: z.number().int().nonnegative()
      })
      .strict(),
    root_policy: z
      .object({
        authority: z.literal("launch_root"),
        debug_repo_root_override: z.boolean()
      })
      .strict()
      .optional(),
    daemon: integrationDaemonHealthSchema.optional(),
    next_actions: z.array(nextActionSchema)
  })
  .strict();
export type IntegrationHealth = z.infer<typeof integrationHealthSchema>;

export const integrationHealthRequestSchema = z
  .object({
    repo_root: z.string().optional(),
    client: z.string().max(200).optional(),
    discovery_state: z.enum(["provided", "unknown"]).default("unknown"),
    discovered_tools: z.array(z.string().max(300)).max(200).default([]),
    discovered_resources: z.array(z.string().max(500)).max(200).default([]),
    discovered_prompts: z.array(z.string().max(300)).max(200).default([])
  })
  .strict();
export type IntegrationHealthRequest = z.infer<typeof integrationHealthRequestSchema>;

export const agentIntegrationSurfaceSchema = z.enum([
  "mcp",
  "instructions",
  "skills",
  "hooks",
  "commands",
  "plugins",
  "extensions",
  "subagents",
  "acp"
]);
export type AgentIntegrationSurface = z.infer<typeof agentIntegrationSurfaceSchema>;

export const agentTargetSchema = z.enum([
  "codex",
  "claude_code",
  "kiro",
  "augment",
  "gemini",
  "junie",
  "generic"
]);
export type AgentTarget = z.infer<typeof agentTargetSchema>;

export const integrationArtifactSchema = z.object({
  target_agent: agentTargetSchema,
  surface: agentIntegrationSurfaceSchema,
  path: z.string().optional(),
  status: z.enum(["supported", "unsupported", "deferred"]),
  provenance: z.string(),
  regeneration_safe: z.boolean(),
  notes: z.array(z.string()).default([])
});
export type IntegrationArtifact = z.infer<typeof integrationArtifactSchema>;

export const codexIntegrationFeatureStatusSchema = z.enum([
  "active",
  "available",
  "deferred",
  "unsupported"
]);
export type CodexIntegrationFeatureStatus = z.infer<typeof codexIntegrationFeatureStatusSchema>;

export const codexIntegrationFeatureSchema = z
  .object({
    surface: agentIntegrationSurfaceSchema,
    status: codexIntegrationFeatureStatusSchema,
    artifact_path: z.string().optional(),
    purpose: z.string(),
    behavior: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([])
  })
  .strict();
export type CodexIntegrationFeature = z.infer<typeof codexIntegrationFeatureSchema>;

export const codexHookSpecSchema = z
  .object({
    name: z.string(),
    event: z.string(),
    matcher: z.string().optional(),
    path: z.string(),
    default_mode: z.enum(["silent", "basic_feedback"]),
    blocks_workflow: z.literal(false),
    emits_when: z.array(z.string()),
    quiet_when: z.array(z.string()),
    schema_mapping: z.string()
  })
  .strict();
export type CodexHookSpec = z.infer<typeof codexHookSpecSchema>;

export const codexSkillSpecSchema = z
  .object({
    name: z.string(),
    path: z.string(),
    purpose: z.string(),
    workflow: z.array(z.string()),
    constraints: z.array(z.string())
  })
  .strict();
export type CodexSkillSpec = z.infer<typeof codexSkillSpecSchema>;

export const codexPluginSpecSchema = z
  .object({
    name: z.string(),
    manifest_path: z.string(),
    mcp_config_path: z.string().optional(),
    runtime_source: z.string(),
    packaging_model: z.string(),
    mcp_binding_model: z.string().optional(),
    update_model: z.object({
      source_changes: z.string(),
      dependency_changes: z.string(),
      copied_runtime_allowed: z.literal(false)
    })
  })
  .strict();
export type CodexPluginSpec = z.infer<typeof codexPluginSpecSchema>;

export const codexInstallPackageSpecSchema = z
  .object({
    registry: z.literal("ghcr.io"),
    image: z.string(),
    containerfile_path: z.string(),
    manifest_path: z.string(),
    release_workflow_path: z.string(),
    installed_components: z.array(z.string()),
    dependency_install_model: z.string(),
    mcp_install_model: z.string(),
    hook_install_model: z.string()
  })
  .strict();
export type CodexInstallPackageSpec = z.infer<typeof codexInstallPackageSpecSchema>;

export const codexIntegrationProfileSchema = z
  .object({
    target_agent: z.literal("codex"),
    profile_name: z.string(),
    runtime_version: z.string(),
    mcp_server_id: z.string(),
    runtime_source: z.string(),
    active_surfaces: z.array(codexIntegrationFeatureSchema),
    wrapper_surfaces: z.array(codexIntegrationFeatureSchema),
    mcp_bindings: z.array(
      z.object({
        name: z.string(),
        uri: z.string().optional(),
        kind: z.enum(["tool", "resource", "prompt"]),
        capability_class: toolCapabilityClassSchema,
        description: z.string()
      })
    ),
    plugin: codexPluginSpecSchema,
    install_package: codexInstallPackageSpecSchema,
    skills: z.array(codexSkillSpecSchema),
    hooks: z.array(codexHookSpecSchema),
    guardrails: z.array(z.string()),
    artifacts: z.array(integrationArtifactSchema)
  })
  .strict();
export type CodexIntegrationProfile = z.infer<typeof codexIntegrationProfileSchema>;

export const currentIntegrationProfileSchema = z.object({
  provider: integrationProviderSchema,
  provider_identity: integrationProviderIdentitySchema,
  profile_name: z.string(),
  runtime_version: z.string(),
  mcp_server_id: z.literal("agent-workbench"),
  mcp_bindings: codexIntegrationProfileSchema.shape.mcp_bindings
}).strict();
export type CurrentIntegrationProfile = z.infer<typeof currentIntegrationProfileSchema>;

export const integrationProfileSchema = z.object({
  runtime_version: z.string(),
  target_agents: z.array(agentTargetSchema),
  mcp_bindings: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["tool", "resource", "prompt"]),
      capability_class: toolCapabilityClassSchema
    })
  ),
  artifacts: z.array(integrationArtifactSchema),
  unsupported_surfaces: z.array(
    z.object({
      target_agent: agentTargetSchema,
      surface: agentIntegrationSurfaceSchema,
      reason: z.string()
    })
  )
});
export type IntegrationProfile = z.infer<typeof integrationProfileSchema>;
