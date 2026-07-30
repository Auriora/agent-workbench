#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
  BUILD_OPTIONS,
  RUNTIME_BUILD_ENTRYPOINTS,
  collectRuntimeBuildContract,
  validateRuntimeBuildReceipt,
  RUNTIME_BUILD_OUTPUT_DIR,
  RUNTIME_BUILD_RECEIPT_PATH
} from "./runtime-build-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptArgs = process.argv.slice(2);
const checkOnly = scriptArgs.includes("--check");
const quiet = scriptArgs.includes("--quiet");
const helpOnly = scriptArgs.includes("--help") || scriptArgs.includes("-h");

if (helpOnly) {
  process.stdout.write([
    "Usage: node scripts/build-runtime.mjs [--check] [--quiet]",
    "  --check   validate the existing dist/mcp runtime build receipt",
    "  --quiet   suppress the success message (used by npm prepack JSON output)",
    ""
  ].join("\n"));
  process.exit(0);
}

if (checkOnly) {
  try {
    validateRuntimeBuildReceipt(repoRoot);
    process.stdout.write("runtime build receipt is valid\n");
    process.exit(0);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

try {
  const distRoot = path.join(repoRoot, RUNTIME_BUILD_OUTPUT_DIR);
  for (const outputSubdirectory of ["mcp", "workers"]) {
    fs.rmSync(path.join(distRoot, outputSubdirectory), {
      recursive: true,
      force: true
    });
  }

  const entryPoints = Object.values(RUNTIME_BUILD_ENTRYPOINTS).map((entrypoint) => ({
    in: entrypoint.source,
    out: entrypoint.name
  }));
  await build({
    entryPoints,
    ...BUILD_OPTIONS,
    outdir: distRoot
  });

  const contract = collectRuntimeBuildContract(repoRoot, { includeOutputs: true });
  fs.writeFileSync(
    path.join(repoRoot, RUNTIME_BUILD_RECEIPT_PATH),
    `${JSON.stringify(contract, null, 2)}\n`,
    "utf8"
  );
  validateRuntimeBuildReceipt(repoRoot);

  if (!quiet) {
    process.stdout.write("runtime build completed\n");
  }
  process.exit(0);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
