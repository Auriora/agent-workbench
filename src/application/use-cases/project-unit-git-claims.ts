/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ProjectUnitBlocker, ProjectUnitEvidence } from "../../contracts/index.js";
import type { WorkspaceFilePort } from "../../ports/index.js";

const MAX_GIT_METADATA_BYTES = 32_000;

export type RepositoryGitClaimEvidence =
  | { state: "head_resolved"; evidence_paths: string[] }
  | { state: "unavailable"; evidence_paths: string[]; reason: "missing" | "malformed" | "unresolved" | "unreadable" };

export async function inspectRepositoryGitClaims(workspace: WorkspaceFilePort): Promise<RepositoryGitClaimEvidence> {
  const head = await boundedRead(workspace, ".git/HEAD", 512);
  if (head.state !== "readable") {
    return { state: "unavailable", evidence_paths: head.exists ? [".git/HEAD"] : [], reason: head.exists ? "unreadable" : "missing" };
  }
  const value = head.content.trim();
  if (/^[0-9a-f]{40,64}$/iu.test(value)) {
    return { state: "head_resolved", evidence_paths: [".git/HEAD"] };
  }
  const match = /^ref:\s+(refs\/[A-Za-z0-9._\/-]+)$/u.exec(value);
  if (match === null || match[1]!.split("/").some((segment) => segment === ".." || segment.length === 0)) {
    return { state: "unavailable", evidence_paths: [".git/HEAD"], reason: "malformed" };
  }
  const refPath = `.git/${match[1]}`;
  const ref = await boundedRead(workspace, refPath, 512);
  if (ref.state === "readable" && /^[0-9a-f]{40,64}\s*$/iu.test(ref.content)) {
    return { state: "head_resolved", evidence_paths: [".git/HEAD", refPath] };
  }
  const packed = await boundedRead(workspace, ".git/packed-refs", MAX_GIT_METADATA_BYTES);
  if (packed.state === "readable" && packed.content.split(/\r?\n/u).some((line) => {
    const parts = line.trim().split(/\s+/u);
    return parts[1] === match[1] && /^[0-9a-f]{40,64}$/iu.test(parts[0] ?? "");
  })) {
    return { state: "head_resolved", evidence_paths: [".git/HEAD", ".git/packed-refs"] };
  }
  return { state: "unavailable", evidence_paths: [".git/HEAD"], reason: "unresolved" };
}

export function applyRepositoryGitClaimEvidence(
  units: readonly ProjectUnitEvidence[],
  evidence: RepositoryGitClaimEvidence
): ProjectUnitEvidence[] {
  if (evidence.state === "head_resolved") return units.map(cloneUnit);
  return units.map((unit) => {
    const blocker: ProjectUnitBlocker = {
      kind: "git_claim_unavailable",
      unit_root: unit.root,
      evidence_paths: evidence.evidence_paths,
      message: `Git metadata is ${evidence.reason}; source evidence remains usable but worktree and diff claims are unavailable.`,
      blocked_claims: ["worktree_cleanliness", "diff_completeness"]
    };
    return {
      ...cloneUnit(unit),
      readiness: unit.readiness === "ready" ? "limited" : unit.readiness,
      blockers: [...unit.blockers.filter((item) => item.kind !== "git_claim_unavailable"), blocker]
    };
  });
}

async function boundedRead(
  workspace: WorkspaceFilePort,
  filePath: string,
  maxBytes: number
): Promise<{ state: "readable"; exists: true; content: string } | { state: "unavailable"; exists: boolean }> {
  try {
    const stat = await workspace.stat({ path: filePath });
    if (!stat.exists || !stat.is_file) return { state: "unavailable", exists: false };
    if (stat.size_bytes > maxBytes) return { state: "unavailable", exists: true };
    const content = workspace.readTextPrefix === undefined
      ? await workspace.readText({ path: filePath })
      : await workspace.readTextPrefix({ path: filePath, max_bytes: maxBytes });
    return { state: "readable", exists: true, content };
  } catch {
    return { state: "unavailable", exists: true };
  }
}

function cloneUnit(unit: ProjectUnitEvidence): ProjectUnitEvidence {
  return {
    ...unit,
    markers: [...unit.markers],
    blockers: [...unit.blockers],
    planned_commands: [...unit.planned_commands]
  };
}
