import type { ImpactRequest, ImpactResult, ResponseMetadata } from "../../contracts/index.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import {
  blockedMeta,
  fileReferencesForNodes,
  resolveSnapshot,
  toSymbolReference
} from "./query-helpers.js";
import { capNextActions } from "../../presentation/metadata.js";

export type ComputeImpactResult = {
  impact: ImpactResult;
  meta: ResponseMetadata;
};

export async function computeImpact(input: {
  request: ImpactRequest;
  graph: GraphQueryPort;
  snapshots: SnapshotPort;
  catalog: FileCatalogPort;
  workspace?: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<ComputeImpactResult> {
  const repoRoot = input.request.repo_root ?? input.default_repo_root;
  const resolved = await resolveSnapshot({
    repo_root: repoRoot,
    snapshot_id: input.request.snapshot_id,
    snapshots: input.snapshots,
    catalog: input.catalog,
    row_limit: input.request.max_nodes,
    traversal_depth: input.request.max_depth
  });
  if (!resolved) {
    return {
      impact: {
        repo_root: repoRoot,
        snapshot_id: input.request.snapshot_id ?? "",
        start_node_ids: [input.request.node_id],
        affected_symbols: [],
        affected_files: [],
        edge_count: 0,
        reached_depth: 0,
        traversal_truncated: false,
        confidence: {
          level: "low",
          scope: "empty",
          reason: "No graph snapshot was available, so impact evidence could not be computed.",
          evidence_kinds: []
        },
        next_actions: capNextActions([])
      },
      meta: blockedMeta({
        repo_root: repoRoot,
        row_limit: input.request.max_nodes,
        traversal_depth: input.request.max_depth
      })
    };
  }

  const traversal = await input.graph.traverse({
    snapshot_id: resolved.snapshot_id,
    request: {
      start_node_ids: [input.request.node_id],
      max_depth: input.request.max_depth,
      max_nodes: input.request.max_nodes,
      direction: input.request.direction
    }
  });
  const confidence = impactConfidence({
    edgeCount: traversal.edges.length,
    fileCount: new Set(traversal.nodes.map((node) => node.file_path)).size,
    truncated: traversal.truncated
  });

  return {
    impact: {
      repo_root: resolved.repo_root,
      snapshot_id: resolved.snapshot_id,
      start_node_ids: [...traversal.start_node_ids],
      affected_symbols: await Promise.all(
        traversal.nodes.map((node) =>
          toSymbolReference({
            node,
            workspace: input.workspace,
            source_byte_limit: 0
          })
        )
      ),
      affected_files: await fileReferencesForNodes({
        nodes: traversal.nodes,
        catalog: input.catalog,
        snapshot_id: resolved.snapshot_id
      }),
      edge_count: traversal.edges.length,
      reached_depth: traversal.reached_depth,
      traversal_truncated: traversal.truncated,
      confidence,
      next_actions: capNextActions([
        {
          tool: "verification_plan",
          args: {
            files: Array.from(new Set(traversal.nodes.map((node) => node.file_path))).sort()
          }
        }
      ])
    },
    meta: {
      ...resolved.meta,
      truncated: traversal.truncated,
      budget: {
        ...resolved.meta.budget,
        traversal_depth: input.request.max_depth,
        row_limit: input.request.max_nodes
      }
    }
  };
}

function impactConfidence(input: {
  edgeCount: number;
  fileCount: number;
  truncated: boolean;
}): ImpactResult["confidence"] {
  if (input.edgeCount === 0) {
    return {
      level: "low",
      scope: "empty",
      reason: "Traversal found no parser-backed edges; blast-radius evidence is insufficient for broad edit planning.",
      evidence_kinds: ["parser"]
    };
  }
  if (input.fileCount <= 1) {
    return {
      level: "low",
      scope: "local_only",
      reason: "Traversal stayed within one file; treat impact as local-only and verify broader usage before broad edits.",
      evidence_kinds: ["parser"]
    };
  }
  return {
    level: input.truncated ? "medium" : "high",
    scope: "graph",
    reason: input.truncated
      ? "Traversal reached cross-file parser-backed edges but hit the configured budget."
      : "Traversal reached cross-file parser-backed edges within the configured budget.",
    evidence_kinds: ["parser"]
  };
}
