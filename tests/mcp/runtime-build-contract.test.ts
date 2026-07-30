/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

import {
  collectRuntimeBuildContract,
  validateRuntimeBuildReceipt,
  RUNTIME_BUILD_ENTRYPOINTS,
  RUNTIME_BUILD_OUTPUT_DIR,
  RUNTIME_BUILD_RECEIPT_PATH
} from "../../scripts/runtime-build-contract.mjs";

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function withRuntimeBuildFixture<T>(callback: (root: string) => T): T {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-runtime-build-"));
  try {
    fs.mkdirSync(path.join(root, "src", "mcp"), { recursive: true });
    fs.mkdirSync(path.join(root, "src", "infrastructure", "workers"), { recursive: true });
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(root, "node_modules", "esbuild"), { recursive: true });

    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
      name: "@agent-workbench/runtime-build-contract-fixture",
      version: "1.2.3"
    }, null, 2) + "\n");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: { target: "ES2022" } }, null, 2)}\n`
    );
    fs.writeFileSync(
      path.join(root, "node_modules", "esbuild", "package.json"),
      JSON.stringify({ name: "esbuild", version: "0.27.7" }) + "\n"
    );
    fs.writeFileSync(
      path.join(root, "node_modules", "esbuild", "index.js"),
      [
        "const fs = require(\"node:fs\");",
        "const path = require(\"node:path\");",
        "",
        "exports.build = async function build({ entryPoints, outdir }) {",
        "  for (const entry of entryPoints) {",
        "    const name = entry.out;",
        "    const outputPath = path.join(outdir, `${name}.mjs`);",
        "    fs.mkdirSync(path.dirname(outputPath), { recursive: true });",
        "    fs.writeFileSync(outputPath, `// generated ${name}\\n`);",
        "  }",
        "};"
      ].join("\n")
    );

    fs.writeFileSync(path.join(root, "src", "mcp", "stdio.ts"), `console.log("fixture stdio");\n`);
    fs.writeFileSync(path.join(root, "src", "mcp", "daemon-main.ts"), `console.log("fixture daemon main");\n`);
    fs.writeFileSync(
      path.join(root, "src", "infrastructure", "workers", "startup-graph-warmup-worker.ts"),
      `console.log("fixture graph worker");\n`
    );

    fs.copyFileSync(path.join(REPO_ROOT, "scripts/runtime-build-contract.mjs"), path.join(root, "scripts", "runtime-build-contract.mjs"));
    fs.copyFileSync(path.join(REPO_ROOT, "scripts/build-runtime.mjs"), path.join(root, "scripts", "build-runtime.mjs"));

    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeRuntimeReceipt(root: string): void {
  const built = collectRuntimeBuildContract(root, { includeOutputs: true });
  const receiptPath = path.join(root, RUNTIME_BUILD_RECEIPT_PATH);
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(built, null, 2)}\n`, "utf8");
}

function writeBuildArtifacts(root: string): void {
  const outputRoot = path.join(root, RUNTIME_BUILD_OUTPUT_DIR);
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const entry of Object.values(RUNTIME_BUILD_ENTRYPOINTS)) {
    const artifactPath = path.join(root, entry.output);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${`export const generated = true; // ${entry.name}`}\n`, "utf8");
  }
}

function runRuntimeBuildCommand(root: string, args: string[] = []): ReturnType<typeof spawnSync> {
  const scriptPath = path.join(root, "scripts", "build-runtime.mjs");
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: "utf8"
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  return result;
}

describe("runtime build contract", () => {
  it("collects source inputs and deterministic entrypoint metadata", () => {
    withRuntimeBuildFixture((root) => {
      const contract = collectRuntimeBuildContract(root);
      expect(contract.outputDir).toBe(RUNTIME_BUILD_OUTPUT_DIR);
      expect(contract.buildOptions.outExtension).toEqual({ ".js": ".mjs" });
      expect(contract.entrypoints.map((entry) => entry.name).sort()).toEqual([
        "mcp/daemon-entrypoint",
        "mcp/stdio-entrypoint",
        "workers/startup-graph-warmup-worker-entrypoint"
      ]);

      const sourcePaths = new Set(contract.sourceInputs.map((input) => input.path));
      expect(sourcePaths.has("package.json")).toBe(true);
      expect(sourcePaths.has("tsconfig.json")).toBe(true);
      expect(sourcePaths.has("scripts/build-runtime.mjs")).toBe(true);
      expect(sourcePaths.has("scripts/runtime-build-contract.mjs")).toBe(true);
      expect(sourcePaths.has(normalizePath(path.join("src", "mcp", "stdio.ts")))).toBe(true);
      expect(sourcePaths.has(normalizePath(path.join("src", "mcp", "daemon-main.ts")))).toBe(true);
      expect(
        sourcePaths.has(
          normalizePath(path.join("src", "infrastructure", "workers", "startup-graph-warmup-worker.ts"))
        )
      ).toBe(true);
    });
  });

  it("validates a matching runtime build receipt", () => {
    withRuntimeBuildFixture((root) => {
      writeBuildArtifacts(root);
      writeRuntimeReceipt(root);
      expect(() => validateRuntimeBuildReceipt(root)).not.toThrow();
    });
  });

  it("detects stale build outputs via receipt validation", () => {
    withRuntimeBuildFixture((root) => {
      writeBuildArtifacts(root);
      writeRuntimeReceipt(root);
      const outputPath = path.join(root, RUNTIME_BUILD_ENTRYPOINTS.stdio.output);
      fs.appendFileSync(outputPath, "// mutation\n", "utf8");

      expect(() => validateRuntimeBuildReceipt(root)).toThrow(/runtime build output is stale/);
    });
  });

  it("rejects missing receipts", () => {
    withRuntimeBuildFixture((root) => {
      expect(() => validateRuntimeBuildReceipt(root)).toThrow(/runtime build receipt is missing/);
    });
  });

  it("keeps deterministic output checksums", () => {
    withRuntimeBuildFixture((root) => {
      writeBuildArtifacts(root);
      const contract = collectRuntimeBuildContract(root, { includeOutputs: true });
      const stdioOutput = path.join(root, RUNTIME_BUILD_ENTRYPOINTS.stdio.output);

      const original = contract.outputs?.find(
        (entry) => entry.output === normalizePath(RUNTIME_BUILD_ENTRYPOINTS.stdio.output)
      );
      expect(original).toBeDefined();
      const expectedHash = crypto.createHash("sha256").update(fs.readFileSync(stdioOutput)).digest("hex");
      expect(original?.hash).toBe(expectedHash);
    });
  });

  it("builds artifacts and validates the receipt with the build command", () => {
    withRuntimeBuildFixture((root) => {
      const buildResult = runRuntimeBuildCommand(root);
      expect(buildResult.status).toBe(0);
      expect(buildResult.stdout).toContain("runtime build completed");

      const receiptPath = path.join(root, RUNTIME_BUILD_RECEIPT_PATH);
      expect(fs.existsSync(receiptPath)).toBe(true);
      expect(
        fs.existsSync(path.join(root, RUNTIME_BUILD_ENTRYPOINTS.worker.output))
      ).toBe(true);
      expect(() => validateRuntimeBuildReceipt(root)).not.toThrow();

      const checkResult = runRuntimeBuildCommand(root, ["--check"]);
      expect(checkResult.status).toBe(0);
      expect(checkResult.stdout).toContain("runtime build receipt is valid");
    });
  });

  it("keeps npm prepack output machine-readable by supporting quiet builds", () => {
    withRuntimeBuildFixture((root) => {
      const buildResult = runRuntimeBuildCommand(root, ["--quiet"]);
      expect(buildResult.status).toBe(0);
      expect(buildResult.stdout).toBe("");
      expect(() => validateRuntimeBuildReceipt(root)).not.toThrow();
    });
  });

  it("revalidates the receipt inside the build command", () => {
    withRuntimeBuildFixture((root) => {
      const contractPath = path.join(root, "scripts", "runtime-build-contract.mjs");
      const contractSource = fs.readFileSync(contractPath, "utf8");
      fs.writeFileSync(
        contractPath,
        contractSource.replace(
          "export function validateRuntimeBuildReceipt(repoRoot = process.cwd()) {",
          [
            "export function validateRuntimeBuildReceipt(repoRoot = process.cwd()) {",
            "  fs.writeFileSync(path.join(path.resolve(repoRoot), \"validation-marker\"), \"validated\\n\", \"utf8\");"
          ].join("\n")
        ),
        "utf8"
      );

      const buildResult = runRuntimeBuildCommand(root, ["--quiet"]);
      expect(buildResult.status).toBe(0);
      expect(fs.readFileSync(path.join(root, "validation-marker"), "utf8")).toBe("validated\n");
    });
  });

  it("preserves unrelated generated output while replacing runtime directories", () => {
    withRuntimeBuildFixture((root) => {
      const unrelatedOutput = path.join(root, "dist", "reports", "keep.txt");
      const staleRuntimeOutput = path.join(root, "dist", "mcp", "stale.txt");
      fs.mkdirSync(path.dirname(unrelatedOutput), { recursive: true });
      fs.mkdirSync(path.dirname(staleRuntimeOutput), { recursive: true });
      fs.writeFileSync(unrelatedOutput, "keep\n", "utf8");
      fs.writeFileSync(staleRuntimeOutput, "remove\n", "utf8");

      const buildResult = runRuntimeBuildCommand(root, ["--quiet"]);
      expect(buildResult.status).toBe(0);
      expect(fs.readFileSync(unrelatedOutput, "utf8")).toBe("keep\n");
      expect(fs.existsSync(staleRuntimeOutput)).toBe(false);
    });
  });
});
