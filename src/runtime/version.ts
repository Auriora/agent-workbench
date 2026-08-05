/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../../package.json" with { type: "json" };

export const AGENT_WORKBENCH_RUNTIME_VERSION = packageJson.version;
const RUNTIME_BUILD_RECEIPT_FILE = "runtime-build-receipt.json";

export const AGENT_WORKBENCH_RUNTIME_BUILD_FINGERPRINT = readRuntimeBuildFingerprint();

export function readRuntimeBuildFingerprint(moduleUrl: string = import.meta.url): string {
  const moduleDir = path.dirname(fileURLToPath(moduleUrl));
  const checkoutRoot = sourceCheckoutRoot(moduleDir);
  if (checkoutRoot !== undefined) {
    return fingerprintCheckoutSources(checkoutRoot);
  }
  for (const receiptPath of runtimeBuildReceiptCandidates(moduleDir)) {
    try {
      const receipt = fs.readFileSync(receiptPath);
      return crypto.createHash("sha256").update(receipt).digest("hex");
    } catch (error) {
      if (isMissingRuntimeBuildReceipt(error)) {
        continue;
      }
      throw error;
    }
  }
  throw new Error(
    "Agent Workbench runtime build receipt is missing; rebuild or reinstall the runtime package."
  );
}

function sourceCheckoutRoot(moduleDir: string): string | undefined {
  if (path.basename(moduleDir) !== "runtime" || path.basename(path.dirname(moduleDir)) !== "src") {
    return undefined;
  }
  const candidate = path.dirname(path.dirname(moduleDir));
  return fs.existsSync(path.join(candidate, "package.json")) ? candidate : undefined;
}

function fingerprintCheckoutSources(repoRoot: string): string {
  const relativePaths = [
    ...walkRuntimeSourceFiles(path.join(repoRoot, "src"), repoRoot),
    "package.json",
    "tsconfig.json",
    "scripts/build-runtime.mjs",
    "scripts/runtime-build-contract.mjs"
  ].sort();
  const hash = crypto.createHash("sha256");
  for (const relativePath of relativePaths) {
    hash.update(relativePath.replace(/\\/gu, "/"));
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(repoRoot, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function walkRuntimeSourceFiles(directory: string, repoRoot: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRuntimeSourceFiles(absolutePath, repoRoot));
    } else if (entry.isFile() && /\.(?:ts|mjs)$/u.test(entry.name)) {
      files.push(path.relative(repoRoot, absolutePath));
    }
  }
  return files;
}

function runtimeBuildReceiptCandidates(moduleDir: string): string[] {
  return [...new Set([
    path.join(moduleDir, RUNTIME_BUILD_RECEIPT_FILE),
    path.join(moduleDir, "..", "mcp", RUNTIME_BUILD_RECEIPT_FILE),
    path.join(moduleDir, "..", "..", "dist", "mcp", RUNTIME_BUILD_RECEIPT_FILE)
  ])];
}

function isMissingRuntimeBuildReceipt(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (
      (error as { code?: unknown }).code === "ENOENT" ||
      (error as { code?: unknown }).code === "ENOTDIR"
    )
  );
}
