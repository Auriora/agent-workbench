#!/usr/bin/env node
// Cross-platform install smoke (spec 033, T011a). Runs the shell-free installer
// into a temp prefix and asserts the runtime was copied, sanitized, and a Node
// launcher generated. Shares the prefix with the launch/hook smokes via
// AW_CI_PREFIX so they exercise the same installed runtime end to end.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { install } from "../../packaging/agent-workbench/installer.mjs";

const prefix = process.env.AW_CI_PREFIX || path.join(os.tmpdir(), "agent-workbench-ci");

function assert(condition, message) {
  if (!condition) {
    process.stderr.write(`install-smoke FAIL: ${message}\n`);
    process.exit(1);
  }
}

fs.rmSync(prefix, { recursive: true, force: true });
const result = install({ source: process.cwd(), prefix, writeCodexConfig: false });

const launcher = path.join(prefix, "bin", "agent-workbench-mcp.mjs");
assert(fs.existsSync(launcher), `launcher generated at ${launcher}`);
assert(fs.existsSync(path.join(prefix, "src", "mcp", "stdio.ts")), "src/mcp/stdio.ts copied");
assert(fs.existsSync(path.join(prefix, "plugins", "agent-workbench", "mcp-launch.mjs")), "plugin shim copied");
assert(!fs.existsSync(path.join(prefix, "src", "debug")), "src/debug stripped");
assert(!fs.existsSync(path.join(prefix, "docs", "specs")), "docs/specs stripped");
assert(fs.existsSync(path.join(prefix, "node_modules", "tsx")), "tsx available in install (launch prerequisite)");

process.stdout.write(`install-smoke OK on ${process.platform}: ${result.installRoot}\n`);
