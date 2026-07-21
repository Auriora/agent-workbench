/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  AnalysisValidity,
  DocumentationRankingReceipt,
  ResponseMetadata
} from "../../contracts/index.js";
import type { DocumentationConcernIndexPort } from "../../ports/index.js";

export type DocumentationRankingReadiness = {
  receipt: DocumentationRankingReceipt;
  analysis_validity?: AnalysisValidity;
  blocked: boolean;
  authority_map_absent: boolean;
};

/** Read and classify ranking readiness for exactly one selected snapshot. */
export async function readDocumentationRankingReadiness(input: {
  snapshot_id: string;
  documentation_concerns: DocumentationConcernIndexPort;
}): Promise<DocumentationRankingReadiness> {
  try {
    const state = await input.documentation_concerns.getDocumentationConcernIndexState({
      snapshot_id: input.snapshot_id
    });
    if (state.snapshot_id !== input.snapshot_id) {
      return unavailableDocumentationRanking(
        input.snapshot_id,
        "environment_repair",
        "Documentation ranking readiness did not match the selected snapshot.",
        "invalid_due_to_environment"
      );
    }
    if (state.status === "ready") {
      if (state.state === "complete") {
        return {
          receipt: {
            snapshot_id: input.snapshot_id,
            state: "ready",
            recovery: "none",
            authority_map: "present"
          },
          blocked: false,
          authority_map_absent: false
        };
      }
      if (state.state === "no_map") {
        return {
          receipt: {
            snapshot_id: input.snapshot_id,
            state: "ready",
            recovery: "none",
            authority_map: "absent",
            ...(state.failure_reason === undefined ? {} : { reason: state.failure_reason })
          },
          analysis_validity: "partial",
          blocked: false,
          authority_map_absent: true
        };
      }
      return invalidDocumentationRanking(input.snapshot_id, state.failure_reason);
    }
    switch (state.reason) {
      case "concern_index_invalid":
        return invalidDocumentationRanking(input.snapshot_id, state.failure_reason);
      case "snapshot_not_published":
      case "snapshot_schema_incompatible":
      case "concern_index_state_missing":
        return unavailableDocumentationRanking(
          input.snapshot_id,
          "refresh",
          state.failure_reason ?? state.reason,
          "invalid_due_to_environment"
        );
      case "snapshot_not_found":
        return unavailableDocumentationRanking(
          input.snapshot_id,
          "request_repair",
          state.failure_reason ?? state.reason,
          "invalid"
        );
    }
  } catch {
    return unavailableDocumentationRanking(
      input.snapshot_id,
      "environment_repair",
      "Documentation ranking readiness could not be read from the snapshot store.",
      "invalid_due_to_environment"
    );
  }
}

export function mergeDocumentationRankingTrust(
  meta: ResponseMetadata,
  readiness: DocumentationRankingReadiness
): ResponseMetadata {
  const analysisStrength: Record<AnalysisValidity, number> = {
    valid: 0,
    partial: 1,
    invalid: 2,
    invalid_due_to_environment: 3
  };
  const desiredValidity = readiness.analysis_validity;
  const analysisValidity = desiredValidity !== undefined &&
      analysisStrength[desiredValidity] > analysisStrength[meta.analysis_validity]
    ? desiredValidity
    : meta.analysis_validity;
  const caveats = readiness.authority_map_absent
    ? [
        ...(meta.caveats ?? []),
        {
          kind: "authority_map_absent" as const,
          severity: "warning" as const,
          message: "No documentation authority map was published for this snapshot.",
          evidence_kinds: ["docs" as const]
        }
      ]
    : meta.caveats;
  return {
    ...meta,
    analysis_validity: analysisValidity,
    verification_status: readiness.blocked ||
        analysisValidity === "invalid" ||
        analysisValidity === "invalid_due_to_environment"
      ? "blocked"
      : meta.verification_status,
    ...(caveats === undefined ? {} : { caveats })
  };
}

function invalidDocumentationRanking(
  snapshot_id: string,
  reason?: string
): DocumentationRankingReadiness {
  return {
    receipt: {
      snapshot_id,
      state: "invalid",
      recovery: "source_repair",
      authority_map: "unknown",
      ...(reason === undefined ? {} : { reason })
    },
    analysis_validity: "invalid",
    blocked: true,
    authority_map_absent: false
  };
}

function unavailableDocumentationRanking(
  snapshot_id: string,
  recovery: "refresh" | "request_repair" | "environment_repair",
  reason: string,
  analysis_validity: "invalid" | "invalid_due_to_environment"
): DocumentationRankingReadiness {
  return {
    receipt: {
      snapshot_id,
      state: "unavailable",
      recovery,
      authority_map: "unknown",
      reason
    },
    analysis_validity,
    blocked: true,
    authority_map_absent: false
  };
}
