#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Vendors the shared (codex-origin) hook modules into the Claude Code plugin so
// that claude-plugin/ is self-contained. Claude Code installs a plugin by copying
// only its plugin-root subtree (here ./claude-plugin) into a per-user cache; any
// import that escapes that root via ../../ breaks at runtime with ERR_MODULE_NOT_FOUND.
//
// Source of truth: plugins/agent-workbench/hooks/*.js (also used by the Codex plugin).
// Run `npm run sync:claude-hooks` after editing those files. The Claude plugin
// integration test asserts these copies stay byte-identical to their sources.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(repoRoot, "plugins/agent-workbench/hooks");
const targetDir = path.join(repoRoot, "plugins/agent-workbench/claude-plugin/hooks");
const pluginSourceDir = path.join(repoRoot, "plugins/agent-workbench");
const pluginTargetDir = path.join(repoRoot, "plugins/agent-workbench/claude-plugin");

// source filename -> vendored filename. The shared logic modules are vendored under
// *.core.js so they never collide with the Claude entrypoint wrappers of the same name.
export const VENDORED_HOOK_FILES = {
  "hook-common.js": "hook-common.js",
  "session-start.js": "session-start.core.js",
  "post-edit-feedback.js": "post-edit-feedback.core.js"
};

// Plugin-root modules vendored alongside the shim so claude-plugin/ stays
// self-contained: the MCP launch shim and the install-root resolver it imports
// (spec 033). Vendored byte-identical, same basename, so the shim's
// `import "./install-root.mjs"` resolves inside the copied subtree.
export const VENDORED_PLUGIN_FILES = {
  "mcp-launch.mjs": "mcp-launch.mjs",
  "install-root.mjs": "install-root.mjs"
};

export function syncClaudePluginHooks() {
  const written = [];
  for (const [source, target] of Object.entries(VENDORED_HOOK_FILES)) {
    fs.copyFileSync(path.join(sourceDir, source), path.join(targetDir, target));
    written.push(path.relative(repoRoot, path.join(targetDir, target)));
  }
  for (const [source, target] of Object.entries(VENDORED_PLUGIN_FILES)) {
    fs.copyFileSync(path.join(pluginSourceDir, source), path.join(pluginTargetDir, target));
    written.push(path.relative(repoRoot, path.join(pluginTargetDir, target)));
  }
  return written;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const written = syncClaudePluginHooks();
  for (const file of written) {
    console.log(`synced ${file}`);
  }
}
