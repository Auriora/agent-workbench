/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TREE_SITTER_VERSION = "0.25.0";
export const NODE_GYP_VERSION = "11.5.0";
// Worker.terminate disallows further JavaScript in its closing environment.
// The upstream policy handles only exceptions that cannot be rethrown during
// that shutdown; ordinary parser callback errors remain observable.
// https://github.com/nodejs/node-addon-api/blob/main/doc/setup.md
export const TERMINATION_SAFE_DEFINE = "NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS";

/** Locate this runtime's owner from its module URL, including bundled entries.
 * No caller cwd or environment path can select a different runtime package. */
export function runtimePackageRoot(moduleUrl = import.meta.url) {
  let directory = path.dirname(fileURLToPath(moduleUrl));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(directory, "package.json");
    if (fs.existsSync(candidate)) {
      const manifest = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (manifest.name === "@auriora/agent-workbench") return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error("Agent Workbench runtime package ownership could not be verified.");
}

export function treeSitterRuntime(packageRoot) {
  const require = createRequire(path.join(packageRoot, "package.json"));
  const manifestPath = require.resolve("tree-sitter/package.json");
  const runtimeRoot = path.dirname(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.version !== TREE_SITTER_VERSION) {
    throw new Error(`Termination-safe native build requires tree-sitter ${TREE_SITTER_VERSION}.`);
  }
  const runtimeRequire = createRequire(manifestPath);
  const addonRoot = path.dirname(runtimeRequire.resolve("node-addon-api/package.json"));
  const headerPath = path.join(addonRoot, "napi-inl.h");
  const header = fs.readFileSync(headerPath, "utf8");
  if (!header.includes(`#ifdef ${TERMINATION_SAFE_DEFINE}`)) {
    throw new Error("Installed node-addon-api does not support termination-safe exception handling.");
  }
  return {
    root: runtimeRoot,
    require: runtimeRequire,
    addon_header_sha256: createHash("sha256").update(header).digest("hex")
  };
}

export class NativeRuntimeGuardError extends Error {
  code = "NATIVE_RUNTIME_UNGUARDED";
  constructor(cause) {
    // JSON parse errors can include receipt bytes in their message. Startup
    // errors expose only an evidence category, never those bytes or hashes.
    super("Agent Workbench requires its guarded tree-sitter runtime. Reinstall through the package lifecycle, or run pnpm rebuild:native in a source checkout.");
    this.name = "NativeRuntimeGuardError";
    this.reason = cause?.code === "ENOENT" ? "native_evidence_missing"
      : cause instanceof SyntaxError ? "native_evidence_invalid"
      : "native_configuration_unverified";
  }
}

/** One fail-closed policy used by installation, runtime admission and packaging. */
export function validateTreeSitterSourceBuild({ packageRoot = runtimePackageRoot(), platform = process.platform, arch = process.arch } = {}) {
  try {
    const runtime = treeSitterRuntime(packageRoot);
    const binaryPath = path.join(runtime.root, "build", "Release", "tree_sitter_runtime_binding.node");
    const receipt = JSON.parse(fs.readFileSync(path.join(runtime.root, "build", "Release", "agent-workbench-native.json"), "utf8"));
    if (receipt.schema_version !== 1 || receipt.tree_sitter_version !== TREE_SITTER_VERSION ||
        receipt.node_gyp_version !== NODE_GYP_VERSION ||
        receipt.define !== TERMINATION_SAFE_DEFINE || receipt.platform !== platform || receipt.arch !== arch ||
        typeof receipt.node_version !== "string" || receipt.node_version.length === 0 ||
        receipt.node_addon_api_header_sha256 !== runtime.addon_header_sha256 ||
        receipt.binding_sha256 !== createHash("sha256").update(fs.readFileSync(binaryPath)).digest("hex")) {
      throw new Error("tree-sitter source-build receipt does not match the installed termination-safe binding.");
    }
    const selectedPath = runtime.require("node-gyp-build").path(runtime.root);
    if (fs.realpathSync.native(selectedPath) !== fs.realpathSync.native(binaryPath)) {
      throw new Error("tree-sitter loader selected an unverified prebuild instead of the source-built binding.");
    }
    return receipt;
  } catch (error) {
    throw new NativeRuntimeGuardError(error);
  }
}

