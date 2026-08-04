/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  GitMetadataCommandAdapter,
  type CommandInput,
  type CommandOutput,
  type CommandPort
} from "../../src/infrastructure/commands/index.js";

describe("GitMetadataCommandAdapter", () => {
  it("uses a fixed structured local-only git argv and bounded environment", async () => {
    const commands = new RecordingCommandPort([
      ok("160000 commit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tlibs/child\0"),
      ok("160000 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tlibs/child\0"),
      ok("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n"),
      ok("src/changed.ts\0"),
      ok("")
    ]);
    const adapter = new GitMetadataCommandAdapter(commands);

    await adapter.inspectSuperprojectGitlinks({ repo_root: "/repo" });
    await adapter.inspectRepositoryHead({ repo_root: "/repo" });
    await adapter.inspectRepositoryCleanliness({ repo_root: "/repo" });

    expect(commands.calls).toEqual([
      expect.objectContaining({
        executable: "git",
        cwd: "/repo",
        timeout_ms: 5_000,
        max_stdout_bytes: 128_000,
        max_stderr_bytes: 16_000,
        args: [...fixedGitPrefix(), "-C", "/repo", "ls-tree", "-rz", "HEAD"],
        env: expect.objectContaining({
          GIT_OPTIONAL_LOCKS: "0",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_TERMINAL_PROMPT: "0",
          GIT_ASKPASS: "echo",
          GIT_SSH_COMMAND: "false"
        })
      }),
      expect.objectContaining({
        executable: "git",
        args: [...fixedGitPrefix(), "-C", "/repo", "ls-files", "--stage", "-z"]
      }),
      expect.objectContaining({
        executable: "git",
        args: [...fixedGitPrefix(), "-C", "/repo", "rev-parse", "--verify", "HEAD"]
      }),
      expect.objectContaining({
        executable: "git",
        args: [...fixedGitPrefix(), "-C", "/repo", "diff-index", "--name-only", "--no-ext-diff", "-z", "HEAD", "--"]
      }),
      expect.objectContaining({
        executable: "git",
        args: [...fixedGitPrefix(), "-C", "/repo", "ls-files", "--others", "--exclude-standard", "-z"]
      })
    ]);
  });

  it("returns sanitized structured blockers for timeout, cancellation, and overflow", async () => {
    const adapter = new GitMetadataCommandAdapter(new RecordingCommandPort([
      {
        stdout: "",
        stderr: "timed\nout",
        exit_code: 124,
        timed_out: true,
        cancelled: false,
        stdout_truncated: false,
        stderr_truncated: false
      }
    ]));

    await expect(adapter.inspectRepositoryHead({ repo_root: "/repo" })).resolves.toEqual({
      status: "blocked",
      reason: "timeout",
      message: "timed out",
      evidence_paths: [".git/HEAD"]
    });
  });

  it("does not refresh the index or invoke configured fsmonitor and hook processes", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-git-safety-"));
    try {
      execFileSync("git", ["init", "-q", repoRoot]);
      fs.writeFileSync(path.join(repoRoot, "tracked.txt"), "before\n");
      execFileSync("git", ["-C", repoRoot, "add", "tracked.txt"]);
      execFileSync("git", [
        "-c", "core.hooksPath=/dev/null",
        "-c", "commit.gpgSign=false",
        "-c", "user.name=Test",
        "-c", "user.email=test@example.invalid",
        "-C", repoRoot,
        "commit", "--no-verify", "-qm", "fixture"
      ], {
        env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" }
      });
      const marker = path.join(repoRoot, "unexpected-process");
      const hookDir = path.join(repoRoot, "hooks");
      fs.mkdirSync(hookDir);
      const probe = path.join(hookDir, "probe");
      fs.writeFileSync(probe, `#!/bin/sh\nprintf invoked > "${marker}"\n`);
      fs.chmodSync(probe, 0o755);
      fs.copyFileSync(probe, path.join(hookDir, "post-index-change"));
      fs.chmodSync(path.join(hookDir, "post-index-change"), 0o755);
      execFileSync("git", ["-C", repoRoot, "config", "core.fsmonitor", probe]);
      execFileSync("git", ["-C", repoRoot, "config", "core.hooksPath", hookDir]);
      execFileSync("git", ["-C", repoRoot, "config", "credential.helper", `!${probe}`]);
      fs.writeFileSync(path.join(repoRoot, "tracked.txt"), "after\n");
      fs.writeFileSync(path.join(repoRoot, "untracked.txt"), "new\n");
      const indexPath = path.join(repoRoot, ".git", "index");
      const beforeIndex = fs.readFileSync(indexPath);

      await expect(new GitMetadataCommandAdapter().inspectRepositoryCleanliness({ repo_root: repoRoot }))
        .resolves.toMatchObject({
          status: "available",
          cleanliness: "dirty",
          changed_paths: expect.arrayContaining(["tracked.txt", "untracked.txt"])
        });

      expect(fs.existsSync(marker)).toBe(false);
      expect(fs.readFileSync(indexPath)).toEqual(beforeIndex);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

class RecordingCommandPort implements CommandPort {
  public readonly calls: CommandInput[] = [];

  public constructor(private readonly outputs: CommandOutput[]) {}

  public async execute(input: CommandInput): Promise<CommandOutput> {
    this.calls.push(input);
    const next = this.outputs.shift();
    if (next === undefined) {
      throw new Error(`Unexpected command ${input.executable} ${input.args.join(" ")}`);
    }
    return next;
  }
}

function fixedGitPrefix(): string[] {
  return [
    "--no-optional-locks",
    "-c", "core.hooksPath=/dev/null",
    "-c", "core.fsmonitor=false",
    "-c", "core.untrackedCache=false",
    "-c", "credential.helper=",
    "-c", "submodule.recurse=false",
    "-c", "protocol.allow=never"
  ];
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
