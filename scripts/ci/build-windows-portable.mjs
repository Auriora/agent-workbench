#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_RELATIVE_ROOT = path.join(
  "runtime",
  "node_modules",
  "@auriora",
  "agent-workbench"
);
const REQUIRED_NATIVE_PACKAGES = [
  "better-sqlite3",
  "tree-sitter",
  "tree-sitter-go",
  "tree-sitter-javascript",
  "tree-sitter-python",
  "tree-sitter-ruby",
  "tree-sitter-typescript"
];
export const PAYLOAD_HASH_EXCLUSIONS = [
  "manifest.json",
  "runtime/node_modules/@auriora/agent-workbench/plugins/agent-workbench/.mcp.json",
  "runtime/node_modules/@auriora/agent-workbench/plugins/agent-workbench/claude-plugin/.mcp.json",
  "runtime/node_modules/@auriora/agent-workbench/plugins/agent-workbench/claude-plugin/hooks/hooks.json"
];

export function parseArgs(argv) {
  const result = { packagePath: "", deploymentPath: "", lockfilePath: "", outputPath: "", gitSha: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--package") result.packagePath = value ?? "";
    else if (argument === "--deployment") result.deploymentPath = value ?? "";
    else if (argument === "--lockfile") result.lockfilePath = value ?? "";
    else if (argument === "--output") result.outputPath = value ?? "";
    else if (argument === "--git-sha") result.gitSha = value ?? "";
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!result.packagePath) throw new Error("--package is required");
  if (!result.deploymentPath) throw new Error("--deployment is required");
  if (!result.lockfilePath) throw new Error("--lockfile is required");
  if (!result.outputPath) throw new Error("--output is required");
  if (!/^[0-9a-f]{40}$/i.test(result.gitSha)) {
    throw new Error("--git-sha must be a full 40-character Git commit SHA");
  }
  return result;
}

export function validateBuildHost(platform = process.platform, arch = process.arch, nodeVersion = process.versions.node) {
  if (platform !== "win32") throw new Error(`Windows portable bundles must be built on win32, got ${platform}`);
  if (arch !== "x64") throw new Error(`Windows portable bundles require x64, got ${arch}`);
  if (Number(nodeVersion.split(".")[0]) !== 22) {
    throw new Error(`Windows portable bundles require Node 22, got ${nodeVersion}`);
  }
}

export function launcherText() {
  return [
    "@echo off",
    "setlocal",
    '"%~dp0node.exe" "%~dp0runtime\\node_modules\\@auriora\\agent-workbench\\packaging\\agent-workbench\\mcp-bin.mjs" %*',
    ""
  ].join("\r\n");
}

export function configureLauncherText() {
  return [
    "@echo off",
    "setlocal",
    '"%~dp0node.exe" "%~dp0runtime\\node_modules\\@auriora\\agent-workbench\\scripts\\configure-portable.mjs" --bundle-root "%~dp0." %*',
    ""
  ].join("\r\n");
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function hashPayload(rootPath, exclusions = PAYLOAD_HASH_EXCLUSIONS) {
  const hash = crypto.createHash("sha256");
  const excluded = new Set(exclusions.map((value) => value.replaceAll("\\", "/")));
  const files = listFiles(rootPath)
    .filter((relativePath) => !excluded.has(relativePath.replaceAll(path.sep, "/")))
    .sort((left, right) => left.localeCompare(right));
  for (const relativePath of files) {
    hash.update(relativePath.replaceAll(path.sep, "/"));
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(rootPath, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function createManifest({ packageRoot, bundleRoot, packageTarball, lockfilePath, deploymentLockfilePath, gitSha, nodeVersion, nodeModulesAbi }) {
  const packageManifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (packageManifest.name !== "@auriora/agent-workbench" || typeof packageManifest.version !== "string") {
    throw new Error("Installed package identity is not @auriora/agent-workbench with a version");
  }
  return {
    schema_version: "1",
    package: "@auriora/agent-workbench",
    version: packageManifest.version,
    git_sha: gitSha,
    platform: "win32",
    architecture: "x64",
    node_version: nodeVersion,
    node_modules_abi: nodeModulesAbi,
    package_root: PACKAGE_RELATIVE_ROOT.replaceAll(path.sep, "/"),
    entrypoint: "agent-workbench.cmd",
    configure: "configure.cmd",
    source_package_sha256: sha256File(packageTarball),
    source_lock_sha256: sha256File(lockfilePath),
    deployment_lock_sha256: sha256File(deploymentLockfilePath),
    payload_hash_exclusions: PAYLOAD_HASH_EXCLUSIONS,
    payload_sha256: hashPayload(bundleRoot)
  };
}

export function assertInside(rootPath, candidatePath, label) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} escapes ${rootPath}: ${candidatePath}`);
}

export function validateDeploymentRoot(deploymentRoot) {
  if (!fs.existsSync(deploymentRoot) || !fs.statSync(deploymentRoot).isDirectory()) {
    throw new Error(`Production deployment does not exist: ${deploymentRoot}`);
  }
  if (fs.lstatSync(deploymentRoot).isSymbolicLink()) {
    throw new Error(`Production deployment must not be a symlink or junction: ${deploymentRoot}`);
  }
}

export function assertDisjointPaths(leftPath, rightPath, label) {
  const left = path.resolve(leftPath);
  const right = path.resolve(rightPath);
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  const isInside = (relative) => relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  if (isInside(leftToRight) || isInside(rightToLeft)) {
    throw new Error(`${label} must use disjoint paths: ${left} and ${right}`);
  }
}

export function assertNoSymbolicLinks(rootPath) {
  const pending = [path.resolve(rootPath)];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Portable deployment contains a symbolic link or junction: ${target}`);
      }
      if (entry.isDirectory()) pending.push(target);
    }
  }
}

export function buildPortableBundle({ packagePath, deploymentPath, lockfilePath, outputPath, gitSha }) {
  validateBuildHost();
  const packageTarball = path.resolve(packagePath);
  const deploymentRoot = path.resolve(deploymentPath);
  const lockfile = path.resolve(lockfilePath);
  const bundleRoot = path.resolve(outputPath);
  assertDisjointPaths(deploymentRoot, bundleRoot, "Production deployment and bundle output");
  if (!fs.existsSync(packageTarball)) throw new Error(`Package tarball does not exist: ${packageTarball}`);
  if (!fs.existsSync(lockfile) || !fs.statSync(lockfile).isFile()) throw new Error(`Lockfile does not exist: ${lockfile}`);
  validateDeploymentRoot(deploymentRoot);
  if (fs.existsSync(bundleRoot)) throw new Error(`Output path already exists: ${bundleRoot}`);
  fs.mkdirSync(bundleRoot, { recursive: true });

  const runtimeRoot = path.join(bundleRoot, "runtime");
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const deployedNodeModules = path.join(deploymentRoot, "node_modules");
  if (!fs.existsSync(deployedNodeModules) || !fs.statSync(deployedNodeModules).isDirectory()) {
    throw new Error(`Production deployment is missing node_modules: ${deployedNodeModules}`);
  }
  const deployedLockfile = path.join(deploymentRoot, "pnpm-lock.yaml");
  if (!fs.existsSync(deployedLockfile) || !fs.statSync(deployedLockfile).isFile()) {
    throw new Error(`Production deployment is missing its pruned lockfile: ${deployedLockfile}`);
  }
  const runtimeNodeModules = path.join(runtimeRoot, "node_modules");
  fs.renameSync(deployedNodeModules, runtimeNodeModules);
  fs.mkdirSync(path.join(runtimeNodeModules, "@auriora"), { recursive: true });
  const packageRoot = path.join(bundleRoot, PACKAGE_RELATIVE_ROOT);
  fs.renameSync(deploymentRoot, packageRoot);
  assertInside(bundleRoot, packageRoot, "Installed package root");
  assertRealPathInside(bundleRoot, runtimeNodeModules, "Runtime node_modules");
  assertRealPathInside(bundleRoot, packageRoot, "Installed package root");
  assertNoSymbolicLinks(runtimeNodeModules);
  assertNoSymbolicLinks(packageRoot);
  for (const requiredPath of [
    path.join(packageRoot, "package.json"),
    path.join(packageRoot, "dist", "mcp", "stdio-entrypoint.mjs"),
    path.join(packageRoot, "scripts", "configure-portable.mjs")
  ]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`Portable package is missing ${requiredPath}`);
  }

  const nodeExecutable = path.join(bundleRoot, "node.exe");
  const nodeLicenseSource = path.join(path.dirname(process.execPath), "LICENSE");
  if (!fs.existsSync(nodeLicenseSource)) throw new Error(`Node license is missing beside node.exe: ${nodeLicenseSource}`);
  fs.copyFileSync(process.execPath, nodeExecutable);
  fs.copyFileSync(nodeLicenseSource, path.join(bundleRoot, "NODE-LICENSE"));
  fs.writeFileSync(path.join(bundleRoot, "agent-workbench.cmd"), launcherText(), "utf8");
  fs.writeFileSync(path.join(bundleRoot, "configure.cmd"), configureLauncherText(), "utf8");

  assertNativeLoads(nodeExecutable, packageRoot);
  const manifest = createManifest({
    packageRoot,
    bundleRoot,
    packageTarball,
    lockfilePath: lockfile,
    deploymentLockfilePath: path.join(packageRoot, "pnpm-lock.yaml"),
    gitSha,
    nodeVersion: process.versions.node,
    nodeModulesAbi: process.versions.modules
  });
  fs.writeFileSync(path.join(bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function assertRealPathInside(rootPath, candidatePath, label) {
  const rootRealPath = fs.realpathSync(rootPath);
  const candidateRealPath = fs.realpathSync(candidatePath);
  const relative = path.relative(rootRealPath, candidateRealPath);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} resolves outside ${rootPath}: ${candidateRealPath}`);
}

function assertNativeLoads(nodeExecutable, packageRoot) {
  const script = [
    'const { createRequire } = require("node:module");',
    'const path = require("node:path");',
    'const root = process.argv[1];',
    'const load = createRequire(path.join(root, "package.json"));',
    `for (const name of ${JSON.stringify(REQUIRED_NATIVE_PACKAGES)}) load(name);`,
    'const Database = load("better-sqlite3");',
    'const db = new Database(":memory:");',
    'db.prepare("select 1").get();',
    'db.close();'
  ].join("\n");
  const result = spawnSync(nodeExecutable, ["-e", script, packageRoot], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Portable native dependency load failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
}

function listFiles(rootPath, relativeRoot = "") {
  const directory = path.join(rootPath, relativeRoot);
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(rootPath, relativePath));
    else if (entry.isFile()) result.push(relativePath);
  }
  return result;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const manifest = buildPortableBundle(parseArgs(process.argv.slice(2)));
    process.stdout.write(`windows-portable-build OK ${JSON.stringify(manifest)}\n`);
  } catch (error) {
    process.stderr.write(`windows-portable-build FAIL: ${error.message}\n`);
    process.exitCode = 1;
  }
}
