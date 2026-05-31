import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CodexIntegrationProfile,
  FindReferencesRequest,
  ImpactRequest,
  SymbolSearchRequest,
  TaskContextRequest,
  VerificationPlanRequest
} from "../../../contracts/index.js";
import type { ComputeImpactResult } from "../../../application/use-cases/compute-impact.js";
import type { FindReferencesUseCaseResult } from "../../../application/use-cases/find-references.js";
import type { GetRepoOverviewResult } from "../../../application/use-cases/get-repo-overview.js";
import type { GetRepoScopeResult } from "../../../application/use-cases/get-repo-scope.js";
import type { GetTaskContextResult } from "../../../application/use-cases/get-task-context.js";
import type { GetRepoStatusResult } from "../../../application/use-cases/get-repo-status.js";
import type { PlanVerificationResult } from "../../../application/use-cases/plan-verification.js";
import type { SearchSymbolsResult } from "../../../application/use-cases/search-symbols.js";
import { codexIntegrationProfileResource } from "./resources/codex-integration-profile.js";
import { repoOverviewResource } from "./resources/repo-overview.js";
import { repoScopeResource } from "./resources/repo-scope.js";
import { repoStatusResource } from "./resources/repo-status.js";
import { contextForTaskTool } from "./tools/context-for-task.js";
import { findReferencesTool } from "./tools/find-references.js";
import { impactTool } from "./tools/impact.js";
import { symbolSearchTool } from "./tools/symbol-search.js";
import { verificationPlanTool } from "./tools/verification-plan.js";

export type McpRegistryContext = {
  repoRoot: string;
  getRepoStatus?: (input: { repo_root: string }) => Promise<GetRepoStatusResult> | GetRepoStatusResult;
  getRepoScope?: (input: { repo_root: string }) => Promise<GetRepoScopeResult> | GetRepoScopeResult;
  getRepoOverview?: (input: { repo_root: string }) => Promise<GetRepoOverviewResult> | GetRepoOverviewResult;
  getTaskContext?: (input: { request: TaskContextRequest }) => Promise<GetTaskContextResult> | GetTaskContextResult;
  searchSymbols?: (input: { request: SymbolSearchRequest }) => Promise<SearchSymbolsResult> | SearchSymbolsResult;
  findReferences?: (input: { request: FindReferencesRequest }) => Promise<FindReferencesUseCaseResult> | FindReferencesUseCaseResult;
  computeImpact?: (input: { request: ImpactRequest }) => Promise<ComputeImpactResult> | ComputeImpactResult;
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
  repoScopeResource,
  repoOverviewResource,
  codexIntegrationProfileResource
];

export const mcpTools: McpToolDeclaration[] = [
  contextForTaskTool,
  symbolSearchTool,
  findReferencesTool,
  impactTool,
  verificationPlanTool
];

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
