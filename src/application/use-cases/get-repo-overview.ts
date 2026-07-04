/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  DocumentReference,
  FileReference,
  RepoOverview,
  ResponseMetadata,
  SkippedPath,
  ValidationHint
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  FileCatalogScanPort,
  FileCatalogSkippedPath,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../ports/index.js";
import { classifyMarkdownDoc } from "../../domain/policies/index.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import {
  detectJsTsProjectShape,
  isJsTsProjectConfigPath,
  isJsTsTestPath
} from "./js-ts-project-shape.js";
import {
  detectMcpServerShape,
  isMcpServerEvidencePath,
  mcpEvidenceReason,
  mcpTransportLabels
} from "./mcp-server-shape.js";

export type GetRepoOverviewResult = {
  overview: RepoOverview;
  meta: ResponseMetadata;
};

export async function getRepoOverview(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  snapshots?: SnapshotPort;
  warmups?: WarmupCoordinatorPort;
}): Promise<GetRepoOverviewResult> {
  const [scanned, snapshot, warmup] = await Promise.all([
    input.scanner.scan({
      repo_root: input.repo_root,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 15000
    }),
    input.snapshots?.getSnapshot({ repo_root: input.repo_root }) ?? Promise.resolve(undefined),
    input.warmups?.getState({ repo_root: input.repo_root }) ?? Promise.resolve(undefined)
  ]);
  const languages = uniqueSorted(scanned.files.map((file) => file.file_identity.language));
  const status = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: snapshot?.freshness ?? "unknown",
    snapshot: snapshot ?? undefined,
    warmup: warmup ?? undefined
  });

  return {
    overview: {
      repo_root: scanned.repo_root,
      summary: `Repository has ${scanned.files.length} indexed file(s) across ${languages.length} language/category value(s).`,
      languages,
      platforms: detectPlatforms(scanned.files),
      key_files: selectKeyFiles(scanned.files),
      key_docs: selectKeyDocs(scanned.files),
      validation_hints: inferValidationHints(scanned.files),
      skipped_paths: mapSkippedPaths(scanned.skipped_paths ?? []),
      recommended_first_calls: [
        { tool: "read_resource", args: { uri: "repo:///status" } },
        { tool: "read_resource", args: { uri: "repo:///scope" } },
        { tool: "context_for_task", args: { task: "Describe the planned change before editing." } },
        { tool: "verification_plan", args: { files: [] } }
      ]
    },
    meta: {
      ...status.meta,
      truncated: scanned.truncated,
      budget: {
        row_limit: 15000
      }
    }
  };
}

function mapSkippedPaths(skippedPaths: readonly FileCatalogSkippedPath[]): SkippedPath[] | undefined {
  if (skippedPaths.length === 0) {
    return undefined;
  }
  return skippedPaths.slice(0, 20).map((skipped) => ({
    path: skipped.path,
    reason: skipped.reason,
    detail: skipped.detail
  }));
}

function selectKeyFiles(files: readonly FileCatalogEntry[]): FileReference[] {
  return files
    .filter((file) => isKeyFile(file.path))
    .sort((left, right) => keyFileEvidence(right).score - keyFileEvidence(left).score || left.path.localeCompare(right.path))
    .slice(0, 20)
    .map((file) => ({
      path: file.path,
      language: file.file_identity.language,
      exists: true,
      capability_level: file.adapter_evidence?.capability_level ?? "unsupported",
      evidence_kinds: file.adapter_evidence?.evidence_kinds ?? [],
      reason: keyFileEvidence(file).reason
    }));
}

function selectKeyDocs(files: readonly FileCatalogEntry[]): DocumentReference[] {
  return files
    .filter((file) => file.file_identity.language === "markdown")
    .filter((file) => isOverviewDocCandidate(file.path))
    .sort((left, right) => docRank(right.path) - docRank(left.path) || left.path.localeCompare(right.path))
    .slice(0, 10)
    .map((file) => {
      const title = titleFromPath(file.path);
      const authority = classifyMarkdownDoc({ path: file.path, title });
      return {
        path: file.path,
        title,
        reason: `${reasonForDoc(file.path)} ${authority.authority_caveat}`,
        evidence_kinds: ["docs"],
        ...publicAuthority(authority)
      };
    });
}

function isOverviewDocCandidate(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower === "readme.md" ||
    lower === "agents.md" ||
    lower.startsWith("docs/") ||
    lower.startsWith("skills/") ||
    lower.includes("/skills/")
  );
}

function docRank(filePath: string): number {
  const lower = filePath.toLowerCase();
  const authority = classifyMarkdownDoc({ path: filePath, title: titleFromPath(filePath) });
  let score = 0;
  if (lower === "agents.md") score += 220;
  if (lower === "readme.md") score += 210;
  if (lower.startsWith("docs/guides/")) score += 90;
  if (lower.includes("architecture") || lower.includes("design")) score += 70;
  if (lower.includes("runbook") || lower.includes("operations") || lower.includes("developer")) score += 60;
  if (lower.startsWith("docs/reference/")) score += 50;
  if (lower.startsWith("skills/") || lower.includes("/skills/")) score += 85;
  if (lower.endsWith("/skill.md")) score += 45;
  if (lower.includes("template")) score -= 80;
  if (lower.includes("/fixtures/") || lower.startsWith("tests/fixtures/")) score -= 140;
  if (lower.includes("/archive/") || lower.startsWith("docs/archive/")) score -= 70;
  if (lower.includes("/updates/") || lower.startsWith("docs/updates/")) score -= 60;
  if (lower.includes("project-management") || lower.includes("/plans/")) score -= 40;
  score += authority.priority * 10;
  return score;
}

function reasonForDoc(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower === "readme.md") return "Repository entry document.";
  if (lower === "agents.md") return "Agent guidance document.";
  if (lower.startsWith("docs/guides/")) return "Durable guide document.";
  if (lower.includes("architecture") || lower.includes("design")) return "Durable architecture or design document.";
  if (lower.startsWith("docs/reference/")) return "Durable reference document.";
  if (lower.startsWith("skills/") || lower.includes("/skills/")) return "Canonical skill guidance document.";
  return "Repository documentation file.";
}

function inferValidationHints(files: readonly FileCatalogEntry[]): ValidationHint[] {
  const paths = new Set(files.map((file) => file.path));
  const hints: ValidationHint[] = [];
  const hasCmake = hasCMakeEvidence(paths);
  const hasCpp = files.some((file) => file.file_identity.language === "c" || file.file_identity.language === "cpp");
  const hasGo = paths.has("go.mod") || paths.has("go.work");
  const hasPackage = paths.has("package.json");
  const jsTsShape = detectJsTsProjectShape(files);
  const hasJsTsShape =
    jsTsShape.package_manifests.length > 0 ||
    jsTsShape.workspace_files.length > 0 ||
    jsTsShape.tsconfig_files.length > 0 ||
    jsTsShape.source_files.length > 0 ||
    jsTsShape.generated_files.length > 0;
  const hasDocsOrConfig = files.some((file) => ["config", "markdown", "json", "toml", "yaml"].includes(file.file_identity.language));
  const dotnetSolution = firstDotnetSolution(paths);
  const dotnetTestProject = firstDotnetTestProject(paths);
  const samTemplate = firstSamTemplate(paths);

  if (samTemplate !== undefined) {
    hints.push({
      command: "verification_plan",
      reason: `${samTemplate} indicates SAM/CloudFormation validation is available; use verification planning for non-executed cfn/SAM checks.`,
      status: "needed"
    });
  }
  if (dotnetSolution !== undefined) {
    hints.push({
      command: "verification_plan",
      reason: `${dotnetSolution} indicates .NET validation is available; project/test discovery should plan non-executed dotnet commands.`,
      status: "needed"
    });
  } else if (hasDotnetProject(paths)) {
    hints.push({
      command: "verification_plan",
      reason: ".NET project files indicate dotnet build/test validation may be available.",
      status: "needed"
    });
  }
  if (dotnetTestProject !== undefined) {
    hints.push({
      command: "dotnet test",
      reason: `${dotnetTestProject} is marked as a test project.`,
      status: "needed"
    });
  }
  if (hasCmake && hasCpp) {
    hints.push({
      command: "manual_review cmake-build-test",
      reason: "CMakeLists.txt and C/C++ files indicate CMake build/test validation should drive this repository area.",
      status: "needed"
    });
  }
  if (hasGo) {
    hints.push({
      command: "verification_plan",
      reason: "go.mod/go.work indicates Go validation is available; repo guidance may constrain whether host or container commands are allowed.",
      status: "needed"
    });
  }
  if (hasDevcontainerEvidence(paths)) {
    hints.push({
      command: "manual_review devcontainer-validation-environment",
      reason: ".devcontainer configuration indicates containerized development environment evidence; it is not proof of Docker-only validation by itself.",
      status: "needed"
    });
  }
  const mcpShape = detectMcpServerShape(paths);
  if (mcpShape.detected) {
    hints.push({
      command: "verification_plan",
      reason: [
        `MCP server ${mcpShape.confidence}-confidence evidence is present`,
        mcpShape.transports.length > 0 ? `transports: ${mcpTransportLabels(mcpShape.transports).join(", ")}` : "transport evidence is incomplete",
        "plan initialize/tools-list/call-tool smoke checks without execution"
      ].join("; "),
      status: "needed"
    });
  }
  if (hasDockerComposeEvidence(paths)) {
    hints.push({
      command: "manual_review compose-validation-environment",
      reason: "Docker Compose configuration indicates container workflow evidence; explicit repo guidance or policy is still required before suppressing host commands.",
      status: "needed"
    });
  }
  if (hasJsTsShape && !(hasCmake && hasCpp) && !hasGo) {
    const packageEvidence = jsTsShape.package_manifests[0] ?? "package.json";
    hints.push({
      command: "verification_plan",
      reason: `${packageEvidence} and JS/TS project-shape evidence indicate package-local validation should be planned without executing package managers.`,
      status: "needed"
    });
    hints.push({
      command: "pnpm typecheck",
      reason: "TypeScript configuration or package scripts indicate a non-executed typecheck candidate; confirm repo policy and package manager before running.",
      status: "needed"
    });
    hints.push({
      command: "pnpm test",
      reason: "Package/test-root evidence indicates a non-executed JavaScript/TypeScript test candidate; confirm repo policy and package manager before running.",
      status: "needed"
    });
  }
  if (paths.has("pyproject.toml")) {
    hints.push({ command: "python3 -m pytest", reason: "pyproject.toml indicates Python tests may be available.", status: "needed" });
  }
  if (
    hasDocsOrConfig &&
    samTemplate === undefined &&
    dotnetSolution === undefined &&
    !hasDotnetProject(paths) &&
    !(hasCmake && hasCpp) &&
    !hasGo &&
    !hasPackage &&
    !paths.has("pyproject.toml")
  ) {
    hints.push({
      command: "manual_review docs-config-syntax",
      reason: "Documentation or configuration files indicate syntax, metadata, and link/readability checks may be useful even when no code test runner is present.",
      status: "needed"
    });
  }
  return hints;
}

function detectPlatforms(files: readonly FileCatalogEntry[]): string[] {
  const paths = new Set(files.map((file) => file.path));
  const platforms = new Set<string>();
  if (paths.has("package.json")) platforms.add("node");
  const jsTsShape = detectJsTsProjectShape(files);
  if (jsTsShape.has_typescript || jsTsShape.tsconfig_files.length > 0) platforms.add("typescript");
  if (jsTsShape.has_javascript) platforms.add("javascript");
  if (paths.has("pyproject.toml")) platforms.add("python");
  if (firstDotnetSolution(paths) !== undefined || hasDotnetProject(paths)) platforms.add("dotnet");
  if (firstSamTemplate(paths) !== undefined) {
    platforms.add("aws_lambda");
    platforms.add("cloudformation");
    platforms.add("sam");
  }
  if (paths.has("go.mod") || paths.has("go.work")) platforms.add("go");
  if (hasCMakeEvidence(paths)) platforms.add("cmake");
  if (hasDockerEvidence(paths)) platforms.add("docker");
  if (hasDevcontainerEvidence(paths)) platforms.add("devcontainer");
  const mcpShape = detectMcpServerShape(paths);
  if (mcpShape.detected) {
    platforms.add("mcp_server");
    for (const transport of mcpShape.transports) {
      platforms.add(`mcp_${transport}`);
    }
  }
  if ([...paths].some((file) => file.startsWith(".github/workflows/"))) platforms.add("github_actions");
  return [...platforms].sort();
}

function isKeyFile(filePath: string): boolean {
  return (
    filePath === "package.json" ||
    filePath === "pyproject.toml" ||
    filePath === "go.mod" ||
    filePath === "go.work" ||
    lowerExtension(filePath) === ".sln" ||
    lowerExtension(filePath) === ".csproj" ||
    lowerExtension(filePath) === ".fsproj" ||
    lowerExtension(filePath) === ".vbproj" ||
    isSamTemplatePath(filePath) ||
    isLambdaHandlerPath(filePath) ||
    pathBasename(filePath).toLowerCase() === "program.cs" ||
    pathBasename(filePath).toLowerCase().startsWith("appsettings") ||
    pathBasename(filePath).toLowerCase().endsWith(".razor") ||
    isJsTsProjectConfigPath(filePath) ||
    filePath.toLowerCase().includes("/controllers/") ||
    filePath.toLowerCase().includes("/routes/") ||
    filePath.toLowerCase().includes("/components/") ||
    filePath.toLowerCase().includes("/migrations/") ||
    pathBasename(filePath).toLowerCase() === "cmakelists.txt" ||
    filePath === "Dockerfile" ||
    filePath.startsWith(".devcontainer/") ||
    filePath.startsWith(".github/workflows/") ||
    filePath.startsWith("apps/") ||
    filePath.startsWith("packages/") ||
    filePath.startsWith("services/") ||
    isMcpServerEvidencePath(filePath) ||
    filePath.startsWith("src/") ||
    filePath.startsWith("tests/")
  );
}

function keyFileEvidence(file: FileCatalogEntry): { score: number; reason: string } {
  const lower = file.path.toLowerCase();
  const reasons: string[] = [];
  let score = baseKeyFileRank(file);
  if (lower.endsWith(".sln")) {
    reasons.push("project configuration");
  }
  if (lower.endsWith(".csproj") || lower.endsWith(".fsproj") || lower.endsWith(".vbproj")) {
    reasons.push(lower.includes("test") ? "test project configuration" : "project configuration");
  }
  if (isSamTemplatePath(lower)) {
    reasons.push("infrastructure template");
  }
  if (isLambdaHandlerPath(lower)) {
    reasons.push("application entrypoint");
  }
  if (lower === "cmakelists.txt") {
    reasons.push("build configuration");
  } else if (lower.endsWith("/cmakelists.txt")) {
    reasons.push("build configuration");
  }
  if (lower.includes("/tests/infra/") || lower.includes("/test/infra/")) {
    reasons.push("infrastructure test");
  }
  if (lower === "go.mod" || lower === "go.work") {
    reasons.push("package configuration");
  }
  if (lower === "pyproject.toml" || lower === "package.json") {
    reasons.push("package configuration");
  }
  if (isJsTsProjectConfigPath(lower) && lower !== "package.json") {
    reasons.push("JavaScript/TypeScript project configuration");
  }
  const mcpReason = mcpEvidenceReason(file.path);
  if (mcpReason !== undefined) {
    score = Math.max(score, 118);
    reasons.push(mcpReason.replace(/\s+evidence\.$/u, ""));
  }
  if (isEntrypointPath(lower)) {
    score = Math.max(score, 115);
    reasons.push("application entrypoint");
  }
  if (isTestPath(lower)) {
    reasons.push("test");
  }
  if (isFirstPartySourcePath(lower)) {
    reasons.push("first-party source");
  }
  if (lower.includes("/controllers/")) {
    reasons.push("application route");
  }
  if (lower.includes("/routes/")) {
    reasons.push("application route");
  }
  if (lower.includes("/components/")) {
    reasons.push("application UI source");
  }
  if (lower.endsWith(".razor") || lower.includes("/pages/") || lower.includes("/shared/")) {
    reasons.push("application UI source");
  }
  if (lower.includes("/migrations/") || lower.includes("dbcontext")) {
    reasons.push("data model source");
  }
  if (pathBasename(lower).startsWith("appsettings")) {
    reasons.push("runtime configuration");
  }
  if (lower === "dockerfile" || lower.startsWith(".devcontainer/")) {
    reasons.push("infrastructure environment");
  }
  if (lower.startsWith(".github/workflows/")) {
    reasons.push("workflow configuration");
  }
  if (isGeneratedVendorOrFixturePath(lower)) {
    reasons.push("downranked generated/vendor/fixture path");
  }
  return {
    score,
    reason: reasonFromEvidence(reasons)
  };
}

function isEntrypointPath(lowerPath: string): boolean {
  const basename = pathBasename(lowerPath);
  return (
    basename === "program.cs" ||
    basename === "main.go" ||
    basename === "main.ts" ||
    basename === "main.js" ||
    basename === "index.ts" ||
    basename === "index.js" ||
    basename === "app.ts" ||
    basename === "app.js" ||
    lowerPath.endsWith("/app.py") ||
    lowerPath.endsWith("/main.py")
  );
}

function isFirstPartySourcePath(lowerPath: string): boolean {
  return /^(src|lib|app|cmd|internal|include)\//u.test(lowerPath);
}

function isTestPath(lowerPath: string): boolean {
  return /^(test|tests)\//u.test(lowerPath) || /(^|\/)[^/]*(?:test|spec)\.[cm]?[jt]sx?$/u.test(lowerPath);
}

function isGeneratedVendorOrFixturePath(lowerPath: string): boolean {
  return (
    lowerPath.includes("/generated/") ||
    lowerPath.includes("/fixtures/") ||
    lowerPath.startsWith("tests/fixtures/") ||
    lowerPath.includes("/fixture") ||
    /(^|\/)(vendor|third_party|thirdparty|3rdparty|external|extern)\//u.test(lowerPath)
  );
}

function reasonFromEvidence(reasons: readonly string[]): string {
  const uniqueReasons = Array.from(new Set(reasons));
  const primary = uniqueReasons.filter((reason) => !reason.startsWith("downranked"));
  const downranked = uniqueReasons.find((reason) => reason.startsWith("downranked"));
  if (primary.length > 0) {
    const shown = primary.slice(0, 2).join(" and ");
    return downranked === undefined ? `Promoted as ${shown} evidence.` : `Promoted as ${shown} evidence; ${downranked}.`;
  }
  if (downranked !== undefined) {
    return `Weak path evidence; ${downranked}.`;
  }
  return "Weak path-based routing evidence.";
}

function baseKeyFileRank(file: FileCatalogEntry): number {
  const lower = file.path.toLowerCase();
  if (lower === "cmakelists.txt") return 130;
  if (lower.endsWith("/cmakelists.txt")) return 125;
  if (lower.endsWith(".sln")) return 320;
  if (lower.endsWith(".csproj") || lower.endsWith(".fsproj") || lower.endsWith(".vbproj")) return 300;
  if (isSamTemplatePath(lower)) return 290;
  if (isLambdaHandlerPath(lower)) return 170;
  if (lower.includes("/tests/infra/") || lower.includes("/test/infra/")) return 120;
  let score = 0;
  if (lower.endsWith("/program.cs")) score += 115;
  if (lower.includes("/controllers/")) score += 95;
  if (lower.includes("/routes/")) score += 95;
  if (lower.endsWith(".razor") || lower.includes("/pages/") || lower.includes("/shared/")) score += 90;
  if (lower.includes("/components/")) score += 88;
  if (lower.includes("/migrations/") || lower.includes("dbcontext")) score += 85;
  if (pathBasename(lower).startsWith("appsettings")) score += 82;
  if (lower === "go.mod" || lower === "go.work") score += 120;
  if (lower === "pyproject.toml" || lower === "package.json") score += 100;
  if (isJsTsProjectConfigPath(lower) && lower !== "package.json") score += 96;
  if (lower === "dockerfile" || lower.startsWith(".devcontainer/")) score += 80;
  if (lower.startsWith("apps/") || lower.startsWith("packages/") || lower.startsWith("services/")) score += 82;
  if (/^(src|lib|app|cmd|internal|include)\//u.test(lower)) score += 70;
  if (/^(test|tests)\//u.test(lower)) score += 55;
  if (isJsTsTestPath(lower)) score += 55;
  if (lower.startsWith(".github/workflows/")) score += 20;
  if (file.file_identity.language === "cpp" || file.file_identity.language === "c" || file.file_identity.language === "go") score += 8;
  if (file.file_identity.language === "csharp") score += 8;
  if (file.file_identity.language === "python") score += 6;
  if (lower.includes("/generated/") || lower.includes("/fixtures/")) score -= 60;
  if (lower.startsWith("tests/fixtures/") || lower.includes("/fixture")) score -= 140;
  if (lower.includes("template-generated")) score -= 90;
  if (isMcpServerEvidencePath(lower)) score += 60;
  return score;
}

function hasCMakeEvidence(paths: Set<string>): boolean {
  return [...paths].some((file) => pathBasename(file).toLowerCase() === "cmakelists.txt");
}

function hasDockerEvidence(paths: Set<string>): boolean {
  return [...paths].some((file) => {
    const lower = file.toLowerCase();
    return lower.endsWith("dockerfile") || hasDockerComposeEvidence(new Set([lower])) || lower.endsWith(".devcontainer/dockerfile");
  });
}

function hasDevcontainerEvidence(paths: Set<string>): boolean {
  return [...paths].some((file) => file.startsWith(".devcontainer/"));
}

function hasDockerComposeEvidence(paths: Set<string>): boolean {
  return [...paths].some((file) => {
    const lower = file.toLowerCase();
    return lower.endsWith("docker-compose.yml") || lower.endsWith("docker-compose.yaml") || lower.endsWith("compose.yml") || lower.endsWith("compose.yaml");
  });
}

function hasDotnetProject(paths: Set<string>): boolean {
  return [...paths].some((file) => [".csproj", ".fsproj", ".vbproj"].includes(lowerExtension(file)));
}

function firstDotnetSolution(paths: Set<string>): string | undefined {
  return [...paths].sort().find((file) => lowerExtension(file) === ".sln");
}

function firstDotnetTestProject(paths: Set<string>): string | undefined {
  return [...paths].sort().find((file) => lowerExtension(file) === ".csproj" && file.toLowerCase().includes("test"));
}

function firstSamTemplate(paths: Set<string>): string | undefined {
  return [...paths].sort().find(isSamTemplatePath);
}

function isSamTemplatePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    (lower.endsWith("template.yaml") || lower.endsWith("template.yml") || lower.endsWith("template.json")) &&
    (lower.includes("/sam/") || lower.includes("/cloudformation/") || lower.startsWith("infra/") || lower.startsWith("template."))
  );
}

function isLambdaHandlerPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return /\.(py|ts|js|mjs|cjs)$/u.test(lower) && (lower.includes("/lambda/") || lower.includes("/handlers/") || lower.endsWith("/app.py"));
}

function pathBasename(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf("/") + 1);
}

function lowerExtension(filePath: string): string {
  const basename = pathBasename(filePath).toLowerCase();
  const dot = basename.lastIndexOf(".");
  return dot <= 0 ? "" : basename.slice(dot);
}

function titleFromPath(filePath: string): string {
  const basename = filePath.slice(filePath.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
  return basename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function publicAuthority(input: ReturnType<typeof classifyMarkdownDoc>) {
  return {
    doc_status: input.doc_status,
    authority: input.authority,
    authority_caveat: input.authority_caveat
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
