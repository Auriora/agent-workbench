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
});

class FakeCommandAdapter implements CommandPort {
  public constructor(private readonly responses: Array<{
    match: string[];
    output: CommandOutput;
  }>) {}

  public async execute(input: CommandInput): Promise<CommandOutput> {
    const response = this.responses.find((candidate) =>
      candidate.match.every((part) => input.args?.includes(part) === true)
    );
    return response?.output ?? fail(2, `unexpected command ${input.command} ${(input.args ?? []).join(" ")}`);
  }
}

function ok(stdout: string): CommandOutput {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(exitCode: number, stderr: string): CommandOutput {
  return { stdout: "", stderr, exitCode };
}
