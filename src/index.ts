import path from "node:path";
import { buildColdStatus } from "./runtime/status.js";

const repoArg = process.argv.slice(2).find((arg) => arg !== "--");
const repoRoot = repoArg ? path.resolve(repoArg) : process.cwd();

console.log(JSON.stringify(buildColdStatus(repoRoot), null, 2));
