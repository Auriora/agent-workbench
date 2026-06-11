import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import packageJson from "../../package.json" with { type: "json" };
import type { ResponseEnvelope } from "../contracts/index.js";
import type { FileCatalogEntry, GraphNode } from "../domain/models/index.js";
import { checkMarkdownDocument, checkMarkdownSet } from "../application/use-cases/check-markdown-quality.js";
import { computeImpact } from "../application/use-cases/compute-impact.js";
import { diagnoseChangedFiles } from "../application/use-cases/diagnose-changed-files.js";
import { findReferences } from "../application/use-cases/find-references.js";
import { getIntegrationHealth, type IntegrationSurfaceInput } from "../application/use-cases/get-integration-health.js";
import { getRepoOverview } from "../application/use-cases/get-repo-overview.js";
import { getRepoScope } from "../application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "../application/use-cases/get-repo-status.js";
import { getTaskContext } from "../application/use-cases/get-task-context.js";
import { indexRepositoryGraph } from "../application/use-cases/index-repository-graph.js";
import { planVerification } from "../application/use-cases/plan-verification.js";
import {
  getDocsMap,
  getDocsOutline,
  getDocsOverview,
  readDocsSection,
  searchDocs
} from "../application/use-cases/query-docs.js";
import { searchSymbols } from "../application/use-cases/search-symbols.js";
import { applyWorkspaceEdit } from "../application/use-cases/apply-workspace-edit.js";
import { previewWorkspaceEdit } from "../application/use-cases/preview-workspace-edit.js";
import { describeCodexIntegrationProfile } from "../application/use-cases/describe-codex-integration-profile.js";
import { JsonSyntaxDiagnosticsProviderAdapter } from "../infrastructure/diagnostics/index.js";
import { InMemoryEditPreviewStoreAdapter } from "../infrastructure/edit-preview-store/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../infrastructure/extraction/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "../infrastructure/filesystem/index.js";
import { MarkdownParserAdapter, MarkdownStructureCheckerAdapter } from "../infrastructure/markdown/index.js";
import { SCHEMA_VERSION, SqliteGraphStoreAdapter } from "../infrastructure/sqlite/index.js";
import {
  JavaScriptTypeScriptTreeSitterExtractorAdapter,
  PythonParserAdapter,
  PythonTreeSitterExtractorAdapter
} from "../infrastructure/tree-sitter/index.js";
import { SystemClockAdapter } from "../infrastructure/time/index.js";
import {
  mcpResources,
  mcpTools
} from "../interface-adapters/mcp/registries/index.js";
import { buildCodexIntegrationProfileEnvelope } from "../presentation/integration-profile-presenter.js";
import { buildDocsMapEnvelope, buildDocsOutlineEnvelope, buildDocsOverviewEnvelope, buildDocsReadSectionEnvelope, buildDocsSearchEnvelope } from "../presentation/docs-presenter.js";
import { buildFindReferencesEnvelope } from "../presentation/find-references-presenter.js";
import { buildImpactEnvelope } from "../presentation/impact-presenter.js";
import { buildIntegrationHealthEnvelope } from "../presentation/integration-health-presenter.js";
import { buildCheckMarkdownDocumentEnvelope, buildCheckMarkdownSetEnvelope } from "../presentation/markdown-quality-presenter.js";
import { buildDiagnosticsForFilesEnvelope } from "../presentation/diagnostics-presenter.js";
import { buildRepoOverviewEnvelope } from "../presentation/repo-overview-presenter.js";
import { buildRepoScopeEnvelope } from "../presentation/repo-scope-presenter.js";
import { buildStatusEnvelope } from "../presentation/status-presenter.js";
import { buildSymbolSearchEnvelope } from "../presentation/symbol-search-presenter.js";
import { buildTaskContextEnvelope } from "../presentation/task-context-presenter.js";
import { buildVerificationPlanEnvelope } from "../presentation/verification-plan-presenter.js";
import {
  buildApplyWorkspaceEditEnvelope,
  buildPreviewWorkspaceEditEnvelope
} from "../presentation/workspace-edit-presenter.js";
import { isAgentWorkbenchRepo } from "./mcp-use-case.js";

export type ToolSweepConfig = {
  repos: string[];
  output_dir: string;
  call_timeout_ms: number;
  include_raw: boolean;
  start_graph_warmup: boolean;
};

export type ToolSweepQuality = "full" | "partial" | "degraded" | "blocked" | "invalid";

export type ToolSweepSurfaceResult = {
  repo_root: string;
  kind: "resource" | "tool" | "discovery";
  name: string;
  status: "ok" | "failed" | "skipped";
  quality: ToolSweepQuality;
  elapsed_ms: number;
  analysis_validity?: string;
  verification_status?: string;
  truncated?: boolean;
  errors: string[];
  warnings: string[];
  data_shape: Record<string, unknown>;
  raw_envelope?: unknown;
};

export type ToolSweepReport = {
  generated_at: string;
  config: ToolSweepConfig;
  repo_count: number;
  results: ToolSweepSurfaceResult[];
  summary: Record<ToolSweepQuality, number>;
};

type RepoFacts = {
  markdown_path?: string;
  no_heading_markdown_path?: string;
  missing_markdown_path: string;
  json_path?: string;
  text_path?: string;
  symbol_query?: string;
};

type RepoRuntime = {
  scanner: FileCatalogScannerAdapter;
  workspace: WorkspaceFileAdapter;
  graph: SqliteGraphStoreAdapter;
  clock: SystemClockAdapter;
  parser: MarkdownParserAdapter;
  checker: MarkdownStructureCheckerAdapter;
  previewStore: InMemoryEditPreviewStoreAdapter;
};

export function resolveToolSweepConfig(input: {
  argv: readonly string[];
  cwd: string;
}): ToolSweepConfig {
  if (!isAgentWorkbenchRepo(input.cwd)) {
    throw new Error("MCP tool sweep must be run from the agent-workbench repository.");
  }

  const args = input.argv.filter((arg) => arg !== "--");
  const repos = readRepeatedOption(args, "--repo").map((repo) => path.resolve(input.cwd, repo));
  if (repos.length === 0) {
    throw new Error("Usage: pnpm debug:mcp-tool-sweep -- --repo <repo> [--repo <repo>] [--output-dir <dir>]");
  }

  return {
    repos,
    output_dir: path.resolve(input.cwd, readOption(args, "--output-dir") ?? ".tmp/agent-workbench-tool-sweep"),
    call_timeout_ms: readNumberOption(args, "--timeout-ms", 30_000),
    include_raw: args.includes("--include-raw"),
    start_graph_warmup: args.includes("--start-graph-warmup")
  };
}

export async function runMcpToolSweep(config: ToolSweepConfig): Promise<ToolSweepReport> {
  const results: ToolSweepSurfaceResult[] = [];
  fs.mkdirSync(config.output_dir, { recursive: true });

  for (const repoRoot of config.repos) {
    const runtime = createRepoRuntime({ repoRoot, outputDir: config.output_dir });
    try {
      if (config.start_graph_warmup) {
        await warmGraph({ repoRoot, runtime });
      }
      const facts = await discoverRepoFacts({ repoRoot, runtime });
      results.push(discoveryResult({ repoRoot, name: "resources/list", count: mcpResources.length }));
      results.push(discoveryResult({ repoRoot, name: "tools/list", count: mcpTools.length }));

      for (const resource of mcpResources) {
        results.push(await timedEnvelope({
          repoRoot,
          kind: "resource",
          name: resource.name,
          timeoutMs: config.call_timeout_ms,
          includeRaw: config.include_raw,
          run: () => callResource({ repoRoot, resourceName: resource.name, runtime })
        }));
      }
      for (const tool of mcpTools) {
        results.push(await timedEnvelope({
          repoRoot,
          kind: "tool",
          name: tool.name,
          timeoutMs: config.call_timeout_ms,
          includeRaw: config.include_raw,
          run: () => callTool({ repoRoot, toolName: tool.name, facts, runtime })
        }));
      }
    } finally {
      runtime.graph.close();
    }
  }

  return {
    generated_at: new Date().toISOString(),
    config,
    repo_count: config.repos.length,
    results,
    summary: summarizeQuality(results)
  };
}

export function writeToolSweepReport(input: {
  report: ToolSweepReport;
  outputDir: string;
}): string {
  fs.mkdirSync(input.outputDir, { recursive: true });
  const timestamp = input.report.generated_at.replace(/[:.]/g, "-");
  const outputPath = path.join(input.outputDir, `mcp-tool-sweep-${timestamp}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(input.report, null, 2)}\n`);
  return outputPath;
}

export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  const config = resolveToolSweepConfig({ argv, cwd });
  const report = await runMcpToolSweep(config);
  const outputPath = writeToolSweepReport({ report, outputDir: config.output_dir });
  console.log(JSON.stringify({
    output_path: outputPath,
    repo_count: report.repo_count,
    summary: report.summary
  }, null, 2));
}

function createRepoRuntime(input: { repoRoot: string; outputDir: string }): RepoRuntime {
  const databasePath = path.join(input.outputDir, `graph-${safeName(input.repoRoot)}-${Date.now()}.sqlite`);
  return {
    scanner: new FileCatalogScannerAdapter(),
    workspace: new WorkspaceFileAdapter({ repoRoot: input.repoRoot }),
    graph: new SqliteGraphStoreAdapter(databasePath),
    clock: new SystemClockAdapter(),
    parser: new MarkdownParserAdapter(),
    checker: new MarkdownStructureCheckerAdapter(),
    previewStore: new InMemoryEditPreviewStoreAdapter()
  };
}

async function warmGraph(input: { repoRoot: string; runtime: RepoRuntime }): Promise<void> {
  const registry = new ExtractorRegistryAdapter();
  registry.register(new PythonTreeSitterExtractorAdapter({ parser: new PythonParserAdapter() }));
  registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "javascript" }));
  registry.register(new JavaScriptTypeScriptTreeSitterExtractorAdapter({ language: "typescript" }));
  await indexRepositoryGraph({
    repo_root: input.repoRoot,
    scanner: input.runtime.scanner,
    workspace: input.runtime.workspace,
    extractors: registry,
    resource_extractor: new ResourceExtractorAdapter(),
    graph: input.runtime.graph,
    catalog: input.runtime.graph,
    docs_index: input.runtime.graph,
    snapshots: input.runtime.graph,
    clock: input.runtime.clock,
    schema_version: SCHEMA_VERSION,
    max_files: 500
  });
}

async function callResource(input: {
  repoRoot: string;
  resourceName: string;
  runtime: RepoRuntime;
}): Promise<ResponseEnvelope<unknown>> {
  if (input.resourceName === "status") {
    return buildStatusEnvelope(await getScannedRepoStatus({ repo_root: input.repoRoot, scanner: input.runtime.scanner }));
  }
  if (input.resourceName === "scope") {
    return buildRepoScopeEnvelope(await getRepoScope({ repo_root: input.repoRoot, scanner: input.runtime.scanner }));
  }
  if (input.resourceName === "overview") {
    return buildRepoOverviewEnvelope(await getRepoOverview({ repo_root: input.repoRoot, scanner: input.runtime.scanner }));
  }
  if (input.resourceName === "docs-overview") {
    return buildDocsOverviewEnvelope(await getDocsOverview({
      request: { repo_root: input.repoRoot, max_docs: 5, max_headings_per_doc: 5 },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.resourceName === "docs-map") {
    return buildDocsMapEnvelope(await getDocsMap({
      request: { repo_root: input.repoRoot, max_docs: 10, max_headings_per_doc: 5 },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.resourceName === "codex-integration-profile") {
    return buildCodexIntegrationProfileEnvelope(describeCodexIntegrationProfile());
  }
  if (input.resourceName === "integration-health") {
    return buildIntegrationHealthEnvelope(getIntegrationHealth({
      request: {
        repo_root: input.repoRoot,
        discovery_state: "provided",
        discovered_tools: mcpTools.map((tool) => tool.name),
        discovered_resources: mcpResources.map((resource) => resource.uri),
        discovered_prompts: []
      },
      default_repo_root: input.repoRoot,
      runtime_version: packageJson.version,
      profile: "codex",
      surfaces: integrationSurfaces()
    }));
  }
  throw new Error(`No sweep resource caller is registered for ${input.resourceName}.`);
}

async function callTool(input: {
  repoRoot: string;
  toolName: string;
  facts: RepoFacts;
  runtime: RepoRuntime;
}): Promise<ResponseEnvelope<unknown>> {
  const file = input.facts.text_path ?? input.facts.json_path ?? input.facts.markdown_path;
  if (input.toolName === "context_for_task") {
    return buildTaskContextEnvelope(await getTaskContext({
      request: {
        task: "MCP tool sweep fixture context.",
        repo_root: input.repoRoot,
        files: file ? [file] : [],
        symbols: input.facts.symbol_query ? [input.facts.symbol_query] : [],
        max_files: 5,
        max_docs: 5
      },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "diagnostics_for_files") {
    return buildDiagnosticsForFilesEnvelope(await diagnoseChangedFiles({
      request: { repo_root: input.repoRoot, files: input.facts.json_path ? [input.facts.json_path] : [], max_files: 5 },
      scanner: input.runtime.scanner,
      providers: [new JsonSyntaxDiagnosticsProviderAdapter()],
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "docs_search") {
    return buildDocsSearchEnvelope(await searchDocs({
      request: { repo_root: input.repoRoot, query: "sweep", max_results: 5, include_snippets: true },
      docs_index: input.runtime.graph,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "docs_outline") {
    return buildDocsOutlineEnvelope(await getDocsOutline({
      request: { repo_root: input.repoRoot, path: input.facts.markdown_path ?? input.facts.missing_markdown_path },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "docs_read_section") {
    const pathForRead = input.facts.markdown_path ?? input.facts.missing_markdown_path;
    const outline = await getDocsOutline({
      request: { repo_root: input.repoRoot, path: pathForRead },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    });
    return buildDocsReadSectionEnvelope(await readDocsSection({
      request: {
        repo_root: input.repoRoot,
        path: pathForRead,
        heading_id: outline.outline.headings[0]?.id ?? "missing-heading",
        max_bytes: 1000
      },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "check_markdown_document") {
    if (input.facts.markdown_path === undefined) {
      throw new SkipSurfaceError("No scanner-visible Markdown file was found for markdown document quality sweep.");
    }
    return buildCheckMarkdownDocumentEnvelope(await checkMarkdownDocument({
      request: {
        repo_root: input.repoRoot,
        path: input.facts.markdown_path,
        max_findings: 50,
        max_evidence_bytes: 240,
        max_file_bytes: 200_000,
        required_frontmatter: ["title", "doc_type", "status", "owner", "last_reviewed"]
      },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      parser: input.runtime.parser,
      checker: input.runtime.checker,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "check_markdown_set") {
    if (input.facts.markdown_path === undefined) {
      throw new SkipSurfaceError("No scanner-visible Markdown file was found for markdown set quality sweep.");
    }
    return buildCheckMarkdownSetEnvelope(await checkMarkdownSet({
      request: {
        repo_root: input.repoRoot,
        paths: [input.facts.markdown_path],
        max_documents: 5,
        max_findings: 100,
        max_evidence_bytes: 240,
        max_file_bytes: 200_000,
        required_frontmatter: ["title", "doc_type", "status", "owner", "last_reviewed"]
      },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      parser: input.runtime.parser,
      checker: input.runtime.checker,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "symbol_search") {
    return buildSymbolSearchEnvelope(await searchSymbols({
      request: {
        repo_root: input.repoRoot,
        query: input.facts.symbol_query ?? "main",
        exact: input.facts.symbol_query !== undefined,
        max_results: 5,
        languages: [],
        source_byte_limit: 0
      },
      graph: input.runtime.graph,
      snapshots: input.runtime.graph,
      catalog: input.runtime.graph,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "find_references") {
    const symbol = await firstSymbol(input);
    return buildFindReferencesEnvelope(await findReferences({
      request: { repo_root: input.repoRoot, ...(symbol ? { node_id: symbol.node_id } : { symbol: input.facts.symbol_query ?? "main" }), max_depth: 1, max_results: 10 },
      graph: input.runtime.graph,
      snapshots: input.runtime.graph,
      catalog: input.runtime.graph,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "impact") {
    const symbol = await firstSymbol(input);
    return buildImpactEnvelope(await computeImpact({
      request: { repo_root: input.repoRoot, node_id: symbol?.node_id ?? "missing-node", max_depth: 1, max_nodes: 10, direction: "both" },
      graph: input.runtime.graph,
      snapshots: input.runtime.graph,
      catalog: input.runtime.graph,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "preview_workspace_edit") {
    assertWorkspaceWriteSweepTarget(input.repoRoot);
    const edit = safeNoopEdit(input);
    return buildPreviewWorkspaceEditEnvelope(await previewWorkspaceEdit({
      request: { repo_root: input.repoRoot, edits: [edit], expires_in_ms: 600_000 },
      workspace: input.runtime.workspace,
      safety: new WorkspaceSafetyAdapter({ repoRoot: input.repoRoot }),
      previews: input.runtime.previewStore,
      clock: input.runtime.clock,
      default_repo_root: input.repoRoot
    }));
  }
  if (input.toolName === "apply_workspace_edit") {
    assertWorkspaceWriteSweepTarget(input.repoRoot);
    const edit = safeNoopEdit(input);
    const preview = await previewWorkspaceEdit({
      request: { repo_root: input.repoRoot, edits: [edit], expires_in_ms: 600_000 },
      workspace: input.runtime.workspace,
      safety: new WorkspaceSafetyAdapter({ repoRoot: input.repoRoot }),
      previews: input.runtime.previewStore,
      clock: input.runtime.clock,
      default_repo_root: input.repoRoot
    });
    const applied = await applyWorkspaceEdit({
      request: {
        repo_root: input.repoRoot,
        preview_token: preview.preview.preview.preview_token,
        edits: [edit]
      },
      workspace: input.runtime.workspace,
      safety: new WorkspaceSafetyAdapter({ repoRoot: input.repoRoot }),
      previews: input.runtime.previewStore,
      clock: input.runtime.clock,
      default_repo_root: input.repoRoot
    });
    await assertInvalidApplyToken({ input, edit });
    return buildApplyWorkspaceEditEnvelope(applied);
  }
  if (input.toolName === "verification_plan") {
    const validationFile = input.facts.markdown_path ?? input.facts.json_path;
    return buildVerificationPlanEnvelope(await planVerification({
      request: {
        repo_root: input.repoRoot,
        task: "Validate MCP sweep fixture.",
        files: validationFile ? [validationFile] : [],
        changed_files: validationFile ? [validationFile] : [],
        max_commands: 5,
        include_static_feedback: true
      },
      scanner: input.runtime.scanner,
      workspace: input.runtime.workspace,
      default_repo_root: input.repoRoot
    }));
  }
  throw new Error(`No sweep tool caller is registered for ${input.toolName}.`);
}

async function assertInvalidApplyToken(input: {
  input: {
    repoRoot: string;
    runtime: RepoRuntime;
  };
  edit: { path: string; replacement_text: string };
}): Promise<void> {
  try {
    await applyWorkspaceEdit({
      request: {
        repo_root: input.input.repoRoot,
        preview_token: "invalid-sweep-token",
        edits: [input.edit]
      },
      workspace: input.input.runtime.workspace,
      safety: new WorkspaceSafetyAdapter({ repoRoot: input.input.repoRoot }),
      previews: input.input.runtime.previewStore,
      clock: input.input.runtime.clock,
      default_repo_root: input.input.repoRoot
    });
  } catch (_error) {
    return;
  }
  throw new Error("Invalid apply token unexpectedly succeeded.");
}

async function firstSymbol(input: { repoRoot: string; facts: RepoFacts; runtime: RepoRuntime }) {
  const result = await searchSymbols({
    request: {
      repo_root: input.repoRoot,
      query: input.facts.symbol_query ?? "main",
      exact: input.facts.symbol_query !== undefined,
      max_results: 1,
      languages: [],
      source_byte_limit: 0
    },
    graph: input.runtime.graph,
    snapshots: input.runtime.graph,
    catalog: input.runtime.graph,
    workspace: input.runtime.workspace,
    default_repo_root: input.repoRoot
  });
  return result.symbols.symbols[0];
}

function safeNoopEdit(input: {
  repoRoot: string;
  facts: RepoFacts;
  runtime: RepoRuntime;
}): { path: string; replacement_text: string } {
  const editPath = input.facts.text_path ?? input.facts.json_path ?? input.facts.markdown_path;
  if (editPath === undefined) {
    throw new SkipSurfaceError("No safe existing text file was found for workspace edit sweep.");
  }
  return {
    path: editPath,
    replacement_text: fs.readFileSync(path.join(input.repoRoot, editPath), "utf8")
  };
}

function assertWorkspaceWriteSweepTarget(repoRoot: string): void {
  const resolved = path.resolve(repoRoot);
  const repoRelative = path.relative(process.cwd(), resolved).replaceAll(path.sep, "/");
  const tmpRelative = path.relative("/tmp", resolved).replaceAll(path.sep, "/");
  const isRepoFixture = repoRelative.startsWith("tests/fixtures/");
  const isRepoTmpSandbox = repoRelative.startsWith(".tmp/");
  const isSystemTmpSandbox =
    tmpRelative.startsWith("agent-workbench-sandbox-") ||
    tmpRelative.startsWith("agent-workbench-tool-sweep-sandbox-");
  if (isRepoFixture || isRepoTmpSandbox || isSystemTmpSandbox) {
    return;
  }
  throw new SkipSurfaceError(
    "Workspace-write sweep skipped for non-sandbox target repo; copy the repo to .tmp or an Agent Workbench-named /tmp sandbox before testing workspace-write tools."
  );
}

async function discoverRepoFacts(input: { repoRoot: string; runtime: RepoRuntime }): Promise<RepoFacts> {
  const scanned = await input.runtime.scanner.scan({
    repo_root: input.repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: 2000
  });
  const files = [...scanned.files].sort((left, right) => left.path.localeCompare(right.path));
  const markdownFiles = files.filter((file) => file.file_identity.language === "markdown");
  const headed = markdownFiles.find((file) => /^#\s+/mu.test(readSafe(path.join(input.repoRoot, file.path))));
  const noHeading = markdownFiles.find((file) => !/^#\s+/mu.test(readSafe(path.join(input.repoRoot, file.path))));
  const jsonFiles = files.filter((file) => file.file_identity.language === "json");
  const json = jsonFiles.find((file) => isJsonParseable(path.join(input.repoRoot, file.path))) ?? jsonFiles[0];
  const text = preferredTextFile(files);
  return {
    markdown_path: headed?.path ?? markdownFiles[0]?.path,
    no_heading_markdown_path: noHeading?.path,
    missing_markdown_path: "docs/missing-sweep-document.md",
    json_path: json?.path,
    text_path: text?.path,
    symbol_query: await discoverIndexedSymbol({ repoRoot: input.repoRoot, runtime: input.runtime, files })
  };
}

async function discoverIndexedSymbol(input: {
  repoRoot: string;
  runtime: RepoRuntime;
  files: readonly FileCatalogEntry[];
}): Promise<string | undefined> {
  const snapshot = (await input.runtime.graph.listSnapshots({ repo_root: input.repoRoot }))[0];
  if (snapshot === undefined) {
    return discoverSourceSymbol({ repoRoot: input.repoRoot, files: input.files });
  }
  for (const symbol of discoverSourceSymbols({ repoRoot: input.repoRoot, files: input.files })) {
    const nodes = await input.runtime.graph.findNodesByName({
      snapshot_id: snapshot.id,
      query: symbol,
      exact: true,
      max_rows: 1
    });
    if (nodes.some((node) => isUsableSweepSymbol(node))) {
      return symbol;
    }
  }
  return discoverSourceSymbol({ repoRoot: input.repoRoot, files: input.files });
}

function discoverSourceSymbol(input: { repoRoot: string; files: readonly FileCatalogEntry[] }): string | undefined {
  return discoverSourceSymbols(input)[0];
}

function discoverSourceSymbols(input: { repoRoot: string; files: readonly FileCatalogEntry[] }): string[] {
  const symbols: string[] = [];
  for (const file of input.files.filter((candidate) => ["python", "typescript", "javascript"].includes(candidate.file_identity.language)).slice(0, 50)) {
    const content = readSafe(path.join(input.repoRoot, file.path));
    const match = /(?:def|function|class)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(content);
    if (match?.[1]) {
      symbols.push(match[1]);
    }
  }
  return Array.from(new Set(symbols));
}

function isUsableSweepSymbol(node: GraphNode): boolean {
  return ["python", "typescript", "javascript"].includes(node.language);
}

function preferredTextFile(files: readonly FileCatalogEntry[]): FileCatalogEntry | undefined {
  return files.find((file) => ["python", "typescript", "javascript"].includes(file.file_identity.language))
    ?? files.find((file) => file.file_identity.language === "markdown")
    ?? files.find((file) => file.file_identity.language === "json")
    ?? files.find((file) => ["text", "yaml"].includes(file.file_identity.language));
}

function isJsonParseable(filePath: string): boolean {
  try {
    JSON.parse(readSafe(filePath).replace(/^\uFEFF/u, ""));
    return true;
  } catch (_error) {
    return false;
  }
}

async function timedEnvelope(input: {
  repoRoot: string;
  kind: "resource" | "tool";
  name: string;
  timeoutMs: number;
  includeRaw: boolean;
  run: () => Promise<ResponseEnvelope<unknown>>;
}): Promise<ToolSweepSurfaceResult> {
  const started = Date.now();
  try {
    const envelope = await withTimeout(input.run(), input.timeoutMs);
    return surfaceResultFromEnvelope({
      repoRoot: input.repoRoot,
      kind: input.kind,
      name: input.name,
      elapsedMs: Date.now() - started,
      envelope,
      includeRaw: input.includeRaw
    });
  } catch (error) {
    if (error instanceof SkipSurfaceError) {
      return {
        repo_root: input.repoRoot,
        kind: input.kind,
        name: input.name,
        status: "skipped",
        quality: "degraded",
        elapsed_ms: Date.now() - started,
        errors: [],
        warnings: [error.message],
        data_shape: {
          skipped_prerequisite: error.message
        }
      };
    }
    return {
      repo_root: input.repoRoot,
      kind: input.kind,
      name: input.name,
      status: "failed",
      quality: "invalid",
      elapsed_ms: Date.now() - started,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      data_shape: {}
    };
  }
}

class SkipSurfaceError extends Error {}

function surfaceResultFromEnvelope(input: {
  repoRoot: string;
  kind: "resource" | "tool";
  name: string;
  elapsedMs: number;
  envelope: ResponseEnvelope<unknown>;
  includeRaw: boolean;
}): ToolSweepSurfaceResult {
  return {
    repo_root: input.repoRoot,
    kind: input.kind,
    name: input.name,
    status: "ok",
    quality: classifyEnvelope(input.envelope),
    elapsed_ms: input.elapsedMs,
    analysis_validity: input.envelope.meta.analysis_validity,
    verification_status: input.envelope.meta.verification_status,
    truncated: input.envelope.meta.truncated,
    errors: input.envelope.errors.map((error) => `${error.code}: ${error.message}`),
    warnings: input.envelope.warnings.map((warning) => `${warning.kind}: ${warning.message}`),
    data_shape: dataShape(input.envelope.data),
    ...(input.includeRaw ? { raw_envelope: input.envelope } : {})
  };
}

function classifyEnvelope(envelope: ResponseEnvelope<unknown>): ToolSweepQuality {
  if (envelope.errors.length > 0 || envelope.meta.analysis_validity === "invalid") {
    return "invalid";
  }
  if (envelope.meta.verification_status === "blocked") {
    return "blocked";
  }
  if (envelope.meta.truncated || envelope.meta.analysis_validity === "partial") {
    return "partial";
  }
  if (envelope.warnings.length > 0) {
    return "degraded";
  }
  return "full";
}

function discoveryResult(input: { repoRoot: string; name: string; count: number }): ToolSweepSurfaceResult {
  return {
    repo_root: input.repoRoot,
    kind: "discovery",
    name: input.name,
    status: "ok",
    quality: "full",
    elapsed_ms: 0,
    errors: [],
    warnings: [],
    data_shape: { count: input.count }
  };
}

function dataShape(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object") {
    return { type: typeof data };
  }
  const object = data as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [
      key,
      Array.isArray(value) ? { type: "array", length: value.length } : { type: typeof value }
    ])
  );
}

function integrationSurfaces(): IntegrationSurfaceInput[] {
  return [
    ...mcpResources.map((resource): IntegrationSurfaceInput => ({
      name: resource.name,
      kind: "resource",
      uri: resource.uri,
      configured: true,
      registered: true,
      advertised: true,
      capability_class: resource.metadata.capability_class
    })),
    ...mcpTools.map((tool): IntegrationSurfaceInput => ({
      name: tool.name,
      kind: "tool",
      configured: true,
      registered: true,
      advertised: true,
      capability_class: tool.metadata.capability_class
    }))
  ];
}

function summarizeQuality(results: readonly ToolSweepSurfaceResult[]): Record<ToolSweepQuality, number> {
  return {
    full: results.filter((result) => result.quality === "full").length,
    partial: results.filter((result) => result.quality === "partial").length,
    degraded: results.filter((result) => result.quality === "degraded").length,
    blocked: results.filter((result) => result.quality === "blocked").length,
    invalid: results.filter((result) => result.quality === "invalid").length
  };
}

function readSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_error) {
    return "";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`MCP sweep call timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(-80);
}

function readOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readRepeatedOption(args: readonly string[], name: string): string[] {
  return args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]] : []));
}

function readNumberOption(args: readonly string[], name: string, fallback: number): number {
  const value = readOption(args, name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
