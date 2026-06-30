#!/usr/bin/env node
// Cross-platform postinstall pointer smoke (spec 033). The package is launched
// in place (npm install location) — never copied to a prefix. This smoke runs
// the package `postinstall` against a temp state dir and asserts it records a
// runtime-root pointer that resolves back to this checkout, which is the
// mechanism the plugin launcher relies on to find the in-place runtime.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  resolveRuntimeRoot,
  runtimePointerPath
} from "../../plugins/agent-workbench/install-root.mjs";

const repoRoot = process.cwd();
const stateHome = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-state-"));

function assert(condition, message) {
  if (!condition) {
    process.stderr.write(`install-smoke FAIL: ${message}\n`);
    fs.rmSync(stateHome, { recursive: true, force: true });
    process.exit(1);
  }
}

// Redirect the per-OS state dir into the temp home on every platform, and make
// sure no override masks the pointer mechanism we are exercising.
const env = {
  ...process.env,
  HOME: stateHome,
  USERPROFILE: stateHome,
  LOCALAPPDATA: path.join(stateHome, "AppData", "Local")
};
delete env.AGENT_WORKBENCH_INSTALL_ROOT;

const result = spawnSync(process.execPath, [path.join("scripts", "postinstall.mjs")], {
  cwd: repoRoot,
  env,
  encoding: "utf8"
});
assert(result.status === 0, `postinstall exited with status ${result.status}: ${result.stderr}`);

const pointer = runtimePointerPath(env);
assert(fs.existsSync(pointer), `runtime pointer written at ${pointer}`);

const resolved = resolveRuntimeRoot(env);
assert(resolved === repoRoot, `pointer resolves to this checkout (got ${resolved})`);

fs.rmSync(stateHome, { recursive: true, force: true });
process.stdout.write(`install-smoke OK on ${process.platform}: ${resolved}\n`);
