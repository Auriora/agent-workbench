import { getTaskContext } from "./application/use-cases/get-task-context.js";
import { getRepoOverview } from "./application/use-cases/get-repo-overview.js";
import { getRepoScope } from "./application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "./application/use-cases/get-repo-status.js";
import { planVerification } from "./application/use-cases/plan-verification.js";
import { FileCatalogScannerAdapter } from "./infrastructure/filesystem/index.js";
import { createAgentWorkbenchServer as createAgentWorkbenchMcpServer } from "./interface-adapters/mcp/server.js";

export function createAgentWorkbenchServer(repoRoot: string) {
  const scanner = new FileCatalogScannerAdapter();
  return createAgentWorkbenchMcpServer(repoRoot, {
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
        default_repo_root: repoRoot
      }),
    planVerification: ({ request }) =>
      planVerification({
        request,
        scanner,
        default_repo_root: repoRoot
      })
  });
}
