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
  SnapshotState,
  WarmupExecution
} from "../domain/models/runtime.js";
import type {
  CapabilityLevel,
  DiagnosticFinding,
  DiagnosticsProviderStatus,
  DocsDocument,
  EditToken,
  IntegrationArtifact,
  IntegrationProfile
} from "../contracts/index.js";

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
  }): Promise<FileCatalogScanResult>;
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
  load(input: {
    repo_root: string;
    max_docs: number;
    max_headings_per_doc: number;
  }): Promise<{
    documents: readonly DocsDocument[];
    warnings: readonly {
      path?: string;
      reason: FileCatalogSkippedPath["reason"];
      message: string;
    }[];
    truncated: boolean;
  }>;
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
