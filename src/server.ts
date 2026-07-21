/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
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
import { getRepoOrientation } from "./application/use-cases/get-repo-orientation.js";
import { getRepoScope } from "./application/use-cases/get-repo-scope.js";
import { getSnapshotRepoStatus } from "./application/use-cases/get-repo-status.js";
import {
  DEFAULT_SNAPSHOT_VALIDITY_MAX_PATHS,
  SnapshotValidityService
} from "./application/use-cases/validate-snapshot-paths.js";
import { planVerification } from "./application/use-cases/plan-verification.js";
import { processWorkspaceChangeQueue, type WorkspaceChangeQueueProcessResult } from "./application/use-cases/process-workspace-change-queue.js";
import {
  RepositoryRefreshTriggerCoordinator,
  type RepositoryRefreshTriggerPort
} from "./application/use-cases/repository-refresh-triggers.js";
import { previewWorkspaceEdit } from "./application/use-cases/preview-workspace-edit.js";
import type { WatcherFreshnessState } from "./application/use-cases/response-metadata.js";
import { WorkspaceChangeQueue } from "./application/use-cases/workspace-change-queue.js";
import { resolveWorkspaceWatcherConfig, type WorkspaceWatcherConfig, type WorkspaceWatchHandle } from "./domain/models/index.js";
import {
  getDocsMap,
  getDocsOutline,
  getDocsOverview,
  rankedDocsSnapshotUnavailable,
  readDocsSection,
  searchRankedDocs
} from "./application/use-cases/query-docs.js";
import { searchSymbols } from "./application/use-cases/search-symbols.js";
import { InMemoryEditPreviewStoreAdapter } from "./infrastructure/edit-preview-store/index.js";
import { JsonSyntaxDiagnosticsProviderAdapter } from "./infrastructure/diagnostics/index.js";
import {
  FileCatalogScannerAdapter,
  FilesystemSnapshotPathValidatorAdapter,
  FilesystemWorkspaceWatcherAdapter,
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "./infrastructure/filesystem/index.js";
import {
  MarkdownParserAdapter,
  MarkdownStructureCheckerAdapter
} from "./infrastructure/markdown/index.js";
import {
  createDocsRankingCursorCodec,
  createReferenceCursorCodec,
  InMemoryRuntimeOperationsAdapter,
  SnapshotRefreshController
} from "./infrastructure/runtime/index.js";
import {
  FileRepositoryOwnershipAdapter,
  LazyOwnershipGatedRefreshAuthority
} from "./infrastructure/runtime/repository-ownership.js";
import { StartupGraphRefreshExecutor } from "./infrastructure/runtime/startup-graph-refresh-executor.js";
import { openGraphStore, SCHEMA_VERSION, type GraphStore } from "./infrastructure/sqlite/index.js";
import {
  graphStorePath,
  retireLegacyGraphStore
} from "./infrastructure/sqlite/graph-store-location.js";
import {
  createTelemetryAdapter,
  telemetryConfigFromEnv
} from "./infrastructure/telemetry/index.js";
import { SystemClockAdapter } from "./infrastructure/time/index.js";
import { createAgentWorkbenchServer as createAgentWorkbenchMcpServer } from "./interface-adapters/mcp/server.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "./runtime/version.js";
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
import type { IntegrationLauncherIdentity, RankedDocsSearchResult } from "./contracts/index.js";
import type {
  DocsRankingCursorCodecPort,
  RepositoryOwnershipLease,
  ReferenceCursorCodecPort,
  TelemetryRecorderPort,
  SnapshotPublicationPort,
  SnapshotRefreshAdmissionFailurePort,
  SnapshotRefreshControllerPort,
  SnapshotRefreshDiagnosticsPort,
  WorkspaceWatcherPort,
  ClockPort,
  WarmupCoordinatorPort
} from "./ports/index.js";

export type AgentWorkbenchSharedRepositoryServices = {
  refreshController: SnapshotRefreshControllerPort;
  refreshDiagnostics: SnapshotRefreshDiagnosticsPort;
  refreshTriggers: RepositoryRefreshTriggerPort;
  graphStore: () => Promise<GraphStore>;
  referenceCursorCodec: ReferenceCursorCodecPort;
  docsRankingCursorCodec: DocsRankingCursorCodecPort;
  pollWorkspaceWatcher(): Promise<WatcherFreshnessState | undefined>;
  registerDisposer(dispose: () => void | Promise<void>): () => void;
};

export type AsyncGraphStore = (() => Promise<GraphStore>) & {
  close(): Promise<void>;
};

export type AgentWorkbenchDaemonHealthFacts = {
  pid: number;
  socket_path: string;
  repo_root: string;
  connected_clients: number;
};

export type AgentWorkbenchServerOptions = {
  startupRefreshDelayMs?: number;
  startupWarmupMaxFiles?: number;
  rootAuthorityPolicy?: RootAuthorityPolicy;
  graphStore?: () => Promise<GraphStore>;
  referenceCursorCodec?: ReferenceCursorCodecPort;
  docsRankingCursorCodec?: DocsRankingCursorCodecPort;
  telemetry?: TelemetryRecorderPort;
  daemonDiagnostics?: () => AgentWorkbenchDaemonHealthFacts;
  integrationIdentity?: IntegrationLauncherIdentity;
  workspaceWatcher?: Partial<WorkspaceWatcherConfig>;
  workspaceWatcherIndexedRoots?: readonly string[];
  workspaceWatcherSkippedRoots?: readonly string[];
  sharedRepositoryServices?: AgentWorkbenchSharedRepositoryServices;
};

const DEFAULT_STARTUP_WARMUP_DELAY_MS = 1000;
const DEFAULT_STARTUP_WARMUP_MAX_FILES = 2000;
const DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_SNAPSHOTS = 3;
const DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_FRESH_SNAPSHOTS = 2;

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
  const graphStore = options.sharedRepositoryServices?.graphStore ??
    options.graphStore ?? createAsyncGraphStore(databasePath);
  const referenceCursorCodec = options.sharedRepositoryServices?.referenceCursorCodec ??
    options.referenceCursorCodec ?? createReferenceCursorCodec();
  const docsRankingCursorCodec = options.sharedRepositoryServices?.docsRankingCursorCodec ??
    options.docsRankingCursorCodec ?? createDocsRankingCursorCodec();
  const localRefreshAuthority = options.sharedRepositoryServices === undefined
    ? createStandaloneRefreshAuthority({
        repoRoot: absoluteRepoRoot,
        graphStore,
        databasePath,
        maxFiles: options.startupWarmupMaxFiles ?? DEFAULT_STARTUP_WARMUP_MAX_FILES,
        clock
      })
    : undefined;
  const refreshAuthority: SnapshotRefreshControllerPort =
    options.sharedRepositoryServices?.refreshController ?? localRefreshAuthority!;
  const publication = createAsyncPublicationPort(graphStore);
  const refreshTriggers = options.sharedRepositoryServices?.refreshTriggers ??
    new RepositoryRefreshTriggerCoordinator({
      repo_root: absoluteRepoRoot,
      controller: refreshAuthority,
      publications: publication,
      snapshots: {
        async markSnapshotFreshness(request) {
          await (await graphStore()).markSnapshotFreshness(request);
        }
      }
    });
  const warmupView = controllerWarmupView(refreshAuthority, absoluteRepoRoot, clock);
  const telemetry = options.telemetry ?? createTelemetryAdapter(telemetryConfigFromEnv());
  const workspaceWatcherConfig = resolveWorkspaceWatcherConfig(options.workspaceWatcher);
  const localWorkspaceRefresh = options.sharedRepositoryServices === undefined
    ? createRepositoryWorkspaceRefreshService({
        repoRoot: absoluteRepoRoot,
        triggers: refreshTriggers,
        watcher: new FilesystemWorkspaceWatcherAdapter(),
        clock,
        config: workspaceWatcherConfig,
        indexedRoots: options.workspaceWatcherIndexedRoots ?? ["."],
        skippedRoots: options.workspaceWatcherSkippedRoots ?? []
      })
    : undefined;
  const pollWorkspaceWatcher = options.sharedRepositoryServices?.pollWorkspaceWatcher ??
    (() => localWorkspaceRefresh!.poll());

  async function selectValidatedSnapshot(repoRoot: string, store: GraphStore, snapshotId?: string) {
    const selection = snapshotId === undefined
      ? await store.getLatestPublished({ repo_root: repoRoot })
      : await store.readExplicit({ repo_root: repoRoot, snapshot_id: snapshotId });
    if (selection.status === "blocked") {
      return { snapshot_id: snapshotId, validity: undefined };
    }
    if (selection.status === "missing") {
      return { snapshot_id: null, validity: undefined };
    }
    const snapshot = selection.snapshot;
    const validity = await new SnapshotValidityService(
      store,
      new FilesystemSnapshotPathValidatorAdapter({ repoRoot }),
      store
    ).validate({ snapshot, max_paths: DEFAULT_SNAPSHOT_VALIDITY_MAX_PATHS });
    let refreshBlocker: WatcherFreshnessState | undefined;
    if (validity.state === "stale" && snapshotId === undefined) {
      try {
        const admission = await refreshTriggers.staleFirstRead({
          source: validity.reason ?? "first-read-validity",
          visible_snapshot_id: snapshot.id
        });
        if (admission.outcome === "blocked") {
          refreshBlocker = {
            status: "degraded",
            queue_state: "failed",
            scope_status: "unknown",
            ignore_rules_status: "unknown",
            reason: admission.message,
            refresh_admission: admission
          };
        }
      } catch {
        refreshBlocker = {
          status: "degraded",
          queue_state: "failed",
          scope_status: "unknown",
          ignore_rules_status: "unknown",
          reason: "Repository refresh trigger failed."
        };
      }
    }
    return { snapshot_id: snapshot.id, validity, refresh_blocker: refreshBlocker };
  }

  const server = createAgentWorkbenchMcpServer(absoluteRepoRoot, {
    rootAuthorityPolicy: createRootAuthorityPolicy({
      launchRoot: absoluteRepoRoot,
      debugRepoRootOverride: rootAuthorityPolicy.debugRepoRootOverride
    }),
    telemetry,
    launcherIdentity: options.integrationIdentity,
    getRepoStatus: async ({ repo_root }) => {
      const store = await graphStore();
      const watcher = await pollWorkspaceWatcher();
      const selected = await selectValidatedSnapshot(repo_root, store);
      return getSnapshotRepoStatus({
        repo_root,
        snapshots: store,
        catalog: store,
        documentation_concerns: store,
        warmups: warmupView,
        watcher: selected.refresh_blocker ?? watcher,
        selected_snapshot_id: selected.snapshot_id,
        snapshot_validity: selected.validity
      });
    },
    getRepoOrientation: async ({ repo_root }) => {
      const store = await graphStore();
      const watcher = await pollWorkspaceWatcher();
      const selected = await selectValidatedSnapshot(repo_root, store);
      return getRepoOrientation(await getSnapshotRepoStatus({
        repo_root,
        snapshots: store,
        catalog: store,
        documentation_concerns: store,
        warmups: warmupView,
        watcher: selected.refresh_blocker ?? watcher,
        selected_snapshot_id: selected.snapshot_id,
        snapshot_validity: selected.validity
      }));
    },
    getRepoScope: async ({ repo_root }) => {
      const store = await graphStore();
      return getRepoScope({
        repo_root,
        scanner,
        snapshots: store,
        warmups: warmupView
      });
    },
    getRepoOverview: async ({ repo_root }) => {
      const store = await graphStore();
      return getRepoOverview({
        repo_root,
        scanner,
        snapshots: store,
        warmups: warmupView
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
    searchRankedDocs: async ({ request }) => {
      const store = await graphStore();
      const selected = await selectValidatedSnapshot(
        request.repo_root ?? absoluteRepoRoot,
        store
      );
      if (selected.snapshot_id === null || selected.snapshot_id === undefined ||
          selected.validity === undefined || selected.validity.state !== "valid") {
        const result = rankedDocsSnapshotUnavailable({
          request,
          default_repo_root: absoluteRepoRoot,
          message: selected.validity?.reason ??
            "A valid selected documentation snapshot is required before ranked search."
        });
        telemetry.record("docs.ranking.result", rankedDocsTelemetryAttributes(result));
        return result;
      }
      const result = await searchRankedDocs({
        request,
        docs_index: store,
        documentation_concerns: store,
        ranking_candidates: store,
        ranking_cursor_codec: docsRankingCursorCodec,
        ranked_universes: store,
        selected_snapshot_id: selected.snapshot_id,
        default_repo_root: absoluteRepoRoot,
        now_iso8601: clock.nowIso8601(),
        universe_id: randomUUID()
      });
      telemetry.record("docs.ranking.result", rankedDocsTelemetryAttributes(result));
      return result;
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
      const selected = await selectValidatedSnapshot(
        request.repo_root ?? absoluteRepoRoot,
        store
      );
      return getTaskContext({
        request,
        scanner,
        graph: store,
        snapshots: store,
        catalog: store,
        snapshot_validity: selected.validity,
        selected_snapshot_id: selected.snapshot_id,
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
      const selected = await selectValidatedSnapshot(
        request.repo_root ?? absoluteRepoRoot,
        store,
        request.snapshot_id
      );
      return searchSymbols({
        request,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: workspaceForRepoRoot(request.repo_root),
        snapshot_validity: selected.validity,
        selected_snapshot_id: selected.snapshot_id,
        default_repo_root: absoluteRepoRoot
      });
    },
    findReferences: async ({ request }) => {
      const store = await graphStore();
      const selected = await selectValidatedSnapshot(
        request.repo_root ?? absoluteRepoRoot,
        store,
        request.snapshot_id
      );
      return findReferences({
        request,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: workspaceForRepoRoot(request.repo_root),
        workspace_safety: safetyForRepoRoot(request.repo_root),
        cursor_codec: referenceCursorCodec,
        snapshot_validity: selected.validity,
        selected_snapshot_id: selected.snapshot_id,
        default_repo_root: absoluteRepoRoot
      });
    },
    computeImpact: async ({ request }) => {
      const store = await graphStore();
      const selected = await selectValidatedSnapshot(
        request.repo_root ?? absoluteRepoRoot,
        store,
        request.snapshot_id
      );
      return computeImpact({
        request,
        graph: store,
        snapshots: store,
        catalog: store,
        workspace: workspaceForRepoRoot(request.repo_root),
        snapshot_validity: selected.validity,
        selected_snapshot_id: selected.snapshot_id,
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
    getIntegrationHealth: ({ request, connection_identity }) =>
      getIntegrationHealth({
        request,
        default_repo_root: absoluteRepoRoot,
        runtime_version: AGENT_WORKBENCH_RUNTIME_VERSION,
        profile: connection_identity?.provider_identity.provider ?? "unknown",
        connection_identity,
        surfaces: registeredIntegrationSurfaces(),
        root_policy: {
          authority: "launch_root",
          debug_repo_root_override: rootAuthorityPolicy.debugRepoRootOverride
        },
        daemon: options.daemonDiagnostics === undefined || options.sharedRepositoryServices === undefined
          ? undefined
          : {
              ...options.daemonDiagnostics(),
              diagnostics: options.sharedRepositoryServices.refreshDiagnostics
            }
      })
  });

  const localStartupTimer = options.sharedRepositoryServices === undefined
    ? setTimeout(() => {
        void refreshTriggers.startup({ source: "standalone-startup" }).catch(() => undefined);
      }, options.startupRefreshDelayMs ?? DEFAULT_STARTUP_WARMUP_DELAY_MS)
    : undefined;
  localStartupTimer?.unref?.();

  if (localRefreshAuthority !== undefined) {
    const closeServer = server.close.bind(server);
    server.close = async () => {
      await closeServer();
      if (localStartupTimer !== undefined) clearTimeout(localStartupTimer);
      await localWorkspaceRefresh?.close();
      await localRefreshAuthority.close();
      if ("close" in graphStore && typeof graphStore.close === "function") {
        await graphStore.close();
      }
    };
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

}

export function rankedDocsTelemetryAttributes(result: RankedDocsSearchResult): Record<string, unknown> {
  const counts = "counts" in result ? result.counts : undefined;
  return {
    outcome: result.trust_state,
    status: result.status,
    blocker: "blocker" in result ? result.blocker : undefined,
    returned_page_documents_count: counts?.returned_page_documents_count ?? 0,
    fts_candidate_documents_count: counts !== undefined && "fts_candidate_documents_count" in counts
      ? counts.fts_candidate_documents_count
      : undefined,
    fts_candidate_count_lower_bound: counts !== undefined && "fts_candidate_count_lower_bound" in counts
      ? counts.fts_candidate_count_lower_bound
      : undefined,
    matched_owner_candidate_documents_count:
      counts !== undefined && "matched_owner_candidate_documents_count" in counts
        ? counts.matched_owner_candidate_documents_count
        : undefined,
    matched_owner_candidate_count_lower_bound:
      counts !== undefined && "matched_owner_candidate_count_lower_bound" in counts
        ? counts.matched_owner_candidate_count_lower_bound
        : undefined,
    candidate_union_documents_count: counts !== undefined && "candidate_union_documents_count" in counts
      ? counts.candidate_union_documents_count
      : undefined,
    candidate_union_count_lower_bound: counts !== undefined && "candidate_union_count_lower_bound" in counts
      ? counts.candidate_union_count_lower_bound
      : undefined,
    ranked_candidate_universe_count: counts !== undefined && "ranked_candidate_universe_count" in counts
      ? counts.ranked_candidate_universe_count
      : undefined,
    page_truncated: result.truncated,
    has_cursor: "cursor" in result && result.cursor !== undefined
  };
}

export function createAsyncGraphStore(databasePath: string): AsyncGraphStore {
  let graphStore: Promise<GraphStore> | undefined;
  let closePromise: Promise<void> | undefined;
  const load = (() => {
    graphStore ??= Promise.resolve().then(() => openGraphStore(databasePath));
    return graphStore;
  }) as AsyncGraphStore;
  load.close = async () => {
    if (graphStore === undefined) return;
    closePromise ??= graphStore.then((store) => store.close(), () => undefined);
    await closePromise;
  };
  return load;
}

export async function createRepositoryRefreshController(input: {
  repoRoot: string;
  graphStore: () => Promise<GraphStore>;
  databasePath: string;
  controllerGeneration: number;
  maxFiles: number;
}): Promise<SnapshotRefreshControllerPort & SnapshotRefreshDiagnosticsPort & SnapshotRefreshAdmissionFailurePort> {
  const publication = createAsyncPublicationPort(input.graphStore);
  return new SnapshotRefreshController({
    repo_root: input.repoRoot,
    controller_generation: input.controllerGeneration,
    timeout_ms: 60_000,
    clock: new SystemClockAdapter(),
    publication,
    executor: new StartupGraphRefreshExecutor({
      database_path: input.databasePath,
      config_identity: "default",
      max_files: input.maxFiles,
      retain_latest_snapshots: DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_SNAPSHOTS,
      retain_latest_fresh_snapshots: DEFAULT_STARTUP_WARMUP_RETAIN_LATEST_FRESH_SNAPSHOTS,
      controller_generation: input.controllerGeneration
    })
  });
}

export function createAsyncPublicationPort(
  graphStore: () => Promise<GraphStore>
): SnapshotPublicationPort {
  return {
    async allocateBuildSnapshotId(request) {
      return await (await graphStore()).allocateBuildSnapshotId(request);
    },
    async transitionBuild(request) {
      return await (await graphStore()).transitionBuild(request);
    },
    async getLatestPublished(request) {
      return await (await graphStore()).getLatestPublished(request);
    },
    async readExplicit(request) {
      return await (await graphStore()).readExplicit(request);
    }
  };
}

export function createRepositoryWorkspaceRefreshService(input: {
  repoRoot: string;
  triggers: RepositoryRefreshTriggerPort;
  watcher: WorkspaceWatcherPort;
  clock: ClockPort;
  config: WorkspaceWatcherConfig;
  indexedRoots: readonly string[];
  skippedRoots: readonly string[];
  pollIntervalMs?: number;
  schedulePoll?: (input: {
    delay_ms: number;
    callback: () => void;
  }) => { cancel(): void };
}) {
  const queue = new WorkspaceChangeQueue({ clock: input.clock, config: input.config });
  let handle: WorkspaceWatchHandle | null = null;
  let freshness: WatcherFreshnessState | undefined;
  let pollTail: Promise<void> = Promise.resolve();
  let closed = false;
  let scheduledPoll: { cancel(): void } | undefined;

  async function poll(): Promise<WatcherFreshnessState | undefined> {
    const prior = pollTail;
    let release!: () => void;
    pollTail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try {
      if (!input.config.enabled || closed) return undefined;
      handle ??= await input.watcher.start({
        repo_root: input.repoRoot,
        paths: input.indexedRoots,
        skipped_roots: input.skippedRoots,
        enabled: true,
        debounce_ms: input.config.debounce_ms,
        event_budget: input.config.event_budget
      });
      const events = await input.watcher.poll({
        watch_id: handle.id,
        max_events: input.config.event_budget
      });
      for (const event of events) queue.enqueue(event);
      if (
        events.length === 0 &&
        freshness?.status === "refreshing" &&
        await input.triggers.hasPendingGeneration()
      ) return freshness;
      freshness = watcherFreshnessFromQueueResult(await processWorkspaceChangeQueue({
        repo_root: input.repoRoot,
        queue,
        triggers: input.triggers
      }));
      return freshness;
    } catch {
      freshness = {
        status: "degraded",
        queue_state: "failed",
        scope_status: "unknown",
        ignore_rules_status: "unknown",
        reason: "Workspace watcher processing failed."
      };
      return freshness;
    } finally {
      release();
    }
  }

  const schedulePoll = input.schedulePoll ?? scheduleRepositoryWatcherPoll;
  const pollIntervalMs = input.pollIntervalMs ?? Math.max(25, input.config.debounce_ms);

  function scheduleNextPoll(): void {
    if (!input.config.enabled || closed) return;
    scheduledPoll = schedulePoll({
      delay_ms: pollIntervalMs,
      callback: () => {
        scheduledPoll = undefined;
        void poll().finally(scheduleNextPoll);
      }
    });
  }

  scheduleNextPoll();

  return {
    poll,
    async close(): Promise<void> {
      closed = true;
      scheduledPoll?.cancel();
      scheduledPoll = undefined;
      await pollTail;
      if (handle !== null) {
        await input.watcher.stop({ watch_id: handle.id });
        handle = null;
      }
    }
  };
}

function scheduleRepositoryWatcherPoll(input: {
  delay_ms: number;
  callback: () => void;
}): { cancel(): void } {
  const timer = setTimeout(input.callback, input.delay_ms);
  timer.unref?.();
  return { cancel: () => clearTimeout(timer) };
}

function createStandaloneRefreshAuthority(input: {
  repoRoot: string;
  graphStore: () => Promise<GraphStore>;
  databasePath: string;
  maxFiles: number;
  clock: SystemClockAdapter;
}): LazyOwnershipGatedRefreshAuthority {
  const ownerGeneration = input.clock.nowUnixMs();
  let recoveredSnapshotIds: readonly string[] = [];
  let recoveryLease: (RepositoryOwnershipLease & { state: "active" }) | undefined;
  const ownership = new FileRepositoryOwnershipAdapter(repositoryOwnershipPath(input.databasePath));
  return new LazyOwnershipGatedRefreshAuthority({
    ownership,
    ownership_request: {
      repo_root: input.repoRoot,
      runtime_identity: `${AGENT_WORKBENCH_RUNTIME_VERSION}:${SCHEMA_VERSION}`,
      schema_version: SCHEMA_VERSION,
      owner_id: `standalone:${process.pid}:${ownerGeneration}`,
      owner_pid: process.pid,
      owner_generation: ownerGeneration,
      heartbeat_at: input.clock.nowIso8601()
    },
    prepare_controller: async (admission) => {
      const store = await input.graphStore();
      retireLegacyGraphStore(input.databasePath);
      const result = await store.reconcileOrphanedBuilds({
        repo_root: input.repoRoot,
        current_owner: admission.lease,
        recovered_owners: admission.recovered_owners,
        updated_at: input.clock.nowIso8601()
      });
      recoveredSnapshotIds = result.outcome === "reconciled" ? result.snapshot_ids : [];
      recoveryLease = result.outcome === "reconciled" ? admission.lease : undefined;
      return result.outcome === "blocked" ? "ownership_ambiguous" : "ready";
    },
    create_controller: async () => {
      const controller = await createRepositoryRefreshController({
        repoRoot: input.repoRoot,
        graphStore: input.graphStore,
        databasePath: input.databasePath,
        controllerGeneration: ownerGeneration,
        maxFiles: input.maxFiles
      });
      if (recoveredSnapshotIds[0] !== undefined) {
        await controller.recordAdmissionFailure({
          repo_root: input.repoRoot,
          invalidation_generation: 0,
          code: "orphaned_build",
          target_snapshot_id: recoveredSnapshotIds[0]
        });
      }
      if (recoveryLease !== undefined) {
        await ownership.confirmRecovery({ lease: recoveryLease });
      }
      return controller;
    }
  });
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

export { graphStorePath } from "./infrastructure/sqlite/graph-store-location.js";

export function repositoryOwnershipPath(databasePath: string): string {
  return path.join(path.dirname(databasePath), "refresh-owner.json");
}

function controllerWarmupView(
  controller: SnapshotRefreshControllerPort,
  repoRoot: string,
  clock: ClockPort
): WarmupCoordinatorPort {
  return {
    async getState() {
      const receipt = controller.getReceipt();
      if (
        receipt.execution_state === "idle" ||
        receipt.execution_id === undefined ||
        receipt.target_snapshot_id === undefined
      ) return null;
      return {
        execution_id: receipt.execution_id,
        repo_root: repoRoot,
        snapshot_id: receipt.target_snapshot_id,
        state: receipt.execution_state,
        owner_id: `controller:${receipt.controller_generation}`,
        queued_jobs: receipt.execution_state === "planned" || receipt.execution_state === "running" ? 1 : 0,
        started_at: clock.nowIso8601(),
        updated_at: clock.nowIso8601(),
        reason: receipt.last_failure?.message
      };
    },
    async requestWarmup() { throw new Error("Warm-up requests must use SnapshotRefreshPort."); },
    async markOwner() { throw new Error("Warm-up ownership is controller-owned."); },
    async completeWarmup() { throw new Error("Warm-up completion is controller-owned."); }
  };
}


function registeredIntegrationSurfaces(): IntegrationSurfaceInput[] {
  return [...mcpResources, ...mcpTools, ...mcpPrompts].map((surface) => {
    return {
      name: surface.name,
      kind: surface.kind,
      uri: "uri" in surface ? surface.uri : undefined,
      configured: true,
      registered: true,
      advertised: true,
      capability_class: surface.metadata.capability_class
    };
  });
}
