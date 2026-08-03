/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import scenariosFixture from "../fixtures/fixture-validation-status-contract/scenarios.json" with { type: "json" };
import { buildTrustCalibration } from "../../src/application/use-cases/response-metadata.js";
import {
  analysisValiditySchema,
  evidenceKindSchema,
  plannedValidationCommandSchema,
  verificationStatusSchema
} from "../../src/contracts/index.js";
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
});
