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
import { capNextActions, uniqueSorted } from "./response-metadata.js";

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
      languages: input.request.languages,
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
  const nodes = await expandLambdaHandlerGroups({
    graph: input.graph,
    snapshot_id: resolved.snapshot_id,
    nodes: searchResult.nodes,
    max_rows: input.request.max_results
  });
  const exactMiss = searchResult.exactMiss;
  const filtered = filterByLanguages(nodes, input.request.languages);

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
  languages: readonly string[];
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
  const exact = filterByLanguages(
    rankExactNodes(dedupeNodes([...byName, ...byQualifiedName]), input.query),
    input.languages
  ).slice(0, input.max_rows);
  if (exact.length > 0) {
    return {
      nodes: exact,
      exactMiss: false
    };
  }
  const resourceExact = filterByLanguages(
    await findResourceBackedExactSymbols(input),
    input.languages
  ).slice(0, input.max_rows);
  if (resourceExact.length > 0) {
    return {
      nodes: resourceExact,
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

async function findResourceBackedExactSymbols(input: {
  graph: GraphQueryPort;
  snapshot_id: string;
  query: string;
  max_rows: number;
}): Promise<readonly GraphNode[]> {
  const query = input.query.trim().toLowerCase();
  if (query.length === 0) {
    return [];
  }
  const candidates = await input.graph.searchNodes({
    snapshot_id: input.snapshot_id,
    query: input.query,
    max_rows: input.max_rows
  });
  return rankExactNodes(
    candidates.filter((node) => isResourceBackedExactMatch(node, query)),
    input.query
  );
}

function isResourceBackedExactMatch(node: GraphNode, lowerQuery: string): boolean {
  if (node.metadata.capability_level !== "resource_backed") {
    return false;
  }
  const lowerName = node.name.toLowerCase();
  const lowerQualified = node.qualified_name?.toLowerCase() ?? "";
  if (node.kind === "lambda_handler_binding") {
    return lowerName === lowerQuery || lowerName.endsWith(`.${lowerQuery}`) || lowerQualified.endsWith(`:${lowerQuery}`);
  }
  if (node.kind === "lambda_function" || node.kind === "cloudformation_resource") {
    return lowerName === lowerQuery || lowerQualified.endsWith(`:${lowerQuery}`);
  }
  return false;
}

function rankExactNodes(nodes: readonly GraphNode[], query: string): GraphNode[] {
  const lowerQuery = query.toLowerCase();
  return [...nodes].sort((left, right) => {
    const delta = exactRank(left, lowerQuery) - exactRank(right, lowerQuery);
    return delta || left.file_path.localeCompare(right.file_path) || left.name.localeCompare(right.name);
  });
}

function exactRank(node: GraphNode, lowerQuery: string): number {
  const lowerName = node.name.toLowerCase();
  const lowerQualified = node.qualified_name?.toLowerCase() ?? "";
  if (lowerName === lowerQuery) return 0;
  if (lowerQualified === lowerQuery) return 1;
  if (node.kind === "lambda_handler_binding" && lowerName.endsWith(`.${lowerQuery}`)) return 2;
  if (lowerQualified.endsWith(`:${lowerQuery}`)) return 3;
  return 10;
}

function filterByLanguages(nodes: readonly GraphNode[], languages: readonly string[]): readonly GraphNode[] {
  return languages.length > 0
    ? nodes.filter((node) => languages.includes(node.language))
    : nodes;
}

async function expandLambdaHandlerGroups(input: {
  graph: GraphQueryPort;
  snapshot_id: string;
  nodes: readonly GraphNode[];
  max_rows: number;
}): Promise<readonly GraphNode[]> {
  const grouped: GraphNode[] = [];
  const seen = new Set<string>();
  for (const node of rankLambdaHandlerNodes(input.nodes)) {
    if (!seen.has(node.id)) {
      grouped.push(node);
      seen.add(node.id);
    }
    if (node.kind === "lambda_handler_binding") {
      const anchors = await lambdaHandlerFileAnchors({
        graph: input.graph,
        snapshot_id: input.snapshot_id,
        node
      });
      for (const anchor of anchors) {
        if (!seen.has(anchor.id)) {
          grouped.push(anchor);
          seen.add(anchor.id);
        }
      }
    }
    if (grouped.length >= input.max_rows) {
      break;
    }
  }
  return grouped.slice(0, input.max_rows);
}

async function lambdaHandlerFileAnchors(input: {
  graph: GraphQueryPort;
  snapshot_id: string;
  node: GraphNode;
}): Promise<readonly GraphNode[]> {
  const edges = await input.graph.getOutgoingEdges({
    snapshot_id: input.snapshot_id,
    node_id: input.node.id,
    max_rows: 5
  });
  const anchors = await Promise.all(
    edges
      .filter((edge) => edge.kind === "routes_to_handler_file" && edge.target_node_id !== undefined)
      .map((edge) =>
        input.graph.getNode({
          snapshot_id: input.snapshot_id,
          node_id: edge.target_node_id ?? ""
        })
      )
  );
  return anchors.filter((node): node is GraphNode => node !== null).sort(compareLambdaGroupNodes);
}

function rankLambdaHandlerNodes(nodes: readonly GraphNode[]): GraphNode[] {
  return [...nodes].sort(compareLambdaGroupNodes);
}

function compareLambdaGroupNodes(left: GraphNode, right: GraphNode): number {
  return lambdaTemplateKey(left).localeCompare(lambdaTemplateKey(right)) ||
    lambdaLogicalId(left).localeCompare(lambdaLogicalId(right)) ||
    lambdaKindRank(left) - lambdaKindRank(right) ||
    left.name.localeCompare(right.name) ||
    left.file_path.localeCompare(right.file_path);
}

function lambdaTemplateKey(node: GraphNode): string {
  const value = node.metadata.template_path;
  return typeof value === "string" ? value : node.file_path;
}

function lambdaLogicalId(node: GraphNode): string {
  const value = node.metadata.logical_id;
  return typeof value === "string" ? value : "";
}

function lambdaKindRank(node: GraphNode): number {
  if (node.kind === "lambda_handler_binding") return 0;
  if (node.kind === "lambda_handler_file") return 1;
  if (node.kind === "lambda_function") return 2;
  return 5;
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
