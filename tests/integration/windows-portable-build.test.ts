/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs CI helper imported into the TS test via esbuild.
import * as portableBuild from "../../scripts/ci/build-windows-portable.mjs";

const {
  assertInside,
  assertDisjointPaths,
  assertRealPathInside,
  configureLauncherText,
  createManifest,
  hashPayload,
  launcherText,
  PAYLOAD_HASH_EXCLUSIONS,
  parseArgs,
  validateBuildHost,
  validateDeploymentRoot
} = portableBuild;

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Windows portable bundle contract", () => {
  it("requires explicit inputs and a full Git SHA", () => {
    expect(() => parseArgs([])).toThrow("--package is required");
    expect(() => parseArgs(["--package", "a.tgz"])).toThrow("--deployment is required");
    expect(() => parseArgs(["--package", "a.tgz", "--deployment", "deploy"])).toThrow("--lockfile is required");
    expect(() => parseArgs(["--package", "a.tgz", "--deployment", "deploy", "--lockfile", "pnpm-lock.yaml", "--output", "out", "--git-sha", "short"])).toThrow(
      "40-character"
    );
    expect(parseArgs([
      "--package", "a.tgz",
      "--deployment", "deploy",
      "--lockfile", "pnpm-lock.yaml",
      "--output", "out",
      "--git-sha", "a".repeat(40)
    ])).toEqual({
      packagePath: "a.tgz",
      deploymentPath: "deploy",
      lockfilePath: "pnpm-lock.yaml",
      outputPath: "out",
      gitSha: "a".repeat(40)
    });
  });

  it("fails closed outside the supported build host", () => {
    expect(() => validateBuildHost("linux", "x64", "22.23.1")).toThrow("must be built on win32");
    expect(() => validateBuildHost("win32", "arm64", "22.23.1")).toThrow("require x64");
    expect(() => validateBuildHost("win32", "x64", "24.8.0")).toThrow("require Node 22");
    expect(() => validateBuildHost("win32", "x64", "22.23.1")).not.toThrow();
  });

  it("launches and configures only through the bundled node.exe", () => {
    expect(launcherText()).toContain('"%~dp0node.exe"');
    expect(launcherText()).toContain("runtime\\node_modules\\@auriora\\agent-workbench");
    expect(configureLauncherText()).toContain('"%~dp0node.exe"');
    expect(configureLauncherText()).toContain("scripts\\configure-portable.mjs");
    expect(launcherText()).not.toMatch(/\bnpm(?:\.cmd)?\b/i);
    expect(configureLauncherText()).not.toMatch(/\bnpm(?:\.cmd)?\b/i);
  });

  it("hashes a sorted payload and records exact release identity", () => {
    const root = makeTempRoot();
    const packageRoot = path.join(root, "runtime", "node_modules", "@auriora", "agent-workbench");
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(path.join(packageRoot, "package.json"), '{"name":"@auriora/agent-workbench","version":"9.8.7"}\n');
    fs.writeFileSync(path.join(root, "node.exe"), "node");
    fs.writeFileSync(path.join(root, "manifest.json"), "ignored");
    const tarball = path.join(root, "source.tgz");
    const lockfile = path.join(root, "pnpm-lock.yaml");
    const deploymentLockfile = path.join(root, "deployment-lock.yaml");
    fs.writeFileSync(tarball, "source");
    fs.writeFileSync(lockfile, "lockfileVersion: '9.0'\n");
    fs.writeFileSync(deploymentLockfile, "lockfileVersion: '9.0'\npackages: {}\n");

    const firstHash = hashPayload(root);
    fs.writeFileSync(path.join(root, "manifest.json"), "different but still ignored");
    expect(hashPayload(root)).toBe(firstHash);
    const mutableConfig = path.join(
      packageRoot,
      "plugins",
      "agent-workbench",
      "claude-plugin",
      "hooks",
      "hooks.json"
    );
    fs.mkdirSync(path.dirname(mutableConfig), { recursive: true });
    fs.writeFileSync(mutableConfig, "before");
    const immutableHash = hashPayload(root);
    fs.writeFileSync(mutableConfig, "after");
    expect(hashPayload(root)).toBe(immutableHash);

    const manifest = createManifest({
      packageRoot,
      bundleRoot: root,
      packageTarball: tarball,
      lockfilePath: lockfile,
      deploymentLockfilePath: deploymentLockfile,
      gitSha: "b".repeat(40),
      nodeVersion: "22.23.1",
      nodeModulesAbi: "127"
    });
    expect(manifest).toMatchObject({
      version: "9.8.7",
      git_sha: "b".repeat(40),
      platform: "win32",
      architecture: "x64",
      node_version: "22.23.1",
      node_modules_abi: "127",
      package_root: "runtime/node_modules/@auriora/agent-workbench"
    });
    expect(manifest.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.source_package_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.source_lock_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.deployment_lock_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.deployment_lock_sha256).not.toBe(manifest.source_lock_sha256);
    expect(manifest.payload_hash_exclusions).toEqual(PAYLOAD_HASH_EXCLUSIONS);
  });

  it("rejects paths outside the bundle", () => {
    const root = makeTempRoot();
    const outside = makeTempRoot();
    expect(() => assertInside(root, path.join(root, "runtime"), "runtime")).not.toThrow();
    expect(() => assertInside(root, path.dirname(root), "runtime")).toThrow("escapes");
    expect(() => assertDisjointPaths(root, path.join(root, "bundle"), "deployment/output")).toThrow("disjoint");
    expect(() => assertDisjointPaths(root, outside, "deployment/output")).not.toThrow();
    const linked = path.join(root, "linked");
    fs.symlinkSync(outside, linked, "dir");
    expect(() => validateDeploymentRoot(linked)).toThrow("symlink or junction");
    expect(() => assertRealPathInside(root, linked, "linked deployment")).toThrow("resolves outside");
  });
});

function makeTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-windows-portable-test-"));
  tempRoots.push(root);
  return root;
}
