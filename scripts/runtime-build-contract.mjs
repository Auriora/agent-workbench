#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RUNTIME_BUILD_OUTPUT_DIR = "dist";
export const RUNTIME_BUILD_RECEIPT_PATH = path.join(
  RUNTIME_BUILD_OUTPUT_DIR,
  "mcp",
  "runtime-build-receipt.json"
);
const RECEIPT_VERSION = 1;

export const RUNTIME_BUILD_ENTRYPOINTS = {
  stdio: {
    name: "mcp/stdio-entrypoint",
    source: "src/mcp/stdio.ts",
    output: path.join(RUNTIME_BUILD_OUTPUT_DIR, "mcp", "stdio-entrypoint.mjs")
  },
  daemon: {
    name: "mcp/daemon-entrypoint",
    source: "src/mcp/daemon-main.ts",
    output: path.join(RUNTIME_BUILD_OUTPUT_DIR, "mcp", "daemon-entrypoint.mjs")
  },
  worker: {
    name: "workers/startup-graph-warmup-worker-entrypoint",
    source: "src/infrastructure/workers/startup-graph-warmup-worker.ts",
    output: path.join(
      RUNTIME_BUILD_OUTPUT_DIR,
      "workers",
      "startup-graph-warmup-worker-entrypoint.mjs"
    )
  }
};

export const BUILD_OPTIONS = {
  platform: "node",
  format: "esm",
  bundle: true,
  target: "node22",
  sourcemap: false,
  minify: false,
  packages: "external",
  outdir: RUNTIME_BUILD_OUTPUT_DIR,
  entryNames: "[dir]/[name]",
  outExtension: {
    ".js": ".mjs"
  }
};

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function fileHashAndSize(inputPath) {
  const contents = fs.readFileSync(inputPath);
  return {
    hash: crypto.createHash("sha256").update(contents).digest("hex"),
    size: contents.length
  };
}

function readPackageJson(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const raw = fs.readFileSync(packageJsonPath, "utf8");
  return JSON.parse(raw);
}

function readEsbuildVersion(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "node_modules", "esbuild", "package.json");
  const raw = fs.readFileSync(packageJsonPath, "utf8");
  const { version } = JSON.parse(raw);
  if (!isString(version)) {
    throw new Error("Invalid esbuild package.json version in node_modules/esbuild/package.json");
  }
  return version;
}

function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function walkFiles(dir, base, output) {
  const entries = fs.readdirSync(path.join(base, dir), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".gitkeep") {
      continue;
    }
    const entryRelativePath = path.join(dir, entry.name);
    const entryAbsolutePath = path.join(base, entryRelativePath);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === ".cache") {
        continue;
      }
      walkFiles(entryRelativePath, base, output);
      continue;
    }

    if (!entry.isFile()) continue;
    if (/\.(ts|mjs)$/u.test(entry.name) === false && entry.name !== "package.json") {
      continue;
    }

    output.push(normalizeRelativePath(entryRelativePath));
  }
}

function sourceInputRecords(repoRoot) {
  const filePaths = [];
  walkFiles("src", repoRoot, filePaths);
  filePaths.push("package.json");
  filePaths.push("tsconfig.json");
  filePaths.push("scripts/build-runtime.mjs");
  filePaths.push("scripts/runtime-build-contract.mjs");

  const unique = [...new Set(filePaths)].sort();
  return unique.map((relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath);
    const { hash, size } = fileHashAndSize(absolutePath);
    return {
      path: normalizeRelativePath(relativePath),
      size,
      hash
    };
  });
}

function outputRecords(repoRoot) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const entries = Object.values(RUNTIME_BUILD_ENTRYPOINTS);
  return entries.map((entry) => {
    const absolutePath = path.join(absoluteRepoRoot, entry.output);
    if (!fs.existsSync(absolutePath)) {
      throwValidationError(
        "runtime build outputs are missing",
        `expected ${entry.output} to exist; run \`pnpm run build-runtime\`.`
      );
    }
    const { hash, size } = fileHashAndSize(absolutePath);
    return {
      name: entry.name,
      source: entry.source,
      output: entry.output,
      size,
      hash
    };
  });
}

function entrypointsFromManifest() {
  return Object.values(RUNTIME_BUILD_ENTRYPOINTS).map((entry) => ({ ...entry }));
}

export function collectRuntimeBuildContract(repoRoot = process.cwd(), options = {}) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const packageJson = readPackageJson(absoluteRepoRoot);
  const includeOutputs = options?.includeOutputs === true;
  return {
    receiptVersion: RECEIPT_VERSION,
    package: {
      name: isString(packageJson.name) ? packageJson.name : "",
      version: isString(packageJson.version) ? packageJson.version : ""
    },
    esbuild: {
      version: readEsbuildVersion(absoluteRepoRoot)
    },
    outputDir: RUNTIME_BUILD_OUTPUT_DIR,
    buildOptions: { ...BUILD_OPTIONS },
    entrypoints: entrypointsFromManifest(),
    sourceInputs: sourceInputRecords(absoluteRepoRoot),
    ...(includeOutputs ? { outputs: outputRecords(absoluteRepoRoot) } : {})
  };
}

function recordsMatch(expected, actual) {
  if (expected.length !== actual.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index];
    const right = actual[index];
    if (left.path !== right.path || left.size !== right.size || left.hash !== right.hash) {
      return false;
    }
  }
  return true;
}

function throwValidationError(message, details) {
  if (details !== undefined) {
    throw new Error(`${message}. ${details}`);
  }
  throw new Error(message);
}

function verifyStringField(expected, actual, label) {
  if (expected !== actual) {
    throwValidationError(`${label} changed`, `expected ${JSON.stringify(expected)} but saw ${JSON.stringify(actual)}`);
  }
}

export function validateRuntimeBuildReceipt(repoRoot = process.cwd()) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const receiptPath = path.join(absoluteRepoRoot, RUNTIME_BUILD_RECEIPT_PATH);
  if (!fs.existsSync(receiptPath)) {
    throwValidationError(
      "runtime build receipt is missing",
      "run `pnpm run build-runtime` and rerun the check"
    );
  }

  const current = collectRuntimeBuildContract(absoluteRepoRoot);
  const recorded = JSON.parse(fs.readFileSync(receiptPath, "utf8"));

  if (!Array.isArray(recorded.sourceInputs) || recorded.sourceInputs.length < 1) {
    throwValidationError("runtime build receipt is invalid", "missing source input records");
  }
  if (!Array.isArray(recorded.outputs) || recorded.outputs.length < 1) {
    throwValidationError("runtime build receipt is invalid", "missing output records");
  }
  const recordBuildDir = normalizeRelativePath(recorded.outputDir ?? "");
  if (recordBuildDir !== normalizeRelativePath(current.outputDir)) {
    throwValidationError("runtime build output directory changed", `expected ${current.outputDir} but saw ${recordBuildDir}`);
  }

  if (!isString(recorded.package?.name) || !isString(recorded.package?.version)) {
    throwValidationError("runtime build receipt is invalid", "missing package metadata");
  }
  if (!Array.isArray(recorded.entrypoints) || recorded.entrypoints.length < 1) {
    throwValidationError("runtime build receipt is invalid", "missing entrypoint records");
  }
  if (recorded.receiptVersion !== RECEIPT_VERSION) {
    throwValidationError("runtime build receipt schema changed", `received v${recorded.receiptVersion}, expected v${RECEIPT_VERSION}`);
  }
  verifyStringField(current.package.name, recorded.package.name, "package name");
  verifyStringField(current.package.version, recorded.package.version, "package version");
  verifyStringField(current.esbuild.version, recorded.esbuild?.version, "esbuild version");
  verifyStringField(current.outputDir, recordBuildDir, "output directory");

  const expectedEntryPoints = [...current.entrypoints].sort((a, b) => a.name.localeCompare(b.name));
  const actualEntryPoints = [...recorded.entrypoints].sort((a, b) => a.name.localeCompare(b.name));
  const serializedExpectedEntryPoints = JSON.stringify(expectedEntryPoints);
  const serializedActualEntryPoints = JSON.stringify(actualEntryPoints);
  if (serializedExpectedEntryPoints !== serializedActualEntryPoints) {
    throwValidationError("runtime build entrypoints changed", `${serializedActualEntryPoints} != ${serializedExpectedEntryPoints}`);
  }

  const buildOptions = {
    ...current.buildOptions,
    outdir: normalizeRelativePath(current.buildOptions.outdir)
  };
  const recordedBuildOptions = {
    ...(recorded.buildOptions ?? {}),
    outdir: normalizeRelativePath(recorded.buildOptions?.outdir ?? "")
  };
  if (JSON.stringify(buildOptions) !== JSON.stringify(recordedBuildOptions)) {
    throwValidationError("runtime build options changed", "run `pnpm run build-runtime` again");
  }

  const expectedSources = [...current.sourceInputs].sort((a, b) => a.path.localeCompare(b.path));
  const actualSources = [...recorded.sourceInputs].sort((a, b) => a.path.localeCompare(b.path));
  if (!recordsMatch(expectedSources, actualSources)) {
    throwValidationError("runtime source inputs changed", "run `pnpm run build-runtime` before packaging");
  }

  const expectedOutputs = outputRecords(absoluteRepoRoot).sort((a, b) => a.output.localeCompare(b.output));
  const actualOutputs = [...recorded.outputs].sort((a, b) => a.output.localeCompare(b.output));
  if (expectedOutputs.length !== actualOutputs.length) {
    throwValidationError("runtime build outputs changed", "run `pnpm run build-runtime` and verify receipt artifacts");
  }

  for (let index = 0; index < expectedOutputs.length; index += 1) {
    const expected = expectedOutputs[index];
    const actual = actualOutputs[index];
    if (expected.output !== actual.output) {
      throwValidationError("runtime build output path changed");
    }
    if (expected.size !== actual.size || expected.hash !== actual.hash) {
      throwValidationError(
        "runtime build output is stale",
        `run ` + "`pnpm run build-runtime`" + " to regenerate artifacts"
      );
    }
  }

  return recorded;
}
