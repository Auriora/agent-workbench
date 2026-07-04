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
// path and imports the entrypoint in-process (the entrypoint registers tsx
// relative to its own file and prints an actionable hint on native-load errors).
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..", "..");

// Default the repo root to the launch cwd (the client's working directory) when
// the caller has not pinned one explicitly.
if (!process.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT) {
  process.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT = process.cwd();
}

await import(path.join(packageRoot, "src", "mcp", "stdio-entrypoint.mjs"));
