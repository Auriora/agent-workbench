import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CodexIntegrationProfile,
  TaskContextRequest,
  VerificationPlanRequest
} from "../../../contracts/index.js";
import type { GetTaskContextResult } from "../../../application/use-cases/get-task-context.js";
import type { GetRepoStatusResult } from "../../../application/use-cases/get-repo-status.js";
import type { PlanVerificationResult } from "../../../application/use-cases/plan-verification.js";
import { codexIntegrationProfileResource } from "./resources/codex-integration-profile.js";
import { repoStatusResource } from "./resources/repo-status.js";
import { contextForTaskTool } from "./tools/context-for-task.js";
import { verificationPlanTool } from "./tools/verification-plan.js";

export type McpRegistryContext = {
  repoRoot: string;
  getRepoStatus?: (input: { repo_root: string }) => Promise<GetRepoStatusResult> | GetRepoStatusResult;
  getTaskContext?: (input: { request: TaskContextRequest }) => Promise<GetTaskContextResult> | GetTaskContextResult;
  planVerification?: (input: { request: VerificationPlanRequest }) => Promise<PlanVerificationResult> | PlanVerificationResult;
  describeCodexIntegrationProfile?: () => CodexIntegrationProfile;
};

export type McpResourceDeclaration = {
  kind: "resource";
  name: string;
  uri: string;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export type McpToolDeclaration = {
  kind: "tool";
  name: string;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export type McpPromptDeclaration = {
  kind: "prompt";
  name: string;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export const mcpResources: McpResourceDeclaration[] = [
  repoStatusResource,
  codexIntegrationProfileResource
];

export const mcpTools: McpToolDeclaration[] = [contextForTaskTool, verificationPlanTool];

export const mcpPrompts: McpPromptDeclaration[] = [];

export function registerAllMcpSurfaces(
  server: McpServer,
  context: McpRegistryContext
): void {
  for (const resource of mcpResources) {
    resource.register(server, context);
  }

  for (const tool of mcpTools) {
    tool.register(server, context);
  }

  for (const prompt of mcpPrompts) {
    prompt.register(server, context);
  }
}
