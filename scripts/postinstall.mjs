#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// npm postinstall: native termination safety is mandatory (spec 072). Build
// tree-sitter from source with the supported node-addon-api termination policy
// before advertising the installed runtime. Runtime pointer and provider-config
// setup remain best-effort (spec 033).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTreeSitterSourceBuild, validateTreeSitterSourceBuild } from "./rebuild-native.mjs";
import { materializeCodexMcpConfig } from "../plugins/agent-workbench/codex-mcp-config.mjs";
import {
  runtimePointerPath,
  writeRuntimeRoot
} from "../plugins/agent-workbench/install-root.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const nativeStatus = runTreeSitterSourceBuild({ packageRoot });
if (nativeStatus !== 0) {
  console.error("agent-workbench: cannot install the termination-safe tree-sitter runtime. Python 3 and a C/C++ build toolchain are required.");
  process.exit(nativeStatus);
}
validateTreeSitterSourceBuild({ packageRoot });

try {
  const require = createRequire(path.join(packageRoot, "package.json"));
  require("tree-sitter");
} catch (error) {
  console.error(
    [
      "agent-workbench: the native tree-sitter binding could not be loaded after its required source build.",
      "  Correct the local native toolchain/build issue and rerun package installation.",
      "  Agent Workbench requires its canonical C++20 build and termination-safe compiler define.",
      `  (${error.message})`
    ].join("\n")
  );
  process.exit(1);
}

try {
  const pointer = writeRuntimeRoot(packageRoot);
  console.log(`agent-workbench: recorded runtime root ${packageRoot} -> ${pointer}`);
} catch (error) {
  console.warn(
    `agent-workbench: could not record the runtime pointer (${error.message}).\n` +
      `  The plugin launcher will not find the runtime automatically; set\n` +
      `  AGENT_WORKBENCH_INSTALL_ROOT=${packageRoot} before launching, or write it to\n` +
      `  ${safePointerPath()}.`
  );
}

try {
  if (!fs.existsSync(path.join(packageRoot, ".git"))) {
    const configPath = materializeCodexMcpConfig(packageRoot);
    console.log(`agent-workbench: materialized Codex MCP config ${configPath}`);
  }
} catch (error) {
  console.warn(
    `agent-workbench: could not materialize the Codex MCP config (${error.message}).\n` +
      `  The package can still launch when the host provides an explicit plugin-root\n` +
      `  path, but package-backed Codex sessions may fail to start the MCP server.`
  );
}


function safePointerPath() {
  try {
    return runtimePointerPath();
  } catch {
    return "<state dir>/runtime-root";
  }
}
