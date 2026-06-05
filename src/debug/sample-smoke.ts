import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ResponseEnvelope } from "../contracts/index.js";
import {
  type DebugMcpUseCaseEnvelope,
  isAgentWorkbenchRepo,
  runDebugMcpUseCase
} from "./mcp-use-case.js";

export type SampleSmokeConfig = {
  roots: string[];
  repos: string[];
  maxRepos: number;
  maxDepth: number;
  outputDir: string;
  task: string;
  includeContext: boolean;
};

export type SampleSmokeRepoResult = {
  repo_root: string;
  status: "passed" | "failed";
  elapsed_ms: number;
  envelopes?: {
    status: DebugMcpUseCaseEnvelope;
    scope: DebugMcpUseCaseEnvelope;
    overview: DebugMcpUseCaseEnvelope;
    context?: DebugMcpUseCaseEnvelope;
  };
  error?: {
    message: string;
  };
};

export type SampleSmokeReport = {
  generated_at: string;
  config: SampleSmokeConfig;
  repo_count: number;
  passed: number;
  failed: number;
  results: SampleSmokeRepoResult[];
};

const DEFAULT_SKIPPED_DISCOVERY_DIRS = new Set([
  ".cache",
  ".codex",
  ".git",
  ".tmp",
  "node_modules",
  "target",
  "vendor",
  "third_party",
  "thirdparty",
  "3rdparty"
]);

export function resolveSampleSmokeConfig(input: {
  argv: readonly string[];
  cwd: string;
  homeDir?: string;
}): SampleSmokeConfig {
  if (!isAgentWorkbenchRepo(input.cwd)) {
    throw new Error("Sample smoke harness must be run from the agent-workbench repository.");
  }

  const args = input.argv.filter((arg) => arg !== "--");
  const homeDir = input.homeDir ?? os.homedir();
  const roots = readRepeatedOption(args, "--root").map((value) => path.resolve(input.cwd, value));
  const repos = readRepeatedOption(args, "--repo").map((value) => path.resolve(input.cwd, value));
  const maxRepos = readNumberOption(args, "--max", 20);
  const maxDepth = readNumberOption(args, "--depth", 5);
  const outputDir = path.resolve(input.cwd, readOption(args, "--output-dir") ?? ".tmp/sample-smoke");
  const task = readOption(args, "--task") ?? "Describe the target repository before editing.";

  return {
    roots: roots.length > 0 ? roots : repos.length > 0 ? [] : [path.join(homeDir, "Projects")],
    repos,
    maxRepos,
    maxDepth,
    outputDir,
    task,
    includeContext: args.includes("--context")
  };
}

export async function runSampleSmoke(config: SampleSmokeConfig): Promise<SampleSmokeReport> {
  const repoRoots = selectRepoRoots(config);
  const results: SampleSmokeRepoResult[] = [];
  for (const repoRoot of repoRoots) {
    const started = Date.now();
    try {
      const status = await runDebugMcpUseCase({
        useCase: "status",
        targetRepo: repoRoot,
        task: config.task,
        files: []
      });
      const scope = await runDebugMcpUseCase({
        useCase: "scope",
        targetRepo: repoRoot,
        task: config.task,
        files: []
      });
      const overview = await runDebugMcpUseCase({
        useCase: "overview",
        targetRepo: repoRoot,
        task: config.task,
        files: []
      });
      const context = config.includeContext
        ? await runDebugMcpUseCase({
            useCase: "context",
            targetRepo: repoRoot,
            task: config.task,
            files: []
          })
        : undefined;

      results.push({
        repo_root: repoRoot,
        status: hasInvalidEnvelope([status, scope, overview, context]) ? "failed" : "passed",
        elapsed_ms: Date.now() - started,
        envelopes: {
          status,
          scope,
          overview,
          ...(context === undefined ? {} : { context })
        }
      });
    } catch (error) {
      results.push({
        repo_root: repoRoot,
        status: "failed",
        elapsed_ms: Date.now() - started,
        error: {
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    config,
    repo_count: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results
  };
}

export function writeSampleSmokeReport(input: {
  report: SampleSmokeReport;
  outputDir: string;
}): string {
  fs.mkdirSync(input.outputDir, { recursive: true });
  const timestamp = input.report.generated_at.replace(/[:.]/g, "-");
  const outputPath = path.join(input.outputDir, `sample-smoke-${timestamp}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(input.report, null, 2)}\n`);
  return outputPath;
}

export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  const config = resolveSampleSmokeConfig({ argv, cwd });
  const report = await runSampleSmoke(config);
  const outputPath = writeSampleSmokeReport({
    report,
    outputDir: config.outputDir
  });
  console.log(JSON.stringify({
    output_path: outputPath,
    repo_count: report.repo_count,
    passed: report.passed,
    failed: report.failed
  }, null, 2));
}

function selectRepoRoots(config: SampleSmokeConfig): string[] {
  const repos = new Set<string>();
  for (const repo of config.repos) {
    if (fs.existsSync(repo) && fs.statSync(repo).isDirectory()) {
      repos.add(path.resolve(repo));
    }
  }
  for (const root of config.roots) {
    for (const repo of discoverGitRepos(root, config.maxDepth)) {
      repos.add(repo);
      if (repos.size >= config.maxRepos) {
        return [...repos].sort();
      }
    }
  }
  return [...repos].sort().slice(0, config.maxRepos);
}

function discoverGitRepos(root: string, maxDepth: number): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  const repos: string[] = [];
  const queue: Array<{ directory: string; depth: number }> = [{ directory: path.resolve(root), depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    if (isGitRepo(current.directory)) {
      repos.push(current.directory);
      continue;
    }
    if (current.depth >= maxDepth) {
      continue;
    }
    const children = safeReadDirectories(current.directory);
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      if (DEFAULT_SKIPPED_DISCOVERY_DIRS.has(child.name.toLowerCase())) {
        continue;
      }
      queue.push({
        directory: path.join(current.directory, child.name),
        depth: current.depth + 1
      });
    }
  }
  return repos.sort();
}

function safeReadDirectories(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch (_error) {
    return [];
  }
}

function isGitRepo(directory: string): boolean {
  return fs.existsSync(path.join(directory, ".git"));
}

function hasInvalidEnvelope(envelopes: Array<DebugMcpUseCaseEnvelope | undefined>): boolean {
  return envelopes.some((envelope) => envelope !== undefined && hasInvalidMeta(envelope));
}

function hasInvalidMeta(envelope: ResponseEnvelope<unknown>): boolean {
  return envelope.meta.analysis_validity === "invalid" || envelope.errors.length > 0;
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
