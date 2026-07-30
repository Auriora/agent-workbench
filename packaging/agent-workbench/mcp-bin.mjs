#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// `agent-workbench-mcp` bin (spec 033). Launches the Agent Workbench MCP server
// straight from where npm installed this package — no copy, no prefix. Useful
// for `claude mcp add agent-workbench -- node <abs>/packaging/agent-workbench/mcp-bin.mjs`
// or direct CLI use; the bundled plugins launch the same entrypoint via the
// portable mcp-launch.mjs shim.
//
// The bin lives inside the package, so it self-locates the runtime by relative
// path and imports the compiled entrypoint in-process.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..", "..");

// Default the repo root to the launch cwd (the client's working directory) when
// the caller has not pinned one explicitly.
if (!process.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT) {
  process.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT = process.cwd();
}

const entrypoint = path.join(packageRoot, "dist", "mcp", "stdio-entrypoint.mjs");
if (!fs.existsSync(entrypoint)) {
  process.stderr.write(
    "agent-workbench: missing compiled runtime entrypoint at dist/mcp/stdio-entrypoint.mjs. " +
      "Run `node scripts/build-runtime.mjs` and reinstall this package before launching.\n"
  );
  process.exit(1);
}

try {
  await import(entrypoint);
} catch (error) {
  process.stderr.write(
    `agent-workbench: compiled runtime failed to start: ${
      error instanceof Error ? error.message : String(error)
    }\n`
  );
  process.exit(1);
}
