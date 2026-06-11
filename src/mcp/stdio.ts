import { connectAgentWorkbenchStdio } from "./stdio-launch.js";

await connectAgentWorkbenchStdio();
process.stdin.resume();
setInterval(() => {}, 2 ** 31 - 1);
