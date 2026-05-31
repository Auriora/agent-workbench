import { getScannedRepoStatus } from "./application/use-cases/get-repo-status.js";
import { FileCatalogScannerAdapter } from "./infrastructure/filesystem/index.js";
import { createAgentWorkbenchServer as createAgentWorkbenchMcpServer } from "./interface-adapters/mcp/server.js";

export function createAgentWorkbenchServer(repoRoot: string) {
  const scanner = new FileCatalogScannerAdapter();
  return createAgentWorkbenchMcpServer(repoRoot, {
    getRepoStatus: ({ repo_root }) =>
      getScannedRepoStatus({
        repo_root,
        scanner
      })
  });
}
