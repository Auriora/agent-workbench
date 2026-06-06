import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  diagnosticsForFilesRequestSchema,
  type DiagnosticsForFilesRequest
} from "../../../../contracts/index.js";
import {
  buildDiagnosticsForFilesEnvelope,
  buildInvalidDiagnosticsForFilesInputEnvelope
} from "../../../../presentation/diagnostics-presenter.js";
import {
  formatMcpArgumentError,
  parseMcpArguments
} from "../../arguments/index.js";
import type { McpToolDeclaration } from "../index.js";
import { withDefaultRepoRoot } from "../repo-root-default.js";

const diagnosticsForFilesRawShape = {
  repo_root: z.string().optional().describe("Optional repository root. Defaults to the MCP server repo root."),
  files: z.array(z.string()).default([]).describe("Repo-relative files to check with configured diagnostics providers."),
  max_files: z.number().int().positive().max(50).default(20).describe("Maximum files to check.")
};

export const diagnosticsForFilesTool: McpToolDeclaration = {
  kind: "tool",
  name: "diagnostics_for_files",
  metadata: {
    capability_class: "read_only",
    mutation_class: "none",
    budget_policy: "Bounded by max_files and provider budgets; never mutates files or executes validation commands.",
    description: "Run compact provider-backed diagnostics for repo-relative files without executing validation commands.",
    parameters: [
      { name: "repo_root", description: "Optional repository root. Defaults to the MCP server repo root.", required: false },
      { name: "files", description: "Repo-relative files to check with configured diagnostics providers.", required: false },
      { name: "max_files", description: "Maximum files to check.", required: false }
    ],
    returns: "ResponseEnvelope<DiagnosticsForFiles>"
  },
  register(server: McpServer, context) {
    server.tool(
      "diagnostics_for_files",
      "Run compact provider-backed diagnostics for repo-relative files without executing validation commands.",
      diagnosticsForFilesRawShape,
      async (args: unknown) => {
        let request: DiagnosticsForFilesRequest;
        try {
          request = parseMcpArguments(diagnosticsForFilesRequestSchema, args);
        } catch (error) {
          const message = formatMcpArgumentError(
            error,
            "Invalid diagnostics_for_files arguments."
          );
          const envelope = buildInvalidDiagnosticsForFilesInputEnvelope({
            repoRoot: context.repoRoot,
            message
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(envelope, null, 2)
              }
            ]
          };
        }

        if (context.diagnoseChangedFiles === undefined) {
          const envelope = buildInvalidDiagnosticsForFilesInputEnvelope({
            repoRoot: context.repoRoot,
            message: "diagnostics_for_files provider is not configured."
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(envelope, null, 2)
              }
            ]
          };
        }

        let result;
        try {
          result = await context.diagnoseChangedFiles({
            request: withDefaultRepoRoot(request, context.repoRoot)
          });
        } catch (error) {
          const envelope = buildInvalidDiagnosticsForFilesInputEnvelope({
            repoRoot: request.repo_root ?? context.repoRoot,
            message: `diagnostics_for_files provider failed before diagnostics could complete: ${error instanceof Error ? error.message : String(error)}`
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(envelope, null, 2)
              }
            ]
          };
        }

        const envelope = buildDiagnosticsForFilesEnvelope(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(envelope, null, 2)
            }
          ]
        };
      }
    );
  }
};
