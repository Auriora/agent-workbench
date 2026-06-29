#!/usr/bin/env node
// Cross-platform hook execution smoke (spec 033, T011c). Fires the installed
// SessionStart and PostToolUse hooks via exec-form `node <hook>.js` and asserts
// advisory output with no shell error — the shell-free hook path on this OS.
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const prefix = process.env.AW_CI_PREFIX || path.join(os.tmpdir(), "agent-workbench-ci");
const hooksDir = path.join(prefix, "plugins", "agent-workbench", "hooks");

function fail(message) {
  process.stderr.write(`hook-smoke FAIL: ${message}\n`);
  process.exit(1);
}

function runHook(name, payload) {
  const hookPath = path.join(hooksDir, name);
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify(payload),
    cwd: prefix,
    encoding: "utf8",
    timeout: 30_000
  });
  if (result.error) fail(`${name} failed to run: ${result.error.message}`);
  if (result.status !== 0) fail(`${name} exited with status ${result.status}: ${result.stderr}`);
  return result.stdout || "";
}

// SessionStart emits the basic-default advisory (no env field; in-script default).
const sessionStart = runHook("session-start.js", { hook_event_name: "SessionStart" });
if (!sessionStart.includes("Agent Workbench MCP is available")) {
  fail(`session-start.js did not emit the advisory; got: ${sessionStart.slice(0, 200)}`);
}

// PostToolUse runs diagnostics over a changed file; a clean exit with no shell
// error is the smoke (output may be empty when the file has no diagnostics).
runHook("post-edit-feedback.js", {
  hook_event_name: "PostToolUse",
  cwd: prefix,
  tool_name: "Write",
  tool_input: { file_path: "src/mcp/stdio.ts" }
});

process.stdout.write(`hook-smoke OK on ${process.platform}\n`);
