/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import { z } from "zod";
import type {
  McpRegistryContext,
  McpSurfaceParameterMetadata
} from "./index.js";

export const DEBUG_REPO_ROOT_OVERRIDE_ENV = "AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE";

export type RootAuthorityPolicy = {
  launchRoot: string;
  debugRepoRootOverride: boolean;
};

export type RootAuthorityDecision<T extends { repo_root?: string }> =
  | {
      ok: true;
      request: T & { repo_root: string };
    }
  | {
      ok: false;
      repoRoot: string;
      message: string;
    };

type McpRawShape = Record<string, z.ZodTypeAny>;

export function createRootAuthorityPolicy(input: {
  launchRoot: string;
  debugRepoRootOverride?: boolean;
}): RootAuthorityPolicy {
  return {
    launchRoot: path.resolve(input.launchRoot),
    debugRepoRootOverride: input.debugRepoRootOverride ?? false
  };
}

export function rootAuthorityPolicyFromEnv(input: {
  launchRoot: string;
  env?: NodeJS.ProcessEnv;
}): RootAuthorityPolicy {
  return createRootAuthorityPolicy({
    launchRoot: input.launchRoot,
    debugRepoRootOverride: input.env?.[DEBUG_REPO_ROOT_OVERRIDE_ENV] === "1"
  });
}

export function resolveMcpRequestRepoRoot<T extends { repo_root?: string }>(
  request: T,
  context: Pick<McpRegistryContext, "repoRoot" | "rootAuthorityPolicy">
): RootAuthorityDecision<T> {
  const policy = context.rootAuthorityPolicy ?? createRootAuthorityPolicy({
    launchRoot: context.repoRoot
  });
  if (request.repo_root !== undefined) {
    if (!policy.debugRepoRootOverride) {
      return {
        ok: false,
        repoRoot: policy.launchRoot,
        message:
          "repo_root override is blocked by launch-root authority. Restart Agent Workbench with AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1 for maintainer-only diagnostics."
      };
    }
    if (request.repo_root.trim().length === 0) {
      return {
        ok: false,
        repoRoot: policy.launchRoot,
        message: "repo_root override is empty and cannot be resolved for debug diagnostics."
      };
    }
    return {
      ok: true,
      request: {
        ...request,
        repo_root: path.resolve(request.repo_root)
      }
    };
  }

  return {
    ok: true,
    request: {
      ...request,
      repo_root: policy.launchRoot
    }
  };
}

export function normalMcpParameters(
  parameters: readonly McpSurfaceParameterMetadata[]
): readonly McpSurfaceParameterMetadata[] {
  return parameters.filter((parameter) => parameter.name !== "repo_root");
}

export function mcpShapeForRootAuthority<T extends McpRawShape>(
  shape: T,
  context: Pick<McpRegistryContext, "rootAuthorityPolicy">
): T | Omit<T, "repo_root"> {
  if (context.rootAuthorityPolicy?.debugRepoRootOverride === true) {
    return shape;
  }
  const { repo_root: _repoRoot, ...normalShape } = shape;
  return normalShape;
}
