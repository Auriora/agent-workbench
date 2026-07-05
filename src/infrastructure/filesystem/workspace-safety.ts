/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { classifyPathPolicy, parseGitignoreRules, type GitignoreRule } from "../../domain/policies/index.js";

const DEFAULT_WORKSPACE_GENERATED_ROOTS = ["generated"];

export type PathDecision =
  | {
      allowed: true;
      absolutePath: string;
      relativePath: string;
      readOnly: boolean;
    }
  | {
      allowed: false;
      reason: "path_refused";
      message: string;
      requestedPath: string;
    };

export type WorkspaceSafetyPolicy = {
  repoRoot: string;
  generatedRoots?: string[];
  vendorRoots?: string[];
  skippedRoots?: string[];
  allowGeneratedWrites?: boolean;
};

function normalizeRepoRoot(repoRoot: string): string {
  return fs.realpathSync(repoRoot);
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveWorkspacePath(
  policy: WorkspaceSafetyPolicy,
  requestedPath: string,
  options: { write?: boolean } = {}
): PathDecision {
  const repoRoot = normalizeRepoRoot(policy.repoRoot);
  const candidate = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(repoRoot, requestedPath);

  let realCandidate: string;
  try {
    realCandidate = fs.realpathSync(candidate);
  } catch {
    realCandidate = fs.realpathSync(path.dirname(candidate));
    realCandidate = path.join(realCandidate, path.basename(candidate));
  }

  if (!isInside(repoRoot, realCandidate)) {
    return {
      allowed: false,
      reason: "path_refused",
      message: "Path resolves outside the repository root.",
      requestedPath
    };
  }

  const relativePath = path.relative(repoRoot, realCandidate).split(path.sep).join("/");
  const classification = classifyPathPolicy({
    relativePath,
    isDirectory: directoryExists(realCandidate),
    skippedRoots: policy.skippedRoots ?? [],
    generatedRoots: policy.generatedRoots ?? DEFAULT_WORKSPACE_GENERATED_ROOTS,
    vendorRoots: policy.vendorRoots ?? [],
    gitignoreRules: readRootIgnoreRules(repoRoot)
  });
  const readOnly = classification.writePolicy === "refuse";
  const generatedOverrideAllowed =
    policy.allowGeneratedWrites === true &&
    ["generated", "vendor", "configured_skip"].includes(classification.category);

  if (options.write && readOnly && !generatedOverrideAllowed) {
    return {
      allowed: false,
      reason: "path_refused",
      message: workspaceRefusalMessage(classification.reason),
      requestedPath
    };
  }

  return {
    allowed: true,
    absolutePath: realCandidate,
    relativePath,
    readOnly
  };
}

function directoryExists(absolutePath: string): boolean {
  try {
    return fs.statSync(absolutePath).isDirectory();
  } catch {
    return false;
  }
}

function readRootIgnoreRules(repoRoot: string): GitignoreRule[] {
  return [".gitignore", ".aiignore"].flatMap((ignoreFileName) => readRootIgnoreFileRules(repoRoot, ignoreFileName));
}

function readRootIgnoreFileRules(repoRoot: string, ignoreFileName: string): GitignoreRule[] {
  const ignoreFilePath = path.join(repoRoot, ignoreFileName);
  if (!fs.existsSync(ignoreFilePath)) return [];
  try {
    return parseGitignoreRules(fs.readFileSync(ignoreFilePath, "utf8"));
  } catch (_error) {
    return [];
  }
}

function workspaceRefusalMessage(reason: string): string {
  switch (reason) {
    case "secret":
      return "Secret-bearing paths are refused by default.";
    case "hidden_path":
      return "Hidden local paths are read-only by default.";
    case "gitignore":
      return "Ignored paths are read-only by default.";
    case "configured_skip":
      return "Configured skipped paths are read-only by default.";
    case "nested_git_repository":
      return "Nested repository paths are read-only by default.";
    case "generated_or_vendor":
    default:
      return "Generated or vendor paths are read-only by default.";
  }
}

export class WorkspaceSafetyAdapter {
  constructor(private readonly policy: WorkspaceSafetyPolicy) {}

  public resolveWorkspacePath(
    requestedPath: string,
    options: { write?: boolean } = {}
  ): PathDecision {
    return resolveWorkspacePath(this.policy, requestedPath, options);
  }

  public redactSecretLikeText(value: string): string {
    return redactSecretLikeText(value);
  }

  public isReadOnlyPath(requestedPath: string): boolean {
    const decision = this.resolveWorkspacePath(requestedPath);
    return !decision.allowed || decision.readOnly;
  }
}

export function redactSecretLikeText(value: string): string {
  return value
    .replace(/(api[_-]?key|token|password|secret)=([^\s]+)/gi, "$1=[REDACTED]")
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");
}
