/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { readRuntimeBuildFingerprint } from "../../src/runtime/version.js";

describe("runtime build fingerprint", () => {
  it("changes with current checkout sources without relying on a dist receipt", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-version-checkout-"));
    const modulePath = path.join(repoRoot, "src", "runtime", "version.ts");
    try {
      writeFixtureFile(repoRoot, "package.json", "{}\n");
      writeFixtureFile(repoRoot, "tsconfig.json", "{}\n");
      writeFixtureFile(repoRoot, "scripts/build-runtime.mjs", "export {};\n");
      writeFixtureFile(repoRoot, "scripts/runtime-build-contract.mjs", "export {};\n");
      writeFixtureFile(repoRoot, "src/runtime/version.ts", "export const version = 1;\n");

      const moduleUrl = pathToFileURL(modulePath).href;
      const before = readRuntimeBuildFingerprint(moduleUrl);
      writeFixtureFile(repoRoot, "src/runtime/version.ts", "export const version = 2;\n");
      const after = readRuntimeBuildFingerprint(moduleUrl);

      expect(after).not.toBe(before);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("fails closed when an installed runtime receipt is missing", () => {
    const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-version-package-"));
    try {
      const moduleUrl = pathToFileURL(path.join(packageRoot, "dist", "mcp", "stdio-entrypoint.mjs")).href;
      expect(() => readRuntimeBuildFingerprint(moduleUrl)).toThrow(
        "Agent Workbench runtime build receipt is missing"
      );
    } finally {
      fs.rmSync(packageRoot, { recursive: true, force: true });
    }
  });
});

function writeFixtureFile(repoRoot: string, relativePath: string, contents: string): void {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}
