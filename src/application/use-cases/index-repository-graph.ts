import type {
  ExtractionBatch,
  FileCatalogEntry,
  GraphEdgeWriteModel,
  GraphNodeWriteModel,
  UnresolvedReferenceWriteModel
} from "../../domain/models/index.js";
import type { SnapshotState } from "../../domain/models/runtime.js";
import type {
  ClockPort,
  ExtractorPort,
  ExtractorRegistryPort,
  FileCatalogPort,
  FileCatalogScanPort,
  GraphWritePort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";

export type IndexRepositoryGraphResult = {
  snapshot_id: string;
  repo_root: string;
  scanned_files: number;
  extracted_files: number;
  resource_backed_files: number;
  unsupported_files: number;
  node_count: number;
  edge_count: number;
  unresolved_reference_count: number;
  truncated: boolean;
};

export async function indexRepositoryGraph(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  extractors: ExtractorRegistryPort;
  resource_extractor: ExtractorPort;
  graph: GraphWritePort;
  catalog: FileCatalogPort;
  snapshots: SnapshotPort;
  clock: ClockPort;
  schema_version: number;
  snapshot_id?: string;
  config_identity?: string;
  max_files?: number;
}): Promise<IndexRepositoryGraphResult> {
  const snapshotId = input.snapshot_id ?? String(input.clock.nowUnixMs());
  const now = input.clock.nowIso8601();
  const configIdentity = input.config_identity ?? "default";
  const existingSnapshot = await input.snapshots.getSnapshot({
    repo_root: input.repo_root
  });
  if (existingSnapshot && existingSnapshot.config_identity !== configIdentity) {
    throw new Error("Existing snapshot config identity does not match the requested graph index config identity.");
  }
  if (existingSnapshot && existingSnapshot.schema_version !== input.schema_version) {
    throw new Error("Existing snapshot schema version does not match the requested graph index schema version.");
  }
  const snapshot = buildSnapshot({
    snapshot_id: snapshotId,
    repo_root: input.repo_root,
    config_identity: configIdentity,
    schema_version: input.schema_version,
    freshness: "refreshing",
    now
  });
  await input.snapshots.upsertSnapshot({ snapshot });

  const scanned = await input.scanner.scan({
    repo_root: input.repo_root,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: input.max_files ?? 2000
  });

  const batches: ExtractionBatch[] = [];
  let unsupportedFiles = 0;
  let resourceBackedFiles = 0;

  for (const file of scanned.files) {
    const extractor = resolveExtractor({
      file,
      registry: input.extractors,
      resourceExtractor: input.resource_extractor
    });

    if (!extractor) {
      unsupportedFiles += 1;
      await input.catalog.upsertEntry({
        snapshot_id: snapshotId,
        entry: {
          ...file,
          indexed: false,
          skipped_reason: "unsupported",
          file_identity: {
            ...file.file_identity,
            indexed_at: undefined
          }
        }
      });
      continue;
    }

    if (extractor === input.resource_extractor) {
      resourceBackedFiles += 1;
    }

    const content = await input.workspace.readText({ path: file.path });
    const batch = await extractor.extract({
      snapshot_id: snapshotId,
      path: file.path,
      language: file.file_identity.language,
      content
    });
    batches.push({
      ...batch,
      file_identity: {
        ...file.file_identity,
        indexed_at: now
      },
      extracted_at: now
    });
  }

  const resolved = resolveReferences(batches);
  for (const batch of resolved.batches) {
    await input.graph.replaceSnapshotExtraction({
      batch,
      replace: true
    });
  }
  for (const edgesForFile of resolved.edges) {
    await input.graph.insertEdges({
      snapshot_id: snapshotId,
      file_path: edgesForFile.file_path,
      edges: edgesForFile.edges
    });
  }

  await input.snapshots.markSnapshotFreshness({
    snapshot_id: snapshotId,
    freshness: "fresh"
  });

  return {
    snapshot_id: snapshotId,
    repo_root: scanned.repo_root,
    scanned_files: scanned.files.length,
    extracted_files: resolved.batches.length,
    resource_backed_files: resourceBackedFiles,
    unsupported_files: unsupportedFiles,
    node_count: resolved.batches.reduce((total, batch) => total + batch.nodes.length, 0),
    edge_count: resolved.edges.reduce((total, item) => total + item.edges.length, 0),
    unresolved_reference_count: resolved.batches.reduce(
      (total, batch) => total + batch.unresolved_references.length,
      0
    ),
    truncated: scanned.truncated
  };
}

function buildSnapshot(input: {
  snapshot_id: string;
  repo_root: string;
  config_identity: string;
  schema_version: number;
  freshness: SnapshotState["freshness"];
  now: string;
}): SnapshotState {
  return {
    id: input.snapshot_id,
    repo_root: input.repo_root,
    workspace_root: input.repo_root,
    repo_identity: input.repo_root,
    config_identity: input.config_identity,
    schema_version: input.schema_version,
    freshness: input.freshness,
    owner_state: "owner",
    created_at: input.now,
    updated_at: input.now
  };
}

function resolveExtractor(input: {
  file: FileCatalogEntry;
  registry: ExtractorRegistryPort;
  resourceExtractor: ExtractorPort;
}): ExtractorPort | null {
  const registered = input.registry.resolve({
    language: input.file.file_identity.language
  });
  if (registered?.supports({
    language: input.file.file_identity.language,
    path: input.file.path
  })) {
    return registered;
  }

  if (
    input.resourceExtractor.supports({
      language: input.file.file_identity.language,
      path: input.file.path
    })
  ) {
    return input.resourceExtractor;
  }

  return null;
}

function resolveReferences(batches: readonly ExtractionBatch[]): {
  batches: ExtractionBatch[];
  edges: Array<{ file_path: string; edges: GraphEdgeWriteModel[] }>;
} {
  const nodesByName = new Map<string, GraphNodeWriteModel[]>();
  for (const node of batches.flatMap((batch) => batch.nodes)) {
    const key = node.name.toLowerCase();
    nodesByName.set(key, [...(nodesByName.get(key) ?? []), node]);
  }

  const edgesByFile: Array<{ file_path: string; edges: GraphEdgeWriteModel[] }> = [];
  const resolvedBatches = batches.map((batch) => {
    const edges: GraphEdgeWriteModel[] = [];
    const unresolved: UnresolvedReferenceWriteModel[] = [];

    for (const reference of batch.unresolved_references) {
      const candidates = nodesByName.get(reference.reference_name.toLowerCase()) ?? [];
      const unique = candidates.length === 1 ? candidates[0] : undefined;
      if (unique) {
        edges.push({
          id: `${reference.id}:resolved`,
          source_node_id: reference.source_node_id,
          target_node_id: unique.id,
          kind: reference.reference_kind,
          source_range: reference.source_range,
          provenance: "tree-sitter-reference-resolution",
          confidence: 0.8,
          metadata: {
            reference_name: reference.reference_name
          }
        });
        continue;
      }

      unresolved.push({
        ...reference,
        candidate_metadata: {
          ...reference.candidate_metadata,
          candidate_count: candidates.length,
          resolution: candidates.length > 1 ? "ambiguous" : "unresolved"
        }
      });
    }

    if (edges.length > 0) {
      edgesByFile.push({
        file_path: batch.source_path,
        edges
      });
    }

    return {
      ...batch,
      edges: batch.edges,
      unresolved_references: unresolved
    };
  });

  return {
    batches: resolvedBatches,
    edges: edgesByFile
  };
}
