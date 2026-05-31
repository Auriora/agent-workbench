import path from "node:path";
import { pathToFileURL } from "node:url";

export function feedbackMode(env = process.env) {
  return env.AGENT_WORKBENCH_HOOK_FEEDBACK === "basic" ? "basic" : "silent";
}

export function readStdin(stdin = process.stdin) {
  return new Promise((resolve) => {
    let payload = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      payload += chunk;
    });
    stdin.on("end", () => {
      resolve(payload);
    });
  });
}

export function parsePayload(raw) {
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? parsed : {};
}

export function emitAdditionalContext(message, stdout = process.stdout) {
  stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        additionalContext: message
      }
    })}\n`
  );
}

export async function runQuietHook(main) {
  try {
    await main();
    return 0;
  } catch {
    return 0;
  }
}

export function isMain(importMetaUrl, argv = process.argv) {
  return typeof argv[1] === "string" && importMetaUrl === pathToFileURL(path.resolve(argv[1])).href;
}
