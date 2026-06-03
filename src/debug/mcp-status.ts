import { main as runDebugMcpUseCase } from "./mcp-use-case.js";

await runDebugMcpUseCase(["status", ...process.argv.slice(2)], process.cwd());
