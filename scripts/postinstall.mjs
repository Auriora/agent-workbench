#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// npm postinstall (spec 033). Two jobs, both best-effort and non-fatal so a
// failure here never fails `npm install`:
//
//   1. Record a runtime-root pointer so the plugins' mcp-launch.mjs shim can
//      find this package's location at launch time (the package is launched in
//      place — it is never copied to a prefix).
//   2. If the native modules npm just built are unloadable, print an actionable
//      hint. This is a thin bonus: when tree-sitter itself fails to compile, npm
//      aborts the dependency build *before* this parent postinstall runs, so the
//      authoritative hint lives at server launch (src/mcp/stdio-entrypoint.mjs)
//      and in the README prerequisites.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimePointerPath, writeRuntimeRoot } from "../plugins/agent-workbench/install-root.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  const require = createRequire(path.join(packageRoot, "package.json"));
  require("tree-sitter");
} catch (error) {
  console.warn(
    [
      "agent-workbench: the native tree-sitter binding could not be loaded after install.",
      "  This is a local toolchain/build issue, not a packaging bug. Ensure Python 3 and a",
      "  C/C++ build toolchain are installed, then run: npm rebuild tree-sitter better-sqlite3",
      "  On Node 24 the tree-sitter core needs C++20 — use Node 22, or rebuild with",
      "  CXXFLAGS=-std=c++20 (CL=/std:c++20 on Windows).",
      `  (${error.message})`
    ].join("\n")
  );
}

function safePointerPath() {
  try {
    return runtimePointerPath();
  } catch {
    return "<state dir>/runtime-root";
  }
}
