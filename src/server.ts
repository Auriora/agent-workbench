/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { applyWorkspaceEdit } from "./application/use-cases/apply-workspace-edit.js";
import {
  checkMarkdownDocument,
  checkMarkdownSet
} from "./application/use-cases/check-markdown-quality.js";
import { computeImpact } from "./application/use-cases/compute-impact.js";
import { diagnoseChangedFiles } from "./application/use-cases/diagnose-changed-files.js";
import { findReferences } from "./application/use-cases/find-references.js";
import { getCurrentDocsForTask } from "./application/use-cases/current-docs-for-task.js";
import {
  getIntegrationHealth,
  type IntegrationSurfaceInput
} from "./application/use-cases/get-integration-health.js";
import { getTaskContext } from "./application/use-cases/get-task-context.js";
import { getRepoOverview } from "./application/use-cases/get-repo-overview.js";
import { getRepoScope } from "./application/use-cases/get-repo-scope.js";
import { getSnapshotRepoStatus } from "./application/use-cases/get-repo-status.js";
import type { IndexRepositoryGraphResult } from "./application/use-cases/index-repository-graph.js";
import { planVerification } from "./application/use-cases/plan-verification.js";
import { processWorkspaceChangeQueue, type WorkspaceChangeQueueProcessResult } from "./application/use-cases/process-workspace-change-queue.js";
import { previewWorkspaceEdit } from "./application/use-cases/preview-workspace-edit.js";
import type { WatcherFreshnessState } from "./application/use-cases/response-metadata.js";
import { WorkspaceChangeQueue } from "./application/use-cases/workspace-change-queue.js";
import { resolveWorkspaceWatcherConfig, type WorkspaceWatcherConfig, type WorkspaceWatchHandle } from "./domain/models/index.js";
import {
  getDocsMap,
  getDocsOutline,
  getDocsOverview,
  readDocsSection,
  searchDocs
} from "./application/use-cases/query-docs.js";
import { searchSymbols } from "./application/use-cases/search-symbols.js";
import { InMemoryEditPreviewStoreAdapter } from "./infrastructure/edit-preview-store/index.js";
import { JsonSyntaxDiagnosticsProviderAdapter } from "./infrastructure/diagnostics/index.js";
import {
  FileCatalogScannerAdapter,
  FilesystemWorkspaceWatcherAdapter,
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "./infrastructure/filesystem/index.js";
import {
  MarkdownParserAdapter,
  MarkdownStructureCheckerAdapter
} from "./infrastructure/markdown/index.js";
import { InMemoryRuntimeOperationsAdapter } from "./infrastructure/runtime/index.js";
import { openGraphStore, SCHEMA_VERSION, type GraphStore } from "./infrastructure/sqlite/index.js";
import {
  createTelemetryAdapter,
  telemetryConfigFromEnv
} from "./infrastructure/telemetry/index.js";
import { SystemClockAdapter } from "./infrastructure/time/index.js";
import { createAgentWorkbenchServer as createAgentWorkbenchMcpServer } from "./interface-adapters/mcp/server.js";
import {
  mcpPrompts,
  mcpResources,
  mcpTools
} from "./interface-adapters/mcp/registries/index.js";
import {
  createRootAuthorityPolicy,
  rootAuthorityPolicyFromEnv,
  type RootAuthorityPolicy
} from "./interface-adapters/mcp/registries/root-authority.js";
import { describeCodexIntegrationProfile } from "./application/use-cases/describe-codex-integration-profile.js";
import type { IntegrationDaemonHealth } from "./contracts/index.js";

export type AgentWorkbenchServerOptions = {
  startGraphWarmup?: boolean;
  onGraphWarmupFailure?: (error: unknown) => void;
  startupWarmupDelayMs?: number;
  startupWarmupMaxFiles?: number;
  rootAuthorityPolicy?: RootAuthorityPolicy;
  graphStore?: () => Promise<GraphStore>;
  daemonDiagnostics?: () => IntegrationDaemonHealth;
  workspaceWatcher?: Partial<WorkspaceWatcherConfig>;
  workspaceWatcherIndexedRoots?: readonly string[];
  workspaceWatcherSkippedRoots?: readonly string[];
};

const DEFAULT_STARTUP_WARMUP_DELAY_MS = 1000;
const DEFAULT_STARTUP_WARMUP_MAX_FILES = 2000;
const DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_SNAPSHOTS = 3;
const DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_FRESH_SNAPSHOTS = 2;
const STARTUP_WARMUP_LOCK_FILE = "startup-warmup.lock";

export function createAgentWorkbenchServer(
  repoRoot: string,
  options: AgentWorkbenchServerOptions = {}
) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const rootAuthorityPolicy = options.rootAuthorityPolicy ?? rootAuthorityPolicyFromEnv({
    launchRoot: absoluteRepoRoot,
    env: process.env
  });
  const scanner = new FileCatalogScannerAdapter();
  const clock = new SystemClockAdapter();
  const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
  const previews = new InMemoryEditPreviewStoreAdapter();
  const diagnosticsProviders = [new JsonSyntaxDiagnosticsProviderAdapter()];
  const markdownParser = new MarkdownParserAdapter();
  const markdownChecker = new MarkdownStructureCheckerAdapter();
  const databasePath = graphStorePath(absoluteRepoRoot);
  const graphStore = options.graphStore ?? createAsyncGraphStore(databasePath);
  const telemetry = createTelemetryAdapter(telemetryConfigFromEnv());
  const workspaceWatcherConfig = resolveWorkspaceWatcherConfig(options.workspaceWatcher);
  const workspaceWatcher = new FilesystemWorkspaceWatcherAdapter();
  const workspaceChangeQueue = new WorkspaceChangeQueue({
    clock,
    config: workspaceWatcherConfig
  });
  let workspaceWatchHandle: WorkspaceWatchHandle | null = null;
  let workspaceWatcherFreshness: WatcherFreshnessState | undefined;

  async function updateWorkspaceWatcherFreshness(
    repoRoot: string,
    store: GraphStore
  ): Promise<WatcherFreshnessState | undefined> {
    if (!workspaceWatcherConfig.enabled) {
      return undefined;
    }

    try {
      if (workspaceWatchHandle === null) {
        workspaceWatchHandle = await workspaceWatcher.start({
          repo_root: repoRoot,
          paths: options.workspaceWatcherIndexedRoots ?? ["."],
          skipped_roots: options.workspaceWatcherSkippedRoots ?? [],
          enabled: workspaceWatcherConfig.enabled,
          debounce_ms: workspaceWatcherConfig.debounce_ms,
          event_budget: workspaceWatcherConfig.event_budget
        });
      }

      const events = await workspaceWatcher.poll({
        watch_id: workspaceWatchHandle.id,
        max_events: workspaceWatcherConfig.event_budget
      });
      for (const event of events) {
        workspaceChangeQueue.enqueue(event);
      }
      workspaceWatcherFreshness = watcherFreshnessFromQueueResult(
        await processWorkspaceChangeQueue({
          repo_root: repoRoot,
          queue: workspaceChangeQueue,
          snapshots: store,
          warmups: runtime,
          clock
        })
      );
    } catch (error) {
      workspaceWatcherFreshness = {
        status: "degraded",
        queue_state: "failed",
        scope_status: "unknown",
        ignore_rules_status: "unknown",
        reason: error instanceof Error ? error.message : String(error)
      };
    }
    return workspaceWatcherFreshness;
  }

  const server = createAgentWorkbenchMcpServer(absoluteRepoRoot, {
    rootAuthorityPolicy: createRootAuthorityPolicy({
      launchRoot: absoluteRepoRoot,
      debugRepoRootOverride: rootAuthorityPolicy.debugRepoRootOverride
    }),
    telemetry,
    getRepoStatus: async ({ repo_root }) => {
      const store = await graphStore();
      const watcher = await updateWorkspaceWatcherFreshness(repo_root, store);
      return getSnapshotRepoStatus({
        repo_root,
        snapshots: store,
        catalog: store,
        warmups: runtime,
        watcher
      });
    },
    getRepoScope: async ({ repo_root }) => {
      const store = await graphStore();
      return getRepoScope({
        repo_root,
        scanner,
        snapshots: store,
        warmups: runtime
      });
    },
    getRepoOverview: async ({ repo_root }) => {
      const store = await graphStore();
      return getRepoOverview({
        repo_root,
        scanner,
        snapshots: store,
        warmups: runtime
      });
    },
    getDocsOverview: ({ request }) =>
      getDocsOverview({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    getDocsMap: ({ request }) =>
      getDocsMap({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    searchDocs: async ({ request }) => {
      const store = await graphStore();
      return searchDocs({
        request,
        docs_index: store,
        default_repo_root: absoluteRepoRoot
      });
    },
    getCurrentDocsForTask: ({ request }) =>
      getCurrentDocsForTask({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    getDocsOutline: ({ request }) =>
      getDocsOutline({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    readDocsSection: ({ request }) =>
      readDocsSection({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    checkMarkdownDocument: ({ request }) =>
      checkMarkdownDocument({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        parser: markdownParser,
        checker: markdownChecker,
        default_repo_root: absoluteRepoRoot
      }),
    checkMarkdownSet: ({ request }) =>
      checkMarkdownSet({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        parser: markdownParser,
        checker: markdownChecker,
        default_repo_root: absoluteRepoRoot
      }),
    getTaskContext: async ({ request }) => {
      const store = await graphStore();
      return getTaskContext({
        request,
        scanner,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      });
    },
    diagnoseChangedFiles: ({ request }) =>
      diagnoseChangedFiles({
        request,
        scanner,
        providers: diagnosticsProviders,
        default_repo_root: absoluteRepoRoot
      }),
    searchSymbols: async ({ request }) => {
      const store = await graphStore();
      return searchSymbols({
        request,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      });
    },
    findReferences: async ({ request }) => {
      const store = await graphStore();
      return findReferences({
        request,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      });
    },
    computeImpact: async ({ request }) => {
      const store = await graphStore();
      return computeImpact({
        request,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      });
    },
    previewWorkspaceEdit: ({ request }) =>
      previewWorkspaceEdit({
        request,
        workspace: workspaceForRepoRoot(request.repo_root),
        safety: safetyForRepoRoot(request.repo_root),
        previews,
        clock,
        default_repo_root: absoluteRepoRoot
      }),
    applyWorkspaceEdit: ({ request }) =>
      applyWorkspaceEdit({
        request,
        workspace: workspaceForRepoRoot(request.repo_root),
        safety: safetyForRepoRoot(request.repo_root),
        previews,
        clock,
        default_repo_root: absoluteRepoRoot
      }),
    planVerification: ({ request }) =>
      planVerification({
        request,
        scanner,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    getIntegrationHealth: ({ request }) =>
      getIntegrationHealth({
        request,
        default_repo_root: absoluteRepoRoot,
        runtime_version: "0.1.0",
        profile: "codex",
        surfaces: registeredIntegrationSurfaces(),
        root_policy: {
          authority: "launch_root",
          debug_repo_root_override: rootAuthorityPolicy.debugRepoRootOverride
        },
        daemon: options.daemonDiagnostics?.()
      })
  });

  if (options.startGraphWarmup !== false) {
    const warmupTimer = setTimeout(
      startInitialGraphWarmup,
      options.startupWarmupDelayMs ?? DEFAULT_STARTUP_WARMUP_DELAY_MS
    );
    warmupTimer.unref?.();
  }
  return server;

  function repoRootForRequest(repoRoot: string | undefined): string {
    return path.resolve(repoRoot ?? absoluteRepoRoot);
  }

  function workspaceForRepoRoot(repoRoot: string | undefined): WorkspaceFileAdapter {
    return new WorkspaceFileAdapter({ repoRoot: repoRootForRequest(repoRoot) });
  }

  function safetyForRepoRoot(repoRoot: string | undefined): WorkspaceSafetyAdapter {
    return new WorkspaceSafetyAdapter({ repoRoot: repoRootForRequest(repoRoot) });
  }

  function startInitialGraphWarmup(): void {
    void (async () => {
      const warmupLock = acquireStartupWarmupLock(startupWarmupLockPath(databasePath));
      if (warmupLock === null) {
        return;
      }
      const store = await graphStore();
      const snapshotId = String(clock.nowUnixMs());
      const executionId = await runtime.requestWarmup({
        repo_root: absoluteRepoRoot,
        snapshot_id: snapshotId
      });
      await runtime.markOwner({
        execution_id: executionId,
        owner_id: "agent-workbench:mcp-startup",
      });
      try {
        const result = await runStartupGraphWarmupWorker({
          repoRoot: absoluteRepoRoot,
          databasePath,
          snapshotId,
          configIdentity: "default",
          maxFiles: options.startupWarmupMaxFiles ?? DEFAULT_STARTUP_WARMUP_MAX_FILES,
          retainLatestSnapshots: DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_SNAPSHOTS,
          retainLatestFreshSnapshots: DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_FRESH_SNAPSHOTS,
          vacuum: true
        });
        const files = await store.listFiles({
          snapshot_id: result.snapshot_id,
          max_rows: options.startupWarmupMaxFiles ?? DEFAULT_STARTUP_WARMUP_MAX_FILES
        });
        await runtime.set({
          namespace: "warmup",
          key: `graph:${absoluteRepoRoot}`,
          value: result,
          depends_on_snapshot_id: result.snapshot_id,
          depends_on_config_identity: "default",
          depends_on_file_hashes: files.map((file) => ({
            path: file.path,
            content_hash: file.file_identity.content_hash
          }))
        });
        await runtime.completeWarmup({
          execution_id: executionId,
          success: true
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await store.markSnapshotFreshness({
          snapshot_id: snapshotId,
          freshness: "cold",
          owner_state: "dead_owner",
          reason
        });
        await runtime.completeWarmup({
          execution_id: executionId,
          success: false,
          reason
        });
        throw error;
      } finally {
        warmupLock.release();
      }
    })().catch((error) => {
      // The warmup use case records failed snapshot/warmup state before throwing.
      if (options.onGraphWarmupFailure !== undefined) {
        options.onGraphWarmupFailure(error);
        return;
      }
      console.error(
        `Agent Workbench startup graph warmup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }
}

function runStartupGraphWarmupWorker(input: {
  repoRoot: string;
  databasePath: string;
  snapshotId: string;
  configIdentity: string;
  maxFiles: number;
  retainLatestSnapshots: number;
  retainLatestFreshSnapshots: number;
  vacuum: boolean;
}): Promise<IndexRepositoryGraphResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./infrastructure/workers/startup-graph-warmup-worker-entrypoint.mjs", import.meta.url),
      {
        workerData: input
      }
    );
    worker.unref();
    let settled = false;

    worker.once("message", (message: unknown) => {
      settled = true;
      try {
        resolve(readStartupGraphWarmupResult(message));
      } catch (error) {
        reject(error);
      }
    });
    worker.once("error", (error) => {
      settled = true;
      reject(error);
    });
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        reject(new Error(`Startup graph warmup worker exited with code ${code}.`));
      }
    });
  });
}

function readStartupGraphWarmupResult(message: unknown): IndexRepositoryGraphResult {
  if (
    typeof message !== "object" ||
    message === null ||
    !("type" in message) ||
    (message as { type?: unknown }).type !== "complete" ||
    !("result" in message)
  ) {
    throw new Error("Startup graph warmup worker returned an invalid result.");
  }
  return (message as { result: IndexRepositoryGraphResult }).result;
}

export function createAsyncGraphStore(databasePath: string): () => Promise<GraphStore> {
  let graphStore: Promise<GraphStore> | undefined;
  return () => {
    graphStore ??= Promise.resolve().then(() => openGraphStore(databasePath));
    return graphStore;
  };
}

function watcherFreshnessFromQueueResult(
  result: WorkspaceChangeQueueProcessResult
): WatcherFreshnessState {
  if (result.status === "idle") {
    return {
      status: "fresh",
      queue_state: "drained",
      scope_status: "synchronized",
      ignore_rules_status: "synchronized"
    };
  }

  if (result.status === "degraded") {
    return {
      status: "degraded",
      queue_state: "failed",
      scope_status: "unknown",
      ignore_rules_status: "unknown",
      reason: result.reason
    };
  }

  return {
    status: "refreshing",
    queue_state: "pending",
    scope_status: "synchronized",
    ignore_rules_status: "synchronized",
    reason:
      result.status === "stale_rescan_scheduled"
        ? "Workspace watcher scheduled bounded rescan."
        : undefined
  };
}

export function graphStorePath(repoRoot: string): string {
  const cacheDir = path.join(repoRoot, ".cache", "agent-workbench");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "graph.sqlite");
}

function startupWarmupLockPath(databasePath: string): string {
  return path.join(path.dirname(databasePath), STARTUP_WARMUP_LOCK_FILE);
}

function acquireStartupWarmupLock(lockPath: string): { release: () => void } | null {
  try {
    return createStartupWarmupLock(lockPath);
  } catch (error) {
    if (!isFileExistsError(error)) {
      throw error;
    }
  }

  if (!startupWarmupLockIsStale(lockPath)) {
    return null;
  }

  try {
    fs.rmSync(lockPath, { force: true });
    return createStartupWarmupLock(lockPath);
  } catch (error) {
    if (isFileExistsError(error)) {
      return null;
    }
    throw error;
  }
}

function createStartupWarmupLock(lockPath: string): { release: () => void } {
  const fd = fs.openSync(lockPath, "wx");
  let released = false;
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
  } finally {
    fs.closeSync(fd);
  }

  return {
    release: () => {
      if (released) {
        return;
      }
      released = true;
      try {
        fs.rmSync(lockPath, { force: true });
      } catch {
        // The lock only coordinates startup warmup ownership; release failure
        // must not mask the completed MCP request path.
      }
    }
  };
}

function startupWarmupLockIsStale(lockPath: string): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return true;
  }

  const pid =
    typeof payload === "object" && payload !== null && "pid" in payload
      ? (payload as { pid?: unknown }).pid
      : undefined;
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return true;
  }

  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    return code === "ESRCH";
  }
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}

function registeredIntegrationSurfaces(): IntegrationSurfaceInput[] {
  const profile = describeCodexIntegrationProfile();
  const advertised = new Set(
    profile.mcp_bindings.map((binding) => `${binding.kind}:${binding.name}`)
  );

  return [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => {
    const key = `${surface.kind}:${surface.name}`;
    return {
      name: surface.name,
      kind: surface.kind,
      uri: "uri" in surface ? surface.uri : undefined,
      configured: advertised.has(key),
      registered: true,
      advertised: advertised.has(key),
      capability_class: surface.metadata.capability_class
    };
  });
}
