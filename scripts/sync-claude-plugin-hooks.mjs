#!/usr/bin/env node
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

// source filename -> vendored filename. The shared logic modules are vendored under
// *.core.js so they never collide with the Claude entrypoint wrappers of the same name.
export const VENDORED_HOOK_FILES = {
  "hook-common.js": "hook-common.js",
  "session-start.js": "session-start.core.js",
  "post-edit-feedback.js": "post-edit-feedback.core.js"
};

export function syncClaudePluginHooks() {
  const written = [];
  for (const [source, target] of Object.entries(VENDORED_HOOK_FILES)) {
    const sourcePath = path.join(sourceDir, source);
    const targetPath = path.join(targetDir, target);
    fs.copyFileSync(sourcePath, targetPath);
    written.push(path.relative(repoRoot, targetPath));
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
