import fs from "node:fs";
import inspector from "node:inspector/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  RepoOverview,
  RepoScope,
  ResponseEnvelope,
  TaskContext,
  VerificationPlan
} from "../contracts/index.js";
import type { RuntimeStatus } from "../application/use-cases/get-repo-status.js";
import { getRepoOverview } from "../application/use-cases/get-repo-overview.js";
import { getRepoScope } from "../application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "../application/use-cases/get-repo-status.js";
import { getTaskContext } from "../application/use-cases/get-task-context.js";
import { planVerification } from "../application/use-cases/plan-verification.js";
import {
  createTelemetryAdapter,
  telemetryConfigFromEnv
} from "../infrastructure/telemetry/index.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../infrastructure/filesystem/index.js";
import { buildRepoOverviewEnvelope } from "../presentation/repo-overview-presenter.js";
import { buildRepoScopeEnvelope } from "../presentation/repo-scope-presenter.js";
import { buildStatusEnvelope } from "../presentation/status-presenter.js";
import { buildTaskContextEnvelope } from "../presentation/task-context-presenter.js";
import { buildVerificationPlanEnvelope } from "../presentation/verification-plan-presenter.js";

export type DebugMcpUseCase = "status" | "scope" | "overview" | "context" | "verification";

export type DebugMcpUseCaseConfig = {
  useCase: DebugMcpUseCase;
  targetRepo: string;
  task: string;
  files: string[];
  profile?: boolean;
  profileOutput?: string;
};

export type DebugMcpUseCaseEnvelope =
  | ResponseEnvelope<RuntimeStatus>
  | ResponseEnvelope<RepoScope>
  | ResponseEnvelope<RepoOverview>
  | ResponseEnvelope<TaskContext>
  | ResponseEnvelope<VerificationPlan>;

export function resolveDebugMcpUseCaseConfig(input: {
  argv: readonly string[];
  cwd: string;
}): DebugMcpUseCaseConfig {
  if (!isAgentWorkbenchRepo(input.cwd)) {
    throw new Error("Debug MCP harness must be run from the agent-workbench repository.");
  }

  const args = input.argv.filter((arg) => arg !== "--");
  const useCase = args[0];
  const targetRepo = args[1];
  if (!isDebugMcpUseCase(useCase) || targetRepo == null) {
    throw new Error(
      "Usage: pnpm debug:mcp-use-case -- <status|scope|overview|context|verification> <target-repo> [--task <task>] [--file <path>]"
    );
  }

  return {
    useCase,
    targetRepo: path.resolve(input.cwd, targetRepo),
    task: readOption(args, "--task") ?? "Describe the target repository before editing.",
    files: readRepeatedOption(args, "--file"),
    profile: args.includes("--profile"),
    profileOutput: readOption(args, "--profile-output")
  };
}

export async function runDebugMcpUseCase(
  config: DebugMcpUseCaseConfig
): Promise<DebugMcpUseCaseEnvelope> {
  if (config.profile === true) {
    return runWithCpuProfile(config, () => runDebugMcpUseCase({
      ...config,
      profile: false
    }));
  }

  const scanner = new FileCatalogScannerAdapter();
  if (config.useCase === "status") {
    return buildStatusEnvelope(
      await getScannedRepoStatus({
        repo_root: config.targetRepo,
        scanner
      })
    );
  }

  if (config.useCase === "scope") {
    return buildRepoScopeEnvelope(
      await getRepoScope({
        repo_root: config.targetRepo,
        scanner
      })
    );
  }

  if (config.useCase === "overview") {
    return buildRepoOverviewEnvelope(
      await getRepoOverview({
        repo_root: config.targetRepo,
        scanner
      })
    );
  }

  if (config.useCase === "verification") {
    return buildVerificationPlanEnvelope(
      await planVerification({
        request: {
          task: config.task,
          repo_root: config.targetRepo,
          files: config.files,
          changed_files: config.files,
          max_commands: 5,
          include_static_feedback: true
        },
        scanner,
        workspace: new WorkspaceFileAdapter({ repoRoot: config.targetRepo }),
        default_repo_root: config.targetRepo
      })
    );
  }

  return buildTaskContextEnvelope(
    await getTaskContext({
      request: {
        task: config.task,
        repo_root: config.targetRepo,
        files: config.files,
        symbols: [],
        max_files: 10,
        max_docs: 5
      },
      scanner,
      workspace: new WorkspaceFileAdapter({ repoRoot: config.targetRepo }),
      default_repo_root: config.targetRepo
    })
  );
}

export function resolveProfileOutputPath(config: DebugMcpUseCaseConfig): string {
  if (config.profileOutput !== undefined) {
    return path.resolve(config.profileOutput);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(".tmp", "profiles", `${config.useCase}-${timestamp}.cpuprofile`);
}

export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  const config = resolveDebugMcpUseCaseConfig({ argv, cwd });
  const telemetry = createTelemetryAdapter(telemetryConfigFromEnv());
  try {
    telemetry.record("debug.mcp_use_case.start", {
      use_case: config.useCase,
      repo_root: config.targetRepo
    });
    const envelope = await runDebugMcpUseCase(config);
    telemetry.record("debug.mcp_use_case.complete", {
      use_case: config.useCase,
      repo_root: config.targetRepo,
      profiling_enabled: config.profile === true,
      profile_output: config.profile === true ? resolveProfileOutputPath(config) : undefined,
      analysis_validity: envelope.meta.analysis_validity,
      verification_status: envelope.meta.verification_status
    });
    console.log(JSON.stringify(envelope, null, 2));
  } catch (error) {
    telemetry.recordError(error, {
      argv: argv.join(" ")
    });
    throw error;
  } finally {
    await telemetry.shutdown();
  }
}

async function runWithCpuProfile(
  config: DebugMcpUseCaseConfig,
  run: () => Promise<DebugMcpUseCaseEnvelope>
): Promise<DebugMcpUseCaseEnvelope> {
  const outputPath = resolveProfileOutputPath(config);
  const session = new inspector.Session();
  session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.start");
    const envelope = await run();
    const profileResult = await session.post("Profiler.stop");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(profileResult.profile));
    return envelope;
  } finally {
    session.disconnect();
  }
}

export function isAgentWorkbenchRepo(repoRoot: string): boolean {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    name?: string;
  };
  return packageJson.name === "agent-workbench" || packageJson.name === "@auriora/agent-workbench";
}

function isDebugMcpUseCase(value: string | undefined): value is DebugMcpUseCase {
  return (
    value === "status" ||
    value === "scope" ||
    value === "overview" ||
    value === "context" ||
    value === "verification"
  );
}

function readOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readRepeatedOption(args: readonly string[], name: string): string[] {
  return args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]] : []));
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
