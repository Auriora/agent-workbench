import type {
  ResponseMetadata,
  SymbolSearchRequest,
  SymbolSearchResult
} from "../../contracts/index.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import type { GraphNode } from "../../domain/models/index.js";
import { blockedMeta, resolveSnapshot, toSymbolReference } from "./query-helpers.js";
import { capNextActions, uniqueSorted } from "../../presentation/metadata.js";

export type SearchSymbolsResult = {
  symbols: SymbolSearchResult;
  meta: ResponseMetadata;
};

export async function searchSymbols(input: {
  request: SymbolSearchRequest;
  graph: GraphQueryPort;
  snapshots: SnapshotPort;
  catalog: FileCatalogPort;
  workspace?: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<SearchSymbolsResult> {
  const repoRoot = input.request.repo_root ?? input.default_repo_root;
  const resolved = await resolveSnapshot({
    repo_root: repoRoot,
    snapshot_id: input.request.snapshot_id,
    snapshots: input.snapshots,
    catalog: input.catalog,
    row_limit: input.request.max_results,
    source_byte_limit: input.request.source_byte_limit
  });
  if (!resolved) {
    return {
      symbols: {
        query: input.request.query,
        repo_root: repoRoot,
        snapshot_id: input.request.snapshot_id ?? "",
        symbols: [],
        next_actions: capNextActions([])
      },
      meta: blockedMeta({
        repo_root: repoRoot,
        row_limit: input.request.max_results,
        source_byte_limit: input.request.source_byte_limit
      })
    };
  }

  const searchResult: SymbolNodeSearchResult = input.request.exact
    ? await findExactThenFallbackSymbols({
        graph: input.graph,
        snapshot_id: resolved.snapshot_id,
        query: input.request.query,
        max_rows: input.request.max_results
      })
    : {
        nodes: await input.graph.searchNodes({
          snapshot_id: resolved.snapshot_id,
          query: input.request.query,
          max_rows: input.request.max_results
        }),
        exactMiss: false
      };
  const nodes = searchResult.nodes;
  const exactMiss = searchResult.exactMiss;
  const filtered = input.request.languages.length > 0
    ? nodes.filter((node) => input.request.languages.includes(node.language))
    : nodes;

  return {
    symbols: {
      query: input.request.query,
      repo_root: resolved.repo_root,
      snapshot_id: resolved.snapshot_id,
      symbols: await Promise.all(
        filtered.map((node) =>
          toSymbolReference({
            node,
            workspace: input.workspace,
            source_byte_limit: input.request.source_byte_limit
          })
        )
      ),
      next_actions:
        filtered.length > 0
          ? capNextActions([
              {
                tool: "find_references",
                args: {
                  symbol: input.request.query,
                  snapshot_id: resolved.snapshot_id
                }
              }
            ])
          : capNextActions([
              {
                tool: "context_for_task",
                args: {
                  task: exactMiss
                    ? `Exact symbol '${input.request.query}' was not found; inspect nearby files or verify the symbol name.`
                    : `No symbol results were found for '${input.request.query}'.`,
                  symbols: [input.request.query],
                  repo_root: resolved.repo_root
                }
              }
            ])
    },
    meta: {
      ...resolved.meta,
      scope: {
        ...resolved.meta.scope,
        languages: uniqueSorted([
          ...resolved.meta.scope.languages,
          ...filtered.map((node) => node.language)
        ])
      },
      truncated: nodes.length >= input.request.max_results
    }
  };
}

async function findExactThenFallbackSymbols(input: {
  graph: GraphQueryPort;
  snapshot_id: string;
  query: string;
  max_rows: number;
}): Promise<SymbolNodeSearchResult> {
  const byName = await input.graph.findNodesByName({
    snapshot_id: input.snapshot_id,
    query: input.query,
    exact: true,
    max_rows: input.max_rows
  });
  const byQualifiedName = await input.graph.findNodesByQualifiedName({
    snapshot_id: input.snapshot_id,
    qualified_name: input.query,
    max_rows: input.max_rows
  });
  const exact = dedupeNodes([...byName, ...byQualifiedName]).slice(0, input.max_rows);
  if (exact.length > 0) {
    return {
      nodes: exact,
      exactMiss: false
    };
  }
  const fallback = await input.graph.searchNodes({
    snapshot_id: input.snapshot_id,
    query: input.query,
    max_rows: input.max_rows
  });
  return {
    nodes: fallback,
    exactMiss: true
  };
}

function dedupeNodes<T extends { id: string }>(nodes: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }
  return [...byId.values()];
}

type SymbolNodeSearchResult = {
  nodes: readonly GraphNode[];
  exactMiss: boolean;
};
