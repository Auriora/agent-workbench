import type {
  EvidenceKind,
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
import { capNextActions } from "./response-metadata.js";

export type FindReferencesUseCaseResult = {
  references: FindReferencesResult;
  meta: ResponseMetadata;
};

const REFERENCES_CURSOR_KIND = "references";

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
        result_count: 0,
        next_actions: capNextActions([])
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
        result_count: 0,
        next_actions: [{ tool: "symbol_search", args: { query: input.request.symbol ?? input.request.node_id ?? "" } }]
      },
      meta: resolved.meta
    };
  }

  const pageOffset = decodeCursor(input.request.cursor, REFERENCES_CURSOR_KIND);
  const fetchLimit = pageOffset + input.request.max_results + 1;
  const outgoing = await input.graph.getReferences({
    snapshot_id: resolved.snapshot_id,
    node_id: target.id,
    max_depth: input.request.max_depth,
    max_rows: fetchLimit
  });
  const incoming = await input.graph.getIncomingEdges({
    snapshot_id: resolved.snapshot_id,
    node_id: target.id,
    max_rows: fetchLimit
  });
  const unresolved = (await input.graph.getUnresolvedReferences({
    snapshot_id: resolved.snapshot_id,
    max_rows: fetchLimit
  })).filter(
    (item) =>
      item.source_node_id === target.id ||
      item.reference_name === target.name ||
      item.reference_name === target.qualified_name
  );
  const parserReferences: ReferenceHit[] = [
    ...outgoing.map((item) => ({
      source_node_id: item.source_node_id,
      target_node_id: item.target_node_id,
      target_file_path: item.target_file_path,
      reference_kind: "resolved",
      confidence: item.confidence,
      evidence_kinds: evidenceKindsForProvenance(item.provenance),
      provenance: item.provenance,
      status: "resolved" as const
    })),
    ...(await Promise.all(
      incoming
        .filter((edge) => edge.source_node_id !== target.id)
        .map(async (edge) => {
          const source = await input.graph.getNode({
            snapshot_id: resolved.snapshot_id,
            node_id: edge.source_node_id
          });
          return {
            source_node_id: edge.source_node_id,
            source_file_path: source?.file_path,
            source_range: edge.source_range,
            target_node_id: target.id,
            target_file_path: target.file_path,
            reference_name: String(edge.metadata.reference_name ?? target.name),
            reference_kind: edge.kind,
            confidence: edge.confidence,
            evidence_kinds: evidenceKindsForProvenance(edge.provenance),
            provenance: edge.provenance,
            status: "resolved" as const
          };
        })
    )),
    ...unresolved.map((item) => ({
      source_node_id: item.source_node_id,
      source_file_path: item.source_file_path,
      source_range: item.source_range,
      reference_name: item.reference_name,
      reference_kind: item.reference_kind,
      confidence: item.candidate_metadata.resolution === "ambiguous" ? 0.4 : 0.35,
      evidence_kinds: ["parser", "heuristic"] as EvidenceKind[],
      provenance: "unresolved_reference",
      status: item.candidate_metadata.resolution === "ambiguous" ? "ambiguous" as const : "unresolved" as const
    }))
  ];
  const lexicalReferences =
    parserReferences.length === 0
      ? await findLexicalReferences({
          target,
          snapshot_id: resolved.snapshot_id,
          catalog: input.catalog,
          workspace: input.workspace,
          max_results: fetchLimit
        })
      : [];
  const allReferences = dedupeReferences([...parserReferences, ...lexicalReferences]);
  const references = allReferences.slice(pageOffset, pageOffset + input.request.max_results);
  const hasMore = allReferences.length > pageOffset + input.request.max_results;

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
      cursor: hasMore ? encodeCursor({ kind: REFERENCES_CURSOR_KIND, offset: pageOffset + references.length }) : undefined,
      result_count: allReferences.length,
      next_actions: capNextActions([
        {
          tool: "impact",
          args: {
            node_id: target.id,
            snapshot_id: resolved.snapshot_id
          }
        }
      ])
    },
    meta: {
      ...resolved.meta,
      truncated: hasMore
    }
  };
}

function evidenceKindsForProvenance(provenance: string): EvidenceKind[] {
  return provenance.includes("cloudformation")
    ? ["config", "infra_parser"]
    : ["parser"];
}

async function findLexicalReferences(input: {
  target: { id: string; name: string; file_path: string };
  snapshot_id: string;
  catalog: FileCatalogPort;
  workspace?: WorkspaceFilePort;
  max_results: number;
}): Promise<ReferenceHit[]> {
  if (input.workspace === undefined || input.target.name.trim().length === 0) {
    return [];
  }
  const files = await input.catalog.listFiles({
    snapshot_id: input.snapshot_id,
    max_rows: Math.min(100, Math.max(10, input.max_results * 5))
  });
  const identifier = input.target.name;
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(identifier)}([^A-Za-z0-9_]|$)`, "u");
  const hits: ReferenceHit[] = [];
  for (const file of files) {
    if (hits.length >= input.max_results) {
      break;
    }
    if (!["python", "typescript", "javascript", "markdown", "text"].includes(file.file_identity.language)) {
      continue;
    }
    if (file.file_identity.size_bytes > 128_000) {
      continue;
    }
    const text = await input.workspace.readText({ path: file.path });
    const lines = text.split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      if (hits.length >= input.max_results) {
        break;
      }
      if (!pattern.test(line)) {
        continue;
      }
      const startColumn = Math.max(0, line.indexOf(identifier));
      hits.push({
        source_file_path: file.path,
        source_range: {
          start_line: index + 1,
          start_column: startColumn,
          end_line: index + 1,
          end_column: startColumn + identifier.length
        },
        target_node_id: input.target.id,
        target_file_path: input.target.file_path,
        reference_name: identifier,
        reference_kind: "lexical",
        confidence: 0.2,
        evidence_kinds: ["text_fallback", "heuristic"],
        provenance: "bounded_lexical_identifier_scan",
        status: "unresolved"
      });
    }
  }
  return hits;
}

function dedupeReferences(references: readonly ReferenceHit[]): ReferenceHit[] {
  const byKey = new Map<string, ReferenceHit>();
  for (const reference of references) {
    byKey.set(
      [
        reference.source_node_id ?? "",
        reference.source_file_path ?? "",
        reference.source_range?.start_line ?? "",
        reference.target_node_id ?? "",
        reference.reference_name ?? "",
        reference.reference_kind,
        reference.provenance
      ].join(":"),
      reference
    );
  }
  return [...byKey.values()];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function encodeCursor(input: { kind: string; offset: number }): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined, kind: string): number {
  if (cursor === undefined) {
    return 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      kind?: unknown;
      offset?: unknown;
    };
    if (parsed.kind !== kind || typeof parsed.offset !== "number" || !Number.isInteger(parsed.offset) || parsed.offset < 0) {
      return 0;
    }
    return parsed.offset;
  } catch {
    return 0;
  }
}
