/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it, vi } from "vitest";
import { discoverRepositoryComposition } from "../../src/application/use-cases/repository-composition.js";
import type {
  CommandCancellation,
  GitRepositoryCompositionPort,
  WorkspaceFilePort
} from "../../src/ports/index.js";

describe("repository composition discovery", () => {
  it("reconciles declaration, gitlink, detached child HEAD, and cleanliness without borrowing aggregate claims", async () => {
    const result = await discoverRepositoryComposition({
      workspace: memoryWorkspace({
        ".gitmodules": "[submodule \"child\"]\n path = libs/child\n url = https://secret.invalid/private.git\n",
        "libs/child/.git": "gitdir: ../../.git/modules/libs/child\n",
        "libs/child/.gitmodules": ""
      }),
      git: gitPort({
        ".": {
          head: availableHead("1111111111111111111111111111111111111111"),
          cleanliness: availableCleanliness("dirty", ["README.md"]),
          gitlinks: {
            committed_gitlinks: [{ path: "libs/child", object_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
            index_gitlinks: [{ path: "libs/child", object_id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }]
          }
        },
        "libs/child": {
          head: availableHead("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          cleanliness: availableCleanliness("clean", [])
        }
      }),
      repo_root: "."
    });

    expect(result.aggregate_claims).toEqual({
      worktree_cleanliness: "dirty",
      pinned_composition: "complete"
    });
    expect(result.repositories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        repository_key: "superproject",
        path_prefix: ".",
        state: "superproject",
        cleanliness: "dirty"
      }),
      expect.objectContaining({
        repository_key: "submodule:libs/child",
        parent_repository_key: "superproject",
        path_prefix: "libs/child",
        state: "initialized",
        head_gitlink_oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        index_gitlink_oid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        worktree_head_oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        pinned_revision_matches: true,
        cleanliness: "clean",
        source_available: true
      })
    ]));
    expect(result.composition_fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(result)).not.toContain("secret.invalid");
  });

  it("distinguishes declaration-without-gitlink, orphan-gitlink, uninitialized, and mismatched worktree states", async () => {
    const result = await discoverRepositoryComposition({
      workspace: memoryWorkspace({
        ".gitmodules": "path = libs/declared-only\npath = libs/uninitialized\npath = libs/mismatch\n",
        "libs/mismatch/.git": "gitdir: ../../.git/modules/libs/mismatch\n"
      }),
      git: gitPort({
        ".": {
          head: availableHead("1111111111111111111111111111111111111111"),
          cleanliness: availableCleanliness("clean", []),
          gitlinks: {
            committed_gitlinks: [
              { path: "libs/uninitialized", object_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
              { path: "libs/mismatch", object_id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
              { path: "libs/orphan", object_id: "cccccccccccccccccccccccccccccccccccccccc" }
            ],
            index_gitlinks: []
          }
        },
        "libs/mismatch": {
          head: availableHead("dddddddddddddddddddddddddddddddddddddddd"),
          cleanliness: availableCleanliness("clean", [])
        }
      }),
      repo_root: "."
    });

    expect(result.aggregate_claims.pinned_composition).toBe("blocked");
    expect(result.skipped_or_blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({ path_prefix: "libs/declared-only", state: "declaration_without_gitlink" }),
      expect.objectContaining({ path_prefix: "libs/uninitialized", state: "uninitialized" }),
      expect.objectContaining({ path_prefix: "libs/orphan", state: "orphan_gitlink" })
    ]));
    expect(result.repositories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path_prefix: "libs/mismatch",
        state: "worktree_revision_mismatch",
        pinned_revision_matches: false,
        source_available: true
      })
    ]));
  });

  it("blocks an initialized declaration whose canonical worktree escapes the selected superproject", async () => {
    const result = await discoverRepositoryComposition({
      workspace: memoryWorkspace({
        ".gitmodules": "path = libs/escape\n",
        "libs/escape/.git": "gitdir: ../../.git/modules/libs/escape\n"
      }),
      git: gitPort({
        "/repo": {
          head: availableHead("1111111111111111111111111111111111111111"),
          cleanliness: availableCleanliness("clean", []),
          gitlinks: {
            committed_gitlinks: [{ path: "libs/escape", object_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
            index_gitlinks: []
          }
        }
      }),
      repo_root: "/repo",
      canonicalize_repo_root: (repoRoot) => repoRoot === "/repo/libs/escape" ? "/outside/escape" : repoRoot
    });

    expect(result.repositories).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path_prefix: "libs/escape", source_available: true })
    ]));
    expect(result.skipped_or_blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path_prefix: "libs/escape",
        state: "path_blocked",
        claim_blockers: [expect.objectContaining({
          kind: "path_blocked",
          blocked_claims: ["repository_traversal", "source_availability", "pinned_composition"]
        })]
      })
    ]));
  });

  it("blocks malformed declarations, git-metadata failures, recursion cycles, and repository limits deterministically", async () => {
    const result = await discoverRepositoryComposition({
      workspace: memoryWorkspace({
        ".gitmodules": "path = ../escape\npath = libs/cycle\npath = libs/limit\npath = libs/overflow\npath = libs/overflow-2\n",
        "libs/cycle/.git": "gitdir: ../../.git/modules/libs/cycle\n",
        "libs/cycle/.gitmodules": "path = again\n",
        "libs/cycle/again/.git": "gitdir: ../../../.git/modules/libs/cycle/again\n",
        "libs/limit/.git": "gitdir: ../../.git/modules/libs/limit\n",
        "libs/overflow/.git": "gitdir: ../../.git/modules/libs/overflow\n"
      }),
      git: gitPort({
        ".": {
          head: availableHead("1111111111111111111111111111111111111111"),
          cleanliness: availableCleanliness("clean", []),
          gitlinks: {
            committed_gitlinks: [
              { path: "libs/cycle", object_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
              { path: "libs/limit", object_id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
              { path: "libs/overflow", object_id: "cccccccccccccccccccccccccccccccccccccccc" },
              { path: "libs/overflow-2", object_id: "dddddddddddddddddddddddddddddddddddddddd" }
            ],
            index_gitlinks: []
          }
        },
        "libs/cycle": {
          head: availableHead("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          cleanliness: availableCleanliness("clean", []),
          gitlinks: {
            committed_gitlinks: [{ path: "again", object_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
            index_gitlinks: []
          }
        },
        "libs/cycle/again": {
          head: availableHead("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          cleanliness: availableCleanliness("clean", [])
        },
        "libs/limit": {
          head: blockedHead("timeout", "timed out"),
          cleanliness: blockedCleanliness("timeout", "timed out")
        },
        "libs/overflow": {
          head: availableHead("cccccccccccccccccccccccccccccccccccccccc"),
          cleanliness: availableCleanliness("clean", [])
        }
      }),
      repo_root: ".",
      max_repositories: 4,
      canonicalize_repo_root: (repoRoot) => repoRoot === "libs/cycle/again" ? "libs/cycle" : repoRoot
    });

    expect(result.truncated).toBe(true);
    expect(result.limits).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "max_repositories_exceeded", path_prefix: "libs/overflow-2" })
    ]));
    expect(result.skipped_or_blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "path_blocked", path_prefix: "../escape" }),
      expect.objectContaining({ state: "cycle_blocked", path_prefix: "libs/cycle/again" }),
      expect.objectContaining({ state: "limit_blocked", path_prefix: "libs/overflow-2" })
    ]));
    expect(result.repositories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path_prefix: "libs/limit",
        state: "metadata_unavailable",
        claim_blockers: expect.arrayContaining([
          expect.objectContaining({ blocked_claims: ["pinned_composition"] }),
          expect.objectContaining({ blocked_claims: ["worktree_cleanliness"] })
        ])
      })
    ]));
  });
});

function memoryWorkspace(files: Readonly<Record<string, string>>): WorkspaceFilePort {
  return {
    readText: async ({ path }) => files[path] ?? "",
    readTextPrefix: async ({ path, max_bytes }) => (files[path] ?? "").slice(0, max_bytes),
    readBinary: async () => new Uint8Array(),
    writeText: vi.fn(),
    writeBinary: vi.fn(),
    stat: async ({ path }) => ({
      exists: files[path] !== undefined,
      is_file: files[path] !== undefined,
      size_bytes: files[path]?.length ?? 0,
      mtime_ms: 1
    }),
    deletePath: vi.fn(),
    ensureDirectory: vi.fn()
  };
}

function gitPort(
  fixtures: Record<string, {
    head?: ReturnType<typeof availableHead> | ReturnType<typeof blockedHead>;
    cleanliness?: ReturnType<typeof availableCleanliness> | ReturnType<typeof blockedCleanliness>;
    gitlinks?: { committed_gitlinks: Array<{ path: string; object_id: string }>; index_gitlinks: Array<{ path: string; object_id: string }> };
    canonical_root?: string;
  }>
): GitRepositoryCompositionPort {
  const resolveKey = (repoRoot: string) => fixtures[repoRoot]?.canonical_root ?? repoRoot;
  return {
    inspectSuperprojectGitlinks: async ({ repo_root }) => {
      const fixture = fixtures[resolveKey(repo_root)];
      return fixture?.gitlinks === undefined
        ? { status: "available", committed_gitlinks: [], index_gitlinks: [] }
        : { status: "available", ...fixture.gitlinks };
    },
    inspectRepositoryHead: async ({ repo_root }: { repo_root: string; cancellation?: CommandCancellation }) =>
      fixtures[resolveKey(repo_root)]?.head ?? blockedHead("command_failed", "missing head fixture"),
    inspectRepositoryCleanliness: async ({ repo_root }: { repo_root: string; cancellation?: CommandCancellation }) =>
      fixtures[resolveKey(repo_root)]?.cleanliness ?? blockedCleanliness("command_failed", "missing cleanliness fixture")
  };
}

function availableHead(head_object_id: string) {
  return {
    status: "available" as const,
    head_object_id,
    evidence_paths: [".git/HEAD"]
  };
}

function blockedHead(reason: "timeout" | "command_failed", message: string) {
  return {
    status: "blocked" as const,
    reason,
    message,
    evidence_paths: [".git/HEAD"]
  };
}

function availableCleanliness(cleanliness: "clean" | "dirty", changed_paths: string[]) {
  return {
    status: "available" as const,
    cleanliness,
    changed_paths
  };
}

function blockedCleanliness(reason: "timeout" | "command_failed", message: string) {
  return {
    status: "blocked" as const,
    reason,
    message
  };
}
