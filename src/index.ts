import path from "node:path";
import { getScannedRepoStatus } from "./application/use-cases/get-repo-status.js";
import { FileCatalogScannerAdapter } from "./infrastructure/filesystem/index.js";
import { buildStatusEnvelope } from "./presentation/status-presenter.js";

const repoArg = process.argv.slice(2).find((arg) => arg !== "--");
const repoRoot = repoArg ? path.resolve(repoArg) : process.cwd();
const repoStatus = await getScannedRepoStatus({
  repo_root: repoRoot,
  scanner: new FileCatalogScannerAdapter()
});
const response = buildStatusEnvelope(repoStatus);

console.log(JSON.stringify(response, null, 2));
