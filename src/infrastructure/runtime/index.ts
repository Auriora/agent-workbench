import crypto from "node:crypto";
import type {
  RuntimeContext,
  RuntimeContextInput,
  SnapshotOwnershipRecord,
  WarmupExecution
} from "../../domain/models/index.js";
import type { CancellationToken } from "../../domain/services/index.js";
import type {
  CacheInvalidationPort,
  CachePort,
  CancellationPort,
  ClockPort,
  RuntimeContextFactoryPort,
  SnapshotCoordinatorPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";

type CacheEntry = {
  namespace: string;
  key: string;
  value: unknown;
  expires_at_ms?: number;
  depends_on_snapshot_id?: string;
  depends_on_file_paths: readonly string[];
};

export type InMemoryRuntimeOperationsOptions = {
  clock: ClockPort;
  owner_stale_after_ms?: number;
  owner_dead_after_ms?: number;
  isolated_worker?: boolean;
};

export class InMemoryRuntimeOperationsAdapter
  implements
    CachePort,
    CacheInvalidationPort,
    WarmupCoordinatorPort,
    SnapshotCoordinatorPort,
    RuntimeContextFactoryPort
{
  private readonly cache = new Map<string, CacheEntry>();
  private readonly warmupsByRepo = new Map<string, WarmupExecution>();
  private readonly ownersByRepo = new Map<string, SnapshotOwnershipRecord>();
  private readonly clock: ClockPort;
  private readonly ownerStaleAfterMs: number;
  private readonly ownerDeadAfterMs: number;
  private readonly isolatedWorker: boolean;
  private sequence = 0;

  constructor(options: InMemoryRuntimeOperationsOptions) {
    this.clock = options.clock;
    this.ownerStaleAfterMs = options.owner_stale_after_ms ?? 30_000;
    this.ownerDeadAfterMs = options.owner_dead_after_ms ?? 120_000;
    this.isolatedWorker = options.isolated_worker ?? false;
  }

  public async has(input: { namespace: string; key: string }): Promise<boolean> {
    return (await this.get(input)) !== null;
  }

  public async get<T>(input: { namespace: string; key: string }): Promise<T | null> {
    const cacheKey = this.cacheKey(input.namespace, input.key);
    const entry = this.cache.get(cacheKey);
    if (entry === undefined) {
      return null;
    }
    if (entry.expires_at_ms !== undefined && entry.expires_at_ms <= this.clock.nowUnixMs()) {
      this.cache.delete(cacheKey);
      return null;
    }
    return entry.value as T;
  }

  public async set<T>(input: {
    namespace: string;
    key: string;
    value: T;
    ttl_ms?: number;
    depends_on_snapshot_id?: string;
    depends_on_file_paths?: readonly string[];
  }): Promise<void> {
    this.cache.set(this.cacheKey(input.namespace, input.key), {
      namespace: input.namespace,
      key: input.key,
      value: input.value,
      expires_at_ms:
        input.ttl_ms === undefined ? undefined : this.clock.nowUnixMs() + input.ttl_ms,
      depends_on_snapshot_id: input.depends_on_snapshot_id,
      depends_on_file_paths: (input.depends_on_file_paths ?? []).map(normalizePath)
    });
  }

  public async delete(input: { namespace: string; key: string }): Promise<boolean> {
    return this.cache.delete(this.cacheKey(input.namespace, input.key));
  }

  public async invalidateNamespace(input: { namespace: string }): Promise<number> {
    return this.deleteMatching((entry) => entry.namespace === input.namespace);
  }

  public async invalidateKey(input: { namespace: string; key: string }): Promise<boolean> {
    return this.delete(input);
  }

  public async invalidatePrefix(input: {
    namespace: string;
    key_prefix: string;
  }): Promise<number> {
    return this.deleteMatching(
      (entry) => entry.namespace === input.namespace && entry.key.startsWith(input.key_prefix)
    );
  }

  public async invalidateSnapshot(input: { snapshot_id: string }): Promise<number> {
    return this.deleteMatching((entry) => entry.depends_on_snapshot_id === input.snapshot_id);
  }

  public async invalidateFile(input: {
    snapshot_id: string;
    file_path: string;
  }): Promise<number> {
    return this.deleteMatching(
      (entry) =>
        entry.depends_on_snapshot_id === input.snapshot_id &&
        entry.depends_on_file_paths.includes(normalizePath(input.file_path))
    );
  }

  public async getState(input: { repo_root: string }): Promise<WarmupExecution | null> {
    return this.warmupsByRepo.get(input.repo_root) ?? null;
  }

  public async requestWarmup(input: {
    repo_root: string;
    snapshot_id: string;
    force?: boolean;
  }): Promise<string> {
    const existing = this.warmupsByRepo.get(input.repo_root);
    if (
      existing !== undefined &&
      input.force !== true &&
      (existing.state === "planned" || existing.state === "running")
    ) {
      return existing.execution_id;
    }

    const execution: WarmupExecution = {
      execution_id: this.nextId("warmup"),
      repo_root: input.repo_root,
      snapshot_id: input.snapshot_id,
      state: "planned",
      owner_id: "",
      queued_jobs: 0,
      started_at: this.clock.nowIso8601(),
      updated_at: this.clock.nowIso8601()
    };
    this.warmupsByRepo.set(input.repo_root, execution);
    return execution.execution_id;
  }

  public async markOwner(input: { execution_id: string; owner_id: string }): Promise<void> {
    const execution = this.findWarmup(input.execution_id);
    if (execution === undefined) {
      throw new Error("Warmup execution was not found.");
    }
    execution.owner_id = input.owner_id;
    execution.state = "running";
    execution.updated_at = this.clock.nowIso8601();
  }

  public async completeWarmup(input: {
    execution_id: string;
    success: boolean;
    reason?: string;
  }): Promise<void> {
    const execution = this.findWarmup(input.execution_id);
    if (execution === undefined) {
      throw new Error("Warmup execution was not found.");
    }
    execution.state = input.success ? "complete" : "failed";
    execution.reason = input.reason;
    execution.updated_at = this.clock.nowIso8601();
  }

  public async claimOwnership(input: {
    repo_root: string;
    snapshot_id: string;
    owner_id: string;
  }): Promise<SnapshotOwnershipRecord> {
    if (this.isolatedWorker) {
      return {
        repo_root: input.repo_root,
        snapshot_id: input.snapshot_id,
        owner_id: input.owner_id,
        state: "isolated_worker",
        heartbeat_at: this.clock.nowIso8601(),
        schema_version: 1
      };
    }

    const existing = this.ownersByRepo.get(input.repo_root);
    const existingState = existing === undefined ? null : this.classifyOwner(existing);
    if (
      existing !== undefined &&
      existing.owner_id !== input.owner_id &&
      (existingState === "owner" || existingState === "stale_owner")
    ) {
      return {
        ...existing,
        state: existingState === "owner" ? "observer" : "stale_owner"
      };
    }

    const owner: SnapshotOwnershipRecord = {
      repo_root: input.repo_root,
      snapshot_id: input.snapshot_id,
      owner_id: input.owner_id,
      state: "owner",
      heartbeat_at: this.clock.nowIso8601(),
      schema_version: 1
    };
    this.ownersByRepo.set(input.repo_root, owner);
    return owner;
  }

  public async heartbeat(input: {
    repo_root: string;
    owner_id: string;
    snapshot_id: string;
  }): Promise<void> {
    const existing = this.ownersByRepo.get(input.repo_root);
    if (existing === undefined || existing.owner_id !== input.owner_id) {
      throw new Error("Snapshot owner heartbeat was refused because the owner does not match.");
    }
    existing.snapshot_id = input.snapshot_id;
    existing.state = "owner";
    existing.heartbeat_at = this.clock.nowIso8601();
  }

  public async releaseOwnership(input: {
    repo_root: string;
    owner_id: string;
    snapshot_id: string;
  }): Promise<void> {
    const existing = this.ownersByRepo.get(input.repo_root);
    if (
      existing !== undefined &&
      existing.owner_id === input.owner_id &&
      existing.snapshot_id === input.snapshot_id
    ) {
      this.ownersByRepo.delete(input.repo_root);
    }
  }

  public async getOwner(input: { repo_root: string }): Promise<SnapshotOwnershipRecord | null> {
    const existing = this.ownersByRepo.get(input.repo_root);
    if (existing === undefined) {
      return null;
    }
    return {
      ...existing,
      state: this.classifyOwner(existing)
    };
  }

  public async create(input: RuntimeContextInput): Promise<RuntimeContext> {
    return {
      operation: input.operation,
      repo_root: input.repo_root,
      workspace_root: input.workspace_root,
      request_id: input.request_id,
      snapshot_id: input.snapshot_id,
      freshness: input.freshness ?? "unknown",
      capability_level: input.capability_level,
      budget_ms: input.budget_ms,
      deadline_at: input.deadline_at,
      usage_context: input.usage_context,
      cancellation_token: input.cancellation_token
    };
  }

  public applyOverrides(input: {
    context: RuntimeContext;
    overrides: Partial<RuntimeContextInput>;
  }): RuntimeContext {
    return {
      ...input.context,
      ...input.overrides,
      freshness: input.overrides.freshness ?? input.context.freshness
    };
  }

  public async getSignature(input: { context: RuntimeContext }): Promise<string> {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          operation: input.context.operation,
          repo_root: input.context.repo_root,
          workspace_root: input.context.workspace_root,
          snapshot_id: input.context.snapshot_id,
          freshness: input.context.freshness,
          capability_level: input.context.capability_level,
          budget_ms: input.context.budget_ms,
          deadline_at: input.context.deadline_at,
          usage_context: input.context.usage_context
        })
      )
      .digest("hex");
  }

  private deleteMatching(predicate: (entry: CacheEntry) => boolean): number {
    let deleted = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (predicate(entry)) {
        this.cache.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  private cacheKey(namespace: string, key: string): string {
    return `${namespace}\0${key}`;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  private findWarmup(executionId: string): WarmupExecution | undefined {
    return Array.from(this.warmupsByRepo.values()).find(
      (execution) => execution.execution_id === executionId
    );
  }

  private classifyOwner(owner: SnapshotOwnershipRecord): SnapshotOwnershipRecord["state"] {
    const ageMs = this.clock.nowUnixMs() - Date.parse(owner.heartbeat_at);
    if (ageMs >= this.ownerDeadAfterMs) {
      return "dead_owner";
    }
    if (ageMs >= this.ownerStaleAfterMs) {
      return "stale_owner";
    }
    return owner.state === "isolated_worker" ? "isolated_worker" : "owner";
  }
}

export class InMemoryCancellationAdapter implements CancellationPort {
  private readonly tokens = new Map<string, CancellationToken & { cancelled: boolean }>();
  private readonly clock: ClockPort;
  private sequence = 0;

  constructor(options: { clock: ClockPort }) {
    this.clock = options.clock;
  }

  public async create(input: {
    scope: string;
    ttl_ms?: number;
    reason?: string;
  }): Promise<CancellationToken> {
    this.sequence += 1;
    const token: CancellationToken & { cancelled: boolean } = {
      token: `${input.scope}-${this.sequence}`,
      reason: input.reason,
      issued_at: this.clock.nowIso8601(),
      expires_at:
        input.ttl_ms === undefined
          ? undefined
          : new Date(this.clock.nowUnixMs() + input.ttl_ms).toISOString(),
      cancelled: false
    };
    this.tokens.set(token.token, token);
    return withoutCancelled(token);
  }

  public async cancel(input: { token: string; reason?: string }): Promise<void> {
    const token = this.tokens.get(input.token);
    if (token !== undefined) {
      token.cancelled = true;
      token.reason = input.reason ?? token.reason;
    }
  }

  public async isCancelled(input: { token: string }): Promise<boolean> {
    const token = this.tokens.get(input.token);
    if (token === undefined) {
      return true;
    }
    if (token.expires_at !== undefined && Date.parse(token.expires_at) <= this.clock.nowUnixMs()) {
      token.cancelled = true;
      return true;
    }
    return token.cancelled;
  }

  public async refresh(input: { token: string; ttl_ms?: number }): Promise<void> {
    const token = this.tokens.get(input.token);
    if (token === undefined || input.ttl_ms === undefined) {
      return;
    }
    token.expires_at = new Date(this.clock.nowUnixMs() + input.ttl_ms).toISOString();
  }

  public async revokeScope(input: { scope: string }): Promise<number> {
    let revoked = 0;
    for (const token of this.tokens.values()) {
      if (token.token.startsWith(`${input.scope}-`) && !token.cancelled) {
        token.cancelled = true;
        revoked += 1;
      }
    }
    return revoked;
  }
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function withoutCancelled(token: CancellationToken & { cancelled: boolean }): CancellationToken {
  return {
    token: token.token,
    reason: token.reason,
    issued_at: token.issued_at,
    expires_at: token.expires_at
  };
}
