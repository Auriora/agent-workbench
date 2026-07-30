/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type RuntimeBuildEntrypoint = {
  name: string;
  source: string;
  output: string;
};

export type RuntimeBuildInput = {
  path: string;
  size: number;
  hash: string;
};

export type RuntimeBuildOutput = RuntimeBuildEntrypoint & {
  size: number;
  hash: string;
};

export type RuntimeBuildContract = {
  receiptVersion: number;
  package: {
    name: string;
    version: string;
  };
  esbuild: {
    version: string;
  };
  outputDir: string;
  buildOptions: {
    platform: string;
    format: string;
    bundle: boolean;
    target: string;
    sourcemap: boolean;
    minify: boolean;
    packages: string;
    outdir: string;
    entryNames: string;
    outExtension: Record<string, string>;
  };
  entrypoints: RuntimeBuildEntrypoint[];
  sourceInputs: RuntimeBuildInput[];
  outputs?: RuntimeBuildOutput[];
};

export const RUNTIME_BUILD_OUTPUT_DIR: string;
export const RUNTIME_BUILD_RECEIPT_PATH: string;
export const RUNTIME_BUILD_ENTRYPOINTS: {
  stdio: RuntimeBuildEntrypoint;
  daemon: RuntimeBuildEntrypoint;
  worker: RuntimeBuildEntrypoint;
};
export const BUILD_OPTIONS: RuntimeBuildContract["buildOptions"];

export function collectRuntimeBuildContract(
  repoRoot?: string,
  options?: { includeOutputs?: boolean }
): RuntimeBuildContract;

export function validateRuntimeBuildReceipt(repoRoot?: string): RuntimeBuildContract;
