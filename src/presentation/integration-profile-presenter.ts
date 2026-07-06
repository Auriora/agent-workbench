/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  type CodexIntegrationProfile,
  type ResponseEnvelope
} from "../contracts/index.js";
import { makeTrustedEnvelope } from "../application/use-cases/response-metadata.js";

export function buildCodexIntegrationProfileEnvelope(
  profile: CodexIntegrationProfile
): ResponseEnvelope<CodexIntegrationProfile> {
  return makeTrustedEnvelope({
    data: profile,
    meta: {
      analysis_validity: "valid",
      freshness: "fresh",
      scope: {
        repo_root: ".",
        indexed_roots: ["."],
        skipped_roots: [],
        languages: ["typescript", "markdown", "json", "javascript"]
      },
      capability_level: "resource_backed",
      evidence_kinds: ["config", "docs"],
      verification_status: "done",
      truncated: false
    },
    trust_policy: { surface_kind: "integration_profile" }
  });
}
