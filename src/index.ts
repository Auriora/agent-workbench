import path from "node:path";
import { getScannedRepoStatus } from "./application/use-cases/get-repo-status.js";
import { FileCatalogScannerAdapter } from "./infrastructure/filesystem/index.js";
import {
  createTelemetryAdapter,
  telemetryConfigFromEnv
} from "./infrastructure/telemetry/index.js";
import { buildStatusEnvelope } from "./presentation/status-presenter.js";

const repoArg = process.argv.slice(2).find((arg) => arg !== "--");
const repoRoot = repoArg ? path.resolve(repoArg) : process.cwd();
const telemetry = createTelemetryAdapter(telemetryConfigFromEnv());

try {
  telemetry.record("cli.status.start", {
    repo_root: repoRoot
  });
  const repoStatus = await getScannedRepoStatus({
    repo_root: repoRoot,
    scanner: new FileCatalogScannerAdapter()
  });
  telemetry.record("cli.status.complete", {
    repo_root: repoRoot,
    coverage_count: repoStatus.status.adapter_coverage.length
  });
  const response = buildStatusEnvelope(repoStatus);

  console.log(JSON.stringify(response, null, 2));
} catch (error) {
  telemetry.recordError(error, {
    repo_root: repoRoot
  });
  throw error;
} finally {
  await telemetry.shutdown();
}
