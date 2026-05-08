import { makeEnvelope, type ResponseEnvelope, type ResponseMetadata } from "../contracts/index.js";

export type RuntimeStatus = {
  repo_root: string;
  freshness: "cold";
  indexed_roots: string[];
  skipped_roots: string[];
  adapter_coverage: Array<{
    language: string;
    capability_level: "partial_semantic" | "resource_backed" | "unsupported";
  }>;
};

export function buildColdStatus(repoRoot: string): ResponseEnvelope<RuntimeStatus> {
  const meta: ResponseMetadata = {
    analysis_validity: "partial",
    freshness: "cold",
    scope: {
      repo_root: repoRoot,
      indexed_roots: [],
      skipped_roots: [],
      languages: []
    },
    capability_level: "unsupported",
    evidence_kinds: [],
    verification_status: "needed",
    truncated: false,
    budget: {
      time_ms: 50
    }
  };

  return makeEnvelope({
    data: {
      repo_root: repoRoot,
      freshness: "cold",
      indexed_roots: [],
      skipped_roots: [],
      adapter_coverage: []
    },
    meta
  });
}
