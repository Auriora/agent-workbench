import type { PlannedValidationCommand } from "../../contracts/index.js";
import { planCommand } from "../../domain/policies/command-safety.js";
import type { WorkspaceFilePort } from "../../ports/index.js";
import { isRecord, statIfPresent, uniqueSorted } from "./validation-utils.js";

export type ValidationEnvironmentEvidence = {
  kind: "dockerfile" | "docker_compose" | "devcontainer";
  path: string;
  detail: string;
};

export type ValidationProtocolDiscovery = {
  requiresDockerValidation: boolean;
  requiresDevcontainerValidation: boolean;
  requiresNixValidation: boolean;
  requiresBazelValidation: boolean;
  blocksHostCommands: boolean;
  prohibitsHostGoTest: boolean;
  policyCommands: PlannedValidationCommand[];
  environmentEvidence: ValidationEnvironmentEvidence[];
  evidencePaths: string[];
  errors: string[];
};

type ValidationPolicy = {
  environment: "host" | "docker" | "devcontainer" | "nix" | "bazel";
  hostCommands: "allowed" | "blocked";
  commands: PlannedValidationCommand[];
};

export async function discoverValidationProtocol(workspace: WorkspaceFilePort): Promise<ValidationProtocolDiscovery> {
  const evidencePaths: string[] = [];
  const errors: string[] = [];
  const policyCommands: PlannedValidationCommand[] = [];
  const environmentEvidence = await discoverValidationEnvironmentEvidence(workspace);
  let requiresDockerValidation = false;
  let requiresDevcontainerValidation = false;
  let requiresNixValidation = false;
  let requiresBazelValidation = false;
  let blocksHostCommands = false;
  let prohibitsHostGoTest = false;

  const policy = await readValidationPolicy(workspace);
  if (policy.error !== undefined) {
    errors.push(policy.error);
  } else if (policy.policy !== undefined) {
    evidencePaths.push(policy.path);
    requiresDockerValidation = requiresDockerValidation || policy.policy.environment === "docker";
    requiresDevcontainerValidation = requiresDevcontainerValidation || policy.policy.environment === "devcontainer";
    requiresNixValidation = requiresNixValidation || policy.policy.environment === "nix";
    requiresBazelValidation = requiresBazelValidation || policy.policy.environment === "bazel";
    blocksHostCommands = blocksHostCommands || policy.policy.hostCommands === "blocked";
    policyCommands.push(...policy.policy.commands);
  }

  for (const filePath of validationGuidanceCandidates()) {
    const stat = await statIfPresent(workspace, filePath);
    if (!stat.exists || !stat.is_file) {
      continue;
    }
    if (stat.size_bytes > 128_000) {
      errors.push(`${filePath} was too large to inspect for validation guidance`);
      continue;
    }
    let content: string;
    try {
      content = await workspace.readText({ path: filePath });
    } catch (_error) {
      errors.push(`${filePath} could not be read for validation guidance`);
      continue;
    }
    const lower = content.toLowerCase();
    const dockerOnly =
      /\bdocker[- ]only\b/u.test(lower) ||
      /always\s+use\s+docker/u.test(lower) ||
      /must\s+use\s+docker/u.test(lower) ||
      /validation[^.\n]{0,120}\buse\s+docker/u.test(lower);
    const devcontainerOnly =
      /\bdevcontainer[- ]only\b/u.test(lower) ||
      /always\s+use\s+(?:the\s+)?devcontainer/u.test(lower) ||
      /must\s+use\s+(?:the\s+)?devcontainer/u.test(lower);
    const nixOnly =
      /\bnix[- ]only\b/u.test(lower) ||
      /always\s+use\s+nix/u.test(lower) ||
      /must\s+use\s+nix/u.test(lower);
    const bazelOnly =
      /\bbazel[- ]only\b/u.test(lower) ||
      /always\s+use\s+bazel/u.test(lower) ||
      /must\s+use\s+bazel/u.test(lower);
    const noHostGo =
      /never\s+(?:run\s+)?`?go test`?\s+directly/u.test(lower) ||
      /do\s+not\s+(?:run\s+)?`?go test`?\s+directly/u.test(lower) ||
      /must\s+not\s+(?:run\s+)?`?go test`?/u.test(lower);

    if (dockerOnly || devcontainerOnly || nixOnly || bazelOnly || noHostGo) {
      evidencePaths.push(filePath);
      requiresDockerValidation = requiresDockerValidation || dockerOnly;
      requiresDevcontainerValidation = requiresDevcontainerValidation || devcontainerOnly;
      requiresNixValidation = requiresNixValidation || nixOnly;
      requiresBazelValidation = requiresBazelValidation || bazelOnly;
      blocksHostCommands = blocksHostCommands || dockerOnly || devcontainerOnly || nixOnly || bazelOnly;
      prohibitsHostGoTest = prohibitsHostGoTest || noHostGo;
    }
  }

  return {
    requiresDockerValidation,
    requiresDevcontainerValidation,
    requiresNixValidation,
    requiresBazelValidation,
    blocksHostCommands,
    prohibitsHostGoTest,
    policyCommands,
    environmentEvidence,
    evidencePaths: uniqueSorted(evidencePaths),
    errors
  };
}

export function hostCommandsBlocked(protocol: ValidationProtocolDiscovery): boolean {
  return protocol.blocksHostCommands || protocol.requiresDockerValidation || protocol.requiresDevcontainerValidation || protocol.requiresNixValidation || protocol.requiresBazelValidation;
}

export function isValidationEnvironmentReason(reason: string): boolean {
  return reason.startsWith("validation-environment: ");
}

export function policyCommandsCoverHostSuppression(protocol: ValidationProtocolDiscovery): boolean {
  return hostCommandsBlocked(protocol) && protocol.policyCommands.length > 0;
}

export function hostCommandBlockedReason(protocol: ValidationProtocolDiscovery, family: string): string {
  const environment = requiredEnvironmentLabel(protocol);
  const evidence =
    protocol.evidencePaths.length > 0
      ? ` Evidence: ${protocol.evidencePaths.slice(0, 3).join(", ")}.`
      : "";
  return `Repository guidance requires ${environment} validation, so generic host ${family} commands were not planned.${evidence}`;
}

function requiredEnvironmentLabel(protocol: ValidationProtocolDiscovery): string {
  if (protocol.requiresDevcontainerValidation) return "devcontainer-based";
  if (protocol.requiresNixValidation) return "Nix-based";
  if (protocol.requiresBazelValidation) return "Bazel-based";
  return "Docker-based";
}

function validationGuidanceCandidates(): string[] {
  return [
    ".agent-workbench/validation-policy.json",
    "AGENTS.md",
    "CLAUDE.md",
    ".kiro/steering/testing-conventions.md",
    "docs/guides/ai-agent/AGENT-RULE-Testing-Conventions.md",
    "docs/testing.md",
    "docs/TESTING.md",
    "docs/developer/testing.md"
  ];
}

async function discoverValidationEnvironmentEvidence(workspace: WorkspaceFilePort): Promise<ValidationEnvironmentEvidence[]> {
  const evidence: ValidationEnvironmentEvidence[] = [];
  for (const filePath of [
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
    ".devcontainer/devcontainer.json",
    ".devcontainer/Dockerfile",
    ".devcontainer/docker-compose.yml",
    ".devcontainer/docker-compose.yaml"
  ]) {
    const stat = await statIfPresent(workspace, filePath);
    if (!stat.exists || !stat.is_file || stat.size_bytes > 128_000) {
      continue;
    }
    let content = "";
    try {
      content = await workspace.readText({ path: filePath });
    } catch (_error) {
      continue;
    }
    if (pathBasename(filePath).toLowerCase() === "devcontainer.json") {
      evidence.push({
        kind: "devcontainer",
        path: filePath,
        detail: devcontainerDetail(content)
      });
      continue;
    }
    if (pathBasename(filePath).toLowerCase().includes("compose")) {
      evidence.push({
        kind: "docker_compose",
        path: filePath,
        detail: composeDetail(content)
      });
      continue;
    }
    if (pathBasename(filePath).toLowerCase() === "dockerfile") {
      evidence.push({
        kind: "dockerfile",
        path: filePath,
        detail: dockerfileDetail(content)
      });
    }
  }
  return evidence;
}

async function readValidationPolicy(
  workspace: WorkspaceFilePort
): Promise<{ path: string; policy?: ValidationPolicy; error?: undefined } | { path: string; error: string }> {
  const policyPath = ".agent-workbench/validation-policy.json";
  const stat = await statIfPresent(workspace, policyPath);
  if (!stat.exists || !stat.is_file) {
    return { path: policyPath };
  }
  if (stat.size_bytes > 64_000) {
    return { path: policyPath, error: `${policyPath} was too large to inspect for validation policy` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await workspace.readText({ path: policyPath }));
  } catch (_error) {
    return { path: policyPath, error: `${policyPath} could not be read as JSON` };
  }
  if (!isRecord(parsed)) {
    return { path: policyPath, error: `${policyPath} must contain a JSON object` };
  }
  const validation = isRecord(parsed.validation) ? parsed.validation : parsed;
  const environment = parsePolicyEnvironment(validation.environment);
  const hostCommands = validation.host_commands === "blocked" || validation.hostCommands === "blocked" ? "blocked" : "allowed";
  const commands = Array.isArray(validation.commands)
    ? validation.commands.flatMap((candidate) => policyCommand(candidate, policyPath))
    : [];
  return {
    path: policyPath,
    policy: {
      environment,
      hostCommands,
      commands
    }
  };
}

function parsePolicyEnvironment(value: unknown): ValidationPolicy["environment"] {
  return value === "docker" || value === "devcontainer" || value === "nix" || value === "bazel" || value === "host"
    ? value
    : "host";
}

function policyCommand(value: unknown, policyPath: string): PlannedValidationCommand[] {
  if (!isRecord(value) || typeof value.command !== "string") {
    return [];
  }
  const args = Array.isArray(value.args) ? value.args.filter((arg): arg is string => typeof arg === "string") : [];
  const decision = planCommand({
    command: value.command,
    args,
    source: "configured"
  });
  if (!decision.allowed) {
    return [];
  }
  const display = typeof value.display === "string"
    ? value.display
    : [decision.command.command, ...decision.command.args].join(" ");
  return [
    {
      command: decision.command.command,
      args: decision.command.args,
      display,
      reason: typeof value.reason === "string"
        ? `${value.reason} Policy evidence: ${policyPath}.`
        : `Repo-local validation policy command. Policy evidence: ${policyPath}.`,
      status: "planned",
      execution: "not_executed"
    }
  ];
}

function dockerfileDetail(content: string): string {
  const stages = content
    .split(/\r?\n/u)
    .map((line) => /^\s*FROM\s+\S+(?:\s+AS\s+([A-Za-z0-9_.-]+))?/iu.exec(line)?.[1])
    .filter((stage): stage is string => stage !== undefined);
  return stages.length > 0
    ? `Dockerfile stages: ${stages.slice(0, 3).join(", ")}.`
    : "Dockerfile present.";
}

function composeDetail(content: string): string {
  const serviceNames = new Set<string>();
  let inServices = false;
  for (const line of content.split(/\r?\n/u)) {
    if (/^services:\s*$/u.test(line)) {
      inServices = true;
      continue;
    }
    if (inServices && /^[A-Za-z_][A-Za-z0-9_.-]*:\s*$/u.test(line)) {
      break;
    }
    const match = /^  ([A-Za-z0-9_.-]+):\s*$/u.exec(line);
    if (inServices && match) {
      serviceNames.add(match[1] ?? "");
    }
  }
  return serviceNames.size > 0
    ? `Docker Compose services: ${[...serviceNames].slice(0, 4).join(", ")}.`
    : "Docker Compose file present.";
}

function devcontainerDetail(content: string): string {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) {
      return "devcontainer configuration present.";
    }
    const details: string[] = [];
    if (isRecord(parsed.features)) {
      details.push(`features: ${Object.keys(parsed.features).slice(0, 4).join(", ")}`);
    }
    if (isRecord(parsed.customizations)) {
      details.push(`customizations: ${Object.keys(parsed.customizations).slice(0, 4).join(", ")}`);
    }
    if (typeof parsed.dockerComposeFile === "string" || Array.isArray(parsed.dockerComposeFile)) {
      details.push("compose workflow");
    }
    if (isRecord(parsed.build)) {
      details.push("custom build");
    }
    return details.length > 0
      ? `devcontainer ${details.join("; ")}.`
      : "devcontainer configuration present.";
  } catch (_error) {
    return "devcontainer configuration present.";
  }
}

function pathBasename(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}
