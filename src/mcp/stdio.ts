import { connectAgentWorkbenchStdio } from "./stdio-launch.js";

await connectAgentWorkbenchStdio();
process.stdin.resume();
await new Promise<void>((resolve) => {
  process.stdin.once("close", resolve);
  process.stdin.once("end", resolve);
});
