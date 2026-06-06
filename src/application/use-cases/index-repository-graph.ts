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
  DocsIndexPort,
  ExtractorPort,
  ExtractorRegistryPort,
  FileCatalogPort,
  FileCatalogScanPort,
  GraphWritePort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import type {
  CachePort,
  WarmupCoordinatorPort
} from "../../ports/index.js";
import {
  markdownTitleFromPath,
  parseMarkdownHeadings,
  selectedMarkdownText
} from "../../infrastructure/markdown/docs.js";

const MAX_TEXT_EXTRACTION_BYTES = 2_000_000;
const MAX_DOCS_INDEX_BYTES = 120_000;
const INDEXING_YIELD_INTERVAL = 25;

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

export type WarmupRepositoryGraphResult = IndexRepositoryGraphResult & {
  execution_id: string;
  warmup_state: "complete";
};

export async function indexRepositoryGraph(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  extractors: ExtractorRegistryPort;
  resource_extractor: ExtractorPort;
  graph: GraphWritePort;
  catalog: FileCatalogPort;
  docs_index?: DocsIndexPort;
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

  for (const [index, file] of scanned.files.entries()) {
    await yieldToEventLoop(index);
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

    if (file.file_identity.size_bytes > MAX_TEXT_EXTRACTION_BYTES) {
      unsupportedFiles += 1;
      await input.catalog.upsertEntry({
        snapshot_id: snapshotId,
        entry: {
          ...file,
          indexed: false,
          skipped_reason: "file_too_large_for_text_extraction",
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

  if (input.docs_index !== undefined) {
    const documents = [];
    for (const [index, file] of scanned.files
      .filter((candidate) => candidate.file_identity.language === "markdown")
      .entries()) {
      await yieldToEventLoop(index);
      const content = await input.workspace.readText({ path: file.path });
      const headings = parseMarkdownHeadings(content);
      const selected = selectedMarkdownText({
        content,
        max_bytes: MAX_DOCS_INDEX_BYTES
      });
      documents.push({
        path: file.path,
        title: headings[0]?.text ?? markdownTitleFromPath(file.path),
        headings,
        selected_text: selected.text,
        content_hash: file.file_identity.content_hash,
        byte_count: file.file_identity.size_bytes,
        indexed_at: now,
        truncated: selected.truncated
      });
    }
    await input.docs_index.replaceSnapshotDocs({
      snapshot_id: snapshotId,
      repo_root: scanned.repo_root,
      documents
    });
  }

  const augmentedRouting = augmentTemplateHandlerRouting({
    batches,
    files: scanned.files
  });
  const resolved = resolveReferences(augmentedRouting.batches);
  for (const [index, batch] of resolved.batches.entries()) {
    await yieldToEventLoop(index);
    await input.graph.replaceSnapshotExtraction({
      batch,
      replace: true
    });
  }
  const allEdges = [...resolved.edges, ...augmentedRouting.edges];
  for (const [index, edgesForFile] of allEdges.entries()) {
    await yieldToEventLoop(index);
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

function augmentTemplateHandlerRouting(input: {
  batches: readonly ExtractionBatch[];
  files: readonly FileCatalogEntry[];
}): {
  batches: ExtractionBatch[];
  edges: Array<{ file_path: string; edges: GraphEdgeWriteModel[] }>;
} {
  const filePaths = new Set(input.files.map((file) => file.path));
  const batchesByPath = new Map(input.batches.map((batch) => [batch.source_path, batch]));
  const handlerAnchorsByPath = new Map<string, GraphNodeWriteModel[]>();
  const augmented = input.batches.map((batch) => ({ ...batch, nodes: [...batch.nodes], edges: [...batch.edges], unresolved_references: [...batch.unresolved_references] }));
  const edges: Array<{ file_path: string; edges: GraphEdgeWriteModel[] }> = [];

  for (const batch of augmented) {
    for (const node of batch.nodes) {
      if (node.kind !== "lambda_handler_binding") {
        continue;
      }
      const candidates = handlerFileCandidates(node.metadata.handler_file_candidates, node.metadata.handler_file_candidate);
      const resolvedPath = candidates.find((candidate) => filePaths.has(candidate));
      if (resolvedPath === undefined) {
        batch.unresolved_references.push({
          id: `${node.id}:handler-file-unresolved`,
          source_node_id: node.id,
          source_file_path: batch.source_path,
          reference_name: candidates[0] ?? String(node.name),
          reference_kind: "lambda_handler_file",
          source_range: node.source_range,
          candidate_metadata: {
            provenance: "cloudformation_handler_file_resolution",
            confidence: "low",
            handler: node.name,
            candidates,
            resolution: "unresolved"
          }
        });
        continue;
      }

      const targetBatch = batchesByPath.get(resolvedPath);
      const augmentedTargetBatch = augmented.find((candidate) => candidate.source_path === resolvedPath);
      if (targetBatch === undefined || augmentedTargetBatch === undefined) {
        continue;
      }
      const anchor = lambdaHandlerFileAnchor({
        snapshot_id: batch.snapshot_id,
        sourceNode: node,
        targetBatch,
        resolvedPath
      });
      const existingAnchors = handlerAnchorsByPath.get(resolvedPath) ?? [];
      if (!existingAnchors.some((candidate) => candidate.id === anchor.id)) {
        handlerAnchorsByPath.set(resolvedPath, [...existingAnchors, anchor]);
        augmentedTargetBatch.nodes.push(anchor);
      }
      edges.push({
        file_path: batch.source_path,
        edges: [
          {
            id: `${node.id}:routes-to:${anchor.id}`,
            source_node_id: node.id,
            target_node_id: anchor.id,
            kind: "routes_to_handler_file",
            source_range: node.source_range,
            provenance: "cloudformation_handler_file_resolution",
            confidence: 0.45,
            metadata: {
              domain: "infrastructure",
              capability_level: "resource_backed",
              evidence_kinds: ["config", "infra_parser"],
              semantic_scope: "file_level_handler_routing",
              handler: node.name,
              handler_file_path: resolvedPath,
              handler_export_candidate: node.metadata.handler_export_candidate
            }
          }
        ]
      });
    }
  }

  return {
    batches: augmented,
    edges
  };
}

function handlerFileCandidates(value: unknown, fallback: unknown): string[] {
  const fromArray = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const fromFallback = typeof fallback === "string" ? [fallback] : [];
  return Array.from(new Set([...fromArray, ...fromFallback].map((candidate) => candidate.replaceAll("\\", "/"))));
}

function lambdaHandlerFileAnchor(input: {
  snapshot_id: string;
  sourceNode: GraphNodeWriteModel;
  targetBatch: ExtractionBatch;
  resolvedPath: string;
}): GraphNodeWriteModel {
  const exportName = typeof input.sourceNode.metadata.handler_export_candidate === "string"
    ? input.sourceNode.metadata.handler_export_candidate
    : undefined;
  return {
    id: `${input.snapshot_id}:${input.resolvedPath}:lambda_handler_file:${input.sourceNode.id}`,
    kind: "lambda_handler_file",
    name: input.resolvedPath,
    qualified_name: `${input.sourceNode.qualified_name}:file:${input.resolvedPath}`,
    file_path: input.resolvedPath,
    language: input.targetBatch.language,
    source_range: fullFileRangeForBatch(input.targetBatch),
    signature: exportName === undefined ? String(input.sourceNode.name) : `${input.resolvedPath}#${exportName}`,
    metadata: {
      domain: "infrastructure",
      capability_level: "resource_backed",
      evidence_kinds: ["config", "infra_parser"],
      provenance: "cloudformation_handler_file_resolution",
      semantic_scope: "file_level_handler_routing",
      handler: input.sourceNode.name,
      logical_id: input.sourceNode.metadata.logical_id,
      handler_export_candidate: exportName
    }
  };
}

function fullFileRangeForBatch(batch: ExtractionBatch): GraphNodeWriteModel["source_range"] {
  return {
    start_line: 1,
    start_column: 0,
    end_line: Math.max(1, batch.file_identity.size_bytes > 0 ? 1 : 1),
    end_column: 0
  };
}

export async function warmupRepositoryGraph(input: {
  repo_root: string;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  extractors: ExtractorRegistryPort;
  resource_extractor: ExtractorPort;
  graph: GraphWritePort;
  catalog: FileCatalogPort;
  docs_index?: DocsIndexPort;
  snapshots: SnapshotPort;
  warmups: WarmupCoordinatorPort;
  clock: ClockPort;
  schema_version: number;
  owner_id: string;
  snapshot_id?: string;
  config_identity?: string;
  max_files?: number;
  cache?: CachePort;
}): Promise<WarmupRepositoryGraphResult> {
  const snapshotId = input.snapshot_id ?? String(input.clock.nowUnixMs());
  const executionId = await input.warmups.requestWarmup({
    repo_root: input.repo_root,
    snapshot_id: snapshotId
  });
  await input.warmups.markOwner({
    execution_id: executionId,
    owner_id: input.owner_id
  });

  try {
    const result = await indexRepositoryGraph({
      repo_root: input.repo_root,
      scanner: input.scanner,
      workspace: input.workspace,
      extractors: input.extractors,
      resource_extractor: input.resource_extractor,
      graph: input.graph,
      catalog: input.catalog,
      docs_index: input.docs_index,
      snapshots: input.snapshots,
      clock: input.clock,
      schema_version: input.schema_version,
      snapshot_id: snapshotId,
      config_identity: input.config_identity,
      max_files: input.max_files
    });
    const files = await input.catalog.listFiles({
      snapshot_id: result.snapshot_id,
      max_rows: input.max_files ?? 2000
    });

    if (input.cache !== undefined) {
      await input.cache.set({
        namespace: "warmup",
        key: `graph:${input.repo_root}`,
        value: result,
        depends_on_snapshot_id: result.snapshot_id,
        depends_on_config_identity: input.config_identity ?? "default",
        depends_on_file_hashes: files.map((file) => ({
          path: file.path,
          content_hash: file.file_identity.content_hash
        }))
      });
    }

    await input.warmups.completeWarmup({
      execution_id: executionId,
      success: true
    });
    return {
      ...result,
      execution_id: executionId,
      warmup_state: "complete"
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await input.snapshots.markSnapshotFreshness({
      snapshot_id: snapshotId,
      freshness: "cold",
      owner_state: "dead_owner",
      reason
    });
    await input.warmups.completeWarmup({
      execution_id: executionId,
      success: false,
      reason
    });
    throw error;
  }
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

async function yieldToEventLoop(index: number): Promise<void> {
  if (index > 0 && index % INDEXING_YIELD_INTERVAL === 0) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
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
        const provenance = typeof reference.candidate_metadata.provenance === "string"
          ? reference.candidate_metadata.provenance
          : "tree-sitter-reference-resolution";
        const confidence = typeof reference.candidate_metadata.confidence === "number"
          ? reference.candidate_metadata.confidence
          : 0.8;
        edges.push({
          id: `${reference.id}:resolved`,
          source_node_id: reference.source_node_id,
          target_node_id: unique.id,
          kind: reference.reference_kind,
          source_range: reference.source_range,
          provenance,
          confidence,
          metadata: {
            ...reference.candidate_metadata,
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
