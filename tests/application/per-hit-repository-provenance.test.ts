/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeImpact } from "../../src/application/use-cases/compute-impact.js";
import { getCurrentDocsForTask } from "../../src/application/use-cases/current-docs-for-task.js";
import { findReferences } from "../../src/application/use-cases/find-references.js";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { getDocsOverview, searchDocs } from "../../src/application/use-cases/query-docs.js";
import { searchSymbols } from "../../src/application/use-cases/search-symbols.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import type { FileCatalogEntry, GraphNode } from "../../src/domain/models/index.js";
import type { SnapshotRepositoryComposition } from "../../src/domain/models/runtime.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import type {
  DocsIndexPort,
  FileCatalogPort,
  FileCatalogScanPort,
  GraphQueryPort,
  ReferenceCursorCodecPort,
  SnapshotPort,
  SnapshotPublicationPort,
  SnapshotRepositoryCompositionPort,
  WorkspaceFilePort,
  WorkspaceSafetyPort
} from "../../src/ports/index.js";

describe("per-hit repository provenance", () => {
  it("federates real scanner context and docs discovery through the selected composition receipt", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-provenance-"));
    try {
      fs.mkdirSync(path.join(repoRoot, ".git"));
      fs.mkdirSync(path.join(repoRoot, "libs", "child"), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, ".gitmodules"), "[submodule \"child\"]\n\tpath = libs/child\n");
      fs.writeFileSync(path.join(repoRoot, "libs", "child", ".git"), "gitdir: ../../.git/modules/libs/child\n");
      fs.writeFileSync(path.join(repoRoot, "libs", "child", "README.md"), "# Child guide\n\nChild engine docs.\n");
      fs.writeFileSync(path.join(repoRoot, "libs", "child", "app.rb"), "class ChildRunner; end\n");
      const composition = compositionReceipt();
      const snapshots = {
        ...snapshotStore(),
        async getRepositoryComposition() {
          return composition;
        }
      } as SnapshotPort & SnapshotPublicationPort & SnapshotRepositoryCompositionPort;
      const scanner = new FileCatalogScannerAdapter();
      const workspaceAdapter = new WorkspaceFileAdapter({ repoRoot });

      const context = await getTaskContext({
        request: {
          task: "Update child engine",
          repo_root: repoRoot,
          files: ["libs/child/app.rb"],
          symbols: [],
          max_files: 5,
          max_docs: 5
        },
        scanner,
        snapshots,
        workspace: workspaceAdapter,
        selected_snapshot_id: "snap-1",
        default_repo_root: repoRoot
      });
      const overview = await getDocsOverview({
        request: { repo_root: repoRoot, max_docs: 10, max_headings_per_doc: 10 },
        scanner,
        workspace: workspaceAdapter,
        repository_composition: composition,
        default_repo_root: repoRoot
      });
      const current = await getCurrentDocsForTask({
        request: { repo_root: repoRoot, task: "child engine", files: [], max_docs: 10 },
        scanner,
        workspace: workspaceAdapter,
        repository_composition: composition,
        default_repo_root: repoRoot
      });

      expect(context.context.requested_files[0]).toMatchObject({ path: "libs/child/app.rb" });
      expect(overview.overview.important_docs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: "libs/child/README.md",
          repository: expect.objectContaining({ repository_key: "submodule:libs/child" })
        })
      ]));
      expect([
        ...current.current_docs.canonical_docs,
        ...current.current_docs.supporting_docs,
        ...current.current_docs.non_authoritative_docs,
        ...current.current_docs.unknown_docs
      ]).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: "libs/child/README.md",
          repository: expect.objectContaining({ repository_key: "submodule:libs/child" })
        })
      ]));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("attaches compact submodule provenance to context file evidence", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update child engine behavior",
        repo_root: "/repo",
        files: ["libs/child/app.rb"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner: scanner([entry("libs/child/app.rb", "ruby"), entry("README.md", "markdown")]),
      snapshots: snapshotStore(),
      catalog: catalog([entry("libs/child/app.rb", "ruby")]),
      workspace: workspace({ "README.md": "# Root docs\n" }),
      snapshot_validity: validSnapshot(),
      selected_snapshot_id: "snap-1",
      default_repo_root: "/repo"
    });

    expect(result.context.requested_files[0]).toMatchObject({
      path: "libs/child/app.rb",
      repository: {
        repository_key: "submodule:libs/child",
        path_prefix: "libs/child",
        state: "initialized"
      }
    });
  });

  it("attaches compact submodule provenance to symbol_search hits", async () => {
    const result = await searchSymbols({
      request: {
        query: "ChildRunner",
        repo_root: "/repo",
        exact: false,
        languages: [],
        max_results: 10,
        source_byte_limit: 0
      },
      graph: graph(),
      snapshots: snapshotStore(),
      catalog: catalog([entry("libs/child/app.rb", "ruby")]),
      snapshot_validity: validSnapshot(),
      selected_snapshot_id: "snap-1",
      default_repo_root: "/repo"
    });

    expect(result.symbols.symbols[0]).toMatchObject({
      path: "libs/child/app.rb",
      repository: {
        repository_key: "submodule:libs/child",
        path_prefix: "libs/child",
        state: "initialized"
      }
    });
  });

  it("attaches compact submodule provenance to reference and impact evidence", async () => {
    const snapshots = snapshotStore();
    const fileCatalog = catalog([entry("libs/child/app.rb", "ruby")]);
    const referenceResult = await findReferences({
      request: {
        node_id: "node-1",
        repo_root: "/repo",
        max_depth: 1,
        max_results: 10
      },
      graph: graph(),
      snapshots,
      catalog: fileCatalog,
      workspace_safety: {} as WorkspaceSafetyPort,
      cursor_codec: cursorCodec(),
      snapshot_validity: validSnapshot(),
      selected_snapshot_id: "snap-1",
      default_repo_root: "/repo"
    });
    const impactResult = await computeImpact({
      request: {
        node_id: "node-1",
        repo_root: "/repo",
        max_depth: 1,
        max_nodes: 10,
        direction: "outgoing"
      },
      graph: graph(),
      snapshots,
      catalog: fileCatalog,
      snapshot_validity: validSnapshot(),
      selected_snapshot_id: "snap-1",
      default_repo_root: "/repo"
    });

    expect(referenceResult.references.target).toMatchObject({
      repository: {
        repository_key: "submodule:libs/child",
        path_prefix: "libs/child",
        state: "initialized"
      }
    });
    expect(referenceResult.references.references[0]).toMatchObject({
      target_file_path: "libs/child/app.rb",
      repository: {
        repository_key: "submodule:libs/child",
        path_prefix: "libs/child",
        state: "initialized"
      }
    });
    expect(impactResult.impact.affected_symbols[0]).toMatchObject({
      repository: {
        repository_key: "submodule:libs/child",
        path_prefix: "libs/child",
        state: "initialized"
      }
    });
    expect(impactResult.impact.affected_files[0]).toMatchObject({
      path: "libs/child/app.rb",
      repository: {
        repository_key: "submodule:libs/child",
        path_prefix: "libs/child",
        state: "initialized"
      }
    });
  });

  it("attaches compact submodule provenance to docs search hits", async () => {
    const result = await searchDocs({
      request: {
        repo_root: "/repo",
        query: "child",
        max_results: 10,
        include_snippets: true
      },
      docs_index: docsIndex(),
      snapshot_validity: validSnapshot(),
      selected_snapshot_id: "snap-1",
      default_repo_root: "/repo"
    });

    expect(result.search.hits[0]).toMatchObject({
      path: "libs/child/README.md",
      repository: {
        repository_key: "submodule:libs/child",
        path_prefix: "libs/child",
        state: "initialized"
      }
    });
  });
});

function entry(filePath: string, language: string): FileCatalogEntry {
  return buildFileCatalogEntry({
    file_identity: {
      path: filePath,
      language,
      content_hash: `sha256:${filePath}`,
      size_bytes: 10,
      mtime_ms: 1
    }
  });
}

function scanner(files: readonly FileCatalogEntry[]): FileCatalogScanPort {
  return {
    async scan() {
      return {
        repo_root: "/repo",
        indexed_roots: ["."],
        skipped_roots: [],
        skipped_path_population: { total_count: 0, groups: [] },
        files,
        truncated: false
      };
    }
  };
}

function workspace(files: Record<string, string>): WorkspaceFilePort {
  return {
    async readText(input) {
      const text = files[input.path];
      if (text === undefined) throw new Error(`missing ${input.path}`);
      return text;
    },
    async stat(input) {
      const text = files[input.path];
      return {
        exists: text !== undefined,
        is_file: text !== undefined,
        size_bytes: text?.length ?? 0,
        mtime_ms: 1
      };
    }
  } as WorkspaceFilePort;
}

function snapshotStore(): SnapshotPort & SnapshotPublicationPort & SnapshotRepositoryCompositionPort {
  const store = {
    async getSnapshot() {
      return snapshot();
    },
    async listSnapshots() {
      return [snapshot()];
    },
    async upsertSnapshot() {},
    async markSnapshotFreshness() {},
    async getLatestPublished() {
      return { status: "selected", snapshot: snapshot(), publication: {} };
    },
    async readExplicit() {
      return { status: "selected", snapshot: snapshot(), publication: {} };
    },
    async allocateBuildSnapshotId() {
      return "snap-1";
    },
    async transitionBuild() {
      return {};
    },
    async getRepositoryComposition() {
      return null;
    },
    async resolveRepositoryForPath(input: { path: string }) {
      return input.path.startsWith("libs/child/")
        ? {
            repository_key: "submodule:libs/child",
            parent_repository_key: "superproject",
            path_prefix: "libs/child",
            depth: 1,
            state: "initialized",
            pinned_revision_matches: true,
            cleanliness: "clean",
            source_available: true,
            evidence_paths: ["libs/child/.git"],
            claim_blockers: []
          }
        : null;
    }
  };
  return store as unknown as SnapshotPort & SnapshotPublicationPort & SnapshotRepositoryCompositionPort;
}

function snapshot() {
  return {
    id: "snap-1",
    repo_root: "/repo",
    workspace_root: "/repo",
    repo_identity: "repo",
    config_identity: "config",
    schema_version: 1,
    freshness: "fresh",
    owner_state: "published",
    created_at: "2026-08-04T00:00:00.000Z",
    updated_at: "2026-08-04T00:00:00.000Z"
  };
}

function compositionReceipt(): SnapshotRepositoryComposition {
  return {
    superproject_key: "superproject",
    repositories: [
      {
        repository_key: "superproject",
        path_prefix: ".",
        depth: 0,
        state: "superproject",
        pinned_revision_matches: "unknown",
        cleanliness: "clean",
        source_available: true,
        evidence_paths: [],
        claim_blockers: []
      },
      {
        repository_key: "submodule:libs/child",
        parent_repository_key: "superproject",
        path_prefix: "libs/child",
        depth: 1,
        state: "initialized",
        declaration_path: ".gitmodules",
        head_gitlink_oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        worktree_head_oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        pinned_revision_matches: true,
        cleanliness: "clean",
        source_available: true,
        evidence_paths: [".gitmodules", "libs/child/.git"],
        claim_blockers: []
      }
    ],
    aggregate_claims: { worktree_cleanliness: "clean", pinned_composition: "complete" },
    skipped_or_blocked: [],
    source_complete: true,
    truncated: false,
    composition_fingerprint: "a".repeat(64),
    limits: []
  };
}

function validSnapshot() {
  return {
    snapshot_id: "snap-1",
    state: "valid" as const,
    complete: true,
    checked_path_count: 1,
    observed_path_count: 1,
    missing_paths: [],
    inaccessible_paths: [],
    refresh_required: false
  };
}

function graph(): GraphQueryPort {
  return {
    async getNode() {
      return node();
    },
    async findNodesByName() {
      return [node()];
    },
    async findNodesByQualifiedName() {
      return [];
    },
    async searchNodes() {
      return [node()];
    },
    async getNodesInRange() {
      return [node()];
    },
    async getOutgoingEdges() {
      return [];
    },
    async getIncomingEdges() {
      return [];
    },
    async getReferences() {
      return [{
        source_node_id: "node-1",
        target_node_id: "node-1",
        target_file_path: "libs/child/app.rb",
        edge_id: "edge-1",
        confidence: 0.9,
        provenance: "tree-sitter-ruby"
      }];
    },
    async getUnresolvedReferences() {
      return [];
    },
    async traverse() {
      return {
        start_node_ids: ["node-1"],
        nodes: [node()],
        edges: [{
          id: "edge-1",
          source_node_id: "node-1",
          target_node_id: "node-1",
          kind: "call",
          provenance: "tree-sitter-ruby",
          confidence: 0.9,
          metadata: {}
        }],
        reached_depth: 1,
        truncated: false
      };
    }
  };
}

function node(): GraphNode {
  return {
    id: "node-1",
    kind: "class",
    name: "ChildRunner",
    qualified_name: "ChildRunner",
    file_path: "libs/child/app.rb",
    language: "ruby",
    source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: 10 },
    metadata: { capability_level: "partial_semantic", evidence_kinds: ["parser"] }
  };
}

function catalog(files: readonly FileCatalogEntry[]): FileCatalogPort {
  return {
    async listFiles() {
      return files;
    },
    async getFile(input) {
      return files.find((file) => file.path === input.path) ?? null;
    },
    async upsertEntry() {},
    async removeEntry() {}
  };
}

function cursorCodec(): ReferenceCursorCodecPort {
  return {
    key_epoch: "test",
    encode() {
      return "cursor";
    },
    decode() {
      return { ok: false, code: "invalid_cursor" };
    }
  };
}

function docsIndex(): DocsIndexPort & SnapshotRepositoryCompositionPort {
  return {
    ...snapshotStore(),
    async replaceSnapshotDocs() {},
    async search() {
      return {
        status: "done",
        repo_root: "/repo",
        snapshot_id: "snap-1",
        freshness: "fresh",
        hits: [{
          path: "libs/child/README.md",
          title: "Child",
          score: 1,
          evidence_kinds: ["docs"],
          direct_read_caveat: "routing evidence",
          snippet: "child"
        }],
        truncated: false,
        result_count: 1,
        result_count_basis: "page"
      };
    },
    async getState() {
      return {
        repo_root: "/repo",
        snapshot_id: "snap-1",
        freshness: "fresh",
        status: "usable",
        document_count: 1
      };
    }
  } as DocsIndexPort & SnapshotRepositoryCompositionPort;
}
