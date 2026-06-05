import type {
  CapabilityLevel,
  EvidenceKind,
  FileReference,
  NextAction,
  ResponseMetadata,
  RuntimeStatusCaveat,
  ScopeMetadata,
  VerificationStatus
} from "../contracts/index.js";

export function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort();
}

export function strongestCapabilityLevel(levels: readonly CapabilityLevel[]): CapabilityLevel {
  if (levels.includes("semantic")) return "semantic";
  if (levels.includes("partial_semantic")) return "partial_semantic";
  if (levels.includes("resource_backed")) return "resource_backed";
  return "unsupported";
}

export function capNextActions(actions: readonly NextAction[], limit = 3): NextAction[] {
  const seen = new Set<string>();
  const capped: NextAction[] = [];
  for (const action of actions) {
    const key = `${action.tool}:${JSON.stringify(action.args)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    capped.push(action);
    if (capped.length >= limit) {
      break;
    }
  }
  return capped;
}

export function invalidResponseMeta(input: {
  repoRoot: string;
  freshness?: ResponseMetadata["freshness"];
  verification_status?: VerificationStatus;
  budget?: ResponseMetadata["budget"];
}): ResponseMetadata {
  return {
    analysis_validity: "invalid",
    freshness: input.freshness ?? "unknown",
    scope: emptyScope(input.repoRoot),
    capability_level: "unsupported",
    evidence_kinds: [],
    verification_status: input.verification_status ?? "blocked",
    truncated: false,
    ...(input.budget === undefined ? {} : { budget: input.budget })
  };
}

export function buildResponseMeta(input: {
  analysis_validity: ResponseMetadata["analysis_validity"];
  freshness: ResponseMetadata["freshness"];
  scope: ScopeMetadata;
  capability_level?: CapabilityLevel;
  evidence_kinds?: readonly EvidenceKind[];
  files?: readonly Pick<FileReference, "capability_level" | "evidence_kinds">[];
  verification_status: VerificationStatus;
  truncated?: boolean;
  budget?: ResponseMetadata["budget"];
  caveats?: readonly RuntimeStatusCaveat[];
}): ResponseMetadata {
  const fileCapabilities = input.files?.map((file) => file.capability_level) ?? [];
  const fileEvidence = input.files?.flatMap((file) => file.evidence_kinds) ?? [];
  const capability = input.capability_level ?? strongestCapabilityLevel(fileCapabilities);
  const evidence = uniqueSorted<EvidenceKind>([...(input.evidence_kinds ?? []), ...fileEvidence]);
  return {
    analysis_validity: input.analysis_validity,
    freshness: input.freshness,
    scope: input.scope,
    capability_level: capability,
    evidence_kinds: evidence,
    verification_status: input.verification_status,
    truncated: input.truncated ?? false,
    ...(input.budget === undefined ? {} : { budget: input.budget }),
    ...(input.caveats === undefined || input.caveats.length === 0 ? {} : { caveats: [...input.caveats] })
  };
}

export function emptyScope(repoRoot: string): ScopeMetadata {
  return {
    repo_root: repoRoot,
    indexed_roots: [],
    skipped_roots: [],
    languages: []
  };
}
