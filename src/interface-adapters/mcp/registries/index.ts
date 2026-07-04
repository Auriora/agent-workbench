/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CodexIntegrationProfile,
  ApplyWorkspaceEditRequest,
  CheckMarkdownDocumentRequest,
  CheckMarkdownSetRequest,
  DiagnosticsForFilesRequest,
  DocsMapRequest,
  DocsCurrentForTaskRequest,
  DocsOutlineRequest,
  DocsOverviewRequest,
  DocsReadSectionRequest,
  DocsSearchRequest,
  FindReferencesRequest,
  ImpactRequest,
  IntegrationHealthRequest,
  PreviewWorkspaceEditRequest,
  SymbolSearchRequest,
  TaskContextRequest,
  ToolCapabilityClass,
  VerificationPlanRequest
} from "../../../contracts/index.js";
import type { ApplyWorkspaceEditUseCaseResult } from "../../../application/use-cases/apply-workspace-edit.js";
import type {
  CheckMarkdownDocumentUseCaseResult,
  CheckMarkdownSetUseCaseResult
} from "../../../application/use-cases/check-markdown-quality.js";
import type { ComputeImpactResult } from "../../../application/use-cases/compute-impact.js";
import type { DiagnoseChangedFilesResult } from "../../../application/use-cases/diagnose-changed-files.js";
import type {
  DocsMapUseCaseResult,
  DocsOutlineUseCaseResult,
  DocsOverviewUseCaseResult,
  DocsReadSectionUseCaseResult,
  DocsSearchUseCaseResult
} from "../../../application/use-cases/query-docs.js";
import type { CurrentDocsForTaskUseCaseResult } from "../../../application/use-cases/current-docs-for-task.js";
import type { FindReferencesUseCaseResult } from "../../../application/use-cases/find-references.js";
import type { GetIntegrationHealthResult } from "../../../application/use-cases/get-integration-health.js";
import type { GetRepoOverviewResult } from "../../../application/use-cases/get-repo-overview.js";
import type { GetRepoScopeResult } from "../../../application/use-cases/get-repo-scope.js";
import type { GetTaskContextResult } from "../../../application/use-cases/get-task-context.js";
import type { GetRepoStatusResult } from "../../../application/use-cases/get-repo-status.js";
import type { PlanVerificationResult } from "../../../application/use-cases/plan-verification.js";
import type { PreviewWorkspaceEditUseCaseResult } from "../../../application/use-cases/preview-workspace-edit.js";
import type { SearchSymbolsResult } from "../../../application/use-cases/search-symbols.js";
import { codexIntegrationProfileResource } from "./resources/codex-integration-profile.js";
import { integrationHealthResource } from "./resources/integration-health.js";
import { checkMarkdownDocumentTool } from "./tools/check-markdown-document.js";
import { checkMarkdownSetTool } from "./tools/check-markdown-set.js";
import { docsMapResource } from "./resources/docs-map.js";
import { docsOverviewResource } from "./resources/docs-overview.js";
import { repoOverviewResource } from "./resources/repo-overview.js";
import { repoScopeResource } from "./resources/repo-scope.js";
import { repoStatusResource } from "./resources/repo-status.js";
import { contextForTaskTool } from "./tools/context-for-task.js";
import { diagnosticsForFilesTool } from "./tools/diagnostics-for-files.js";
import { docsScopeTool } from "./tools/docs-scope.js";
import { docsOutlineTool } from "./tools/docs-outline.js";
import { docsReadSectionTool } from "./tools/docs-read-section.js";
import { docsSearchTool } from "./tools/docs-search.js";
import { docsCurrentForTaskTool } from "./tools/docs-current-for-task.js";
import { applyWorkspaceEditTool } from "./tools/apply-workspace-edit.js";
import { findReferencesTool } from "./tools/find-references.js";
import { impactTool } from "./tools/impact.js";
import { previewWorkspaceEditTool } from "./tools/preview-workspace-edit.js";
import { symbolSearchTool } from "./tools/symbol-search.js";
import { verificationPlanTool } from "./tools/verification-plan.js";
import type { DocsSessionScopeState } from "./docs-session-scope.js";

export type McpRegistryContext = {
  repoRoot: string;
  docsSessionScope?: DocsSessionScopeState;
  getRepoStatus?: (input: { repo_root: string }) => Promise<GetRepoStatusResult> | GetRepoStatusResult;
  getRepoScope?: (input: { repo_root: string }) => Promise<GetRepoScopeResult> | GetRepoScopeResult;
  getRepoOverview?: (input: { repo_root: string }) => Promise<GetRepoOverviewResult> | GetRepoOverviewResult;
  getDocsOverview?: (input: { request: DocsOverviewRequest }) => Promise<DocsOverviewUseCaseResult> | DocsOverviewUseCaseResult;
  getDocsMap?: (input: { request: DocsMapRequest }) => Promise<DocsMapUseCaseResult> | DocsMapUseCaseResult;
  searchDocs?: (input: { request: DocsSearchRequest }) => Promise<DocsSearchUseCaseResult> | DocsSearchUseCaseResult;
  getCurrentDocsForTask?: (input: { request: DocsCurrentForTaskRequest }) => Promise<CurrentDocsForTaskUseCaseResult> | CurrentDocsForTaskUseCaseResult;
  getDocsOutline?: (input: { request: DocsOutlineRequest }) => Promise<DocsOutlineUseCaseResult> | DocsOutlineUseCaseResult;
  readDocsSection?: (input: { request: DocsReadSectionRequest }) => Promise<DocsReadSectionUseCaseResult> | DocsReadSectionUseCaseResult;
  checkMarkdownDocument?: (input: { request: CheckMarkdownDocumentRequest }) => Promise<CheckMarkdownDocumentUseCaseResult> | CheckMarkdownDocumentUseCaseResult;
  checkMarkdownSet?: (input: { request: CheckMarkdownSetRequest }) => Promise<CheckMarkdownSetUseCaseResult> | CheckMarkdownSetUseCaseResult;
  getTaskContext?: (input: { request: TaskContextRequest }) => Promise<GetTaskContextResult> | GetTaskContextResult;
  diagnoseChangedFiles?: (input: { request: DiagnosticsForFilesRequest }) => Promise<DiagnoseChangedFilesResult> | DiagnoseChangedFilesResult;
  searchSymbols?: (input: { request: SymbolSearchRequest }) => Promise<SearchSymbolsResult> | SearchSymbolsResult;
  findReferences?: (input: { request: FindReferencesRequest }) => Promise<FindReferencesUseCaseResult> | FindReferencesUseCaseResult;
  computeImpact?: (input: { request: ImpactRequest }) => Promise<ComputeImpactResult> | ComputeImpactResult;
  previewWorkspaceEdit?: (input: { request: PreviewWorkspaceEditRequest }) => Promise<PreviewWorkspaceEditUseCaseResult> | PreviewWorkspaceEditUseCaseResult;
  applyWorkspaceEdit?: (input: { request: ApplyWorkspaceEditRequest }) => Promise<ApplyWorkspaceEditUseCaseResult> | ApplyWorkspaceEditUseCaseResult;
  planVerification?: (input: { request: VerificationPlanRequest }) => Promise<PlanVerificationResult> | PlanVerificationResult;
  describeCodexIntegrationProfile?: () => CodexIntegrationProfile;
  getIntegrationHealth?: (input: { request: IntegrationHealthRequest }) => Promise<GetIntegrationHealthResult> | GetIntegrationHealthResult;
};

export type McpResourceDeclaration = {
  kind: "resource";
  name: string;
  uri: string;
  metadata: McpSurfaceMetadata;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export type McpToolDeclaration = {
  kind: "tool";
  name: string;
  metadata: McpSurfaceMetadata;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export type McpPromptDeclaration = {
  kind: "prompt";
  name: string;
  metadata: McpSurfaceMetadata;
  register: (server: McpServer, context: McpRegistryContext) => void;
};

export type McpMutationClass = "none" | "workspace_write" | "planning";

export type McpSurfaceParameterMetadata = {
  name: string;
  description: string;
  required: boolean;
};

export type McpSurfaceMetadata = {
  capability_class: ToolCapabilityClass;
  mutation_class: McpMutationClass;
  budget_policy: string;
  description: string;
  parameters: readonly McpSurfaceParameterMetadata[];
  returns: string;
};

export const mcpResources: McpResourceDeclaration[] = [
  repoStatusResource,
  repoScopeResource,
  repoOverviewResource,
  docsOverviewResource,
  docsMapResource,
  codexIntegrationProfileResource,
  integrationHealthResource
];

export const mcpTools: McpToolDeclaration[] = [
  contextForTaskTool,
  diagnosticsForFilesTool,
  docsScopeTool,
  docsSearchTool,
  docsCurrentForTaskTool,
  docsOutlineTool,
  docsReadSectionTool,
  checkMarkdownDocumentTool,
  checkMarkdownSetTool,
  symbolSearchTool,
  findReferencesTool,
  impactTool,
  previewWorkspaceEditTool,
  applyWorkspaceEditTool,
  verificationPlanTool
];

export const mcpPrompts: McpPromptDeclaration[] = [];

export function registerAllMcpSurfaces(
  server: McpServer,
  context: McpRegistryContext
): void {
  const registryContext: McpRegistryContext = {
    ...context,
    docsSessionScope: context.docsSessionScope ?? {}
  };
  for (const resource of mcpResources) {
    resource.register(server, registryContext);
  }

  for (const tool of mcpTools) {
    tool.register(server, registryContext);
  }

  for (const prompt of mcpPrompts) {
    prompt.register(server, registryContext);
  }
}
