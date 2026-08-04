/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  GitHistoryAdapter,
  type CommandInput,
  type CommandOutput,
  type CommandPort
} from "../../src/infrastructure/commands/index.js";

describe("GitHistoryAdapter", () => {
  it("returns latest and first-seen evidence for tracked files", async () => {
    const adapter = new GitHistoryAdapter(new FakeCommandAdapter([
      { match: ["ls-files", "--error-unmatch"], output: ok("docs/current.md\n") },
      { match: ["log", "-1"], output: ok("abc123\t2026-07-02T01:02:03+00:00\n") },
      { match: ["log", "--follow"], output: ok("def456\t2026-06-01T01:02:03+00:00\n") }
    ]));

    await expect(adapter.getFileHistory({
      repo_root: "/repo",
      path: "docs/current.md",
      include_first_seen: true
    })).resolves.toMatchObject({
      status: "available",
      latest_touch: {
        commit: "abc123",
        committed_at: "2026-07-02T01:02:03+00:00"
      },
      first_seen: {
        commit: "def456",
        committed_at: "2026-06-01T01:02:03+00:00"
      }
    });
  });

  it("reports untracked files as unavailable evidence", async () => {
    const adapter = new GitHistoryAdapter(new FakeCommandAdapter([
      { match: ["ls-files", "--error-unmatch"], output: fail(1, "missing") },
      { match: ["rev-parse", "--is-inside-work-tree"], output: ok("true\n") }
    ]));

    await expect(adapter.getFileHistory({
      repo_root: "/repo",
      path: "docs/untracked.md"
    })).resolves.toMatchObject({
      status: "unavailable",
      reason: "untracked"
    });
  });

  it("reports a missing Git executable distinctly", async () => {
    const adapter = new GitHistoryAdapter(new FakeCommandAdapter([
      { match: ["ls-files", "--error-unmatch"], output: fail(127, "git missing") }
    ]));

    await expect(adapter.getFileHistory({
      repo_root: "/repo",
      path: "docs/current.md"
    })).resolves.toMatchObject({
      status: "unavailable",
      reason: "git_unavailable"
    });
  });

  it("uses the shared bounded command seam for git history", async () => {
    const commands = new FakeCommandAdapter([
      { match: ["ls-files", "--error-unmatch"], output: ok("docs/current.md\n") },
      { match: ["log", "-1"], output: ok("abc123\t2026-07-02T01:02:03+00:00\n") }
    ]);
    const adapter = new GitHistoryAdapter(commands);

    await adapter.getFileHistory({
      repo_root: "/repo",
      path: "docs/current.md"
    });

    expect(commands.calls[0]).toMatchObject({
      executable: "git",
      cwd: "/repo",
      timeout_ms: 5_000,
      max_stdout_bytes: 128_000,
      max_stderr_bytes: 16_000,
      args: [
        "--no-optional-locks",
        "-c", "core.hooksPath=/dev/null",
        "-c", "core.fsmonitor=false",
        "-c", "core.untrackedCache=false",
        "-c", "credential.helper=",
        "-c", "submodule.recurse=false",
        "-c", "protocol.allow=never",
        "-C", "/repo", "ls-files", "--error-unmatch", "--", "docs/current.md"
      ],
      env: expect.objectContaining({
        GIT_OPTIONAL_LOCKS: "0",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "echo",
        GIT_SSH_COMMAND: "false"
      })
    });
  });
});

class FakeCommandAdapter implements CommandPort {
  public readonly calls: CommandInput[] = [];

  public constructor(private readonly responses: Array<{
    match: string[];
    output: CommandOutput;
  }>) {}

  public async execute(input: CommandInput): Promise<CommandOutput> {
    this.calls.push(input);
    const response = this.responses.find((candidate) =>
      candidate.match.every((part) => input.args.includes(part) === true)
    );
    return response?.output ?? fail(2, `unexpected command ${input.executable} ${input.args.join(" ")}`);
  }
}

function ok(stdout: string): CommandOutput {
  return {
    stdout,
    stderr: "",
    exit_code: 0,
    timed_out: false,
    cancelled: false,
    stdout_truncated: false,
    stderr_truncated: false
  };
}

function fail(exitCode: number, stderr: string): CommandOutput {
  return {
    stdout: "",
    stderr,
    exit_code: exitCode,
    timed_out: false,
    cancelled: false,
    stdout_truncated: false,
    stderr_truncated: false
  };
}
