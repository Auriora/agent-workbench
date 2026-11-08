/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export const TREE_SITTER_VERSION: "0.25.0";
export const NODE_GYP_VERSION: "11.5.0";
export const TERMINATION_SAFE_DEFINE: "NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS";
export class NativeRuntimeGuardError extends Error {
  readonly code: "NATIVE_RUNTIME_UNGUARDED";
  readonly reason: "native_evidence_missing" | "native_evidence_invalid" | "native_configuration_unverified";
  constructor(cause: unknown);
}
export type NativeRuntimeReceipt = {
  schema_version: 1;
  tree_sitter_version: "0.25.0";
  node_gyp_version: "11.5.0";
  node_version: string;
  platform: string;
  arch: string;
  define: typeof TERMINATION_SAFE_DEFINE;
  node_addon_api_header_sha256: string;
  binding_sha256: string;
};
export function runtimePackageRoot(moduleUrl?: string | URL): string;
export function treeSitterRuntime(packageRoot: string): {
  root: string;
  require: NodeRequire;
  addon_header_sha256: string;
};
export function validateTreeSitterSourceBuild(options?: {
  packageRoot?: string;
  platform?: string;
  arch?: string;
}): NativeRuntimeReceipt;
