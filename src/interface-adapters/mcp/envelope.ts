/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { ResponseEnvelope } from "../../contracts/index.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "./arguments/index.js";
import type { McpRegistryContext } from "./registries/index.js";
import {
  mcpShapeForRootAuthority,
  resolveMcpRequestRepoRoot
} from "./registries/root-authority.js";

export type McpFailureClass =
  | "invalid_input"
  | "provider_unavailable"
  | "workspace_safety_blocked"
  | "stale_state"
  | "environment_unavailable"
  | "domain_error"
  | "internal_error";

export type McpTextResponse = {
  content: Array<{
    type: "text";
    text: string;
  }>;
};

export type McpFailureEnvelopeInput<TRequest extends { repo_root?: string }> = {
  repoRoot: string;
  message: string;
  classification: McpFailureClass;
  args?: unknown;
  request?: TRequest;
};

type RegisterMcpToolWithEnvelopeInput<
  TRequest extends { repo_root?: string },
  TProvider,
  TResult
> = {
  server: McpServer;
  context: McpRegistryContext;
  name: string;
  description: string;
  rawShape: Record<string, z.ZodTypeAny>;
  schema: z.ZodType<TRequest>;
  invalidInputMessage: string;
  getProvider: (context: McpRegistryContext) => TProvider | undefined;
  buildFailureEnvelope: (input: McpFailureEnvelopeInput<TRequest>) => ResponseEnvelope<unknown>;
  invoke: (input: {
    provider: TProvider;
    request: TRequest & { repo_root: string };
    context: McpRegistryContext;
  }) => Promise<TResult> | TResult;
  present: (result: TResult) => ResponseEnvelope<unknown>;
  classifyError?: (error: unknown, request: TRequest & { repo_root: string }) => McpFailureClass;
};

export function registerMcpToolWithEnvelope<
  TRequest extends { repo_root?: string },
  TProvider,
  TResult
>(
  input: RegisterMcpToolWithEnvelopeInput<TRequest, TProvider, TResult>
): void {
  input.server.tool(
    input.name,
    input.description,
    mcpShapeForRootAuthority(input.rawShape, input.context),
    async (args: unknown) => {
      let request: TRequest;
      try {
        request = parseMcpArguments(input.schema, args);
      } catch (error) {
        return textResponse(input.buildFailureEnvelope({
          repoRoot: input.context.repoRoot,
          message: formatMcpArgumentError(error, input.invalidInputMessage),
          classification: "invalid_input",
          args
        }));
      }

      const rootDecision = resolveMcpRequestRepoRoot(request, input.context);
      if (!rootDecision.ok) {
        return textResponse(input.buildFailureEnvelope({
          repoRoot: rootDecision.repoRoot,
          message: rootDecision.message,
          classification: "invalid_input",
          args,
          request
        }));
      }

      const provider = input.getProvider(input.context);
      if (provider === undefined) {
        return textResponse(input.buildFailureEnvelope({
          repoRoot: rootDecision.request.repo_root,
          message: `${input.name} provider is not configured.`,
          classification: "provider_unavailable",
          args,
          request: rootDecision.request
        }));
      }

      try {
        return textResponse(input.present(await input.invoke({
          provider,
          request: rootDecision.request,
          context: input.context
        })));
      } catch (error) {
        const classification = input.classifyError?.(error, rootDecision.request) ?? "internal_error";
        return textResponse(input.buildFailureEnvelope({
          repoRoot: rootDecision.request.repo_root,
          message: errorMessage(error, `${input.name} failed.`),
          classification,
          args,
          request: rootDecision.request
        }));
      }
    }
  );
}

export function classifyWorkspaceEditError(error: unknown): McpFailureClass {
  const message = errorMessage(error, "").toLowerCase();
  if (message.includes("preview") && (
    message.includes("stale") ||
    message.includes("expired") ||
    message.includes("not found") ||
    message.includes("already consumed")
  )) {
    return "stale_state";
  }
  if (
    message.includes("secret-like") ||
    message.includes("refused") ||
    message.includes("outside") ||
    message.includes("not allowed")
  ) {
    return "workspace_safety_blocked";
  }
  return "domain_error";
}

export function classifyGraphQueryError(error: unknown): McpFailureClass {
  const message = errorMessage(error, "").toLowerCase();
  if (message.includes("enoent") || message.includes("no such file or directory")) {
    return "stale_state";
  }
  if (message.includes("eacces") || message.includes("permission denied")) {
    return "environment_unavailable";
  }
  if (
    message.includes("database is locked") ||
    message.includes("sqlite") ||
    message.includes("snapshot") ||
    message.includes("graph")
  ) {
    return "environment_unavailable";
  }
  return "internal_error";
}

export function classifyVerificationPlanError(error: unknown): McpFailureClass {
  const message = errorMessage(error, "").toLowerCase();
  if (
    message.includes("enoent") ||
    message.includes("no such file or directory") ||
    message.includes("scandir") ||
    message.includes("eacces") ||
    message.includes("permission denied")
  ) {
    return "environment_unavailable";
  }
  return "internal_error";
}

export function classifiedFailureEnvelope<T>(
  envelope: ResponseEnvelope<T>,
  input: Pick<McpFailureEnvelopeInput<{ repo_root?: string }>, "classification" | "message">
): ResponseEnvelope<T> {
  return {
    ...envelope,
    meta: {
      ...envelope.meta,
      ...metaForFailure(input.classification)
    },
    errors: [
      {
        code: input.classification,
        message: input.message,
        retryable: retryableFailure(input.classification)
      }
    ]
  };
}

export function textResponse(envelope: unknown): McpTextResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }]
  };
}

function metaForFailure(classification: McpFailureClass) {
  switch (classification) {
    case "environment_unavailable":
    case "provider_unavailable":
    case "internal_error":
      return {
        analysis_validity: "invalid_due_to_environment" as const,
        freshness: "unknown" as const,
        verification_status: "blocked" as const
      };
    case "stale_state":
      return {
        analysis_validity: "valid" as const,
        freshness: "stale" as const,
        verification_status: "blocked" as const
      };
    case "workspace_safety_blocked":
    case "domain_error":
    case "invalid_input":
      return {
        analysis_validity: "invalid" as const,
        freshness: "unknown" as const,
        verification_status: "blocked" as const
      };
  }
}

function retryableFailure(classification: McpFailureClass): boolean {
  return classification === "environment_unavailable" || classification === "internal_error";
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return fallback;
}
