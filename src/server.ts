import fs from "node:fs";
import path from "node:path";
import { applyWorkspaceEdit } from "./application/use-cases/apply-workspace-edit.js";
import { computeImpact } from "./application/use-cases/compute-impact.js";
import { findReferences } from "./application/use-cases/find-references.js";
import { getTaskContext } from "./application/use-cases/get-task-context.js";
import { getRepoOverview } from "./application/use-cases/get-repo-overview.js";
import { getRepoScope } from "./application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "./application/use-cases/get-repo-status.js";
import { planVerification } from "./application/use-cases/plan-verification.js";
import { previewWorkspaceEdit } from "./application/use-cases/preview-workspace-edit.js";
import { searchSymbols } from "./application/use-cases/search-symbols.js";
import { InMemoryEditPreviewStoreAdapter } from "./infrastructure/edit-preview-store/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "./infrastructure/filesystem/index.js";
import { openGraphStore } from "./infrastructure/sqlite/index.js";
import { SystemClockAdapter } from "./infrastructure/time/index.js";
import { createAgentWorkbenchServer as createAgentWorkbenchMcpServer } from "./interface-adapters/mcp/server.js";

export function createAgentWorkbenchServer(repoRoot: string) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const scanner = new FileCatalogScannerAdapter();
  const workspace = new WorkspaceFileAdapter({ repoRoot: absoluteRepoRoot });
  const safety = new WorkspaceSafetyAdapter({ repoRoot: absoluteRepoRoot });
  const clock = new SystemClockAdapter();
  const previews = new InMemoryEditPreviewStoreAdapter();
  const graphStore = openGraphStore(graphStorePath(absoluteRepoRoot));
  return createAgentWorkbenchMcpServer(absoluteRepoRoot, {
    getRepoStatus: ({ repo_root }) =>
      getScannedRepoStatus({
        repo_root,
        scanner
      }),
    getRepoScope: ({ repo_root }) =>
      getRepoScope({
        repo_root,
        scanner
      }),
    getRepoOverview: ({ repo_root }) =>
      getRepoOverview({
        repo_root,
        scanner
      }),
    getTaskContext: ({ request }) =>
      getTaskContext({
        request,
        scanner,
        default_repo_root: absoluteRepoRoot
      }),
    searchSymbols: ({ request }) =>
      searchSymbols({
        request,
        graph: graphStore,
        snapshots: graphStore,
        catalog: graphStore,
        workspace,
        default_repo_root: absoluteRepoRoot
      }),
    findReferences: ({ request }) =>
      findReferences({
        request,
        graph: graphStore,
        snapshots: graphStore,
        catalog: graphStore,
        workspace,
        default_repo_root: absoluteRepoRoot
      }),
    computeImpact: ({ request }) =>
      computeImpact({
        request,
        graph: graphStore,
        snapshots: graphStore,
        catalog: graphStore,
        workspace,
        default_repo_root: absoluteRepoRoot
      }),
    previewWorkspaceEdit: ({ request }) =>
      previewWorkspaceEdit({
        request,
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: absoluteRepoRoot
      }),
    applyWorkspaceEdit: ({ request }) =>
      applyWorkspaceEdit({
        request,
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: absoluteRepoRoot
      }),
    planVerification: ({ request }) =>
      planVerification({
        request,
        scanner,
        workspace,
        default_repo_root: absoluteRepoRoot
      })
  });
}

function graphStorePath(repoRoot: string): string {
  const cacheDir = path.join(repoRoot, ".cache", "agent-workbench");
  fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, "graph.sqlite");
}
