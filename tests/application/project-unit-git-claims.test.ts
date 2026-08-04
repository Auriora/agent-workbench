/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it, vi } from "vitest";
import {
  applyRepositoryGitClaimEvidence,
  inspectRepositoryGitClaims
} from "../../src/application/use-cases/project-unit-git-claims.js";
import type { ProjectUnitEvidence } from "../../src/contracts/index.js";
import type { WorkspaceFilePort } from "../../src/ports/index.js";

describe("project-unit Git claim separation", () => {
  it.each([
    [{}, "missing"],
    [{ ".git/HEAD": "broken HEAD\n" }, "malformed"],
    [{ ".git/HEAD": "ref: refs/heads/missing\n" }, "unresolved"]
  ] as const)("preserves source evidence while blocking unavailable Git claims", async (files, reason) => {
    const workspace = memoryWorkspace(files);
    const evidence = await inspectRepositoryGitClaims(workspace.port);
    expect(evidence).toMatchObject({ state: "unavailable", reason });
    const [result] = applyRepositoryGitClaimEvidence([readyUnit()], evidence);
    expect(result).toMatchObject({
      root: "app",
      readiness: "limited",
      markers: [{ path: "app/App.csproj" }],
      planned_commands: [{ display: "dotnet build app/App.csproj" }],
      blockers: [{ kind: "git_claim_unavailable", blocked_claims: ["worktree_cleanliness", "diff_completeness"] }]
    });
    expect(workspace.writeText).not.toHaveBeenCalled();
    expect(workspace.deletePath).not.toHaveBeenCalled();
  });

  it("recognizes resolved symbolic, packed, and detached HEAD evidence", async () => {
    const hash = "a".repeat(40);
    const repositories: Array<Record<string, string>> = [
      { ".git/HEAD": "ref: refs/heads/main\n", ".git/refs/heads/main": `${hash}\n` },
      { ".git/HEAD": "ref: refs/heads/main\n", ".git/packed-refs": `${hash} refs/heads/main\n` },
      { ".git/HEAD": `${hash}\n` }
    ];
    for (const files of repositories) {
      const evidence = await inspectRepositoryGitClaims(memoryWorkspace(files).port);
      expect(evidence.state).toBe("head_resolved");
      expect(applyRepositoryGitClaimEvidence([readyUnit()], evidence)[0]?.readiness).toBe("ready");
    }
  });
});

function readyUnit(): ProjectUnitEvidence {
  return {
    root: "app",
    kind: "dotnet",
    markers: [{ path: "app/App.csproj", kind: "csproj", evidence_source: "manifest" }],
    selection: "containing",
    boundary: "same_repository",
    readiness: "ready",
    blockers: [],
    planned_commands: [{ command: "dotnet", args: ["build", "app/App.csproj"], display: "dotnet build app/App.csproj", reason: "manifest", status: "planned", execution: "not_executed" }]
  };
}

function memoryWorkspace(files: Readonly<Record<string, string>>) {
  const writeText = vi.fn<WorkspaceFilePort["writeText"]>();
  const deletePath = vi.fn<WorkspaceFilePort["deletePath"]>();
  const port: WorkspaceFilePort = {
    readText: async ({ path }) => files[path] ?? "",
    readTextPrefix: async ({ path, max_bytes }) => (files[path] ?? "").slice(0, max_bytes),
    readBinary: async () => new Uint8Array(),
    writeText,
    writeBinary: vi.fn(),
    stat: async ({ path }) => ({ exists: files[path] !== undefined, is_file: files[path] !== undefined, size_bytes: files[path]?.length ?? 0, mtime_ms: 1 }),
    deletePath,
    ensureDirectory: vi.fn()
  };
  return { port, writeText, deletePath };
}
