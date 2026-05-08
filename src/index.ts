import path from "node:path";
import { getColdRepoStatus } from "./application/use-cases/get-repo-status.js";
import { buildColdStatusEnvelope } from "./presentation/status-presenter.js";

const repoArg = process.argv.slice(2).find((arg) => arg !== "--");
const repoRoot = repoArg ? path.resolve(repoArg) : process.cwd();
const coldRepoStatus = getColdRepoStatus(repoRoot);
const response = buildColdStatusEnvelope(coldRepoStatus);

console.log(JSON.stringify(response, null, 2));
