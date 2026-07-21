/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  CancellationToken,
  QueueHandle,
  QueueWorkItem,
  WorkPriority,
  CacheValidationInput
} from "../domain/services/index.js";
import type {
  ExtractionBatch,
  ExtractionRequest,
  FileCatalogEntry,
  FileIdentity,
  GraphEdge,
  GraphNode,
  GraphTraversalRequest,
  GraphTraversalResult,
  ResolvedReference,
  SourceRange,
  UnresolvedReference,
  ValidationPlan,
  ValidationPlanRequest,
  WorkspaceFileEvent,
  WorkspaceWatchHandle,
  WorkspaceWatchRequest
} from "../domain/models/index.js";
import type {
  RuntimeContext,
  RuntimeContextInput,
  SnapshotFreshness,
  SnapshotOwnershipRecord,
  SnapshotValidityReceipt,
  SnapshotState,
  WarmupExecution
} from "../domain/models/runtime.js";
import type {
  CapabilityLevel,
  DiagnosticFinding,
  DiagnosticsProviderStatus,
  DocsDocument,
  DocsHeading,
  DocsSearchHit,
  EvidenceCoverageState,
  EditToken,
  Freshness,
  IndexCoverage,
  IntegrationArtifact,
  IntegrationProfile,
  InvalidationGeneration,
  MarkdownQualityFinding,
  RefreshDeadline,
  RefreshExecutionState,
  RefreshFailure,
  SnapshotPublicationState,
  SnapshotRefreshDiagnosticsReceipt
} from "../contracts/index.js";

export type { SnapshotPublicationState } from "../contracts/index.js";

export interface GraphQueryPort {
  getNode(input: { snapshot_id: string; node_id: string }): Promise<GraphNode | null>;
  findNodesByName(input: {
    snapshot_id: string;
    query: string;
    exact?: boolean;
    max_rows?: number;
  }): Promise<readonly GraphNode[]>;
  findNodesByQualifiedName(input: {
    snapshot_id: string;
    qualified_name: string;
    max_rows?: number;
  }): Promise<readonly GraphNode[]>;
  searchNodes(input: {
    snapshot_id: string;
    query: string;
    max_rows?: number;
  }): Promise<readonly GraphNode[]>;
  getNodesInRange(input: {
    snapshot_id: string;
    file_path: string;
    range: SourceRange;
  }): Promise<readonly GraphNode[]>;
  getOutgoingEdges(input: { snapshot_id: string; node_id: string; max_rows?: number }): Promise<readonly GraphEdge[]>;
  getIncomingEdges(input: { snapshot_id: string; node_id: string; max_rows?: number }): Promise<readonly GraphEdge[]>;
  getReferences(input: {
    snapshot_id: string;
    node_id: string;
    max_depth?: number;
    max_rows?: number;
  }): Promise<readonly ResolvedReference[]>;
  getUnresolvedReferences(input: {
    snapshot_id: string;
    file_path?: string;
    max_rows?: number;
  }): Promise<readonly UnresolvedReference[]>;
  traverse(input: {
    snapshot_id: string;
    request: GraphTraversalRequest;
  }): Promise<GraphTraversalResult>;
}

export interface GraphWritePort {
  replaceSnapshotExtraction(input: {
    batch: ExtractionBatch;
    replace: boolean;
  }): Promise<void>;
  insertEdges(input: {
    snapshot_id: string;
    file_path: string;
    edges: readonly GraphEdge[];
  }): Promise<void>;
  upsertFileIdentity(input: { snapshot_id: string; file_identity: FileIdentity }): Promise<void>;
  clearFile(input: { snapshot_id: string; file_path: string }): Promise<void>;
  clearSnapshot(input: { snapshot_id: string }): Promise<void>;
  clearUnresolvedReferences(input: { snapshot_id: string; source_node_id: string }): Promise<void>;
}

export type GraphPruneResult = {
  repo_root: string;
  deleted_snapshots: number;
  retained_snapshot_ids: readonly string[];
  optimized: boolean;
  vacuumed: boolean;
};

export interface GraphMaintenancePort {
  pruneRepositorySnapshots(input: {
    repo_root: string;
    retain_latest_snapshots: number;
    retain_latest_fresh_snapshots: number;
    vacuum: boolean;
  }): Promise<GraphPruneResult>;
}

export interface SnapshotPort {
  getSnapshot(input: { repo_root: string; snapshot_id?: string }): Promise<SnapshotState | null>;
  listSnapshots(input: { repo_root: string }): Promise<readonly SnapshotState[]>;
  upsertSnapshot(input: { snapshot: SnapshotState }): Promise<void>;
  markSnapshotFreshness(input: {
    snapshot_id: string;
    freshness: SnapshotFreshness;
    owner_state?: SnapshotOwnershipRecord["state"];
    reason?: string;
  }): Promise<void>;
}

export interface FileCatalogPort {
  listFiles(input: {
    snapshot_id: string;
    after_path?: string;
    max_rows?: number;
  }): Promise<readonly FileCatalogEntry[]>;
  getFile(input: {
    snapshot_id: string;
    path: string;
  }): Promise<FileCatalogEntry | null>;
  upsertEntry(input: { snapshot_id: string; entry: FileCatalogEntry }): Promise<void>;
  removeEntry(input: { snapshot_id: string; path: string }): Promise<void>;
}

export type FileCatalogScanResult = {
  repo_root: string;
  indexed_roots: readonly string[];
  skipped_roots: readonly string[];
  skipped_paths?: readonly FileCatalogSkippedPath[];
  files: readonly FileCatalogEntry[];
  truncated: boolean;
};

export type FileCatalogSkippedPath = {
  path: string;
  reason:
    | "permission_denied"
    | "missing"
    | "not_directory"
    | "generated_or_vendor"
    | "configured_skip"
    | "hidden_path"
    | "gitignore"
    | "secret"
    | "nested_git_repository"
    | "workspace_escape";
  detail: string;
};

export interface FileCatalogScanPort {
  scan(input: {
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
    max_files: number;
    priority_paths?: readonly string[];
  }): Promise<FileCatalogScanResult>;
}

export type SnapshotPathValidationOutcome = {
  path: string;
  status: "present" | "missing" | "inaccessible";
  reason?: string;
};

export interface SnapshotPathValidationPort {
  validatePaths(input: {
    repo_root: string;
    paths: readonly string[];
  }): Promise<readonly SnapshotPathValidationOutcome[]>;
}

export interface SnapshotPathInventoryPort {
  listIndexedPaths(input: {
    snapshot_id: string;
    max_rows: number;
  }): Promise<readonly string[]>;
}

export interface SnapshotValidityPort {
  validate(input: {
    snapshot: SnapshotState;
    max_paths: number;
  }): Promise<SnapshotValidityReceipt>;
}

export interface FileIdentityPort {
  compute(input: { path: string; content: string }): Promise<FileIdentity>;
  inferLanguage(input: { path: string; content?: string }): Promise<string>;
  isSkipped(input: {
    path: string;
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
  }): Promise<boolean>;
}

export interface WorkspaceFilePort {
  readText(input: { path: string }): Promise<string>;
  readBinary(input: { path: string }): Promise<Uint8Array>;
  writeText(input: {
    path: string;
    content: string;
    overwrite?: boolean;
  }): Promise<void>;
  writeBinary(input: { path: string; content: Uint8Array; overwrite?: boolean }): Promise<void>;
  stat(input: { path: string }): Promise<{
    exists: boolean;
    is_file: boolean;
    size_bytes: number;
    mtime_ms: number;
  }>;
  deletePath(input: { path: string }): Promise<void>;
  ensureDirectory(input: { path: string }): Promise<void>;
}

export type WorkspacePathDecision =
  | {
      allowed: true;
      absolutePath: string;
      relativePath: string;
      readOnly: boolean;
    }
  | {
      allowed: false;
      reason: "path_refused";
      message: string;
      requestedPath: string;
    };

export interface WorkspaceSafetyPort {
  resolveWorkspacePath(
    requestedPath: string,
    options?: { write?: boolean }
  ): WorkspacePathDecision;
  isReadOnlyPath(requestedPath: string): boolean;
  redactSecretLikeText(value: string): string;
}

export type MarkdownDocumentAst = {
  path: string;
  lines: readonly string[];
  frontmatter?: {
    start_line: number;
    end_line: number;
    fields: ReadonlyMap<string, string>;
  };
  blocks: readonly MarkdownBlock[];
  links: readonly MarkdownParsedLink[];
};

export type MarkdownBlock =
  | {
      kind: "heading";
      line: number;
      column: number;
      depth: number;
      text: string;
      raw: string;
    }
  | {
      kind: "ordered_list_item";
      line: number;
      column: number;
      indent: number;
      number: number;
      raw: string;
    }
  | {
      kind: "table_row";
      line: number;
      column: number;
      cells: readonly string[];
      raw: string;
    };

export type MarkdownParsedLink = {
  line: number;
  column: number;
  label: string;
  target: string;
  raw: string;
};

export interface MarkdownParserPort {
  parse(input: { path: string; content: string }): MarkdownDocumentAst;
}

export interface MarkdownStructureCheckPort {
  check(input: {
    document: MarkdownDocumentAst;
    repo_root: string;
    existing_markdown_paths: ReadonlySet<string>;
    required_frontmatter: readonly string[];
    max_findings: number;
    max_evidence_bytes: number;
  }): {
    findings: readonly MarkdownQualityFinding[];
    truncated: boolean;
  };
}

export interface WorkspaceWatcherPort {
  start(input: WorkspaceWatchRequest): Promise<WorkspaceWatchHandle>;
  stop(input: { watch_id: string }): Promise<void>;
  poll(input: { watch_id: string; max_events?: number }): Promise<readonly WorkspaceFileEvent[]>;
  reset(input: { watch_id: string }): Promise<void>;
}

export interface ExtractorPort {
  language: string;
  supports(input: { language: string; path: string }): boolean;
  extract(input: ExtractionRequest): Promise<ExtractionBatch>;
}

export interface ExtractorRegistryPort {
  register(input: ExtractorPort): void;
  unregister(input: { language: string }): void;
  resolve(input: { language: string }): ExtractorPort | null;
  availableLanguages(): Promise<readonly string[]>;
}

export interface ReferenceResolverPort {
  resolve(input: {
    snapshot_id: string;
    unresolved_references: readonly UnresolvedReference[];
    max_candidates_per_reference: number;
  }): Promise<readonly ResolvedReference[]>;
}

export interface ValidationPlannerPort {
  plan(input: ValidationPlanRequest): Promise<ValidationPlan>;
}

export type DiagnosticsProviderResult = {
  statuses: readonly DiagnosticsProviderStatus[];
  findings: readonly DiagnosticFinding[];
};

export interface DiagnosticsProviderPort {
  provider_id: string;
  supports(input: {
    path: string;
    language: string;
    capability_level: CapabilityLevel;
  }): boolean;
  diagnose(input: {
    repo_root: string;
    file: FileCatalogEntry;
  }): Promise<DiagnosticsProviderResult>;
}

export interface DocsIndexPort {
  replaceSnapshotDocs(input: {
    snapshot_id: string;
    repo_root: string;
    documents: readonly DocsIndexDocumentWrite[];
    coverage?: readonly IndexCoverage[];
  }): Promise<void>;
  search(input: DocsIndexSearchRequest): Promise<DocsIndexSearchResult>;
  getState(input: { repo_root: string; snapshot_id?: string }): Promise<DocsIndexState>;
}

export type DocsIndexDocumentWrite = {
  path: string;
  title: string;
  headings: readonly DocsHeading[];
  selected_text: string;
  content_hash: string;
  byte_count: number;
  indexed_at: string;
  truncated: boolean;
};

export type DocsIndexState = {
  repo_root: string;
  snapshot_id?: string;
  freshness: Freshness;
  status: "usable" | "cold" | "stale" | "invalid" | "unavailable";
  coverage_state?: EvidenceCoverageState;
  coverage?: readonly IndexCoverage[];
  docs_scan_truncated?: boolean;
  reason?: string;
  document_count: number;
};

export type DocsIndexSearchRequest = {
  repo_root: string;
  snapshot_id?: string;
  scope_path?: string;
  query: string;
  max_results: number;
  include_snippets: boolean;
  cursor?: string;
};

export type DocsIndexSearchResult =
  | {
      status: "done";
      repo_root: string;
      snapshot_id: string;
      freshness: Freshness;
      hits: readonly DocsSearchHit[];
      truncated: boolean;
      cursor?: string;
      result_count: number;
      result_count_basis?: "page" | "indexed_matches";
      docs_index_state?: EvidenceCoverageState;
      indexed_docs_count?: number;
      docs_scan_truncated?: boolean;
      coverage?: readonly IndexCoverage[];
      coverage_note?: string;
    }
  | {
      status: "blocked";
      repo_root: string;
      snapshot_id?: string;
      freshness: Freshness;
      reason: "cold" | "stale" | "invalid" | "unavailable";
      message: string;
      hits: readonly DocsSearchHit[];
      truncated: false;
      cursor?: undefined;
      result_count: 0;
      result_count_basis?: "page" | "indexed_matches";
      docs_index_state?: EvidenceCoverageState;
      indexed_docs_count?: number;
      docs_scan_truncated?: boolean;
      coverage?: readonly IndexCoverage[];
      coverage_note?: string;
    };

export type GitFileHistoryResult =
  | {
      status: "available";
      path: string;
      latest_touch: {
        commit: string;
        committed_at: string;
      };
      first_seen?: {
        commit: string;
        committed_at: string;
      };
    }
  | {
      status: "unavailable";
      path: string;
      reason:
        | "git_unavailable"
        | "not_git_repository"
        | "untracked"
        | "no_history"
        | "command_failed";
      message: string;
    };

export interface GitHistoryPort {
  getFileHistory(input: {
    repo_root: string;
    path: string;
    include_first_seen?: boolean;
  }): Promise<GitFileHistoryResult>;
}

export interface EditPreviewStorePort {
  put(input: { preview: EditToken }): Promise<void>;
  get(input: { preview_token: string }): Promise<EditToken | null>;
  consume(input: { preview_token: string }): Promise<EditToken | null>;
  delete(input: { preview_token: string }): Promise<void>;
  purgeExpired(input: { now_iso8601: string }): Promise<number>;
}

export interface ClockPort {
  now(): Date;
  nowIso8601(): string;
  nowUnixMs(): number;
}

export interface HasherPort {
  hashText(input: { value: string; algorithm?: "sha256" | "sha512" }): Promise<string>;
  hashBytes(input: { bytes: Uint8Array; algorithm?: "sha256" | "sha512" }): Promise<string>;
}

export interface CachePort {
  has(input: { namespace: string; key: string } & CacheValidationInput): Promise<boolean>;
  get<T>(input: { namespace: string; key: string } & CacheValidationInput): Promise<T | null>;
  set<T>(input: {
    namespace: string;
    key: string;
    value: T;
    ttl_ms?: number;
    depends_on_snapshot_id?: string;
    depends_on_config_identity?: string;
    depends_on_file_hashes?: readonly {
      path: string;
      content_hash: string;
    }[];
    depends_on_file_paths?: readonly string[];
  }): Promise<void>;
  delete(input: { namespace: string; key: string }): Promise<boolean>;
}

export interface CacheInvalidationPort {
  invalidateNamespace(input: { namespace: string }): Promise<number>;
  invalidateKey(input: { namespace: string; key: string }): Promise<boolean>;
  invalidatePrefix(input: { namespace: string; key_prefix: string }): Promise<number>;
  invalidateSnapshot(input: { snapshot_id: string }): Promise<number>;
  invalidateFile(input: { snapshot_id: string; file_path: string }): Promise<number>;
}

export interface WarmupCoordinatorPort {
  getState(input: { repo_root: string }): Promise<WarmupExecution | null>;
  requestWarmup(input: { repo_root: string; snapshot_id: string; force?: boolean }): Promise<string>;
  markOwner(input: { execution_id: string; owner_id: string }): Promise<void>;
  completeWarmup(input: { execution_id: string; success: boolean; reason?: string }): Promise<void>;
}

export type RefreshWorkerResult = {
  outcome: "complete";
  execution_id: string;
  target_snapshot_id: string;
  completed_generation: InvalidationGeneration;
};

export type RefreshExecutorCompletion = {
  exit_code: number;
  results: readonly unknown[];
};

export interface RefreshExecutorPort {
  run(input: {
    repo_root: string;
    execution_id: string;
    target_snapshot_id: string;
    generation: InvalidationGeneration;
    deadline: RefreshDeadline;
  }): Promise<RefreshExecutorCompletion>;
  terminate(input: {
    execution_id: string;
    reason: "deadline" | "worker_error" | "controller_shutdown";
  }): Promise<void>;
}

export interface RefreshDeadlineHandle {
  cancel(): void;
}

export interface RefreshDeadlineSchedulerPort {
  arm(input: {
    deadline: RefreshDeadline;
    onDeadline: () => void;
  }): RefreshDeadlineHandle;
}

type RefreshActivityLeaseBase = {
  execution_id: string;
  controller_generation: number;
  acquired_at: string;
};

export type RefreshActivityLease = RefreshActivityLeaseBase &
  (
    | {
        state: "held";
        released_at?: never;
      }
    | {
        state: "released";
        released_at: string;
      }
  );

export type SnapshotPublicationRecord = {
  repo_root: string;
  snapshot_id: string;
  controller_generation: number;
  invalidation_generation: InvalidationGeneration;
  state: SnapshotPublicationState;
  updated_at: string;
};

export type PublishedSnapshotRecord = SnapshotPublicationRecord & {
  state: "published";
};

export type SnapshotPublicationTransition = {
  repo_root: string;
  snapshot_id: string;
  controller_generation: number;
  invalidation_generation: InvalidationGeneration;
  from: "building";
  to: "published" | "superseded" | "failed";
  updated_at: string;
};

export type SnapshotPublicationSelection =
  | {
      status: "selected";
      snapshot: SnapshotState;
      publication: PublishedSnapshotRecord;
    }
  | {
      status: "blocked";
      snapshot_id: string;
      publication_state: Exclude<SnapshotPublicationState, "published">;
      reason: "snapshot_unpublished";
      message: "Snapshot is not published.";
    }
  | {
      status: "missing";
      snapshot_id?: string;
      reason: "snapshot_not_found" | "no_published_snapshot";
    };

export interface SnapshotPublicationPort {
  allocateBuildSnapshotId(input: {
    repo_root: string;
    minimum_id: string;
  }): Promise<string>;
  transitionBuild<TState extends SnapshotPublicationTransition["to"]>(
    input: SnapshotPublicationTransition & { to: TState }
  ): Promise<SnapshotPublicationRecord & { state: TState }>;
  getLatestPublished(input: {
    repo_root: string;
  }): Promise<Exclude<SnapshotPublicationSelection, { status: "blocked" }>>;
  readExplicit(input: {
    repo_root: string;
    snapshot_id: string;
  }): Promise<SnapshotPublicationSelection>;
}

export interface SnapshotBuildPort {
  createBuildSnapshot(input: {
    snapshot: SnapshotState;
    controller_generation: number;
    invalidation_generation: InvalidationGeneration;
    created_at: string;
  }): Promise<SnapshotPublicationRecord & { state: "building" }>;
}

export type RepositoryOwnershipLease = {
  repo_root: string;
  runtime_identity: string;
  schema_version: number;
  owner_id: string;
  owner_pid: number;
  owner_generation: number;
  heartbeat_at: string;
  state: "active" | "dead" | "ambiguous";
  recovered_owners?: readonly {
    repo_root: string;
    runtime_identity: string;
    schema_version: number;
    owner_id: string;
    owner_pid: number;
    owner_generation: number;
    heartbeat_at: string;
    state: "active" | "dead" | "ambiguous";
  }[];
};

export type RepositoryOwnershipAdmission =
  | {
      outcome: "acquired";
      lease: RepositoryOwnershipLease & { state: "active" };
      recovered_owner?: RepositoryOwnershipLease & { state: "dead" };
      recovered_owners?: readonly (RepositoryOwnershipLease & { state: "dead" })[];
    }
  | {
      outcome: "blocked";
      reason: "owner_active";
      owner: RepositoryOwnershipLease & { state: "active" };
    }
  | {
      outcome: "blocked";
      reason: "ownership_ambiguous";
      owner: RepositoryOwnershipLease & { state: "ambiguous" };
    };

export interface RepositoryOwnershipPort {
  acquire(input: {
    repo_root: string;
    runtime_identity: string;
    schema_version: number;
    owner_id: string;
    owner_pid: number;
    owner_generation: number;
    heartbeat_at: string;
  }): Promise<RepositoryOwnershipAdmission>;
  release(input: { lease: RepositoryOwnershipLease & { state: "active" } }): Promise<void>;
  confirmRecovery?(input: { lease: RepositoryOwnershipLease & { state: "active" } }): Promise<void>;
}

export type SnapshotOrphanReconciliationResult =
  | {
      outcome: "reconciled";
      snapshot_ids: readonly string[];
    }
  | {
      outcome: "blocked";
      reason: "ownership_ambiguous";
      snapshot_ids: readonly string[];
    };

export interface SnapshotOrphanReconciliationPort {
  reconcileOrphanedBuilds(input: {
    repo_root: string;
    current_owner: RepositoryOwnershipLease & { state: "active" };
    recovered_owners?: readonly (RepositoryOwnershipLease & { state: "dead" })[];
    updated_at: string;
  }): Promise<SnapshotOrphanReconciliationResult>;
}

export type SnapshotRefreshRequest = {
  repo_root: string;
  reason: "startup" | "stale_first_read" | "watcher_invalidation";
  source: string;
  invalidation_generation: InvalidationGeneration;
};

type SnapshotRefreshExecutionAdmission = {
  execution_id: string;
  target_snapshot_id?: string;
  state: Extract<RefreshExecutionState, "planned" | "running">;
  started_generation: InvalidationGeneration;
  requested_generation: InvalidationGeneration;
};

export type SnapshotRefreshAdmission =
  | (SnapshotRefreshExecutionAdmission & {
      outcome: "accepted";
      reused: false;
      state: "planned";
    })
  | (SnapshotRefreshExecutionAdmission & {
      outcome: "reused";
      reused: true;
    })
  | {
      outcome: "blocked";
      reused: false;
      state: "idle";
      reason: "owner_active";
      message: string;
      owner: RepositoryOwnershipLease & { state: "active" };
    }
  | {
      outcome: "blocked";
      reused: false;
      state: "idle";
      reason: "ownership_ambiguous";
      message: string;
      owner: RepositoryOwnershipLease & { state: "ambiguous" };
    }
  | {
      outcome: "blocked";
      reused: false;
      state: "idle";
      reason: "termination_unconfirmed";
      message: "Prior refresh worker termination is not yet confirmed.";
      execution_id: string;
    }
  | {
      outcome: "blocked";
      reused: false;
      state: "idle";
      reason: "store_failure";
      message: "Refresh store operation failed.";
    }
  | {
      outcome: "blocked";
      reused: false;
      state: "idle";
      reason: "permission_failure";
      message: "Refresh operation was not permitted.";
    };

export interface SnapshotRefreshPort {
  request(input: SnapshotRefreshRequest): Promise<SnapshotRefreshAdmission>;
}

export type SnapshotRefreshControllerReceipt = {
  repo_root: string;
  controller_generation: number;
  execution_state: RefreshExecutionState;
  execution_id?: string;
  target_snapshot_id?: string;
  started_generation: InvalidationGeneration;
  requested_generation: InvalidationGeneration;
  activity_lease: RefreshActivityLease | null;
  worker_invocations: number;
  worker_termination_state: "not_required" | "unconfirmed" | "confirmed";
  last_failure?: RefreshFailure;
};

export interface SnapshotRefreshControllerPort
  extends SnapshotRefreshPort,
    DaemonRefreshActivityPort {
  getReceipt(): SnapshotRefreshControllerReceipt;
}

export interface SnapshotRefreshAdmissionFailurePort {
  recordAdmissionFailure(input: {
    repo_root: string;
    invalidation_generation: InvalidationGeneration;
    code: "store_failure" | "permission_failure" | "orphaned_build";
    target_snapshot_id?: string;
  }): Promise<Extract<SnapshotRefreshAdmission, { outcome: "blocked" }>>;
}

export interface SnapshotRefreshDiagnosticsPort {
  getDiagnostics(input: { repo_root: string }): Promise<SnapshotRefreshDiagnosticsReceipt>;
}

type DaemonRefreshActivityTransitionBase = {
  execution_id: string;
  controller_generation: number;
};

export type DaemonRefreshActivityTransition = DaemonRefreshActivityTransitionBase &
  (
    | {
        state: "active";
        execution_state: "planned" | "running";
        lease: RefreshActivityLease & { state: "held" };
        failure?: never;
      }
    | {
        state: "terminal";
        execution_state: "complete";
        lease: RefreshActivityLease & { state: "released" };
        failure?: never;
      }
    | {
        state: "terminal";
        execution_state: "failed";
        lease: RefreshActivityLease & { state: "released" };
        failure: RefreshFailure;
      }
    | {
        state: "termination_confirmed";
        execution_state: "failed";
        lease?: never;
        failure?: never;
      }
  );

export interface DaemonRefreshActivityPort {
  onTransition(
    listener: (transition: DaemonRefreshActivityTransition) => void | Promise<void>
  ): () => void;
}

export interface WorkQueuePort {
  enqueue<T>(input: {
    request: QueueWorkItem<T>;
    priority?: WorkPriority;
    available_at_iso8601?: string;
  }): Promise<QueueHandle>;
  cancel(input: { queue_id: string }): Promise<void>;
  claim(input: { max_count: number; priorities: readonly WorkPriority[] }): Promise<readonly QueueHandle[]>;
  complete(input: { queue_id: string }): Promise<void>;
  fail(input: { queue_id: string; reason: string }): Promise<void>;
  requeue(input: { queue_id: string; delay_ms?: number }): Promise<void>;
  getPayload<T>(input: { queue_id: string }): Promise<QueueWorkItem<T> | null>;
  depth(): Promise<Record<WorkPriority, number>>;
}

export interface WorkerPoolPort {
  run<TInput, TOutput>(input: {
    task_type: string;
    input: TInput;
    timeout_ms?: number;
    cancellation_token?: string;
  }): Promise<TOutput>;
  shutdown(): Promise<void>;
  resize(input: { size: number }): Promise<void>;
}

export interface CancellationPort {
  create(input: { scope: string; ttl_ms?: number; reason?: string }): Promise<CancellationToken>;
  cancel(input: { token: string; reason?: string }): Promise<void>;
  isCancelled(input: { token: string }): Promise<boolean>;
  refresh(input: { token: string; ttl_ms?: number }): Promise<void>;
  revokeScope(input: { scope: string }): Promise<number>;
}

export interface SnapshotCoordinatorPort {
  claimOwnership(input: {
    repo_root: string;
    snapshot_id: string;
    owner_id: string;
  }): Promise<SnapshotOwnershipRecord>;
  heartbeat(input: { repo_root: string; owner_id: string; snapshot_id: string }): Promise<void>;
  releaseOwnership(input: { repo_root: string; owner_id: string; snapshot_id: string }): Promise<void>;
  getOwner(input: { repo_root: string }): Promise<SnapshotOwnershipRecord | null>;
}

export interface RuntimeContextFactoryPort {
  create(input: RuntimeContextInput): Promise<RuntimeContext>;
  applyOverrides(input: { context: RuntimeContext; overrides: Partial<RuntimeContextInput> }): RuntimeContext;
  getSignature(input: { context: RuntimeContext }): Promise<string>;
}

export interface StateStorePort {
  get<T>(input: {
    namespace: string;
    key: string;
    snapshot_id?: string;
  }): Promise<T | null>;
  set<T>(input: {
    namespace: string;
    key: string;
    value: T;
    snapshot_id?: string;
  }): Promise<void>;
  delete(input: { namespace: string; key: string; snapshot_id?: string }): Promise<boolean>;
  clearNamespace(input: { namespace: string; snapshot_id?: string }): Promise<number>;
  listKeys(input: { namespace: string; prefix?: string; snapshot_id?: string }): Promise<readonly string[]>;
}

export interface TelemetryPort {
  startSpan(input: {
    name: string;
    parent_span_id?: string;
    attributes?: Record<string, unknown>;
  }): Promise<{
    span_id: string;
    trace_id: string;
    started_at: string;
  }>;
  endSpan(input: {
    span_id: string;
    status: "ok" | "error";
    status_message?: string;
    attributes?: Record<string, unknown>;
  }): Promise<void>;
  recordEvent(input: {
    span_id: string;
    name: string;
    attributes?: Record<string, unknown>;
  }): Promise<void>;
  incrementCounter(input: {
    name: string;
    value: number;
    attributes?: Record<string, string | number | boolean>;
  }): Promise<void>;
  setGauge(input: {
    name: string;
    value: number;
    attributes?: Record<string, string | number | boolean>;
  }): Promise<void>;
  flush(): Promise<void>;
}

export interface TelemetryRecorderPort {
  record(name: string, properties?: Record<string, unknown>): void;
  recordError(error: unknown, properties?: Record<string, unknown>): void;
  flush(): Promise<void> | void;
  shutdown(): Promise<void> | void;
}

export interface IntegrationProfileRegistryPort {
  getProfile(input: { runtime_version?: string }): Promise<IntegrationProfile | null>;
  putProfile(input: { profile: IntegrationProfile }): Promise<void>;
  listProfiles(): Promise<readonly IntegrationProfile[]>;
  removeProfile(input: { runtime_version: string }): Promise<void>;
}

export interface IntegrationArtifactEmitterPort {
  emitter_id: string;
  supported_targets: readonly string[];
  emitArtifacts(input: {
    profile: IntegrationProfile;
    force_refresh?: boolean;
  }): Promise<readonly IntegrationArtifact[]>;
  supports(input: { target_agent: string; path: string }): Promise<boolean>;
}
