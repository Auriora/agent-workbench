/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { getChangedFilesContext } from "../../src/application/use-cases/get-changed-files-context.js";
import type { ResponseMetadata } from "../../src/contracts/index.js";
import type { GitRepositoryCompositionPort } from "../../src/ports/index.js";

describe("getChangedFilesContext", () => {
  it("builds one ready packet from sorted Git categories and preserves observational lifecycle context", async () => {
    const result = await getChangedFilesContext({
      request: {
        files: ["src/explicit.ts"],
        lifecycle_context: { source: "spec-lifecycle-manager", state: "provided", summary: "T002 is active." },
        max_files: 20,
        max_commands: 10
      },
      git: gitAvailable(),
      getRepoStatus: () => ({ status: { repo_root: "/repo", runtime_state: "fresh", freshness: "fresh", indexed_roots: ["."], skipped_roots: [], adapter_coverage: [] }, meta: freshMeta() }),
      diagnoseChangedFiles: ({ request }) => ({
        diagnostics: { repo_root: "/repo", status: "not_applicable", summary: "No findings.", checked_files: request.files, findings: [], provider_statuses: [], next_actions: [] },
        meta: freshMeta()
      }),
      planVerification: ({ request }) => ({
        plan: { repo_root: "/repo", status: "planned", summary: "Plan ready.", planned_commands: [], risks: [], next_actions: [], task: request.task },
        meta: freshMeta()
      }),
      default_repo_root: "/repo"
    });

    expect(result.context).toMatchObject({
      state: "ready",
      changes: {
        staged: ["src/a.ts"],
        unstaged: ["src/a.ts", "src/b.ts"],
        untracked: ["src/c.ts"],
        changed_files: ["src/a.ts", "src/b.ts", "src/c.ts", "src/explicit.ts"]
      },
      lifecycle_context: { state: "provided", summary: "T002 is active." }
    });
  });

  it("returns no_changes without inventing diagnostics or validation evidence", async () => {
    let downstreamCalls = 0;
    const result = await getChangedFilesContext({
      request: { files: [], max_files: 20, max_commands: 10 },
      git: gitAvailable({ changed_paths: [], staged_paths: [], unstaged_paths: [], untracked_paths: [], cleanliness: "clean" }),
      getRepoStatus: () => ({ status: { repo_root: "/repo", runtime_state: "fresh", freshness: "fresh", indexed_roots: ["."], skipped_roots: [], adapter_coverage: [] }, meta: freshMeta() }),
      diagnoseChangedFiles: () => { downstreamCalls += 1; throw new Error("must not run"); },
      planVerification: () => { downstreamCalls += 1; throw new Error("must not run"); },
      default_repo_root: "/repo"
    });

    expect(result.context.state).toBe("no_changes");
    expect(result.context.diagnostics.state).toBe("not_applicable");
    expect(result.context.verification.state).toBe("not_applicable");
    expect(downstreamCalls).toBe(0);
  });

  it("keeps blocked Git and unavailable providers explicit instead of returning partial success", async () => {
    const blockedGit = gitAvailable();
    blockedGit.inspectRepositoryCleanliness = async () => ({ status: "blocked", reason: "timeout", message: "Git timed out." });
    const result = await getChangedFilesContext({
      request: { files: ["src/a.ts"], max_files: 20, max_commands: 10 },
      git: blockedGit,
      getRepoStatus: () => { throw new Error("status failed"); },
      diagnoseChangedFiles: () => { throw new Error("diagnostics failed"); },
      planVerification: () => { throw new Error("planner failed"); },
      default_repo_root: "/repo"
    });

    expect(result.context.state).toBe("blocked");
    expect(result.context.changes.state).toBe("blocked");
    expect(result.context.repository_status.state).toBe("unavailable");
    expect(result.context.diagnostics.state).toBe("unavailable");
    expect(result.context.verification.state).toBe("unavailable");
    expect(result.errors?.map(({ code }) => code)).toEqual([
      "git_evidence_blocked", "repo_status_unavailable", "diagnostics_unavailable", "verification_plan_unavailable"
    ]);
  });

  it("blocks malformed Git path evidence instead of silently claiming a complete inventory", async () => {
    const git = gitAvailable({
      changed_paths: ["../outside", "src/a.ts"],
      staged_paths: ["../outside"],
      unstaged_paths: ["src/a.ts"],
      untracked_paths: []
    });
    const result = await getChangedFilesContext({
      request: { files: [], max_files: 20, max_commands: 10 },
      git,
      getRepoStatus: () => ({ status: { repo_root: "/repo", runtime_state: "fresh", freshness: "fresh", indexed_roots: ["."], skipped_roots: [], adapter_coverage: [] }, meta: freshMeta() }),
      diagnoseChangedFiles: ({ request }) => ({ diagnostics: { repo_root: "/repo", status: "not_applicable", summary: "No findings.", checked_files: request.files, findings: [], provider_statuses: [], next_actions: [] }, meta: freshMeta() }),
      planVerification: () => ({ plan: { repo_root: "/repo", status: "planned", summary: "Plan ready.", planned_commands: [], risks: [], next_actions: [] }, meta: freshMeta() }),
      default_repo_root: "/repo"
    });

    expect(result.context.state).toBe("blocked");
    expect(result.context.changes).toMatchObject({ state: "blocked", changed_files: ["src/a.ts"] });
    expect(result.errors?.[0]?.code).toBe("git_evidence_blocked");
  });

  it("preserves Git-discovered paths ahead of supplemental explicit files at the bound", async () => {
    const result = await getChangedFilesContext({
      request: { files: ["000-explicit.ts", "001-explicit.ts"], max_files: 3, max_commands: 10 },
      git: gitAvailable(),
      getRepoStatus: () => ({ status: { repo_root: "/repo", runtime_state: "fresh", freshness: "fresh", indexed_roots: ["."], skipped_roots: [], adapter_coverage: [] }, meta: freshMeta() }),
      diagnoseChangedFiles: ({ request }) => ({ diagnostics: { repo_root: "/repo", status: "not_applicable", summary: "No findings.", checked_files: request.files, findings: [], provider_statuses: [], next_actions: [] }, meta: freshMeta() }),
      planVerification: () => ({ plan: { repo_root: "/repo", status: "planned", summary: "Plan ready.", planned_commands: [], risks: [], next_actions: [] }, meta: freshMeta() }),
      default_repo_root: "/repo"
    });

    expect(result.context.state).toBe("degraded");
    expect(result.context.changes.changed_files).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    expect(result.context.changes).toMatchObject({
      staged: ["src/a.ts"],
      unstaged: ["src/a.ts", "src/b.ts"],
      untracked: ["src/c.ts"]
    });
  });
});

function gitAvailable(overrides: Partial<Extract<Awaited<ReturnType<GitRepositoryCompositionPort["inspectRepositoryCleanliness"]>>, { status: "available" }>> = {}): GitRepositoryCompositionPort {
  const cleanliness = {
    status: "available" as const,
    cleanliness: "dirty" as const,
    changed_paths: ["src/c.ts", "src/b.ts", "src/a.ts"],
    staged_paths: ["src/a.ts"],
    unstaged_paths: ["src/b.ts", "src/a.ts"],
    untracked_paths: ["src/c.ts"],
    ...overrides
  };
  return {
    inspectRepositoryCleanliness: async () => cleanliness,
    inspectRepositoryHead: async () => ({ status: "blocked", reason: "command_failed", message: "unused", evidence_paths: [] }),
    inspectSuperprojectGitlinks: async () => ({ status: "blocked", reason: "command_failed", message: "unused" })
  };
}

function freshMeta(): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: { repo_root: "/repo", indexed_roots: ["."], skipped_roots: [], languages: ["typescript"] },
    capability_level: "partial_semantic",
    evidence_kinds: ["parser"],
    verification_status: "not_applicable",
    truncated: false
  };
}
