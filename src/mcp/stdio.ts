import { connectAgentWorkbenchStdio } from "./stdio-launch.js";

process.stdin.resume();
await connectAgentWorkbenchStdio();
setInterval(() => {}, 2 ** 31 - 1);
