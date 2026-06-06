import fs from "node:fs";
import path from "node:path";
import { applyWorkspaceEdit } from "./application/use-cases/apply-workspace-edit.js";
import { computeImpact } from "./application/use-cases/compute-impact.js";
import { diagnoseChangedFiles } from "./application/use-cases/diagnose-changed-files.js";
import { findReferences } from "./application/use-cases/find-references.js";
import { getTaskContext } from "./application/use-cases/get-task-context.js";
import { getRepoOverview } from "./application/use-cases/get-repo-overview.js";
import { getRepoScope } from "./application/use-cases/get-repo-scope.js";
import { getSnapshotRepoStatus } from "./application/use-cases/get-repo-status.js";
import { warmupRepositoryGraph } from "./application/use-cases/index-repository-graph.js";
import { planVerification } from "./application/use-cases/plan-verification.js";
import { previewWorkspaceEdit } from "./application/use-cases/preview-workspace-edit.js";
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
  ExtractorRegistryAdapter,
  ResourceExtractorAdapter
} from "./infrastructure/extraction/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "./infrastructure/filesystem/index.js";
import { InMemoryRuntimeOperationsAdapter } from "./infrastructure/runtime/index.js";
import { openGraphStore, SCHEMA_VERSION } from "./infrastructure/sqlite/index.js";
import {
  createTelemetryAdapter,
  telemetryConfigFromEnv
} from "./infrastructure/telemetry/index.js";
import {
  CppDeclarationExtractorAdapter,
  GoDeclarationExtractorAdapter,
  PythonTreeSitterExtractorAdapter
} from "./infrastructure/tree-sitter/index.js";
import { SystemClockAdapter } from "./infrastructure/time/index.js";
import { createAgentWorkbenchServer as createAgentWorkbenchMcpServer } from "./interface-adapters/mcp/server.js";

export type AgentWorkbenchServerOptions = {
  startGraphWarmup?: boolean;
};

export function createAgentWorkbenchServer(
  repoRoot: string,
  options: AgentWorkbenchServerOptions = {}
) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const scanner = new FileCatalogScannerAdapter();
  const clock = new SystemClockAdapter();
  const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
  const previews = new InMemoryEditPreviewStoreAdapter();
  const diagnosticsProviders = [new JsonSyntaxDiagnosticsProviderAdapter()];
  const graphStore = openGraphStore(graphStorePath(absoluteRepoRoot));
  const extractors = new ExtractorRegistryAdapter();
  extractors.register(new CppDeclarationExtractorAdapter({ language: "c" }));
  extractors.register(new CppDeclarationExtractorAdapter({ language: "cpp" }));
  extractors.register(new GoDeclarationExtractorAdapter());
  extractors.register(new PythonTreeSitterExtractorAdapter());
  const resourceExtractor = new ResourceExtractorAdapter();
  const telemetry = createTelemetryAdapter(telemetryConfigFromEnv());
  const server = createAgentWorkbenchMcpServer(absoluteRepoRoot, {
    telemetry,
    getRepoStatus: ({ repo_root }) =>
      getSnapshotRepoStatus({
        repo_root,
        snapshots: graphStore,
        catalog: graphStore,
        warmups: runtime
      }),
    getRepoScope: ({ repo_root }) =>
      getRepoScope({
        repo_root,
        scanner,
        snapshots: graphStore,
        warmups: runtime
      }),
    getRepoOverview: ({ repo_root }) =>
      getRepoOverview({
        repo_root,
        scanner,
        snapshots: graphStore,
        warmups: runtime
      }),
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
    searchDocs: ({ request }) =>
      searchDocs({
        request,
        docs_index: graphStore,
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
    getTaskContext: ({ request }) =>
      getTaskContext({
        request,
        scanner,
        graph: graphStore,
        snapshots: graphStore,
        catalog: graphStore,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    diagnoseChangedFiles: ({ request }) =>
      diagnoseChangedFiles({
        request,
        scanner,
        providers: diagnosticsProviders,
        default_repo_root: absoluteRepoRoot
      }),
    searchSymbols: ({ request }) =>
      searchSymbols({
        request,
        graph: graphStore,
        snapshots: graphStore,
        catalog: graphStore,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    findReferences: ({ request }) =>
      findReferences({
        request,
        graph: graphStore,
        snapshots: graphStore,
        catalog: graphStore,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
    computeImpact: ({ request }) =>
      computeImpact({
        request,
        graph: graphStore,
        snapshots: graphStore,
        catalog: graphStore,
        workspace: workspaceForRepoRoot(request.repo_root),
        default_repo_root: absoluteRepoRoot
      }),
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
      })
  });

  if (options.startGraphWarmup !== false) {
    setImmediate(startInitialGraphWarmup);
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
    void warmupRepositoryGraph({
      repo_root: absoluteRepoRoot,
      scanner,
      workspace: workspaceForRepoRoot(absoluteRepoRoot),
      extractors,
      resource_extractor: resourceExtractor,
      graph: graphStore,
      catalog: graphStore,
      docs_index: graphStore,
      snapshots: graphStore,
      warmups: runtime,
      cache: runtime,
      clock,
      schema_version: SCHEMA_VERSION,
      owner_id: "agent-workbench:mcp-startup",
      config_identity: "default"
    }).catch(() => {
      // The warmup use case records failed snapshot/warmup state before throwing.
    });
  }
}

function graphStorePath(repoRoot: string): string {
  const cacheDir = path.join(repoRoot, ".cache", "agent-workbench");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "graph.sqlite");
}
