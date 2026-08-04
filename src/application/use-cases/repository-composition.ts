/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import path from "node:path";
import type {
  CommandCancellation,
  GitRepositoryCompositionPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import { normalizeRepoPath, uniqueSorted } from "./validation-utils.js";
import type {
  RepositoryClaimBlocker,
  RepositoryCompositionAggregateClaims,
  RepositoryCompositionLimit,
  RepositoryCompositionReceipt,
  RepositoryCompositionState,
  RepositoryKey,
  RepositoryUnitEvidence
} from "./repository-composition-model.js";

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_REPOSITORIES = 20;
const MAX_GITMODULES_BYTES = 32_000;
const ROOT_PREFIX = ".";

type DeclarationRecord = {
  path: string;
  evidence_path: string;
};

type DiscoveryBudget = {
  max_depth: number;
  max_repositories: number;
};

export async function discoverRepositoryComposition(input: {
  workspace: WorkspaceFilePort;
  git: GitRepositoryCompositionPort;
  repo_root: string;
  max_depth?: number;
  max_repositories?: number;
  cancellation?: CommandCancellation;
  canonicalize_repo_root?: (repo_root: string) => string;
}): Promise<RepositoryCompositionReceipt> {
  const normalizedRoot = normalizeRoot(input.repo_root);
  const canonicalRoot = input.canonicalize_repo_root?.(normalizedRoot) ?? normalizedRoot;
  const budget: DiscoveryBudget = {
    max_depth: input.max_depth ?? DEFAULT_MAX_DEPTH,
    max_repositories: input.max_repositories ?? DEFAULT_MAX_REPOSITORIES
  };
  const repositories: RepositoryUnitEvidence[] = [];
  const skipped_or_blocked: RepositoryUnitEvidence[] = [];
  const limits: RepositoryCompositionLimit[] = [];
  const seenRoots = new Set<string>();

  await visitRepository({
    workspace: input.workspace,
    git: input.git,
    repo_root: normalizedRoot,
    canonical_repo_root: canonicalRoot,
    canonical_superproject_root: canonicalRoot,
    canonicalize_repo_root: input.canonicalize_repo_root,
    path_prefix: ROOT_PREFIX,
    repository_key: "superproject",
    depth: 0,
    parent_repository_key: undefined,
    cancellation: input.cancellation,
    budget,
    repositories,
    skipped_or_blocked,
    limits,
    seenRoots
  });

  const sortedRepositories = repositories.sort(compareRepositoryUnits);
  const sortedSkipped = skipped_or_blocked.sort(compareRepositoryUnits);
  return {
    superproject_key: "superproject",
    repositories: sortedRepositories,
    aggregate_claims: aggregateClaims(sortedRepositories, sortedSkipped),
    skipped_or_blocked: sortedSkipped,
    source_complete: sortedSkipped.length === 0 && sortedRepositories.every((unit) => unit.source_available),
    truncated: limits.length > 0,
    composition_fingerprint: compositionFingerprint(sortedRepositories, sortedSkipped, limits),
    limits
  };
}

async function visitRepository(input: {
  workspace: WorkspaceFilePort;
  git: GitRepositoryCompositionPort;
  repo_root: string;
  canonical_repo_root: string;
  canonical_superproject_root: string;
  path_prefix: string;
  repository_key: RepositoryKey;
  depth: number;
  parent_repository_key?: RepositoryKey;
  cancellation?: CommandCancellation;
  canonicalize_repo_root?: (repo_root: string) => string;
  budget: DiscoveryBudget;
  repositories: RepositoryUnitEvidence[];
  skipped_or_blocked: RepositoryUnitEvidence[];
  limits: RepositoryCompositionLimit[];
  seenRoots: Set<string>;
}): Promise<void> {
  if (input.seenRoots.has(input.canonical_repo_root)) {
    input.skipped_or_blocked.push(blockedUnit({
      repository_key: input.repository_key,
      parent_repository_key: input.parent_repository_key,
      path_prefix: input.path_prefix,
      depth: input.depth,
      state: "cycle_blocked",
      source_available: false,
      blocker: {
        kind: "cycle_blocked",
        path_prefix: input.path_prefix,
        message: `Repository composition encountered a repeated contained repository at ${input.path_prefix}.`,
        evidence_paths: [],
        blocked_claims: ["repository_traversal", "pinned_composition"]
      }
    }));
    return;
  }
  input.seenRoots.add(input.canonical_repo_root);

  const head = await input.git.inspectRepositoryHead({
    repo_root: input.repo_root,
    cancellation: input.cancellation
  });
  const cleanliness = await input.git.inspectRepositoryCleanliness({
    repo_root: input.repo_root,
    cancellation: input.cancellation
  });

  const selfBlockers: RepositoryClaimBlocker[] = [];
  if (head.status === "blocked") {
    selfBlockers.push({
      kind: "git_metadata_unavailable",
      path_prefix: input.path_prefix,
      message: head.message,
      evidence_paths: prefixEvidencePaths(input.path_prefix, head.evidence_paths),
      blocked_claims: ["pinned_composition"]
    });
  }
  if (cleanliness.status === "blocked") {
    selfBlockers.push({
      kind: "git_metadata_unavailable",
      path_prefix: input.path_prefix,
      message: cleanliness.message,
      evidence_paths: [],
      blocked_claims: ["worktree_cleanliness"]
    });
  }
  if (input.repository_key === "superproject") {
    input.repositories.push({
      repository_key: input.repository_key,
      path_prefix: input.path_prefix,
      depth: input.depth,
      state: "superproject",
      worktree_head_oid: head.status === "available" ? head.head_object_id : undefined,
      pinned_revision_matches: "unknown",
      cleanliness: cleanliness.status === "available" ? cleanliness.cleanliness : "unavailable",
      source_available: true,
      evidence_paths: uniqueSorted(selfBlockers.flatMap((blocker) => blocker.evidence_paths)),
      claim_blockers: selfBlockers
    });
  }

  const declarations = await readGitmoduleDeclarations(input.workspace, input.path_prefix);
  for (const blocked of declarations.blocked_units) {
    input.skipped_or_blocked.push(blocked);
  }

  const gitlinks = await input.git.inspectSuperprojectGitlinks({
    repo_root: input.repo_root,
    cancellation: input.cancellation
  });

  const committedGitlinks = new Map<string, string>();
  const indexGitlinks = new Map<string, string>();
  let gitlinkBlocker: RepositoryClaimBlocker | undefined;
  if (gitlinks.status === "available") {
    for (const record of gitlinks.committed_gitlinks) {
      committedGitlinks.set(normalizeRepoPath(record.path), record.object_id);
    }
    for (const record of gitlinks.index_gitlinks) {
      indexGitlinks.set(normalizeRepoPath(record.path), record.object_id);
    }
  } else {
    gitlinkBlocker = {
      kind: "git_metadata_unavailable",
      path_prefix: input.path_prefix,
      message: gitlinks.message,
      evidence_paths: [],
      blocked_claims: ["repository_traversal", "pinned_composition"]
    };
  }

  const declaredByPath = new Map(declarations.declarations.map((item) => [item.path, item]));
  const candidatePaths = uniqueSorted([
    ...declaredByPath.keys(),
    ...committedGitlinks.keys(),
    ...indexGitlinks.keys()
  ]);

  for (const childPath of candidatePaths) {
    const childPrefix = joinRepoPath(input.path_prefix, childPath);
    const declaration = declaredByPath.get(childPath);
    const committedOid = committedGitlinks.get(childPath);
    const indexOid = indexGitlinks.get(childPath);
    const childKey = toSubmoduleKey(childPrefix);

    if (declaration === undefined) {
      input.skipped_or_blocked.push(blockedUnit({
        repository_key: childKey,
        parent_repository_key: input.repository_key,
        path_prefix: childPrefix,
        depth: input.depth + 1,
        state: "orphan_gitlink",
        source_available: false,
        head_gitlink_oid: committedOid,
        index_gitlink_oid: indexOid,
        blocker: {
          kind: "orphan_gitlink",
          path_prefix: childPrefix,
          message: `Gitlink ${childPrefix} has no matching bounded .gitmodules declaration.`,
          evidence_paths: [],
          blocked_claims: ["repository_traversal", "pinned_composition", "source_availability"]
        }
      }));
      continue;
    }

    if (committedOid === undefined) {
      input.skipped_or_blocked.push(blockedUnit({
        repository_key: childKey,
        parent_repository_key: input.repository_key,
        path_prefix: childPrefix,
        depth: input.depth + 1,
        state: "declaration_without_gitlink",
        declaration_path: declaration.evidence_path,
        index_gitlink_oid: indexOid,
        source_available: false,
        evidence_paths: [declaration.evidence_path],
        blocker: {
          kind: "declaration_without_gitlink",
          path_prefix: childPrefix,
          message: `Declared submodule ${childPrefix} has no committed gitlink in the parent repository.`,
          evidence_paths: [declaration.evidence_path],
          blocked_claims: ["repository_traversal", "pinned_composition", "source_availability"]
        }
      }));
      continue;
    }

    if (input.depth + 1 > input.budget.max_depth) {
      input.limits.push(limitExceeded("max_depth_exceeded", childPrefix, input.budget.max_depth));
      input.skipped_or_blocked.push(limitBlockedUnit({
        repository_key: childKey,
        parent_repository_key: input.repository_key,
        path_prefix: childPrefix,
        depth: input.depth + 1,
        head_gitlink_oid: committedOid,
        index_gitlink_oid: indexOid,
        declaration_path: declaration.evidence_path,
        message: `Repository composition depth exceeded the configured limit of ${input.budget.max_depth}.`
      }));
      continue;
    }

    if (input.repositories.length >= input.budget.max_repositories) {
      input.limits.push(limitExceeded("max_repositories_exceeded", childPrefix, input.budget.max_repositories));
      input.skipped_or_blocked.push(limitBlockedUnit({
        repository_key: childKey,
        parent_repository_key: input.repository_key,
        path_prefix: childPrefix,
        depth: input.depth + 1,
        head_gitlink_oid: committedOid,
        index_gitlink_oid: indexOid,
        declaration_path: declaration.evidence_path,
        message: `Repository composition exceeded the configured repository limit of ${input.budget.max_repositories}.`
      }));
      continue;
    }

    const gitDirStat = await statPath(input.workspace, joinRepoPath(childPrefix, ".git"));
    if (!gitDirStat.exists) {
      input.skipped_or_blocked.push({
        repository_key: childKey,
        parent_repository_key: input.repository_key,
        path_prefix: childPrefix,
        depth: input.depth + 1,
        state: "uninitialized",
        declaration_path: declaration.evidence_path,
        head_gitlink_oid: committedOid,
        index_gitlink_oid: indexOid,
        pinned_revision_matches: "unknown",
        cleanliness: "unavailable",
        source_available: false,
        evidence_paths: uniqueSorted([declaration.evidence_path, joinRepoPath(childPrefix, ".git")]),
        claim_blockers: [{
          kind: "git_metadata_unavailable",
          path_prefix: childPrefix,
          message: `Declared submodule ${childPrefix} is not initialized in the local worktree.`,
          evidence_paths: uniqueSorted([declaration.evidence_path, joinRepoPath(childPrefix, ".git")]),
          blocked_claims: ["source_availability", "repository_traversal", "pinned_composition", "worktree_cleanliness"]
        }]
      });
      continue;
    }

    const childRepoRoot = joinRepoRoot(input.repo_root, childPath);
    const childCanonicalRoot = input.canonicalize_repo_root?.(childRepoRoot) ?? childRepoRoot;
    if (!isContainedCanonicalRoot(input.canonical_superproject_root, childCanonicalRoot)) {
      input.skipped_or_blocked.push(blockedUnit({
        repository_key: childKey,
        parent_repository_key: input.repository_key,
        path_prefix: childPrefix,
        depth: input.depth + 1,
        state: "path_blocked",
        declaration_path: declaration.evidence_path,
        head_gitlink_oid: committedOid,
        index_gitlink_oid: indexOid,
        source_available: false,
        evidence_paths: [declaration.evidence_path, joinRepoPath(childPrefix, ".git")],
        blocker: {
          kind: "path_blocked",
          path_prefix: childPrefix,
          message: `Declared submodule ${childPrefix} resolves outside the selected superproject.`,
          evidence_paths: [declaration.evidence_path, joinRepoPath(childPrefix, ".git")],
          blocked_claims: ["repository_traversal", "source_availability", "pinned_composition"]
        }
      }));
      continue;
    }
    const childHead = await input.git.inspectRepositoryHead({
      repo_root: childRepoRoot,
      cancellation: input.cancellation
    });
    const childCleanliness = await input.git.inspectRepositoryCleanliness({
      repo_root: childRepoRoot,
      cancellation: input.cancellation
    });

    const childBlockers: RepositoryClaimBlocker[] = [];
    if (childHead.status === "blocked") {
      childBlockers.push({
        kind: "git_metadata_unavailable",
        path_prefix: childPrefix,
        message: childHead.message,
        evidence_paths: prefixEvidencePaths(childPrefix, childHead.evidence_paths),
        blocked_claims: ["pinned_composition"]
      });
    }
    if (childCleanliness.status === "blocked") {
      childBlockers.push({
        kind: "git_metadata_unavailable",
        path_prefix: childPrefix,
        message: childCleanliness.message,
        evidence_paths: [],
        blocked_claims: ["worktree_cleanliness"]
      });
    }
    if (gitlinkBlocker !== undefined) {
      childBlockers.push({
        ...gitlinkBlocker,
        path_prefix: childPrefix
      });
    }

    const pinnedMatches = childHead.status === "available"
      ? childHead.head_object_id === committedOid
      : "unknown";
    const childState = gitlinkBlocker !== undefined || childHead.status === "blocked"
      ? "metadata_unavailable"
      : pinnedMatches
        ? "initialized"
        : "worktree_revision_mismatch";

    input.repositories.push({
      repository_key: childKey,
      parent_repository_key: input.repository_key,
      path_prefix: childPrefix,
      depth: input.depth + 1,
      state: childState,
      declaration_path: declaration.evidence_path,
      head_gitlink_oid: committedOid,
      index_gitlink_oid: indexOid,
      worktree_head_oid: childHead.status === "available" ? childHead.head_object_id : undefined,
      pinned_revision_matches: pinnedMatches,
      cleanliness: childCleanliness.status === "available" ? childCleanliness.cleanliness : "unavailable",
      source_available: true,
      evidence_paths: uniqueSorted([
        declaration.evidence_path,
        joinRepoPath(childPrefix, ".git"),
        ...childBlockers.flatMap((blocker) => blocker.evidence_paths)
      ]),
      claim_blockers: normalizeBlockers(childBlockers)
    });

    if (childState !== "metadata_unavailable") {
      await visitRepository({
        ...input,
        repo_root: childRepoRoot,
        canonical_repo_root: childCanonicalRoot,
        path_prefix: childPrefix,
        repository_key: childKey,
        depth: input.depth + 1,
        parent_repository_key: input.repository_key
      });
    }
  }
}

function isContainedCanonicalRoot(superprojectRoot: string, candidateRoot: string): boolean {
  const relative = path.relative(path.resolve(superprojectRoot), path.resolve(candidateRoot));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function readGitmoduleDeclarations(
  workspace: WorkspaceFilePort,
  pathPrefix: string
): Promise<{ declarations: DeclarationRecord[]; blocked_units: RepositoryUnitEvidence[] }> {
  const gitmodulesPath = joinRepoPath(pathPrefix, ".gitmodules");
  const stat = await statPath(workspace, gitmodulesPath);
  if (!stat.exists || !stat.is_file) {
    return { declarations: [], blocked_units: [] };
  }
  if (stat.size_bytes > MAX_GITMODULES_BYTES) {
    return {
      declarations: [],
      blocked_units: [blockedUnit({
        repository_key: toSubmoduleKey(joinRepoPath(pathPrefix, ".gitmodules")),
        path_prefix: joinRepoPath(pathPrefix, ".gitmodules"),
        depth: pathDepth(pathPrefix) + 1,
        state: "path_blocked",
        source_available: false,
        blocker: {
          kind: "path_blocked",
          path_prefix: joinRepoPath(pathPrefix, ".gitmodules"),
          message: `${gitmodulesPath} exceeded the bounded read limit.`,
          evidence_paths: [gitmodulesPath],
          blocked_claims: ["repository_traversal"]
        }
      })]
    };
  }
  let content = "";
  try {
    content = workspace.readTextPrefix === undefined
      ? await workspace.readText({ path: gitmodulesPath })
      : await workspace.readTextPrefix({ path: gitmodulesPath, max_bytes: MAX_GITMODULES_BYTES });
  } catch {
    return {
      declarations: [],
      blocked_units: [blockedUnit({
        repository_key: toSubmoduleKey(joinRepoPath(pathPrefix, ".gitmodules")),
        path_prefix: joinRepoPath(pathPrefix, ".gitmodules"),
        depth: pathDepth(pathPrefix) + 1,
        state: "path_blocked",
        source_available: false,
        blocker: {
          kind: "path_blocked",
          path_prefix: joinRepoPath(pathPrefix, ".gitmodules"),
          message: `${gitmodulesPath} could not be read through the bounded workspace port.`,
          evidence_paths: [gitmodulesPath],
          blocked_claims: ["repository_traversal"]
        }
      })]
    };
  }

  const declarations: DeclarationRecord[] = [];
  const blocked_units: RepositoryUnitEvidence[] = [];
  const seen = new Set<string>();
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\s*path\s*=\s*(.+?)\s*$/u.exec(line);
    if (match === null) continue;
    const raw = match[1] ?? "";
    const safe = safeDeclaredPath(raw);
    if (safe === undefined) {
      blocked_units.push(blockedUnit({
        repository_key: toSubmoduleKey(joinRepoPath(pathPrefix, normalizeRepoPath(raw) || "invalid-path")),
        path_prefix: joinRepoPath(pathPrefix, normalizeRepoPath(raw) || "invalid-path"),
        depth: pathDepth(pathPrefix) + 1,
        state: "path_blocked",
        source_available: false,
        evidence_paths: [gitmodulesPath],
        blocker: {
          kind: "path_blocked",
          path_prefix: joinRepoPath(pathPrefix, normalizeRepoPath(raw) || "invalid-path"),
          message: `${gitmodulesPath} declared an invalid contained submodule path.`,
          evidence_paths: [gitmodulesPath],
          blocked_claims: ["repository_traversal", "source_availability"]
        }
      }));
      continue;
    }
    const prefixed = joinRepoPath(pathPrefix, safe);
    if (seen.has(prefixed)) {
      blocked_units.push(blockedUnit({
        repository_key: toSubmoduleKey(prefixed),
        path_prefix: prefixed,
        depth: pathDepth(prefixed),
        state: "path_blocked",
        source_available: false,
        evidence_paths: [gitmodulesPath],
        blocker: {
          kind: "path_blocked",
          path_prefix: prefixed,
          message: `${gitmodulesPath} declared a duplicate submodule path.`,
          evidence_paths: [gitmodulesPath],
          blocked_claims: ["repository_traversal", "source_availability"]
        }
      }));
      continue;
    }
    seen.add(prefixed);
    declarations.push({ path: safe, evidence_path: gitmodulesPath });
  }

  return {
    declarations: declarations.sort((left, right) => left.path.localeCompare(right.path)),
    blocked_units: blocked_units.sort(compareRepositoryUnits)
  };
}

function aggregateClaims(
  repositories: readonly RepositoryUnitEvidence[],
  blocked: readonly RepositoryUnitEvidence[]
): RepositoryCompositionAggregateClaims {
  const allUnits = [...repositories, ...blocked];
  const cleanlinessBlocked = allUnits.some((unit) =>
    unit.claim_blockers.some((blocker) => blocker.blocked_claims.includes("worktree_cleanliness"))
  );
  const cleanlinessDirty = repositories.some((unit) => unit.cleanliness === "dirty");
  const pinnedBlocked = allUnits.some((unit) =>
    unit.claim_blockers.some((blocker) => blocker.blocked_claims.includes("pinned_composition"))
  );
  const pinnedMismatch = repositories.some((unit) => unit.pinned_revision_matches === false);

  return {
    worktree_cleanliness: cleanlinessBlocked ? "blocked" : cleanlinessDirty ? "dirty" : "clean",
    pinned_composition: pinnedBlocked ? "blocked" : pinnedMismatch ? "mismatch" : "complete"
  };
}

function compositionFingerprint(
  repositories: readonly RepositoryUnitEvidence[],
  blocked: readonly RepositoryUnitEvidence[],
  limits: readonly RepositoryCompositionLimit[]
): string {
  const normalized = JSON.stringify({
    repositories: repositories.map(fingerprintUnit),
    blocked: blocked.map(fingerprintUnit),
    limits
  });
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function fingerprintUnit(unit: RepositoryUnitEvidence) {
  return {
    repository_key: unit.repository_key,
    parent_repository_key: unit.parent_repository_key,
    path_prefix: unit.path_prefix,
    depth: unit.depth,
    state: unit.state,
    declaration_path: unit.declaration_path,
    head_gitlink_oid: unit.head_gitlink_oid,
    index_gitlink_oid: unit.index_gitlink_oid,
    worktree_head_oid: unit.worktree_head_oid,
    pinned_revision_matches: unit.pinned_revision_matches,
    cleanliness: unit.cleanliness,
    source_available: unit.source_available
  };
}

function normalizeBlockers(blockers: readonly RepositoryClaimBlocker[]): RepositoryClaimBlocker[] {
  const byKey = new Map<string, RepositoryClaimBlocker>();
  for (const blocker of blockers) {
    const key = JSON.stringify([blocker.kind, blocker.path_prefix, blocker.message, blocker.blocked_claims]);
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...blocker,
        evidence_paths: uniqueSorted([...blocker.evidence_paths]),
        blocked_claims: [...new Set(blocker.blocked_claims)]
      });
    }
  }
  return [...byKey.values()];
}

function blockedUnit(input: {
  repository_key: RepositoryKey;
  parent_repository_key?: RepositoryKey;
  path_prefix: string;
  depth: number;
  state: RepositoryCompositionState;
  declaration_path?: string;
  head_gitlink_oid?: string;
  index_gitlink_oid?: string;
  source_available: boolean;
  evidence_paths?: readonly string[];
  blocker: RepositoryClaimBlocker;
}): RepositoryUnitEvidence {
  return {
    repository_key: input.repository_key,
    ...(input.parent_repository_key === undefined ? {} : { parent_repository_key: input.parent_repository_key }),
    path_prefix: input.path_prefix,
    depth: input.depth,
    state: input.state,
    declaration_path: input.declaration_path,
    head_gitlink_oid: input.head_gitlink_oid,
    index_gitlink_oid: input.index_gitlink_oid,
    pinned_revision_matches: "unknown",
    cleanliness: "unavailable",
    source_available: input.source_available,
    evidence_paths: uniqueSorted([...(input.evidence_paths ?? []), ...input.blocker.evidence_paths]),
    claim_blockers: [input.blocker]
  };
}

function limitBlockedUnit(input: {
  repository_key: RepositoryKey;
  parent_repository_key?: RepositoryKey;
  path_prefix: string;
  depth: number;
  declaration_path?: string;
  head_gitlink_oid?: string;
  index_gitlink_oid?: string;
  message: string;
}): RepositoryUnitEvidence {
  return blockedUnit({
    ...input,
    state: "limit_blocked",
    source_available: false,
    evidence_paths: input.declaration_path === undefined ? [] : [input.declaration_path],
    blocker: {
      kind: "limit_blocked",
      path_prefix: input.path_prefix,
      message: input.message,
      evidence_paths: input.declaration_path === undefined ? [] : [input.declaration_path],
      blocked_claims: ["repository_traversal", "pinned_composition", "source_availability"]
    }
  });
}

function limitExceeded(
  kind: RepositoryCompositionLimit["kind"],
  path_prefix: string,
  limit: number
): RepositoryCompositionLimit {
  return {
    kind,
    path_prefix,
    limit,
    message: kind === "max_depth_exceeded"
      ? `Repository composition depth exceeded ${limit} at ${path_prefix}.`
      : `Repository composition count exceeded ${limit} at ${path_prefix}.`
  };
}

function safeDeclaredPath(value: string): string | undefined {
  const normalized = normalizeRepoPath(value).replace(/\/+$/u, "");
  if (
    normalized.length === 0 ||
    normalized === ROOT_PREFIX ||
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    normalized.includes("\0")
  ) {
    return undefined;
  }
  return normalized.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
    ? undefined
    : normalized;
}

function toSubmoduleKey(pathPrefix: string): RepositoryKey {
  return `submodule:${pathPrefix}`;
}

function normalizeRoot(value: string): string {
  return value === "." ? ROOT_PREFIX : normalizeRepoPath(value).replace(/\/+$/u, "");
}

function joinRepoRoot(root: string, childPath: string): string {
  if (root === ROOT_PREFIX) {
    return normalizeRepoPath(childPath);
  }
  return normalizeRepoPath(path.posix.join(root, childPath));
}

function joinRepoPath(prefix: string, childPath: string): string {
  if (prefix === ROOT_PREFIX) {
    return normalizeRepoPath(childPath);
  }
  return normalizeRepoPath(path.posix.join(prefix, childPath));
}

function prefixEvidencePaths(pathPrefix: string, evidencePaths: readonly string[]): string[] {
  return uniqueSorted(evidencePaths.map((item) => joinRepoPath(pathPrefix, item)));
}

function pathDepth(pathPrefix: string): number {
  return pathPrefix === ROOT_PREFIX ? 0 : pathPrefix.split("/").length;
}

function compareRepositoryUnits(left: RepositoryUnitEvidence, right: RepositoryUnitEvidence): number {
  return left.depth - right.depth ||
    left.path_prefix.localeCompare(right.path_prefix) ||
    left.repository_key.localeCompare(right.repository_key);
}

async function statPath(
  workspace: WorkspaceFilePort,
  filePath: string
): Promise<{ exists: boolean; is_file: boolean; size_bytes: number }> {
  try {
    return await workspace.stat({ path: filePath });
  } catch {
    return { exists: false, is_file: false, size_bytes: 0 };
  }
}
