import fs from "node:fs";
import path from "node:path";
import { getScannedRepoStatus } from "../application/use-cases/get-repo-status.js";
import {
  createTelemetryAdapter,
  telemetryConfigFromEnv
} from "../infrastructure/telemetry/index.js";
import { FileCatalogScannerAdapter } from "../infrastructure/filesystem/index.js";
import { buildStatusEnvelope } from "../presentation/status-presenter.js";

const targetRepo = process.argv.slice(2).find((arg) => arg !== "--");

if (!isAgentWorkbenchRepo(process.cwd())) {
  throw new Error("Debug MCP harness must be run from the agent-workbench repository.");
}

if (targetRepo == null) {
  throw new Error("Usage: pnpm debug:mcp-status -- <target-repo>");
}

const telemetry = createTelemetryAdapter(telemetryConfigFromEnv());
try {
  const repoRoot = path.resolve(targetRepo);
  telemetry.record("debug.mcp_status.start", {
    repo_root: repoRoot
  });
  const status = await getScannedRepoStatus({
    repo_root: repoRoot,
    scanner: new FileCatalogScannerAdapter()
  });
  telemetry.record("debug.mcp_status.complete", {
    repo_root: repoRoot,
    coverage_count: status.status.adapter_coverage.length
  });

  console.log(JSON.stringify(buildStatusEnvelope(status), null, 2));
} catch (error) {
  telemetry.recordError(error, {
    target_repo: targetRepo
  });
  throw error;
} finally {
  await telemetry.shutdown();
}

function isAgentWorkbenchRepo(repoRoot: string): boolean {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    name?: string;
  };
  return packageJson.name === "agent-workbench";
}
