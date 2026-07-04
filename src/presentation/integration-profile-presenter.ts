/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  makeEnvelope,
  type CodexIntegrationProfile,
  type ResponseEnvelope
} from "../contracts/index.js";

export function buildCodexIntegrationProfileEnvelope(
  profile: CodexIntegrationProfile
): ResponseEnvelope<CodexIntegrationProfile> {
  return makeEnvelope({
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
    }
  });
}
