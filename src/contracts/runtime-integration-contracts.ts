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
    client: z.string().optional(),
    discovery_state: z.enum(["provided", "unknown"]),
    discovered_tools: z.array(z.string()).default([]),
    discovered_resources: z.array(z.string()).default([]),
    discovered_prompts: z.array(z.string()).default([])
  })
  .strict();
export type IntegrationSessionEvidence = z.infer<typeof integrationSessionEvidenceSchema>;

export const integrationDaemonHealthSchema = z
  .object({
    pid: z.number().int().positive(),
    socket_path: z.string(),
    repo_root: z.string(),
    connected_clients: z.number().int().nonnegative(),
    warmup_state: z.string(),
    graph_freshness: z.string(),
    last_failure: z.string().optional()
  })
  .strict();
export type IntegrationDaemonHealth = z.infer<typeof integrationDaemonHealthSchema>;

export const integrationHealthSchema = z
  .object({
    repo_root: z.string(),
    runtime_version: z.string(),
    profile: z.string(),
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
    client: z.string().optional(),
    discovery_state: z.enum(["provided", "unknown"]).default("unknown"),
    discovered_tools: z.array(z.string()).default([]),
    discovered_resources: z.array(z.string()).default([]),
    discovered_prompts: z.array(z.string()).default([])
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
