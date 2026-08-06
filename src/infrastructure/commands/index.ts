/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "node:child_process";
import type {
  CommandExecutionInput,
  CommandExecutionResult,
  CommandPort,
  GitCleanlinessInspectionResult,
  GitFileHistoryResult,
  GitGitlinkInspectionResult,
  GitHeadInspectionResult,
  GitHistoryPort,
  GitRepositoryCompositionPort
} from "../../ports/index.js";

export type CommandInput = CommandExecutionInput;
export type CommandOutput = CommandExecutionResult;
export type { CommandPort } from "../../ports/index.js";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_STDOUT_BYTES = 64_000;
const DEFAULT_MAX_STDERR_BYTES = 16_000;
const GIT_OPERATION_TIMEOUT_MS = 5_000;
const GIT_OPERATION_MAX_STDOUT_BYTES = 128_000;
const GIT_OPERATION_MAX_STDERR_BYTES = 16_000;
const GIT_BASE_ENV = {
  GIT_OPTIONAL_LOCKS: "0",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "echo",
  GIT_SSH_COMMAND: "false"
} as const;
const GIT_FIXED_CONFIG_ARGS = [
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.fsmonitor=false",
  "-c", "core.untrackedCache=false",
  "-c", "credential.helper=",
  "-c", "submodule.recurse=false",
  "-c", "protocol.allow=never"
] as const;

type GitFileTouch = Extract<GitFileHistoryResult, { status: "available" }>["latest_touch"];
type GitHistoryUnavailableReason = Extract<GitFileHistoryResult, { status: "unavailable" }>["reason"];

export class NoopCommandAdapter implements CommandPort {
  public async execute(_input: CommandExecutionInput): Promise<CommandExecutionResult> {
    return {
      stdout: "",
      stderr: "",
      exit_code: 0,
      timed_out: false,
      cancelled: false,
      stdout_truncated: false,
      stderr_truncated: false
    };
  }
}

export class NodeCommandAdapter implements CommandPort {
  public async execute(input: CommandExecutionInput): Promise<CommandExecutionResult> {
    if (input.cancellation?.aborted === true || input.cancellation?.signal?.aborted === true) {
      return cancelledResult(input.cancellation.reason);
    }

    return new Promise<CommandExecutionResult>((resolve) => {
      const maxStdoutBytes = input.max_stdout_bytes ?? DEFAULT_MAX_STDOUT_BYTES;
      const maxStderrBytes = input.max_stderr_bytes ?? DEFAULT_MAX_STDERR_BYTES;
      const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
      const child = spawn(
        input.executable,
        [...input.args],
        {
          cwd: input.cwd,
          env: {
            ...defaultCommandEnv(),
            ...(input.env ?? {})
          },
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let timedOut = false;
      let cancelled = false;
      let spawnError: Error | undefined;
      let settled = false;

      const collect = (chunk: Buffer, stream: "stdout" | "stderr") => {
        const limit = stream === "stdout" ? maxStdoutBytes : maxStderrBytes;
        const used = stream === "stdout" ? stdoutBytes : stderrBytes;
        const remaining = Math.max(0, limit - used);
        if (remaining > 0) {
          const admitted = chunk.subarray(0, remaining);
          (stream === "stdout" ? stdoutChunks : stderrChunks).push(admitted);
          if (stream === "stdout") stdoutBytes += admitted.length;
          else stderrBytes += admitted.length;
        }
        if (chunk.length > remaining) {
          if (stream === "stdout") stdoutTruncated = true;
          else stderrTruncated = true;
          child.kill("SIGTERM");
        }
      };
      child.stdout.on("data", (chunk: Buffer) => collect(chunk, "stdout"));
      child.stderr.on("data", (chunk: Buffer) => collect(chunk, "stderr"));
      child.once("error", (error) => {
        spawnError = error;
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
      const abortSignal = input.cancellation?.signal;
      const cancel = () => {
        cancelled = true;
        child.kill("SIGTERM");
      };
      if (abortSignal !== undefined) {
        abortSignal.addEventListener("abort", cancel, { once: true });
      }
      child.once("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        abortSignal?.removeEventListener("abort", cancel);
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const capturedStderr = Buffer.concat(stderrChunks).toString("utf8");
        resolve({
          stdout,
          stderr: capturedStderr || sanitizeProcessMessage(spawnError?.message ?? ""),
          exit_code: code ?? (cancelled ? 130 : timedOut ? 124 : spawnError !== undefined ? 127 : 1),
          timed_out: timedOut,
          cancelled,
          stdout_truncated: stdoutTruncated,
          stderr_truncated: stderrTruncated
        });
      });
    });
  }
}

export class GitHistoryAdapter implements GitHistoryPort {
  public constructor(private readonly commands: CommandPort = new NodeCommandAdapter()) {}

  public async getFileHistory(input: {
    repo_root: string;
    path: string;
    include_first_seen?: boolean;
  }): Promise<GitFileHistoryResult> {
    const tracked = await this.git(input.repo_root, ["ls-files", "--error-unmatch", "--", input.path]);
    if (tracked.exit_code !== 0) {
      if (tracked.exit_code === 127) {
        return unavailable(input.path, "git_unavailable");
      }
      const repositoryCheck = await this.git(input.repo_root, ["rev-parse", "--is-inside-work-tree"]);
      return unavailable(input.path, repositoryCheck.exit_code === 0 ? "untracked" : "not_git_repository");
    }

    const latest = await this.git(input.repo_root, ["log", "-1", "--format=%H%x09%cI", "--", input.path]);
    const latestTouch = parseGitHistoryLine(latest.stdout);
    if (latest.exit_code !== 0 || latestTouch === undefined) {
      return unavailable(
        input.path,
        latest.exit_code === 127 ? "git_unavailable" : latest.exit_code === 0 ? "no_history" : "command_failed"
      );
    }

    const firstSeen = input.include_first_seen === true
      ? parseGitHistoryLine((await this.git(input.repo_root, [
          "log",
          "--follow",
          "--diff-filter=A",
          "--reverse",
          "--format=%H%x09%cI",
          "--",
          input.path
        ])).stdout)
      : undefined;

    return {
      status: "available",
      path: input.path,
      latest_touch: latestTouch,
      first_seen: firstSeen
    };
  }

  private async git(repoRoot: string, args: string[]): Promise<CommandExecutionResult> {
    return this.commands.execute(gitCommandInput(repoRoot, args));
  }
}

export class GitMetadataCommandAdapter implements GitRepositoryCompositionPort {
  public constructor(private readonly commands: CommandPort = new NodeCommandAdapter()) {}

  public async inspectSuperprojectGitlinks(input: {
    repo_root: string;
    cancellation?: CommandExecutionInput["cancellation"];
  }): Promise<GitGitlinkInspectionResult> {
    const committed = await this.git(input.repo_root, ["ls-tree", "-rz", "HEAD"], input.cancellation);
    if (blockedCommandResult(committed)) {
      return gitBlockedResult(committed, "Unable to inspect committed gitlinks.");
    }
    const index = await this.git(input.repo_root, ["ls-files", "--stage", "-z"], input.cancellation);
    if (blockedCommandResult(index)) {
      return gitBlockedResult(index, "Unable to inspect staged gitlinks.");
    }

    try {
      return {
        status: "available",
        committed_gitlinks: parseCommittedGitlinks(committed.stdout),
        index_gitlinks: parseIndexGitlinks(index.stdout)
      };
    } catch (error) {
      return {
        status: "blocked",
        reason: "parse_failed",
        message: sanitizeProcessMessage(error instanceof Error ? error.message : "Git metadata parse failed.")
      };
    }
  }

  public async inspectRepositoryHead(input: {
    repo_root: string;
    cancellation?: CommandExecutionInput["cancellation"];
  }): Promise<GitHeadInspectionResult> {
    const result = await this.git(input.repo_root, ["rev-parse", "--verify", "HEAD"], input.cancellation);
    if (blockedCommandResult(result)) {
      return {
        ...gitBlockedResult(result, "Unable to resolve repository HEAD."),
        evidence_paths: [".git/HEAD"]
      };
    }
    const headObjectId = result.stdout.trim();
    if (!/^[0-9a-f]{40,64}$/iu.test(headObjectId)) {
      return {
        status: "blocked",
        reason: "parse_failed",
        message: "Repository HEAD did not resolve to a bounded object id.",
        evidence_paths: [".git/HEAD"]
      };
    }
    return {
      status: "available",
      head_object_id: headObjectId,
      evidence_paths: [".git/HEAD"]
    };
  }

  public async inspectRepositoryCleanliness(input: {
    repo_root: string;
    cancellation?: CommandExecutionInput["cancellation"];
  }): Promise<GitCleanlinessInspectionResult> {
    const staged = await this.git(
      input.repo_root,
      ["diff", "--cached", "--name-only", "--no-ext-diff", "-z", "HEAD", "--"],
      input.cancellation
    );
    if (blockedCommandResult(staged)) {
      return gitBlockedResult(staged, "Unable to inspect staged repository changes.");
    }
    const unstaged = await this.git(
      input.repo_root,
      ["diff", "--name-only", "--no-ext-diff", "-z", "--"],
      input.cancellation
    );
    if (blockedCommandResult(unstaged)) {
      return gitBlockedResult(unstaged, "Unable to inspect unstaged repository changes.");
    }
    const untracked = await this.git(
      input.repo_root,
      ["ls-files", "--others", "--exclude-standard", "-z"],
      input.cancellation
    );
    if (blockedCommandResult(untracked)) {
      return gitBlockedResult(untracked, "Unable to inspect untracked repository cleanliness.");
    }
    const stagedPaths = parseNulPaths(staged.stdout);
    const unstagedPaths = parseNulPaths(unstaged.stdout);
    const untrackedPaths = parseNulPaths(untracked.stdout);
    const changedPaths = [...new Set([
      ...stagedPaths,
      ...unstagedPaths,
      ...untrackedPaths
    ])].sort();
    return {
      status: "available",
      cleanliness: changedPaths.length === 0 ? "clean" : "dirty",
      changed_paths: changedPaths,
      staged_paths: stagedPaths,
      unstaged_paths: unstagedPaths,
      untracked_paths: untrackedPaths
    };
  }

  private async git(
    repoRoot: string,
    args: string[],
    cancellation?: CommandExecutionInput["cancellation"]
  ): Promise<CommandExecutionResult> {
    return this.commands.execute(gitCommandInput(repoRoot, args, cancellation));
  }
}

export function createNoopCommandAdapter(): NoopCommandAdapter {
  return new NoopCommandAdapter();
}

export function createNodeCommandAdapter(): NodeCommandAdapter {
  return new NodeCommandAdapter();
}

function gitCommandInput(
  repoRoot: string,
  args: string[],
  cancellation?: CommandExecutionInput["cancellation"]
): CommandExecutionInput {
  return {
    executable: "git",
    args: ["--no-optional-locks", ...GIT_FIXED_CONFIG_ARGS, "-C", repoRoot, ...args],
    cwd: repoRoot,
    env: { ...GIT_BASE_ENV },
    timeout_ms: GIT_OPERATION_TIMEOUT_MS,
    max_stdout_bytes: GIT_OPERATION_MAX_STDOUT_BYTES,
    max_stderr_bytes: GIT_OPERATION_MAX_STDERR_BYTES,
    cancellation
  };
}

function parseGitHistoryLine(value: string): GitFileTouch | undefined {
  const line = value.split(/\r?\n/u).find((candidate) => candidate.trim().length > 0);
  if (line === undefined) {
    return undefined;
  }
  const [commit, committedAt] = line.split("\t");
  if (commit === undefined || committedAt === undefined || commit.length === 0 || committedAt.length === 0) {
    return undefined;
  }
  return {
    commit,
    committed_at: committedAt
  };
}

function unavailable(path: string, reason: GitHistoryUnavailableReason): GitFileHistoryResult {
  return {
    status: "unavailable",
    path,
    reason,
    message: gitUnavailableMessage(reason)
  };
}

function gitUnavailableMessage(reason: GitHistoryUnavailableReason): string {
  if (reason === "git_unavailable") return "Git executable is unavailable.";
  if (reason === "not_git_repository") return "Repository root is not a Git work tree.";
  if (reason === "untracked") return "File is not tracked by Git.";
  if (reason === "no_history") return "No Git history was found for the file.";
  return "Git history command failed.";
}

function blockedCommandResult(result: CommandExecutionResult): boolean {
  return result.timed_out || result.cancelled || result.exit_code !== 0 || result.stdout_truncated || result.stderr_truncated;
}

function gitBlockedResult(
  result: CommandExecutionResult,
  fallbackMessage: string
): Extract<GitGitlinkInspectionResult, { status: "blocked" }> {
  return {
    status: "blocked",
    reason:
      result.cancelled
        ? "cancelled"
        : result.timed_out
          ? "timeout"
          : result.stdout_truncated || result.stderr_truncated
            ? "output_overflow"
            : result.exit_code === 127
              ? "git_unavailable"
              : "command_failed",
    message: sanitizeProcessMessage(result.stderr || fallbackMessage)
  };
}

function parseCommittedGitlinks(stdout: string): readonly { path: string; object_id: string }[] {
  const records: Array<{ path: string; object_id: string }> = [];
  for (const entry of stdout.split("\0")) {
    if (entry.length === 0) continue;
    const match = /^160000 commit ([0-9a-f]{40,64})\t(.+)$/u.exec(entry);
    if (match !== null) {
      records.push({ object_id: match[1]!, path: match[2]! });
    }
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

function parseIndexGitlinks(stdout: string): readonly { path: string; object_id: string }[] {
  const records: Array<{ path: string; object_id: string }> = [];
  for (const entry of stdout.split("\0")) {
    if (entry.length === 0) continue;
    const match = /^160000 ([0-9a-f]{40,64}) \d+\t(.+)$/u.exec(entry);
    if (match !== null) {
      records.push({ object_id: match[1]!, path: match[2]! });
    }
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

function parseNulPaths(stdout: string): readonly string[] {
  return [...new Set(stdout.split("\0").filter((entry) => entry.length > 0))].sort();
}

function sanitizeProcessMessage(value: string): string {
  return value.replaceAll(/\r?\n/gu, " ").replaceAll(/\s+/gu, " ").trim();
}

function defaultCommandEnv(): Record<string, string> {
  const keys = [
    "PATH",
    "HOME",
    "SystemRoot",
    "ComSpec",
    "PATHEXT",
    "TMPDIR",
    "TMP",
    "TEMP"
  ] as const;
  const env: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

function cancelledResult(reason?: string): CommandExecutionResult {
  return {
    stdout: "",
    stderr: sanitizeProcessMessage(reason ?? "Command execution was cancelled."),
    exit_code: 130,
    timed_out: false,
    cancelled: true,
    stdout_truncated: false,
    stderr_truncated: false
  };
}
