/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { NextAction, ProjectUnitMarker } from "../../src/contracts/index.js";
import {
  assessProjectUnitReadiness,
  projectUnitNextActions
} from "../../src/application/use-cases/validation-environment.js";

describe("project-unit readiness", () => {
  it("keeps a unit ready when dependency and environment evidence are established", () => {
    const unit = assessProjectUnitReadiness({
      root: "dotnet-service",
      kind: "dotnet",
      markers: [marker("dotnet-service/App.csproj", "csproj")],
      selection: "containing",
      boundary: "same_repository",
      dependency: {
        status: "ready",
        evidence_paths: ["dotnet-service/App.csproj"]
      },
      environment: {
        status: "ready",
        evidence_paths: ["dotnet-service/App.csproj"]
      },
      planned_commands: [{
        command: "dotnet",
        args: ["test", "dotnet-service/App.csproj"],
        display: "dotnet test dotnet-service/App.csproj",
        reason: "Validate the selected .NET unit.",
        status: "planned",
        execution: "not_executed"
      }]
    });

    expect(unit).toMatchObject({
      root: "dotnet-service",
      readiness: "ready",
      blockers: []
    });
    expect(unit.planned_commands.map((command) => command.display)).toEqual([
      "dotnet test dotnet-service/App.csproj"
    ]);
  });

  it("returns a blocked unit-specific environment blocker without inventing fallback commands", () => {
    const nextAction: NextAction = {
      tool: "context_for_task",
      args: {
        task: "Clarify the runtime for unknown-environment.",
        files: ["unknown-environment/README.md"]
      },
      reason: "Clarify the runtime from bounded repository evidence."
    };
    const unit = assessProjectUnitReadiness({
      root: "unknown-environment",
      kind: "repository_script",
      markers: [marker("scripts/validate", "extensionless_script", "docs/validation-protocol.md")],
      selection: "intersects_subtree",
      boundary: "same_repository",
      dependency: {
        status: "ready",
        evidence_paths: ["docs/validation-protocol.md", "scripts/validate"]
      },
      environment: {
        status: "unknown",
        detail: "Project unit unknown-environment requires a runtime, but repository evidence does not identify one.",
        evidence_paths: ["unknown-environment/README.md"],
        next_action: nextAction
      },
      planned_commands: [{
        command: "bash",
        args: ["scripts/validate"],
        display: "./scripts/validate",
        reason: "The validation protocol admits the repository validation script.",
        status: "planned",
        execution: "not_executed"
      }]
    });

    expect(unit.readiness).toBe("blocked");
    expect(unit.planned_commands).toEqual([]);
    expect(unit.blockers).toEqual([{
      kind: "environment_unknown",
      unit_root: "unknown-environment",
      evidence_paths: ["unknown-environment/README.md"],
      message: "Project unit unknown-environment requires a runtime, but repository evidence does not identify one.",
      blocked_claims: ["validation_candidate"],
      next_action: nextAction
    }]);
  });

  it("keeps source-backed commands while marking git-only claims as limited", () => {
    const unit = assessProjectUnitReadiness({
      root: "broken-git",
      kind: "repository_script",
      markers: [marker("scripts/validate", "extensionless_script", "docs/validation-protocol.md")],
      selection: "intersects_subtree",
      boundary: "same_repository",
      dependency: { status: "ready" },
      environment: { status: "ready" },
      blockers: [{
        kind: "git_claim_unavailable",
        unit_root: "broken-git",
        evidence_paths: ["broken-git/README.md"],
        message: "Project unit broken-git has readable source evidence, but Git cleanliness claims are unavailable.",
        blocked_claims: ["worktree_cleanliness", "diff_completeness"]
      }],
      planned_commands: [{
        command: "bash",
        args: ["scripts/validate"],
        display: "./scripts/validate",
        reason: "The validation protocol admits the repository validation script.",
        status: "planned",
        execution: "not_executed"
      }]
    });

    expect(unit.readiness).toBe("limited");
    expect(unit.blockers[0]).toMatchObject({
      kind: "git_claim_unavailable",
      blocked_claims: ["worktree_cleanliness", "diff_completeness"]
    });
    expect(unit.planned_commands.map((command) => command.display)).toEqual(["./scripts/validate"]);
  });

  it("projects unique top-level next actions with the affected unit named in the reason", () => {
    const ready = assessProjectUnitReadiness({
      root: "dotnet-service",
      kind: "dotnet",
      markers: [marker("dotnet-service/App.csproj", "csproj")],
      selection: "containing",
      boundary: "same_repository",
      dependency: { status: "ready" },
      environment: { status: "ready" },
      planned_commands: [{
        command: "dotnet",
        args: ["test", "dotnet-service/App.csproj"],
        display: "dotnet test dotnet-service/App.csproj",
        reason: "Validate the selected .NET unit.",
        status: "planned",
        execution: "not_executed"
      }]
    });
    const sharedAction: NextAction = {
      tool: "context_for_task",
      args: {
        task: "Clarify the runtime for selected repository-script units.",
        files: ["unknown-environment/README.md", "unknown-environment-2/README.md"]
      },
      reason: "Clarify the runtime from bounded repository evidence."
    };
    const blocked = assessProjectUnitReadiness({
      root: "unknown-environment",
      kind: "repository_script",
      markers: [marker("scripts/validate", "extensionless_script", "docs/validation-protocol.md")],
      selection: "intersects_subtree",
      boundary: "same_repository",
      dependency: { status: "ready" },
      environment: {
        status: "unknown",
        evidence_paths: ["unknown-environment/README.md"],
        next_action: sharedAction
      }
    });
    const blockedSibling = assessProjectUnitReadiness({
      root: "unknown-environment-2",
      kind: "repository_script",
      markers: [marker("scripts/validate", "extensionless_script", "docs/validation-protocol.md")],
      selection: "intersects_subtree",
      boundary: "same_repository",
      dependency: { status: "unknown", next_action: sharedAction },
      environment: { status: "ready" }
    });

    const actions = projectUnitNextActions([ready, blocked, blockedSibling]);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      ...sharedAction,
      reason: "Project unit unknown-environment: Clarify the runtime from bounded repository evidence."
    });
  });
});

function marker(
  path: string,
  kind: ProjectUnitMarker["kind"],
  evidencePath?: string
): ProjectUnitMarker {
  return {
    path,
    kind,
    evidence_source: evidencePath === undefined ? "manifest" : "repository_guidance",
    ...(evidencePath === undefined ? {} : { evidence_path: evidencePath })
  };
}
