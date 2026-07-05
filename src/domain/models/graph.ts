/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DEFAULT_WORKSPACE_WATCHER_DEBOUNCE_MS,
  DEFAULT_WORKSPACE_WATCHER_ENABLED,
  DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET,
  type AdapterEvidence,
  type WorkspaceWatcherConfigContract
} from "../../contracts/index.js";

export interface SourceRange {
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
}

export interface FileIdentity {
  path: string;
  language: string;
  content_hash: string;
  size_bytes: number;
  mtime_ms: number;
  indexed_at?: string;
}

export interface GraphNodeReadModel {
  id: string;
  kind: string;
  name: string;
  qualified_name?: string;
  file_path: string;
  language: string;
  source_range: SourceRange;
  signature?: string;
  docstring?: string;
  metadata: Record<string, unknown>;
}

export type GraphNode = GraphNodeReadModel;

export interface GraphNodeWriteModel extends GraphNodeReadModel {}

export interface GraphEdgeReadModel {
  id: string;
  source_node_id: string;
  target_node_id?: string;
  kind: string;
  source_range?: SourceRange;
  provenance: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export type GraphEdge = GraphEdgeReadModel;

export interface GraphEdgeWriteModel extends GraphEdgeReadModel {}

export interface UnresolvedReferenceReadModel {
  id: string;
  source_node_id: string;
  source_file_path: string;
  reference_name: string;
  reference_kind: string;
  source_range: SourceRange;
  candidate_metadata: Record<string, unknown>;
}

export type UnresolvedReference = UnresolvedReferenceReadModel;

export interface UnresolvedReferenceWriteModel extends UnresolvedReferenceReadModel {}

export interface ResolvedReferenceReadModel {
  source_node_id: string;
  target_node_id: string;
  target_file_path: string;
  edge_id: string;
  confidence: number;
  provenance: string;
}

export type ResolvedReference = ResolvedReferenceReadModel;

export interface GraphTraversalRequest {
  start_node_ids: readonly string[];
  max_depth: number;
  max_nodes: number;
  direction: "incoming" | "outgoing" | "both";
}

export interface GraphTraversalResult {
  start_node_ids: readonly string[];
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  reached_depth: number;
  truncated: boolean;
}

export interface GraphQueryHit {
  score: number;
  node: GraphNode;
}

export interface ExtractionRequest {
  snapshot_id: string;
  path: string;
  language: string;
  content: string;
}

export interface ExtractionBatch {
  snapshot_id: string;
  source_path: string;
  extractor_id: string;
  language: string;
  file_identity: FileIdentity;
  nodes: readonly GraphNodeWriteModel[];
  edges: readonly GraphEdgeWriteModel[];
  unresolved_references: readonly UnresolvedReferenceWriteModel[];
  diagnostics_hints: readonly Record<string, unknown>[];
  test_hints: readonly Record<string, unknown>[];
  extracted_at: string;
}

export interface ValidationCommandPlan {
  command: string;
  args: readonly string[];
  reason: string;
}

export interface ValidationPlan {
  status: "planned" | "blocked";
  commands: readonly ValidationCommandPlan[];
  reason: string;
}

export interface ValidationPlanRequest {
  snapshot_id: string;
  repo_root: string;
  paths: readonly string[];
  max_items?: number;
}

export interface FileCatalogEntry {
  path: string;
  file_identity: FileIdentity;
  indexed: boolean;
  skipped_reason?: string;
  adapter_evidence?: AdapterEvidence;
}

export interface WorkspaceFileEvent {
  kind: "created" | "modified" | "deleted" | "renamed";
  path: string;
  old_path?: string;
  snapshot_id?: string;
  recorded_at: string;
}

export interface WorkspaceWatchRequest {
  repo_root: string;
  paths?: readonly string[];
  recursive?: boolean;
  debounce_ms?: number;
  event_budget?: number;
  enabled?: boolean;
}

export type WorkspaceWatcherConfig = WorkspaceWatcherConfigContract;

export function resolveWorkspaceWatcherConfig(
  input: Partial<WorkspaceWatcherConfig> = {}
): WorkspaceWatcherConfig {
  return {
    enabled: input.enabled ?? DEFAULT_WORKSPACE_WATCHER_ENABLED,
    debounce_ms: input.debounce_ms ?? DEFAULT_WORKSPACE_WATCHER_DEBOUNCE_MS,
    event_budget: input.event_budget ?? DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET
  };
}

export interface WorkspaceWatchHandle {
  id: string;
  started_at: string;
}
