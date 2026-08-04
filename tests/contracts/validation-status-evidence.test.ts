/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import scenariosFixture from "../fixtures/fixture-validation-status-contract/scenarios.json" with { type: "json" };
import { buildTrustCalibration } from "../../src/application/use-cases/response-metadata.js";
import {
  analysisValiditySchema,
  evidenceKindSchema,
  plannedValidationCommandSchema,
  projectUnitEvidenceSchema,
  projectUnitMarkerSchema,
  projectUnitPlannedValidationCommandSchema,
  verificationPlanSchema,
  verificationStatusSchema
} from "../../src/contracts/index.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";
import { publicSurfaceTrustPolicies } from "../../src/interface-adapters/mcp/registries/index.js";

describe("EB024 validation-status evidence gate", () => {
  it("keeps the current verification-status vocabulary stable", () => {
    expect(verificationStatusSchema.options).toEqual([
      "done",
      "planned",
      "needed",
      "blocked",
      "not_applicable"
    ]);
  });

  it("keeps planned commands structurally not executed", () => {
    const planned = {
      command: "pnpm",
      args: ["test"],
      display: "pnpm test",
      reason: "Run the repository test suite.",
      status: "planned",
      execution: "not_executed"
    };

    expect(plannedValidationCommandSchema.parse(planned)).toEqual(planned);
    expect(
      plannedValidationCommandSchema.safeParse({
        ...planned,
        status: "done",
        execution: "executed"
      }).success
    ).toBe(false);
  });

  it("accepts an additive bounded project-unit projection without changing planned_commands", () => {
    const plan = {
      repo_root: "/repo",
      status: "planned",
      summary: "Plan validation for the selected project units.",
      planned_commands: [{
        command: "dotnet",
        args: ["test", "dotnet-service/App.csproj"],
        display: "dotnet test dotnet-service/App.csproj",
        reason: "Validate the selected .NET unit.",
        status: "planned",
        execution: "not_executed"
      }],
      project_units: [{
        root: "dotnet-service",
        kind: "dotnet",
        markers: [{
          path: "dotnet-service/App.csproj",
          kind: "csproj",
          evidence_source: "manifest"
        }],
        selection: "containing",
        boundary: "same_repository",
        readiness: "ready",
        blockers: [],
        planned_commands: [{
          command: "dotnet",
          args: ["test", "dotnet-service/App.csproj"],
          display: "dotnet test dotnet-service/App.csproj",
          reason: "Validate the selected .NET unit.",
          status: "planned",
          execution: "not_executed"
        }]
      }],
      risks: [],
      next_actions: []
    };

    expect(verificationPlanSchema.parse(plan)).toEqual(plan);
  });

  it("keeps project-unit contract strict, bounded, and planning-only", () => {
    const validMarker = {
      path: "scripts/validate",
      kind: "extensionless_script",
      evidence_source: "repository_guidance",
      evidence_path: "docs/validation-protocol.md"
    };
    expect(projectUnitMarkerSchema.parse(validMarker)).toEqual(validMarker);
    expect(projectUnitMarkerSchema.safeParse({
      ...validMarker,
      evidence_path: undefined
    }).success).toBe(false);
    expect(projectUnitMarkerSchema.safeParse({
      path: "dotnet-service/App.csproj",
      kind: "csproj",
      evidence_source: "manifest",
      evidence_path: "docs/validation-protocol.md"
    }).success).toBe(false);

    const blockedUnit = {
      root: "unknown-environment",
      kind: "repository_script",
      markers: [validMarker],
      selection: "intersects_subtree",
      boundary: "same_repository",
      readiness: "blocked",
      blockers: [{
        kind: "environment_unknown",
        unit_root: "unknown-environment",
        evidence_paths: ["unknown-environment/README.md"],
        message: "The repository documents a required runtime, but it does not identify one.",
        blocked_claims: ["validation_candidate"],
        next_action: {
          tool: "context_for_task",
          args: { repo_root: "/repo", task: "Clarify the runtime for unknown-environment." },
          reason: "Gather bounded repository evidence for the unit runtime."
        }
      }],
      planned_commands: []
    };

    expect(projectUnitEvidenceSchema.parse(blockedUnit)).toEqual(blockedUnit);
    expect(projectUnitEvidenceSchema.safeParse({
      ...blockedUnit,
      extra: true
    }).success).toBe(false);
    expect(projectUnitEvidenceSchema.safeParse({
      ...blockedUnit,
      root: "/absolute/path"
    }).success).toBe(false);
    expect(projectUnitEvidenceSchema.safeParse({
      ...blockedUnit,
      blockers: [],
      planned_commands: []
    }).success).toBe(false);
    expect(projectUnitEvidenceSchema.safeParse({
      ...blockedUnit,
      blockers: [{
        ...blockedUnit.blockers[0],
        blocked_claims: []
      }]
    }).success).toBe(false);
    expect(projectUnitEvidenceSchema.safeParse({
      ...blockedUnit,
      blockers: [{
        ...blockedUnit.blockers[0],
        evidence_paths: new Array(9).fill("unknown-environment/README.md")
      }]
    }).success).toBe(false);
    expect(projectUnitEvidenceSchema.safeParse({
      ...blockedUnit,
      planned_commands: [{
        command: "bash",
        args: ["scripts/validate"],
        display: "./scripts/validate",
        reason: "Execute the documented script.",
        status: "planned",
        execution: "not_executed"
      }]
    }).success).toBe(false);
    expect(projectUnitEvidenceSchema.safeParse({
      root: "bad/./path",
      kind: "repository_script",
      markers: [validMarker],
      selection: "intersects_subtree",
      boundary: "same_repository",
      readiness: "ready",
      blockers: [],
      planned_commands: []
    }).success).toBe(false);
    expect(projectUnitEvidenceSchema.safeParse({
      root: "bad/\0path",
      kind: "repository_script",
      markers: [validMarker],
      selection: "intersects_subtree",
      boundary: "same_repository",
      readiness: "ready",
      blockers: [],
      planned_commands: []
    }).success).toBe(false);
    expect(projectUnitPlannedValidationCommandSchema.safeParse({
      command: "bash",
      args: ["scripts/validate", "x".repeat(301)],
      display: "./scripts/validate",
      reason: "Execute the documented script.",
      status: "planned",
      execution: "not_executed"
    }).success).toBe(false);
    expect(projectUnitPlannedValidationCommandSchema.safeParse({
      command: "bash",
      args: ["scripts/validate"],
      display: "./scripts/validate",
      reason: "Execute the documented script.",
      status: "done",
      execution: "executed"
    }).success).toBe(false);
  });

  it("keeps project_units optional for compatibility inputs", () => {
    const planWithoutUnits = {
      repo_root: "/repo",
      status: "planned",
      summary: "Existing flat compatibility plan.",
      planned_commands: [],
      risks: [],
      next_actions: []
    };

    expect(verificationPlanSchema.parse(planWithoutUnits)).toEqual(planWithoutUnits);
  });

  it.each(scenariosFixture.scenarios)(
    "calibrates $id without turning validation evidence into a passed claim",
    (scenario) => {
      const verificationStatus = verificationStatusSchema.parse(scenario.verification_status);
      const analysisValidity = analysisValiditySchema.parse(scenario.analysis_validity);
      const evidenceKinds = scenario.evidence_kinds.map((kind) => evidenceKindSchema.parse(kind));
      const trust = buildTrustCalibration({
        policy: {
          surface_kind: "validation_plan",
          ...(scenario.includes_executed_validation
            ? { includes_executed_validation: true }
            : {})
        },
        meta: {
          analysis_validity: analysisValidity,
          freshness: "fresh",
          scope: {
            repo_root: "/repo",
            indexed_roots: ["."],
            skipped_roots: [],
            languages: ["typescript"]
          },
          capability_level: "resource_backed",
          evidence_kinds: evidenceKinds,
          verification_status: verificationStatus,
          truncated: analysisValidity === "partial"
        }
      });

      expect(trust.safe_to_use_for.includes("bounded_executed_validation_claim")).toBe(
        scenario.expected_bounded_executed_claim
      );
      expect(trust.not_safe_to_use_for.includes("passed_validation_claim")).toBe(
        scenario.expected_passed_claim_unsafe
      );
      if (scenario.expected_requirement !== undefined) {
        expect(trust.must_verify_by).toContain(scenario.expected_requirement);
      }
    }
  );

  it("has no public surface that claims to return executed validation", () => {
    expect(
      Object.values(publicSurfaceTrustPolicies).filter(
        (policy) => "includes_executed_validation" in policy
      )
    ).toEqual([]);
  });

  it("does not invent manual or outcome evidence kinds before a migration", () => {
    expect(evidenceKindSchema.safeParse("manual_verification").success).toBe(false);
    expect(verificationStatusSchema.safeParse("passed").success).toBe(false);
    expect(verificationStatusSchema.safeParse("failed").success).toBe(false);
  });

  it("ships bounded catalog-visible mixed-project-unit fixture evidence for Spec 057 T001", async () => {
    const fixtureRoot = path.resolve("tests/fixtures/fixture-mixed-project-units");
    const expectedFiles = [
      ".gitmodules",
      "broken-git/README.md",
      "boundaries/declared-submodule/README.md",
      "cargo-service/Cargo.toml",
      "docs/validation-protocol.md",
      "dotnet-service/App.csproj",
      "maven-service/pom.xml",
      "scripts/validate",
      "unknown-environment/README.md"
    ];

    for (const relativePath of expectedFiles) {
      expect(fs.existsSync(path.join(fixtureRoot, relativePath))).toBe(true);
    }

    expect(fs.existsSync(path.join(fixtureRoot, "boundaries/declared-submodule/.git"))).toBe(false);
    expect(fs.readFileSync(path.join(fixtureRoot, "docs/validation-protocol.md"), "utf8"))
      .toContain("scripts/validate");
    expect(fs.readFileSync(path.join(fixtureRoot, "unknown-environment/README.md"), "utf8"))
      .toContain("runtime");
    expect(fs.readFileSync(path.join(fixtureRoot, "broken-git/README.md"), "utf8"))
      .toContain("HEAD");
    expect(fs.readFileSync(path.join(fixtureRoot, ".gitmodules"), "utf8"))
      .toContain("boundaries/declared-submodule");
    expect(fs.readFileSync(path.join(fixtureRoot, "boundaries/declared-submodule/README.md"), "utf8"))
      .toContain("boundary-config evidence");

    const catalog = await new FileCatalogScannerAdapter().scan({
      repo_root: fixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 100
    });
    expect(catalog.files.map((file) => file.path)).toEqual(expect.arrayContaining([
      "cargo-service/Cargo.toml",
      "docs/validation-protocol.md",
      "dotnet-service/App.csproj",
      "maven-service/pom.xml",
      "scripts/validate"
    ]));
    expect(catalog.files.map((file) => file.path)).not.toContain("scripts/build");
  });
});
