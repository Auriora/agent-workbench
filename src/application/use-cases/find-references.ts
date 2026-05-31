import type {
  FindReferencesRequest,
  FindReferencesResult,
  ReferenceHit,
  ResponseMetadata
} from "../../contracts/index.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import { blockedMeta, resolveSnapshot, toSymbolReference } from "./query-helpers.js";

export type FindReferencesUseCaseResult = {
  references: FindReferencesResult;
  meta: ResponseMetadata;
};

export async function findReferences(input: {
  request: FindReferencesRequest;
  graph: GraphQueryPort;
  snapshots: SnapshotPort;
  catalog: FileCatalogPort;
  workspace?: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<FindReferencesUseCaseResult> {
  const repoRoot = input.request.repo_root ?? input.default_repo_root;
  const resolved = await resolveSnapshot({
    repo_root: repoRoot,
    snapshot_id: input.request.snapshot_id,
    snapshots: input.snapshots,
    catalog: input.catalog,
    row_limit: input.request.max_results,
    traversal_depth: input.request.max_depth
  });
  if (!resolved) {
    return {
      references: {
        repo_root: repoRoot,
        snapshot_id: input.request.snapshot_id ?? "",
        references: [],
        next_actions: [{ tool: "prewarm_graph", args: { repo_root: repoRoot } }]
      },
      meta: blockedMeta({
        repo_root: repoRoot,
        row_limit: input.request.max_results,
        traversal_depth: input.request.max_depth
      })
    };
  }

  const target = input.request.node_id
    ? await input.graph.getNode({ snapshot_id: resolved.snapshot_id, node_id: input.request.node_id })
    : (await input.graph.findNodesByName({
        snapshot_id: resolved.snapshot_id,
        query: input.request.symbol ?? "",
        exact: true,
        max_rows: 2
      }))[0] ?? null;
  if (!target) {
    return {
      references: {
        repo_root: resolved.repo_root,
        snapshot_id: resolved.snapshot_id,
        references: [],
        next_actions: [{ tool: "symbol_search", args: { query: input.request.symbol ?? input.request.node_id ?? "" } }]
      },
      meta: resolved.meta
    };
  }

  const outgoing = await input.graph.getReferences({
    snapshot_id: resolved.snapshot_id,
    node_id: target.id,
    max_depth: input.request.max_depth,
    max_rows: input.request.max_results
  });
  const unresolved = await input.graph.getUnresolvedReferences({
    snapshot_id: resolved.snapshot_id,
    file_path: target.file_path,
    max_rows: input.request.max_results
  });
  const references: ReferenceHit[] = [
    ...outgoing.map((item) => ({
      source_node_id: item.source_node_id,
      target_node_id: item.target_node_id,
      target_file_path: item.target_file_path,
      reference_kind: "resolved",
      confidence: item.confidence,
      provenance: item.provenance,
      status: "resolved" as const
    })),
    ...unresolved.map((item) => ({
      source_node_id: item.source_node_id,
      source_file_path: item.source_file_path,
      reference_name: item.reference_name,
      reference_kind: item.reference_kind,
      provenance: "unresolved_reference",
      status: item.candidate_metadata.resolution === "ambiguous" ? "ambiguous" as const : "unresolved" as const
    }))
  ].slice(0, input.request.max_results);

  return {
    references: {
      repo_root: resolved.repo_root,
      snapshot_id: resolved.snapshot_id,
      target: await toSymbolReference({
        node: target,
        workspace: input.workspace,
        source_byte_limit: 0
      }),
      references,
      next_actions: [
        {
          tool: "impact",
          args: {
            node_id: target.id,
            snapshot_id: resolved.snapshot_id
          }
        }
      ]
    },
    meta: {
      ...resolved.meta,
      truncated: references.length >= input.request.max_results
    }
  };
}
