import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitFileHistoryResult, GitHistoryPort } from "../../ports/index.js";

const execFileAsync = promisify(execFile);
type GitFileTouch = Extract<GitFileHistoryResult, { status: "available" }>["latest_touch"];
type GitHistoryUnavailableReason = Extract<GitFileHistoryResult, { status: "unavailable" }>["reason"];

export type CommandInput = {
  command: string;
  args?: string[];
};

export type CommandOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export interface CommandPort {
  execute(input: CommandInput): Promise<CommandOutput>;
}

export class NoopCommandAdapter implements CommandPort {
  public async execute(_input: CommandInput): Promise<CommandOutput> {
    return {
      stdout: "",
      stderr: "",
      exitCode: 0
    };
  }
}

export class NodeCommandAdapter implements CommandPort {
  public async execute(input: CommandInput): Promise<CommandOutput> {
    try {
      const result = await execFileAsync(input.command, input.args ?? [], {
        encoding: "utf8",
        windowsHide: true
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      };
    } catch (error) {
      const candidate = error as {
        stdout?: string;
        stderr?: string;
        code?: number | string;
        message?: string;
      };
      return {
        stdout: candidate.stdout ?? "",
        stderr: candidate.stderr ?? candidate.message ?? "",
        exitCode: typeof candidate.code === "number" ? candidate.code : 127
      };
    }
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
    if (tracked.exitCode !== 0) {
      if (tracked.exitCode === 127) {
        return unavailable(input.path, "git_unavailable");
      }
      const repositoryCheck = await this.git(input.repo_root, ["rev-parse", "--is-inside-work-tree"]);
      return unavailable(input.path, repositoryCheck.exitCode === 0 ? "untracked" : "not_git_repository");
    }

    const latest = await this.git(input.repo_root, ["log", "-1", "--format=%H%x09%cI", "--", input.path]);
    const latestTouch = parseGitHistoryLine(latest.stdout);
    if (latest.exitCode !== 0 || latestTouch === undefined) {
      return unavailable(input.path, latest.exitCode === 127 ? "git_unavailable" : latest.exitCode === 0 ? "no_history" : "command_failed");
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

  private async git(repoRoot: string, args: string[]): Promise<CommandOutput> {
    return this.commands.execute({
      command: "git",
      args: ["-C", repoRoot, ...args]
    });
  }
}

export function createNoopCommandAdapter(): NoopCommandAdapter {
  return new NoopCommandAdapter();
}

export function createNodeCommandAdapter(): NodeCommandAdapter {
  return new NodeCommandAdapter();
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
