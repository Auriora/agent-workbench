/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import { posix as pathPosix } from "node:path";

import type {
  ExtractionBatch,
  FileCatalogEntry,
  GraphNode,
  GraphEdgeWriteModel,
  GraphNodeWriteModel,
  UnresolvedReference,
  UnresolvedReferenceWriteModel
} from "../../domain/models/index.js";
import type {
  SnapshotRepositoryComposition,
  SnapshotState
} from "../../domain/models/runtime.js";
import type {
  ClockPort,
  DocumentationConcernIndexPort,
  DocsIndexDocumentWrite,
  DocsIndexPort,
  ExtractorPort,
  ExtractorRegistryPort,
  FileCatalogPort,
  FileCatalogScanPort,
  FileCatalogScanResult,
  GraphBuildCoveragePort,
  GraphBuildProgress,
  GraphBuildProgressPort,
  GraphBuildReadPort,
  GraphBuildResolutionWritePort,
  GraphBuildSeedPort,
  GraphWritePort,
  SnapshotBuildPort,
  SnapshotPublicationPort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import type {
  GraphBuildCatalogCapturePort,
  GraphBuildManifest,
  GraphBuildManifestFence,
  GraphBuildManifestPort,
  GraphBuildPathIdentity,
  GraphBuildWatchPort
} from "../../ports/graph-build-manifest.js";
import { graphBuildManifestDigestMaterial } from "../../ports/graph-build-manifest.js";
import type {
  CachePort,
  WarmupCoordinatorPort
} from "../../ports/index.js";
import type { EvidenceCoverageState, IndexCoverage, RefreshWorkerProgress } from "../../contracts/index.js";
import {
  markdownTitleFromPath,
  parseMarkdownHeadings,
  selectedMarkdownText
} from "./markdown-docs.js";
import { extractDocumentationConcernIndex } from "./document-currency-routing.js";
import {
  partitionDocumentationCorpusPaths,
  type DocumentationCorpusDecisionPartition,
  type RepositoryCompositionAdmissionReceipt
} from "../../domain/policies/index.js";
import { type RailsDiscoveryMetadata } from "./rails-project-shape.js";
import {
  detectRailsProjectShape,
  type RailsProjectShape,
  projectAdmitsRailsDiscovery
} from "./rails-project-shape.js";

const DEFAULT_GRAPH_PRIORITY_PATHS = [
  "AGENTS.md",
  "README.md",
  "Gemfile",
  "config/application.rb",
  "config/routes.rb"
] as const;
const MAX_TEXT_EXTRACTION_BYTES = 2_000_000;
const MAX_DOCS_INDEX_BYTES = 120_000;
const INDEXING_YIELD_INTERVAL = 25;
const DOCS_INDEX_ROOTS = ["AGENTS.md", "README.md", "docs", "doc", "documentation"] as const;

export type IndexRepositoryGraphResult = {
  snapshot_id: string;
  repo_root: string;
  scanned_files: number;
  extracted_files: number;
  eligible_files_seen?: number;
  admitted_files?: number;
  extraction_truncated?: boolean;
  continuation_cursor?: string;
  resource_backed_files: number;
  unsupported_files: number;
  node_count: number;
  edge_count: number;
  unresolved_reference_count: number;
  truncated: boolean;
  coverage: readonly IndexCoverage[];
};

export type WarmupRepositoryGraphResult = IndexRepositoryGraphResult & {
  execution_id: string;
  warmup_state: "complete";
};

export type RepositoryGraphBuildPhase = Exclude<RefreshWorkerProgress["phase"], "composition">;

export type BuildRepositoryGraphInput = {
  repo_root: string;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  extractors: ExtractorRegistryPort;
  resource_extractor: ExtractorPort;
  graph: GraphWritePort;
  catalog: FileCatalogPort;
  docs_index?: DocsIndexPort;
  documentation_concerns?: DocumentationConcernIndexPort;
  snapshots: SnapshotPort & SnapshotPublicationPort & SnapshotBuildPort;
  clock: ClockPort;
  schema_version: number;
  snapshot_id?: string;
  config_identity?: string;
  max_files?: number;
  max_extraction_files?: number;
  priority_paths?: readonly string[];
  after_path?: string;
  controller_generation?: number;
  invalidation_generation?: number;
  append_to_existing_build?: boolean;
  mark_fresh?: boolean;
  should_yield_extraction?: () => boolean;
  /** Optional aggregate phase boundary, emitted before the corresponding work. */
  observe_build_phase?: (phase: RepositoryGraphBuildPhase) => void;
  report_build_progress?: (
    phase: "catalog" | "extraction" | "docs" | "graph_write" | "resolution",
    completed_units: number
  ) => void;
  max_resolution_references?: number;
  rails_shape_files?: readonly FileCatalogEntry[];
  repository_composition?: SnapshotRepositoryComposition;
};

const RAILS_ROUTE_PRIORITY_PATTERNS = [
  "**/config/routes.rb",
  "**/config/routes/*.rb"
] as const;
const RAILS_SHAPE_PROBE_MIN_FILES = 32;
const MAX_RESOLUTION_REFERENCES_PER_PASS = 5_000;

export type RepositoryGraphBuildSliceResult = {
  outcome: "partial" | "complete";
  snapshot_id: string;
  continuation_cursor?: string;
  partial_kind?: "publish_seed" | "continue_build";
  coverage: readonly IndexCoverage[];
};

export type RepositoryGraphBuildSliceInput = Omit<BuildRepositoryGraphInput, "scanner"> & {
  snapshot_id: string;
  owner_id: string;
  controller_generation: number;
  invalidation_generation: number;
  build_progress: GraphBuildProgressPort;
  build_seed: GraphBuildSeedPort;
  build_read: GraphBuildReadPort;
  build_coverage: GraphBuildCoveragePort;
  build_resolution: GraphBuildResolutionWritePort;
  /**
   * The durable inventory is mandatory for sliced builds.  It deliberately
   * owns scanner construction: a continuation must never be able to select a
   * non-capturing scanner and fall back to a fresh repository walk.
   */
  manifest: {
    store: GraphBuildManifestPort;
    watcher: Pick<GraphBuildWatchPort, "start" | "registerDirectory">;
    create_scanner: (capture: GraphBuildCatalogCapturePort) => FileCatalogScanPort;
    inputs: readonly GraphBuildPathIdentity[];
  };
};

/** Build complete isolated evidence without selecting the target snapshot. */
export async function buildRepositoryGraph(
  input: BuildRepositoryGraphInput
): Promise<IndexRepositoryGraphResult> {
  input.observe_build_phase?.("graph_write");
  const snapshotId = input.snapshot_id ?? String(input.clock.nowUnixMs());
  const now = input.clock.nowIso8601();
  const configIdentity = input.config_identity ?? "default";
  if (input.append_to_existing_build !== true) {
    const existingSnapshot = await input.snapshots.getSnapshot({
      repo_root: input.repo_root
    });
    if (existingSnapshot && existingSnapshot.config_identity !== configIdentity) {
      throw new Error("Existing snapshot config identity does not match the requested graph index config identity.");
    }
    if (existingSnapshot && existingSnapshot.schema_version > input.schema_version) {
      throw new Error("Existing snapshot schema version does not match the requested graph index schema version.");
    }
    const snapshot = buildSnapshot({
      snapshot_id: snapshotId,
      repo_root: input.repo_root,
      config_identity: configIdentity,
      schema_version: input.schema_version,
      freshness: "refreshing",
      repository_composition: input.repository_composition,
      now
    });
    await input.snapshots.createBuildSnapshot({
      snapshot,
      controller_generation: input.controller_generation ?? 0,
      invalidation_generation: input.invalidation_generation ?? 0,
      created_at: now
    });
  }

  const requestedPriorityPaths = dedupePaths([
    ...(input.priority_paths ?? []),
    ...DEFAULT_GRAPH_PRIORITY_PATHS
  ].map(normalizePriorityPath));
  input.observe_build_phase?.("catalog");
  const inventory = await scanFileCatalog(input.scanner, {
    repo_root: input.repo_root,
    indexed_roots: ["."],
    skipped_roots: [],
    // A standalone build has one canonical discovery pass. Graph budgeting is
    // a view over this inventory, never a second docs/shape traversal.
    max_files: Number.MAX_SAFE_INTEGER,
    priority_paths: requestedPriorityPaths,
    priority_path_patterns: RAILS_ROUTE_PRIORITY_PATTERNS,
    repository_composition: input.repository_composition
  });
  const scanned = boundedGraphCatalogFromInventory({
    scan: inventory,
    max_files: input.max_files ?? 2000,
    after_path: input.after_path
  });
  input.report_build_progress?.("catalog", scanned.files.length);

  const railsShape = detectRailsProjectShape({
    files: mergeRailsShapeFiles({
      scannedFiles: inventory.files,
      probeFiles: input.rails_shape_files
    }),
    scan_truncated: scanned.truncated
  });
  const priorityPaths = resolveExtractionPriorityPaths({
    userPriorityPaths: requestedPriorityPaths,
    railsShape
  });
  const prioritizedExtractionFiles = prioritizeExtractionOrder({
    files: scanned.files,
    priorityPaths
  });
  const maxExtractionFiles = input.max_extraction_files;
  const plannedExtractionFiles = maxExtractionFiles === undefined
    ? prioritizedExtractionFiles
    : prioritizedExtractionFiles.slice(0, maxExtractionFiles);
  const extractionFiles: FileCatalogEntry[] = [];
  let cooperativeDeadlineReached = false;

  const batches: ExtractionBatch[] = [];
  let unsupportedFiles = 0;
  let resourceBackedFiles = 0;

  input.observe_build_phase?.("extraction");
  for (const [index, file] of plannedExtractionFiles.entries()) {
    input.observe_build_phase?.("extraction");
    if (extractionFiles.length > 0 && input.should_yield_extraction?.() === true) {
      cooperativeDeadlineReached = true;
      break;
    }
    extractionFiles.push(file);
    if (extractionFiles.length === 1 || extractionFiles.length % 25 === 0) {
      input.report_build_progress?.("extraction", extractionFiles.length);
    }
    await yieldToEventLoop(index);
    const extractor = resolveExtractor({
      file,
      registry: input.extractors,
      resourceExtractor: input.resource_extractor
    });

    if (!extractor) {
      unsupportedFiles += 1;
      input.observe_build_phase?.("graph_write");
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

    if (file.file_identity.size_bytes > MAX_TEXT_EXTRACTION_BYTES ||
      (isDocumentationIndexPath(file.path) && file.file_identity.size_bytes > MAX_DOCS_INDEX_BYTES)) {
      unsupportedFiles += 1;
      input.observe_build_phase?.("graph_write");
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
    const batch = applyRailsDiscoveryShape({
      batch: await extractor.extract({
        snapshot_id: snapshotId,
        path: file.path,
        language: file.file_identity.language,
        content
      }),
      shape: railsShape
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
  const extractionTruncated =
    cooperativeDeadlineReached ||
    (maxExtractionFiles !== undefined && prioritizedExtractionFiles.length > maxExtractionFiles);

  if (input.docs_index !== undefined) input.observe_build_phase?.("catalog");
  const docsScan = input.docs_index === undefined
    ? undefined
    : docsCatalogFromInventory(inventory);

  input.observe_build_phase?.("docs");
  const markdownContentByPath = new Map<string, string>();
  const documents: DocsIndexDocumentWrite[] = [];
  let docsPartition: DocumentationCorpusDecisionPartition | undefined;
  if (input.docs_index !== undefined) {
    const mergedDocsFiles = mergeDocsIndexFiles({
      graphFiles: scanned.files,
      docsFiles: docsScan!.files
    });
    docsPartition = partitionDocumentationCorpusPaths(mergedDocsFiles.map((file) => file.path));
    const eligibleDocsPaths = new Set(docsPartition.eligible_markdown_paths);
    const docsFiles = mergedDocsFiles.filter((file) => eligibleDocsPaths.has(file.path));
    for (const [index, file] of docsFiles.entries()) {
      await yieldToEventLoop(index);
      const content = file.file_identity.size_bytes > MAX_DOCS_INDEX_BYTES
        ? await readBoundedDocsContent({ workspace: input.workspace, path: file.path })
        : await input.workspace.readText({ path: file.path });
      const contentTruncated = file.file_identity.size_bytes > Buffer.byteLength(content);
      markdownContentByPath.set(file.path, content);
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
        truncated: selected.truncated || contentTruncated
      });
      if (documents.length === 1 || documents.length % 25 === 0) {
        input.report_build_progress?.("docs", documents.length);
      }
    }
  }

  let concernIndex: Awaited<ReturnType<typeof extractDocumentationConcernIndex>> | undefined;
  if (input.documentation_concerns !== undefined) {
    if (input.docs_index === undefined || docsPartition === undefined) {
      throw new Error("Documentation concern indexing requires the snapshot docs index.");
    }
    concernIndex = await extractDocumentationConcernIndex({
      workspace: input.workspace,
      content_by_path: markdownContentByPath,
      corpus_decisions: new Map(docsPartition.decisions.map((decision) => [decision.relativePath, decision]))
    });
    for (const [documentPath, documentContent] of concernIndex.document_content_by_path) {
      if (documents.some((document) => document.path === documentPath)) continue;
      const { content } = documentContent;
      const headings = parseMarkdownHeadings(content);
      const selected = selectedMarkdownText({ content, max_bytes: MAX_DOCS_INDEX_BYTES });
      documents.push({
        path: documentPath,
        title: headings[0]?.text ?? markdownTitleFromPath(documentPath),
        headings,
        selected_text: selected.text,
        content_hash: createHash("sha256").update(content).digest("hex"),
        byte_count: documentContent.byte_count,
        indexed_at: now,
        truncated: selected.truncated || documentContent.truncated
      });
    }
    documents.sort(compareDocsIndexDocuments);
    docsPartition = partitionDocumentationCorpusPaths([
      ...new Set([
        ...docsPartition.decisions.map(({ relativePath }) => relativePath),
        ...documents.map(({ path: documentPath }) => documentPath)
      ])
    ]);
  }

  if (input.docs_index !== undefined) {
    const coverage = buildIndexCoverage({
      graphScan: scanned,
      docsScan,
      docsPartition,
      docsIndexedFiles: documents.length,
      graphExtraction: {
        admitted_files: extractionFiles.length,
        extracted_files: batches.length,
        truncated: extractionTruncated,
        budget: maxExtractionFiles,
        cooperative_deadline_reached: cooperativeDeadlineReached,
        continuation_cursor: extractionContinuationCursor({
          scanned,
          extractionFiles,
          extractionTruncated
        })
      }
    });
    await input.docs_index.replaceSnapshotDocs({
      snapshot_id: snapshotId,
      repo_root: scanned.repo_root,
      documents,
      coverage
    });
    input.report_build_progress?.("docs", documents.length);
  }

  if (input.documentation_concerns !== undefined && concernIndex !== undefined) {
    const { document_content_by_path: _documentContentByPath, ...persistedConcernIndex } = concernIndex;
    await input.documentation_concerns.replaceSnapshotDocumentationConcerns({
      snapshot_id: snapshotId,
      ...persistedConcernIndex
    });
  }

  input.observe_build_phase?.("resolution");
  const augmentedRouting = augmentTemplateHandlerRouting({
    batches,
    files: scanned.files
  });
  const resolved = resolveReferences(augmentedRouting.batches);
  input.observe_build_phase?.("graph_write");
  for (const [index, batch] of resolved.batches.entries()) {
    await yieldToEventLoop(index);
    await input.graph.replaceSnapshotExtraction({
      batch,
      replace: true
    });
    const completed = index + 1;
    if (completed === 1 || completed % 25 === 0 || completed === resolved.batches.length) {
      input.report_build_progress?.("graph_write", completed);
    }
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

  input.observe_build_phase?.("finalizing");
  const coverage = buildIndexCoverage({
    graphScan: scanned,
    docsScan,
    docsPartition,
    docsIndexedFiles: documents.length,
    graphExtraction: {
      admitted_files: extractionFiles.length,
      extracted_files: resolved.batches.length,
      truncated: extractionTruncated,
      budget: maxExtractionFiles,
      cooperative_deadline_reached: cooperativeDeadlineReached,
      continuation_cursor: extractionContinuationCursor({
        scanned,
        extractionFiles,
        extractionTruncated
      })
    }
  });

  if (input.mark_fresh !== false) {
    await input.snapshots.markSnapshotFreshness({
      snapshot_id: snapshotId,
      freshness: "fresh"
    });
  }

  return {
    snapshot_id: snapshotId,
    repo_root: scanned.repo_root,
    scanned_files: scanned.files.length,
    eligible_files_seen: scanned.files.length,
    admitted_files: extractionFiles.length,
    extraction_truncated: extractionTruncated,
    continuation_cursor: extractionContinuationCursor({
      scanned,
      extractionFiles,
      extractionTruncated
    }),
    extracted_files: resolved.batches.length,
    resource_backed_files: resourceBackedFiles,
    unsupported_files: unsupportedFiles,
    node_count: resolved.batches.reduce((total, batch) => total + batch.nodes.length, 0),
    edge_count: resolved.edges.reduce((total, item) => total + item.edges.length, 0),
    unresolved_reference_count: resolved.batches.reduce(
      (total, batch) => total + batch.unresolved_references.length,
      0
    ),
    truncated: scanned.truncated || extractionTruncated || docsScan?.truncated === true,
    coverage
  };
}

/** Execute one durable graph-build slice. Partial seeds are publishable; later slices stay isolated. */
export async function runRepositoryGraphBuildSlice(
  input: RepositoryGraphBuildSliceInput
): Promise<RepositoryGraphBuildSliceResult> {
  const watch = await input.manifest.watcher.start();
  if (!watch.healthy || watch.pending_events !== 0) {
    throw new Error("Graph build watcher is unhealthy or has pending events before manifest preparation.");
  }
  const fence = graphBuildManifestFence(input, watch);
  let progress = await input.build_progress.getGraphBuildProgress({ snapshot_id: input.snapshot_id });
  let startedHere = false;

  if (progress === null) {
    const latest = await input.snapshots.getLatestPublished({ repo_root: input.repo_root });
    const sourceProgress = latest.status === "selected"
      ? await input.build_progress.getGraphBuildProgress({ snapshot_id: latest.snapshot.id })
      : null;
    const sameGenerationSource = sourceProgress !== null && sourceProgress.phase !== "complete" &&
      sourceProgress.controller_generation === input.controller_generation &&
      sourceProgress.invalidation_generation === input.invalidation_generation;
    if (sameGenerationSource && sourceProgress.owner_id !== input.owner_id) {
      throw new Error("Published graph continuation owner does not match the requested slice.");
    }
    if (sameGenerationSource && sourceProgress.generation_source_hash !== fence.generation_source_hash) {
      throw new Error("Published graph continuation generation source does not match the requested slice.");
    }
    if (sameGenerationSource && (sourceProgress.status === "cancelled" || sourceProgress.status === "stale")) {
      throw new Error(`Published graph continuation is ${sourceProgress.status} and cannot be resumed.`);
    }
    const seedable = canSeedPublishedManifest({ input, sourceProgress });
    if (latest.status === "selected" && seedable) {
      const seededProgress = sourceProgress as GraphBuildProgress & { manifest_id: string };
      const sourceManifest = await requireSealedManifest({
        store: input.manifest.store,
        manifest_id: seededProgress.manifest_id,
        fence
      });
      if (sourceManifest.watcher_epoch !== watch.epoch) {
        await invalidateManifest({ input, manifest_id: sourceManifest.manifest_id, reason: "watcher_epoch_mismatch" });
        throw new Error("Published graph continuation watcher epoch does not match the requested slice.");
      }
      const now = input.clock.nowIso8601();
      await input.snapshots.createBuildSnapshot({
        snapshot: { ...latest.snapshot, id: input.snapshot_id, freshness: "refreshing", created_at: now, updated_at: now },
        controller_generation: input.controller_generation,
        invalidation_generation: input.invalidation_generation,
        created_at: now
      });
      await input.build_seed.seedBuildSnapshotFromPublished({
        source_snapshot_id: latest.snapshot.id,
        target_snapshot_id: input.snapshot_id,
        owner_id: input.owner_id,
        controller_generation: input.controller_generation,
        invalidation_generation: input.invalidation_generation,
        updated_at: now
      });
      progress = await input.build_progress.getGraphBuildProgress({ snapshot_id: input.snapshot_id });
      if (progress === null) throw new Error("Seeded graph completion target has no durable progress record.");
    } else {
      try {
        progress = await prepareGraphBuildManifest({ input, fence });
      } catch (error) {
        try {
          await invalidateManifest({ input, manifest_id: graphBuildManifestId(input, fence), reason: "inventory_preparation_failed" });
        } catch {
          // The original preparation failure is the actionable error. A
          // missing row means failure preceded durable manifest admission.
        }
        throw error;
      }
      startedHere = true;
    }
  }

  const manifestId = progress.manifest_id;
  if (manifestId === undefined || progress.counters_version !== 2) {
    throw new Error("Graph build progress is not bound to a sealed inventory manifest.");
  }
  let manifest: GraphBuildManifest;
  try {
    manifest = await requireSealedManifest({ store: input.manifest.store, manifest_id: manifestId, fence });
  } catch (error) {
    await invalidateManifest({ input, manifest_id: manifestId, reason: "sealed_manifest_fence_mismatch" });
    throw error;
  }
  assertProgressMatchesManifest({ input, progress, manifest });
  if (progress.phase === "complete" || progress.status === "completed") {
    return { outcome: "complete", snapshot_id: input.snapshot_id, coverage: [completeGraphCoverage(progress)] };
  }
  if (progress.phase === "resolving") return resolveAccumulatedBuildReferencesSlice(input, progress);

  const result = await extractManifestSlice({ input, fence, manifest, progress });
  return {
    ...result,
    partial_kind: result.outcome === "partial" ? (startedHere ? "publish_seed" : "continue_build") : undefined
  };
}

function graphBuildManifestFence(
  input: RepositoryGraphBuildSliceInput,
  watch: { epoch: string; sequence: number }
): GraphBuildManifestFence {
  return {
    repo_root: input.repo_root,
    config_identity: input.config_identity ?? "default",
    owner_id: input.owner_id,
    controller_generation: input.controller_generation,
    invalidation_generation: input.invalidation_generation,
    generation_source_hash: graphGenerationSourceHash(input),
    watcher_epoch: watch.epoch,
    watcher_sequence: watch.sequence,
    policy_version: "compiled-path-policy-v1",
    ordering_version: "graph-priority-v1",
    composition_fingerprint: input.repository_composition?.composition_fingerprint ?? ""
  };
}

function canSeedPublishedManifest(input: {
  input: RepositoryGraphBuildSliceInput;
  sourceProgress: GraphBuildProgress | null;
}): input is { input: RepositoryGraphBuildSliceInput; sourceProgress: GraphBuildProgress & { manifest_id: string } } {
  const progress = input.sourceProgress;
  return progress !== null &&
    progress.phase !== "complete" &&
    progress.status === "active" &&
    progress.owner_id === input.input.owner_id &&
    progress.controller_generation === input.input.controller_generation &&
    progress.invalidation_generation === input.input.invalidation_generation &&
    progress.generation_source_hash === graphGenerationSourceHash(input.input) &&
    progress.manifest_id !== undefined &&
    progress.counters_version === 2 &&
    (progress.phase === "resolving" || progress.ordinal_cursor !== undefined);
}

async function prepareGraphBuildManifest(input: {
  input: RepositoryGraphBuildSliceInput;
  fence: GraphBuildManifestFence;
}): Promise<GraphBuildProgress> {
  const { input: build, fence } = input;
  const startedAt = build.clock.nowIso8601();
  const startedMs = build.clock.nowUnixMs();
  const manifestId = graphBuildManifestId(build, fence);
  const existingSnapshot = await build.snapshots.getSnapshot({ repo_root: build.repo_root });
  if (existingSnapshot !== null && existingSnapshot.config_identity !== fence.config_identity) {
    throw new Error("Existing snapshot config identity does not match the requested graph index config identity.");
  }
  if (existingSnapshot !== null && existingSnapshot.schema_version > build.schema_version) {
    throw new Error("Existing snapshot schema version does not match the requested graph index schema version.");
  }
  await build.snapshots.createBuildSnapshot({
    snapshot: buildSnapshot({
      snapshot_id: build.snapshot_id,
      repo_root: build.repo_root,
      config_identity: fence.config_identity,
      schema_version: build.schema_version,
      freshness: "refreshing",
      repository_composition: build.repository_composition,
      now: startedAt
    }),
    controller_generation: build.controller_generation,
    invalidation_generation: build.invalidation_generation,
    created_at: startedAt
  });
  await build.manifest.store.beginGraphBuildManifest({ manifest_id: manifestId, fence, started_at: startedAt });

  const capturedFiles = new Map<string, { repository_key: string; entry: FileCatalogEntry; identity: GraphBuildPathIdentity }>();
  const capturedDirectories: import("../../ports/graph-build-manifest.js").GraphBuildDirectoryObservation[] = [];
  const capture: GraphBuildCatalogCapturePort = {
    beforeDirectory: async ({ path, repository_key, identity }) => {
      const observation = await build.manifest.watcher.registerDirectory({ path, repository_key });
      if (!observation.healthy || observation.pending_events !== 0 || observation.epoch !== fence.watcher_epoch) {
        throw new Error(`Graph build watcher cannot fence directory inventory: ${path}`);
      }
      return observation;
    },
    directory: async (directory) => {
      if (directory.watcher_epoch !== fence.watcher_epoch || !directory.registered) {
        throw new Error(`Graph build directory observation is outside the manifest watcher epoch: ${directory.identity.path}`);
      }
      capturedDirectories.push(directory);
      await build.manifest.store.appendGraphBuildManifestObservation({ manifest_id: manifestId, fence, directory });
    },
    file: async (file) => {
      if (capturedFiles.has(file.entry.path)) throw new Error(`Duplicate graph build manifest file observation: ${file.entry.path}`);
      capturedFiles.set(file.entry.path, file);
      await build.manifest.store.appendGraphBuildManifestObservation({ manifest_id: manifestId, fence, file });
    }
  };

  build.observe_build_phase?.("catalog");
  const scanned = await scanFileCatalog(build.manifest.create_scanner(capture), {
    repo_root: build.repo_root,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: Number.MAX_SAFE_INTEGER,
    priority_paths: dedupePaths([...(build.priority_paths ?? []), ...DEFAULT_GRAPH_PRIORITY_PATHS].map(normalizePriorityPath)),
    priority_path_patterns: RAILS_ROUTE_PRIORITY_PATTERNS,
    repository_composition: build.repository_composition
  });
  build.report_build_progress?.("catalog", scanned.files.length);
  const postScanWatch = await build.manifest.watcher.start();
  if (!postScanWatch.healthy || postScanWatch.pending_events !== 0 ||
      postScanWatch.epoch !== fence.watcher_epoch || postScanWatch.sequence !== fence.watcher_sequence) {
    await invalidateManifest({ input: build, manifest_id: manifestId, reason: "watcher_changed_during_inventory" });
    throw new Error("Graph build watcher changed while the inventory was being prepared.");
  }

  const shape = detectRailsProjectShape({ files: scanned.files, scan_truncated: scanned.truncated });
  const priorityPaths = resolveExtractionPriorityPaths({
    userPriorityPaths: dedupePaths([...(build.priority_paths ?? []), ...DEFAULT_GRAPH_PRIORITY_PATHS].map(normalizePriorityPath)),
    railsShape: shape
  });
  const ordered = prioritizeExtractionOrder({ files: scanned.files, priorityPaths });
  const docsPartition = partitionDocumentationCorpusPaths(
    scanned.files.filter((file) => file.file_identity.language === "markdown").map((file) => file.path)
  );
  const docsEligible = new Set(docsPartition.eligible_markdown_paths);
  const files = ordered.map((entry, ordinal) => {
    const observed = capturedFiles.get(entry.path);
    if (observed === undefined) throw new Error(`Graph build manifest is missing a captured identity for ${entry.path}.`);
    return { ordinal, repository_key: observed.repository_key, entry, identity: observed.identity,
      docs_eligible: docsEligible.has(entry.path), outcome: "pending" as const };
  });
  if (capturedFiles.size !== files.length) throw new Error("Graph build manifest captured files differ from the catalog inventory.");
  const progress: GraphBuildProgress = {
    snapshot_id: build.snapshot_id,
    manifest_id: manifestId,
    ordinal_cursor: 0,
    counters_version: 2,
    owner_id: build.owner_id,
    phase: "extracting",
    status: "active",
    max_files: build.max_files ?? 2000,
    generation_source_hash: fence.generation_source_hash,
    counters: emptyManifestCounters(files.length),
    controller_generation: build.controller_generation,
    invalidation_generation: build.invalidation_generation,
    updated_at: build.clock.nowIso8601()
  };
  const unsealed: Omit<GraphBuildManifest, "digest"> = {
    ...fence,
    manifest_id: manifestId,
    state: "sealed",
    started_at: startedAt,
    sealed_at: progress.updated_at,
    files,
    directories: capturedDirectories,
    inputs: build.manifest.inputs,
    graph_catalog: catalogMetadata(scanned),
    docs_catalog: catalogMetadata(docsCatalogFromInventory(scanned)),
    shape,
    preparation_wall_ms: Math.max(0, build.clock.nowUnixMs() - startedMs)
  };
  const manifest: GraphBuildManifest = {
    ...unsealed,
    digest: createHash("sha256").update(graphBuildManifestDigestMaterial(unsealed as GraphBuildManifest)).digest("hex")
  };
  await build.manifest.store.sealGraphBuildManifest({ manifest, progress });
  await persistDocsFromManifestInventory({ build, scanned, docsPartition });
  return progress;
}

function graphBuildManifestId(input: RepositoryGraphBuildSliceInput, fence: GraphBuildManifestFence): string {
  return createHash("sha256").update(JSON.stringify({
    snapshot_id: input.snapshot_id,
    repo_root: fence.repo_root,
    owner_id: fence.owner_id,
    controller_generation: fence.controller_generation,
    invalidation_generation: fence.invalidation_generation,
    generation_source_hash: fence.generation_source_hash
  })).digest("hex");
}

async function requireSealedManifest(input: {
  store: GraphBuildManifestPort;
  manifest_id: string;
  fence: GraphBuildManifestFence;
}): Promise<GraphBuildManifest> {
  const manifest = await input.store.getGraphBuildManifest({ manifest_id: input.manifest_id, fence: input.fence });
  if (manifest === null || manifest.state !== "sealed") {
    throw new Error("Graph build manifest is missing or not sealed.");
  }
  return manifest;
}

async function invalidateManifest(input: {
  input: RepositoryGraphBuildSliceInput;
  manifest_id: string;
  reason: string;
}): Promise<void> {
  await input.input.manifest.store.invalidateGraphBuildManifest({
    manifest_id: input.manifest_id,
    owner_id: input.input.owner_id,
    reason: input.reason,
    updated_at: input.input.clock.nowIso8601()
  });
}

function assertProgressMatchesManifest(input: {
  input: RepositoryGraphBuildSliceInput;
  progress: GraphBuildProgress;
  manifest: GraphBuildManifest;
}): void {
  const { input: build, progress, manifest } = input;
  if (progress.controller_generation !== build.controller_generation ||
      progress.invalidation_generation !== build.invalidation_generation ||
      progress.owner_id !== build.owner_id ||
      progress.generation_source_hash !== manifest.generation_source_hash ||
      manifest.generation_source_hash !== graphGenerationSourceHash(build) ||
      progress.completion_target_id !== undefined && progress.completion_target_id !== build.snapshot_id ||
      progress.status === "cancelled" || progress.status === "stale") {
    throw new Error("Graph build progress does not match its sealed manifest fence.");
  }
}

async function extractManifestSlice(input: {
  input: RepositoryGraphBuildSliceInput;
  fence: GraphBuildManifestFence;
  manifest: GraphBuildManifest;
  progress: GraphBuildProgress;
}): Promise<Omit<RepositoryGraphBuildSliceResult, "partial_kind">> {
  const { input: build, fence, manifest } = input;
  const cursor = input.progress.ordinal_cursor;
  if (cursor === undefined) throw new Error("Incomplete graph build progress has no manifest ordinal cursor.");
  const rowLimit = build.max_files ?? 2000;
  const extractionLimit = build.max_extraction_files ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(rowLimit) || rowLimit <= 0) throw new TypeError("max_files must be a positive safe integer.");
  if (!Number.isSafeInteger(extractionLimit) || extractionLimit <= 0) {
    throw new TypeError("max_extraction_files must be a positive safe integer.");
  }
  const limit = Math.min(rowLimit, extractionLimit);
  const selected = manifest.files.filter((file) => file.ordinal >= cursor && file.outcome === "pending").slice(0, limit);
  const pending = new Map<number, { file: GraphBuildManifest["files"][number]; outcome: "unsupported" | "extracted" | "resource"; entry: FileCatalogEntry; batch?: ExtractionBatch }>();
  const batches: Array<{ ordinal: number; batch: ExtractionBatch; resource: boolean }> = [];
  let processedFiles = 0;
  build.observe_build_phase?.("extraction");
  for (const [index, file] of selected.entries()) {
    if (index > 0 && build.should_yield_extraction?.() === true) break;
    await yieldToEventLoop(index);
    const extractor = resolveExtractor({ file: file.entry, registry: build.extractors, resourceExtractor: build.resource_extractor });
    const unsupported = extractor === null || file.entry.file_identity.size_bytes > MAX_TEXT_EXTRACTION_BYTES ||
      isDocumentationIndexPath(file.entry.path) && file.entry.file_identity.size_bytes > MAX_DOCS_INDEX_BYTES;
    if (unsupported) {
      pending.set(file.ordinal, {
        file,
        outcome: "unsupported",
        entry: {
          ...file.entry,
          indexed: false,
          skipped_reason: extractor === null ? "unsupported" : "file_too_large_for_text_extraction",
          file_identity: file.entry.file_identity
        }
      });
      processedFiles += 1;
      continue;
    }
    const now = build.clock.nowIso8601();
    const batch = applyRailsDiscoveryShape({
      batch: await extractor.extract({ snapshot_id: build.snapshot_id, path: file.entry.path,
        language: file.entry.file_identity.language, content: await build.workspace.readText({ path: file.entry.path }) }),
      shape: manifest.shape
    });
    batches.push({ ordinal: file.ordinal, resource: extractor === build.resource_extractor, batch: {
      ...batch, file_identity: { ...file.entry.file_identity, indexed_at: now }, extracted_at: now
    } });
    processedFiles += 1;
  }
  if (processedFiles > 0) build.report_build_progress?.("extraction", processedFiles);
  const augmented = augmentTemplateHandlerRouting({ batches: batches.map(({ batch }) => batch), files: manifest.files.map(({ entry }) => entry) });
  const resolved = resolveReferences(augmented.batches);
  const ordinalByPath = new Map(batches.map(({ ordinal, batch }) => [batch.source_path, ordinal]));
  const ordinalByNodeId = new Map(augmented.batches.flatMap((batch) =>
    batch.nodes.map((node) => [node.id, ordinalByPath.get(batch.source_path)] as const)
  ));
  const deferredReferenceIds = new Map<string, Set<string>>();
  const deferredEdges = new Map<string, GraphEdgeWriteModel>();
  const supplementalEdges = new Map<string, GraphEdgeWriteModel[]>();
  for (const edgeGroup of [...resolved.edges, ...augmented.edges]) {
    const sourceOrdinal = ordinalByPath.get(edgeGroup.file_path);
    const admittedEdges = edgeGroup.edges.filter((edge) => {
      const targetOrdinal = edge.target_node_id === undefined ? undefined : ordinalByNodeId.get(edge.target_node_id);
      if (sourceOrdinal === undefined || targetOrdinal === undefined || targetOrdinal <= sourceOrdinal) return true;
      if (edge.id.endsWith(":resolved")) {
        const ids = deferredReferenceIds.get(edgeGroup.file_path) ?? new Set<string>();
        const referenceId = edge.id.slice(0, -":resolved".length);
        ids.add(referenceId);
        deferredEdges.set(referenceId, edge);
        deferredReferenceIds.set(edgeGroup.file_path, ids);
      }
      return false;
    });
    supplementalEdges.set(edgeGroup.file_path, [
      ...(supplementalEdges.get(edgeGroup.file_path) ?? []),
      ...admittedEdges
    ]);
  }
  const originalUnresolvedByPath = new Map(augmented.batches.map((batch) => [
    batch.source_path, new Map(batch.unresolved_references.map((reference) => [reference.id, reference]))
  ]));
  const resolvedByPath = new Map(resolved.batches.map((batch) => [batch.source_path, {
    ...batch,
    edges: [...batch.edges, ...(supplementalEdges.get(batch.source_path) ?? [])],
    unresolved_references: [...batch.unresolved_references, ...[...(deferredReferenceIds.get(batch.source_path) ?? [])]
      .map((id): UnresolvedReferenceWriteModel | undefined => {
        const reference = originalUnresolvedByPath.get(batch.source_path)?.get(id);
        const edge = deferredEdges.get(id);
        return reference === undefined || edge === undefined ? undefined : {
          ...reference,
          candidate_metadata: { ...reference.candidate_metadata, deferred_graph_edge: edge }
        } as UnresolvedReferenceWriteModel;
      })
      .filter((reference): reference is UnresolvedReferenceWriteModel => reference !== undefined)]
  }]));
  for (const candidate of batches) {
    const batch = resolvedByPath.get(candidate.batch.source_path);
    if (batch === undefined) throw new Error(`Graph extraction batch was lost during in-slice resolution: ${candidate.batch.source_path}`);
    const file = manifest.files.find((entry) => entry.ordinal === candidate.ordinal);
    if (file === undefined) throw new Error("Graph build manifest ordinal disappeared during extraction.");
    pending.set(candidate.ordinal, {
      file,
      outcome: candidate.resource ? "resource" : "extracted",
      entry: file.entry,
      batch
    });
  }
  let latest = input.progress;
  let committedFiles = 0;
  build.observe_build_phase?.("graph_write");
  for (const ordinal of [...pending.keys()].sort((left, right) => left - right)) {
    const outcome = pending.get(ordinal)!;
    latest = await build.manifest.store.commitGraphBuildFileOutcome({
      manifest_id: manifest.manifest_id,
      fence,
      snapshot_id: build.snapshot_id,
      ordinal,
      outcome: outcome.outcome,
      entry: outcome.entry,
      batch: outcome.batch,
      updated_at: build.clock.nowIso8601()
    });
    committedFiles += 1;
    if (committedFiles === 1 || committedFiles % 25 === 0 || committedFiles === pending.size) {
      build.report_build_progress?.("graph_write", committedFiles);
    }
  }
  if (latest.ordinal_cursor !== undefined && selected.length > 0) {
    const nextPath = manifest.files.find((file) => file.ordinal === latest.ordinal_cursor)?.entry.path;
    const partialProgress: GraphBuildProgress = { ...latest, phase: "extracting", scan_cursor: nextPath, updated_at: build.clock.nowIso8601() };
    const coverage = partialGraphCoverage(partialProgress, { scan_truncated: false, extraction_truncated: true });
    await build.build_coverage.upsertGraphBuildCoverage({ snapshot_id: build.snapshot_id,
      controller_generation: build.controller_generation, invalidation_generation: build.invalidation_generation, coverage });
    await build.build_progress.upsertGraphBuildProgress({ progress: partialProgress });
    return { outcome: "partial", snapshot_id: build.snapshot_id, continuation_cursor: nextPath, coverage: [coverage] };
  }
  const resolvingProgress: GraphBuildProgress = { ...latest, phase: "resolving", ordinal_cursor: undefined, scan_cursor: "resolve:0", updated_at: build.clock.nowIso8601() };
  const coverage = partialGraphCoverage(resolvingProgress, { scan_truncated: false, extraction_truncated: false });
  await build.build_coverage.upsertGraphBuildCoverage({ snapshot_id: build.snapshot_id,
    controller_generation: build.controller_generation, invalidation_generation: build.invalidation_generation, coverage });
  await build.build_progress.upsertGraphBuildProgress({ progress: resolvingProgress });
  return { outcome: "partial", snapshot_id: build.snapshot_id, continuation_cursor: resolvingProgress.scan_cursor, coverage: [coverage] };
}

function emptyManifestCounters(files: number): GraphBuildProgress["counters"] {
  return { eligible_files: files, scanned_files: files, admitted_files: 0, extracted_files: 0,
    unsupported_files: 0, resource_backed_files: 0, nodes: 0, edges: 0, unresolved_references: 0 };
}

function catalogMetadata(scan: ReturnType<FileCatalogScanPort["scan"]> extends Promise<infer Result> ? Result : never): Omit<ReturnType<FileCatalogScanPort["scan"]> extends Promise<infer Result> ? Result : never, "files"> {
  const { files: _files, ...metadata } = scan;
  return metadata;
}

/** The manifest path indexes docs once from its sealed broad inventory. */
async function persistDocsFromManifestInventory(input: {
  build: RepositoryGraphBuildSliceInput;
  scanned: FileCatalogScanResult;
  docsPartition: DocumentationCorpusDecisionPartition;
}): Promise<void> {
  const { build, scanned } = input;
  if (build.docs_index === undefined) {
    if (build.documentation_concerns !== undefined) {
      throw new Error("Documentation concern indexing requires the snapshot docs index.");
    }
    return;
  }
  build.observe_build_phase?.("docs");
  const docsScan = docsCatalogFromInventory(scanned);
  const eligible = new Set(input.docsPartition.eligible_markdown_paths);
  const files = docsScan.files.filter((file) => eligible.has(file.path)).sort(compareDocsIndexFiles);
  const now = build.clock.nowIso8601();
  const contentByPath = new Map<string, string>();
  const documents: DocsIndexDocumentWrite[] = [];
  for (const [index, file] of files.entries()) {
    await yieldToEventLoop(index);
    const content = file.file_identity.size_bytes > MAX_DOCS_INDEX_BYTES
      ? await readBoundedDocsContent({ workspace: build.workspace, path: file.path })
      : await build.workspace.readText({ path: file.path });
    const selected = selectedMarkdownText({ content, max_bytes: MAX_DOCS_INDEX_BYTES });
    const headings = parseMarkdownHeadings(content);
    contentByPath.set(file.path, content);
    documents.push({
      path: file.path, title: headings[0]?.text ?? markdownTitleFromPath(file.path), headings,
      selected_text: selected.text, content_hash: file.file_identity.content_hash,
      byte_count: file.file_identity.size_bytes, indexed_at: now,
      truncated: selected.truncated || file.file_identity.size_bytes > Buffer.byteLength(content)
    });
  }
  let partition = input.docsPartition;
  let concernIndex: Awaited<ReturnType<typeof extractDocumentationConcernIndex>> | undefined;
  if (build.documentation_concerns !== undefined) {
    concernIndex = await extractDocumentationConcernIndex({
      workspace: build.workspace,
      content_by_path: contentByPath,
      corpus_decisions: new Map(partition.decisions.map((decision) => [decision.relativePath, decision]))
    });
    for (const [documentPath, documentContent] of concernIndex.document_content_by_path) {
      if (documents.some((document) => document.path === documentPath)) continue;
      const headings = parseMarkdownHeadings(documentContent.content);
      const selected = selectedMarkdownText({ content: documentContent.content, max_bytes: MAX_DOCS_INDEX_BYTES });
      documents.push({
        path: documentPath, title: headings[0]?.text ?? markdownTitleFromPath(documentPath), headings,
        selected_text: selected.text, content_hash: createHash("sha256").update(documentContent.content).digest("hex"),
        byte_count: documentContent.byte_count, indexed_at: now,
        truncated: selected.truncated || documentContent.truncated
      });
    }
    documents.sort(compareDocsIndexDocuments);
    partition = partitionDocumentationCorpusPaths([...new Set([
      ...partition.decisions.map(({ relativePath }) => relativePath),
      ...documents.map((document) => document.path)
    ])]);
  }
  await build.docs_index.replaceSnapshotDocs({
    snapshot_id: build.snapshot_id, repo_root: docsScan.repo_root, documents,
    coverage: [docsIndexCoverage({ docsScan, docsPartition: partition, docsIndexedFiles: documents.length, truncated: docsScan.truncated })]
  });
  if (build.documentation_concerns !== undefined && concernIndex !== undefined) {
    const { document_content_by_path: _contents, ...persisted } = concernIndex;
    await build.documentation_concerns.replaceSnapshotDocumentationConcerns({ snapshot_id: build.snapshot_id, ...persisted });
  }
  build.report_build_progress?.("docs", documents.length);
}

async function resolveAccumulatedBuildReferencesSlice(
  input: RepositoryGraphBuildSliceInput,
  progress: GraphBuildProgress
): Promise<RepositoryGraphBuildSliceResult> {
  input.observe_build_phase?.("resolution");
  const afterId = parseResolutionCursor(progress.scan_cursor);
  const maxResolutionReferences = input.max_resolution_references ?? MAX_RESOLUTION_REFERENCES_PER_PASS;
  if (!Number.isSafeInteger(maxResolutionReferences) || maxResolutionReferences <= 0) {
    throw new TypeError("max_resolution_references must be a positive safe integer.");
  }
  const nodes = await readAllBuildNodes(input);
  const unresolved = await input.build_read.listBuildUnresolvedReferences({
    snapshot_id: input.snapshot_id,
    controller_generation: input.controller_generation,
    invalidation_generation: input.invalidation_generation,
    after_id: afterId === "0" ? undefined : afterId,
    max_rows: maxResolutionReferences
  });
  const resolvedReferences: Array<{
    unresolved_reference_id: string;
    file_path: string;
    edge: GraphEdgeWriteModel;
  }> = [];
  const deferredAnchors: GraphNodeWriteModel[] = [];
  for (const reference of unresolved) {
    const exactDeferredEdge = deferredGraphEdge(reference.candidate_metadata.deferred_graph_edge);
    if (exactDeferredEdge !== undefined) {
      resolvedReferences.push({
        unresolved_reference_id: reference.id,
        file_path: reference.source_file_path,
        edge: exactDeferredEdge
      });
      continue;
    }
    const lambdaDeferred = deferredLambdaHandlerResolution({ reference, nodes, snapshot_id: input.snapshot_id });
    if (lambdaDeferred !== undefined) {
      deferredAnchors.push(lambdaDeferred.anchor);
      resolvedReferences.push({
        unresolved_reference_id: reference.id,
        file_path: reference.source_file_path,
        edge: lambdaDeferred.edge
      });
      continue;
    }
    const resolution = resolveOneReference({ reference, allNodes: nodes, finalization: true });
    if (resolution !== undefined) {
      resolvedReferences.push({
        unresolved_reference_id: reference.id,
        file_path: reference.source_file_path,
        edge: resolution
      });
    }
  }
  input.observe_build_phase?.("graph_write");
  await input.build_resolution.applyBuildResolutionSlice({
    snapshot_id: input.snapshot_id,
    controller_generation: input.controller_generation,
    invalidation_generation: input.invalidation_generation,
    provenance: "graph-build-final-resolution",
    deferred_anchors: deferredAnchors,
    resolved_references: resolvedReferences
  });
  const authoritativeProgress = await input.build_progress.getGraphBuildProgress({
    snapshot_id: input.snapshot_id
  });
  if (authoritativeProgress === null) {
    throw new Error("Graph build progress disappeared after durable resolution.");
  }
  input.report_build_progress?.("resolution", unresolved.length);
  input.observe_build_phase?.("finalizing");

  if (unresolved.length === maxResolutionReferences) {
    const cursor = `resolve:${unresolved.at(-1)!.id}`;
    const nextProgress: GraphBuildProgress = {
      ...authoritativeProgress,
      scan_cursor: cursor,
      updated_at: input.clock.nowIso8601()
    };
    const coverage = partialGraphCoverage(nextProgress, {
      scan_truncated: false,
      extraction_truncated: false
    });
    await input.build_coverage.upsertGraphBuildCoverage({
      snapshot_id: input.snapshot_id,
      controller_generation: input.controller_generation,
      invalidation_generation: input.invalidation_generation,
      coverage
    });
    await input.build_progress.upsertGraphBuildProgress({ progress: nextProgress });
    return {
      outcome: "partial",
      snapshot_id: input.snapshot_id,
      continuation_cursor: cursor,
      partial_kind: "continue_build",
      coverage: [coverage]
    };
  }

  const completeProgress: GraphBuildProgress = {
    ...authoritativeProgress,
    phase: "complete",
    status: "completed",
    scan_cursor: undefined,
    updated_at: input.clock.nowIso8601()
  };
  const coverage = completeGraphCoverage(completeProgress);
  await input.build_coverage.upsertGraphBuildCoverage({
    snapshot_id: input.snapshot_id,
    controller_generation: input.controller_generation,
    invalidation_generation: input.invalidation_generation,
    coverage
  });
  await input.build_progress.upsertGraphBuildProgress({ progress: completeProgress });
  await input.snapshots.markSnapshotFreshness({
    snapshot_id: input.snapshot_id,
    freshness: "fresh"
  });
  return {
    outcome: "complete",
    snapshot_id: input.snapshot_id,
    coverage: [coverage]
  };
}

function deferredGraphEdge(value: unknown): GraphEdgeWriteModel | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const edge = value as Partial<GraphEdgeWriteModel>;
  if (typeof edge.id !== "string" || typeof edge.source_node_id !== "string" ||
      typeof edge.target_node_id !== "string" || typeof edge.kind !== "string" ||
      typeof edge.provenance !== "string" || typeof edge.confidence !== "number" ||
      edge.source_range === undefined || edge.metadata === undefined) return undefined;
  return edge as GraphEdgeWriteModel;
}

function deferredLambdaHandlerResolution(input: {
  reference: UnresolvedReference;
  nodes: readonly GraphNode[];
  snapshot_id: string;
}): { anchor: GraphNodeWriteModel; edge: GraphEdgeWriteModel } | undefined {
  const target = input.reference.candidate_metadata.deferred_handler_target;
  if (target === null || typeof target !== "object") return undefined;
  const typed = target as { path?: unknown; language?: unknown; file_identity?: unknown };
  if (typeof typed.path !== "string" || typeof typed.language !== "string" ||
      typed.file_identity === null || typeof typed.file_identity !== "object") return undefined;
  const source = input.nodes.find((node) => node.id === input.reference.source_node_id);
  if (source === undefined) return undefined;
  const anchorId = `${input.snapshot_id}:${typed.path}:lambda_handler_file:${source.id}`;
  const exportName = typeof source.metadata.handler_export_candidate === "string"
    ? source.metadata.handler_export_candidate
    : undefined;
  const anchor: GraphNodeWriteModel = {
    id: anchorId,
    kind: "lambda_handler_file",
    name: typed.path,
    qualified_name: `${source.qualified_name}:file:${typed.path}`,
    file_path: typed.path,
    language: typed.language,
    source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: 0 },
    signature: exportName === undefined ? String(source.name) : `${typed.path}#${exportName}`,
    metadata: {
      domain: "infrastructure",
      capability_level: "resource_backed",
      evidence_kinds: ["config", "infra_parser"],
      provenance: "cloudformation_handler_file_resolution",
      semantic_scope: "file_level_handler_routing",
      handler: source.name,
      logical_id: source.metadata.logical_id,
      template_path: source.file_path,
      handler_export_candidate: exportName,
      event_sources: source.metadata.event_sources
    }
  };
  return {
    anchor,
    edge: {
      id: `${source.id}:routes-to:${anchorId}`,
      source_node_id: source.id,
      target_node_id: anchorId,
      kind: "routes_to_handler_file",
      source_range: input.reference.source_range,
      provenance: "cloudformation_handler_file_resolution",
      confidence: 0.45,
      metadata: {
        domain: "infrastructure",
        capability_level: "resource_backed",
        evidence_kinds: ["config", "infra_parser"],
        semantic_scope: "file_level_handler_routing",
        handler: source.name,
        handler_file_path: typed.path,
        handler_export_candidate: exportName
      }
    }
  };
}

function parseResolutionCursor(cursor: string | undefined): string {
  const match = /^resolve:(\d+)$/u.exec(cursor ?? "");
  if (match === null) throw new Error("Resolving graph build progress has an invalid cursor.");
  return match[1];
}

function buildProgressFromResult(input: {
  input: RepositoryGraphBuildSliceInput;
  result: IndexRepositoryGraphResult;
  phase: GraphBuildProgress["phase"];
  scan_cursor?: string;
}): GraphBuildProgress {
  return {
    snapshot_id: input.result.snapshot_id,
    owner_id: input.input.owner_id,
    phase: input.phase,
    status: input.phase === "complete" ? "completed" : "active",
    scan_cursor: input.scan_cursor,
    max_files: input.input.max_files ?? 2000,
    generation_source_hash: graphGenerationSourceHash(input.input),
    counters: {
      eligible_files: input.result.eligible_files_seen ?? input.result.scanned_files,
      scanned_files: input.result.scanned_files,
      admitted_files: input.result.admitted_files ?? input.result.scanned_files,
      extracted_files: input.result.extracted_files,
      unsupported_files: input.result.unsupported_files,
      resource_backed_files: input.result.resource_backed_files,
      nodes: input.result.node_count,
      edges: input.result.edge_count,
      unresolved_references: input.result.unresolved_reference_count
    },
    controller_generation: input.input.controller_generation,
    invalidation_generation: input.input.invalidation_generation,
    updated_at: input.input.clock.nowIso8601()
  };
}

function graphGenerationSourceHash(input: RepositoryGraphBuildSliceInput): string {
  return createHash("sha256").update(JSON.stringify({
    repo_root: input.repo_root,
    config_identity: input.config_identity ?? "default",
    schema_version: input.schema_version,
    controller_generation: input.controller_generation,
    invalidation_generation: input.invalidation_generation,
    composition_fingerprint: input.repository_composition?.composition_fingerprint ?? null,
    admission_policy: "graph-priority-v1"
  })).digest("hex");
}

function addBuildCounters(
  progress: GraphBuildProgress,
  result: IndexRepositoryGraphResult
): GraphBuildProgress["counters"] {
  return {
    eligible_files: progress.counters.eligible_files + (result.eligible_files_seen ?? result.scanned_files),
    scanned_files: progress.counters.scanned_files + result.scanned_files,
    admitted_files: progress.counters.admitted_files + (result.admitted_files ?? result.scanned_files),
    extracted_files: progress.counters.extracted_files + result.extracted_files,
    unsupported_files: progress.counters.unsupported_files + result.unsupported_files,
    resource_backed_files: progress.counters.resource_backed_files + result.resource_backed_files,
    nodes: progress.counters.nodes + result.node_count,
    edges: progress.counters.edges + result.edge_count,
    unresolved_references: progress.counters.unresolved_references + result.unresolved_reference_count
  };
}

function partialGraphCoverage(
  progress: GraphBuildProgress,
  truncation: Pick<IndexCoverage, "scan_truncated" | "extraction_truncated">
): IndexCoverage & { evidence_class: "graph" } {
  return {
    evidence_class: "graph",
    state: "partial",
    indexed_files: progress.counters.extracted_files,
    eligible_files_seen: progress.counters.eligible_files,
    admitted_files: progress.counters.admitted_files,
    extracted_files: progress.counters.extracted_files,
    scan_truncated: truncation.scan_truncated,
    extraction_truncated: truncation.extraction_truncated,
    continuation_available: progress.scan_cursor !== undefined,
    continuation_kind: progress.scan_cursor === undefined ? undefined : "graph_build",
    continuation_cursor: progress.scan_cursor,
    indexed_roots: ["."],
    reason: progress.phase === "resolving"
      ? "Graph completion is resolving accumulated references from a durable resolution cursor."
      : "Graph completion remains bounded and can resume from its durable scan cursor."
  };
}

function completeGraphCoverage(progress: GraphBuildProgress): IndexCoverage & { evidence_class: "graph" } {
  return {
    evidence_class: "graph",
    state: "complete",
    indexed_files: progress.counters.extracted_files,
    eligible_files_seen: progress.counters.eligible_files,
    admitted_files: progress.counters.admitted_files,
    extracted_files: progress.counters.extracted_files,
    scan_truncated: false,
    extraction_truncated: false,
    continuation_available: false,
    indexed_roots: ["."],
    reason: "Graph completion exhausted the deterministic repository scan."
  };
}

function requireGraphCoverage(coverage: readonly IndexCoverage[]): IndexCoverage {
  const graphCoverage = coverage.find((entry) => entry.evidence_class === "graph");
  if (graphCoverage === undefined) {
    throw new Error("Graph build did not produce graph coverage metadata.");
  }
  return graphCoverage;
}

async function readAllBuildNodes(input: RepositoryGraphBuildSliceInput): Promise<GraphNode[]> {
  const rows: GraphNode[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await input.build_read.listBuildNodes({
      snapshot_id: input.snapshot_id,
      controller_generation: input.controller_generation,
      invalidation_generation: input.invalidation_generation,
      after_node_id: after,
      max_rows: 5_000
    });
    rows.push(...page);
    if (page.length < 5_000) return rows;
    after = page.at(-1)?.id;
  }
}

async function readBoundedDocsContent(input: {
  workspace: WorkspaceFilePort;
  path: string;
}): Promise<string> {
  const boundedReader = input.workspace.readTextPrefix;
  if (boundedReader === undefined) {
    throw new Error(`Bounded workspace reads are required to index oversized documentation: ${input.path}.`);
  }
  return boundedReader.call(input.workspace, {
    path: input.path,
    max_bytes: MAX_DOCS_INDEX_BYTES
  });
}

function isDocumentationIndexPath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//u, "");
  return normalized === "AGENTS.md" ||
    normalized === "README.md" ||
    normalized.startsWith("docs/") ||
    normalized.startsWith("doc/") ||
    normalized.startsWith("documentation/");
}

/** Standalone indexing entry point that explicitly publishes a successful build. */
export async function indexRepositoryGraph(
  input: BuildRepositoryGraphInput
): Promise<IndexRepositoryGraphResult> {
  const snapshotId = input.snapshot_id ?? String(input.clock.nowUnixMs());
  const standaloneInput = { ...input, snapshot_id: snapshotId };
  try {
    const result = await buildRepositoryGraph(standaloneInput);
    await publishStandaloneRepositoryGraphBuild({
      snapshots: input.snapshots,
      result,
      controller_generation: input.controller_generation ?? 0,
      invalidation_generation: input.invalidation_generation ?? 0,
      updated_at: input.clock.nowIso8601()
    });
    return result;
  } catch (error) {
    return rethrowWithPublicationCleanup({ input: standaloneInput, snapshotId, error });
  }
}

/** Explicit legacy/standalone publication fence; daemon refresh controllers publish their own builds. */
export async function publishStandaloneRepositoryGraphBuild(input: {
  snapshots: SnapshotPublicationPort;
  result: IndexRepositoryGraphResult;
  controller_generation: number;
  invalidation_generation: number;
  updated_at: string;
}): Promise<void> {
  await input.snapshots.transitionBuild({
    repo_root: input.result.repo_root,
    snapshot_id: input.result.snapshot_id,
    from: "building",
    to: "published",
    controller_generation: input.controller_generation,
    invalidation_generation: input.invalidation_generation,
    updated_at: input.updated_at
  });
}

async function rethrowWithPublicationCleanup({ input, snapshotId, error }: {
  input: BuildRepositoryGraphInput;
  snapshotId: string;
  error: unknown;
}): Promise<never> {
  let cleanupError: unknown;
  try {
    const publication = await input.snapshots.readExplicit({
      repo_root: input.repo_root,
      snapshot_id: snapshotId
    });
    if (publication.status === "blocked" && publication.publication_state === "building") {
      await input.snapshots.transitionBuild({
        repo_root: input.repo_root,
        snapshot_id: snapshotId,
        from: "building",
        to: "failed",
        controller_generation: input.controller_generation ?? 0,
        invalidation_generation: input.invalidation_generation ?? 0,
        updated_at: input.clock.nowIso8601()
      });
    }
  } catch (caughtCleanupError) {
    cleanupError = caughtCleanupError;
  }
  if (cleanupError !== undefined) {
    throw new AggregateError(
      [error, cleanupError],
      "Graph indexing failed and publication cleanup also failed.",
      { cause: error }
    );
  }
  throw error;
}

function mergeDocsIndexFiles(input: {
  graphFiles: readonly FileCatalogEntry[];
  docsFiles: readonly FileCatalogEntry[];
}): FileCatalogEntry[] {
  const byPath = new Map<string, FileCatalogEntry>();
  for (const file of [...input.graphFiles, ...input.docsFiles]) {
    if (file.file_identity.language === "markdown") {
      byPath.set(file.path, file);
    }
  }
  return [...byPath.values()].sort(compareDocsIndexFiles);
}

/**
 * Documentation indexing is a view over the graph inventory, not another
 * filesystem traversal. The graph catalog has already applied the canonical
 * repository policy, so only the docs-root projection remains here.
 */
function docsCatalogFromInventory(scan: FileCatalogScanResult): FileCatalogScanResult {
  return {
    ...scan,
    indexed_roots: [...DOCS_INDEX_ROOTS],
    files: scan.files.filter((file) => isDocumentationIndexPath(file.path))
  };
}

/** Preserve legacy graph continuation semantics while using one full walk. */
function boundedGraphCatalogFromInventory(input: {
  scan: FileCatalogScanResult;
  max_files: number;
  after_path?: string;
}): FileCatalogScanResult {
  if (!Number.isSafeInteger(input.max_files) || input.max_files <= 0) {
    throw new TypeError("max_files must be a positive safe integer.");
  }
  const afterPath = input.after_path === undefined ? undefined : normalizePriorityPath(input.after_path);
  const cursorIndex = afterPath === undefined ? -1 : input.scan.files.findIndex((file) => file.path === afterPath);
  if (afterPath !== undefined && cursorIndex === -1) {
    throw new Error(`Catalog scan continuation cursor not found in traversal sequence: ${input.after_path}`);
  }
  const candidates = input.scan.files.slice(cursorIndex + 1);
  const files = candidates.slice(0, input.max_files);
  const truncated = input.scan.truncated || candidates.length > input.max_files;
  return {
    ...input.scan,
    files,
    truncated,
    continuation_cursor: truncated ? files.at(-1)?.path ?? input.scan.continuation_cursor : undefined
  };
}

function compareDocsIndexFiles(left: FileCatalogEntry, right: FileCatalogEntry): number {
  return docsIndexRank(right.path) - docsIndexRank(left.path) || left.path.localeCompare(right.path);
}

function compareDocsIndexDocuments(
  left: DocsIndexDocumentWrite,
  right: DocsIndexDocumentWrite
): number {
  return docsIndexRank(right.path) - docsIndexRank(left.path) || left.path.localeCompare(right.path);
}

function docsIndexRank(filePath: string): number {
  const lower = filePath.toLowerCase();
  if (lower === "agents.md") return 100;
  if (lower === "readme.md") return 95;
  if (lower.startsWith("docs/")) return 90;
  if (lower.startsWith("doc/") || lower.startsWith("documentation/")) return 85;
  return 10;
}

function buildIndexCoverage(input: {
  graphScan: {
    files: readonly FileCatalogEntry[];
    indexed_roots: readonly string[];
    truncated: boolean;
  };
  graphExtraction: {
    admitted_files: number;
    extracted_files: number;
    truncated: boolean;
    budget?: number;
    cooperative_deadline_reached?: boolean;
    continuation_cursor?: string;
  };
  docsScan?: {
    files: readonly FileCatalogEntry[];
    indexed_roots: readonly string[];
    truncated: boolean;
  };
  docsPartition?: DocumentationCorpusDecisionPartition;
  docsIndexedFiles?: number;
}): readonly IndexCoverage[] {
  const graphCoverageTruncated = input.graphScan.truncated || input.graphExtraction.truncated;
  const graphCoverageReasonMessage = graphCoverageReason({
    graphScanTruncated: input.graphScan.truncated,
    graphExtractionTruncated: input.graphExtraction.truncated,
    graphExtractionBudget: input.graphExtraction.budget,
    cooperativeDeadlineReached: input.graphExtraction.cooperative_deadline_reached === true
  });
  const graphCoverage = {
    evidence_class: "graph" as const,
    state: coverageState(graphCoverageTruncated),
    indexed_files: input.graphExtraction.extracted_files,
    eligible_files_seen: input.graphScan.files.length,
    admitted_files: input.graphExtraction.admitted_files,
    extracted_files: input.graphExtraction.extracted_files,
    scan_truncated: input.graphScan.truncated,
    extraction_truncated: input.graphExtraction.truncated,
    continuation_available: graphCoverageTruncated && input.graphExtraction.continuation_cursor !== undefined,
    continuation_kind: graphCoverageTruncated && input.graphExtraction.continuation_cursor !== undefined
      ? "graph_build" as const
      : undefined,
    continuation_cursor: graphCoverageTruncated
      ? input.graphExtraction.continuation_cursor
      : undefined,
    indexed_roots: [...input.graphScan.indexed_roots],
    reason: graphCoverageReasonMessage
  };
  const docsCoverage = input.docsScan === undefined
    ? undefined
    : docsIndexCoverage({
        docsScan: input.docsScan,
        docsPartition: input.docsPartition ?? partitionDocumentationCorpusPaths(
          input.docsScan.files
            .filter((file) => file.file_identity.language === "markdown")
            .map((file) => file.path)
        ),
        docsIndexedFiles: input.docsIndexedFiles,
        truncated: input.docsScan.truncated
      });
  return docsCoverage === undefined ? [graphCoverage] : [docsCoverage, graphCoverage];
}

function docsIndexCoverage(input: {
  docsScan: {
    files: readonly FileCatalogEntry[];
    indexed_roots: readonly string[];
    truncated: boolean;
  };
  docsPartition: DocumentationCorpusDecisionPartition;
  docsIndexedFiles?: number;
  truncated: boolean;
}): IndexCoverage {
  return {
        evidence_class: "docs" as const,
        state: coverageState(input.truncated),
        indexed_files: input.docsIndexedFiles ?? input.docsPartition.eligible_markdown_files,
        eligible_files_seen: input.docsPartition.eligible_markdown_files,
        scan_truncated: input.truncated,
        indexed_roots: [...input.docsScan.indexed_roots],
        missing_priority_roots: DOCS_INDEX_ROOTS.filter((root) =>
          !input.docsScan.files.some((file) => file.path === root || file.path.startsWith(`${root}/`))
        ),
        documentation_corpus_policy_version: input.docsPartition.policy_version,
        policy_excluded_files: input.docsPartition.excluded_markdown_files,
        policy_exclusions: [...input.docsPartition.exclusions],
        reason: input.truncated
          ? "Docs index scan reached its file budget before covering all docs priority roots."
          : "Docs index scan covered docs priority roots independently from graph seed order."
      } as IndexCoverage;
}

function extractionContinuationCursor(input: {
  scanned: { continuation_cursor?: string };
  extractionFiles: readonly FileCatalogEntry[];
  extractionTruncated: boolean;
}): string | undefined {
  if (input.extractionTruncated) {
    return input.extractionFiles.at(-1)?.path;
  }
  return input.scanned.continuation_cursor;
}

function graphCoverageReason(input: {
  graphScanTruncated: boolean;
  graphExtractionTruncated: boolean;
  graphExtractionBudget?: number;
  cooperativeDeadlineReached: boolean;
}): string {
  const reasons: string[] = [];
  if (input.graphScanTruncated) {
    reasons.push("Graph seed scan reached its file budget before covering the full repository.");
  }
  if (input.graphExtractionTruncated) {
    if (input.cooperativeDeadlineReached) {
      reasons.push("Graph extraction yielded before the worker deadline and exposed a durable continuation.");
    } else {
      const configuredBudget = input.graphExtractionBudget === undefined
        ? "configured file budget"
        : `max_extraction_files=${input.graphExtractionBudget}`;
      reasons.push(`Graph extraction reached its ${configuredBudget} before processing all scanned files.`);
    }
  }
  if (reasons.length === 0) {
    return "Graph seed scan covered the requested roots.";
  }
  if (reasons.length === 1) {
    return reasons[0];
  }
  return reasons.join(" ");
}

function resolveExtractionPriorityPaths(input: {
  userPriorityPaths?: readonly string[];
  railsShape: RailsProjectShape;
}): readonly string[] {
  const paths = [...(input.userPriorityPaths ?? []), ...DEFAULT_GRAPH_PRIORITY_PATHS, ...input.railsShape.route_file_paths];
  return dedupePaths(paths.map(normalizePriorityPath));
}

function prioritizeExtractionOrder(input: {
  files: readonly FileCatalogEntry[];
  priorityPaths: readonly string[];
}): readonly FileCatalogEntry[] {
  const priorityByPath = new Map<string, number>();
  for (let index = 0; index < input.priorityPaths.length; index += 1) {
    const path = normalizePriorityPath(input.priorityPaths[index]);
    if (path === "" || priorityByPath.has(path)) {
      continue;
    }
    priorityByPath.set(path, index);
  }

  return [...input.files]
    .map((file, index) => ({
      file,
      originalIndex: index,
      priorityRank: priorityByPath.get(normalizePriorityPath(file.path)) ?? Number.MAX_SAFE_INTEGER
    }))
    .sort((left, right) => left.priorityRank - right.priorityRank || left.originalIndex - right.originalIndex)
    .map((entry) => entry.file);
}

function normalizePriorityPath(inputPath: string): string {
  const normalized = pathPosix.normalize(inputPath.replaceAll("\\", "/").replace(/^\.\//u, ""));
  return normalized === "." ? "" : normalized;
}

function dedupePaths(paths: readonly string[]): readonly string[] {
  const uniquePaths = new Set<string>();
  for (const candidatePath of paths) {
    if (candidatePath === "" || uniquePaths.has(candidatePath)) {
      continue;
    }
    uniquePaths.add(candidatePath);
  }
  return [...uniquePaths];
}

function mergeRailsShapeFiles(input: {
  scannedFiles: readonly FileCatalogEntry[];
  probeFiles?: readonly FileCatalogEntry[];
}): readonly FileCatalogEntry[] {
  if (input.probeFiles === undefined || input.probeFiles.length === 0) {
    return input.scannedFiles;
  }

  const byPath = new Map<string, FileCatalogEntry>();
  for (const file of [...input.scannedFiles, ...input.probeFiles]) {
    if (!byPath.has(file.path)) {
      byPath.set(file.path, file);
    }
  }
  return [...byPath.values()];
}

function coverageState(truncated: boolean): EvidenceCoverageState {
  return truncated ? "partial" : "complete";
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
        const targetFile = input.files.find((file) => file.path === resolvedPath);
        batch.unresolved_references.push({
          id: `${node.id}:handler-file-deferred`,
          source_node_id: node.id,
          source_file_path: batch.source_path,
          reference_name: resolvedPath,
          reference_kind: "lambda_handler_file",
          source_range: node.source_range,
          candidate_metadata: {
            provenance: "cloudformation_handler_file_resolution",
            confidence: "low",
            handler: node.name,
            candidates,
            resolution: "unresolved",
            deferred_until_target_batch: true,
            deferred_handler_target: targetFile === undefined ? undefined : {
              path: targetFile.path,
              language: targetFile.file_identity.language,
              file_identity: targetFile.file_identity
            }
          }
        });
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
      template_path: input.sourceNode.file_path,
      handler_export_candidate: exportName,
      event_sources: input.sourceNode.metadata.event_sources
    }
  };
}

function applyRailsDiscoveryShape(input: {
  batch: ExtractionBatch;
  shape: ReturnType<typeof detectRailsProjectShape>;
}): ExtractionBatch {
  const nodes = input.batch.nodes.map((node) => {
    const railsDiscovery = railsDiscoveryFromMetadata(node.metadata);
    if (railsDiscovery === undefined) {
      return node;
    }
    if (!projectAdmitsRailsDiscovery({
      filePath: node.file_path,
      discovery: railsDiscovery,
      shape: input.shape
    })) {
      const { rails_discovery: _railsDiscovery, ...metadata } = node.metadata;
      return {
        ...node,
        metadata
      };
    }
    return node;
  });

  return {
    ...input.batch,
    nodes
  };
}

function railsDiscoveryFromMetadata(metadata: Record<string, unknown>): RailsDiscoveryMetadata | undefined {
  const candidate = metadata.rails_discovery;
  if (candidate === undefined || typeof candidate !== "object" || candidate === null) {
    return undefined;
  }

  const typed = candidate as {
    rails_project_roots?: unknown;
    rails_roles?: unknown;
    rails_is_config_file?: unknown;
    rails_is_route_file?: unknown;
    rails_is_test_file?: unknown;
  };

  if (!Array.isArray(typed.rails_project_roots) || !Array.isArray(typed.rails_roles)) {
    return undefined;
  }
  if (
    typeof typed.rails_is_config_file !== "boolean" ||
    typeof typed.rails_is_route_file !== "boolean" ||
    typeof typed.rails_is_test_file !== "boolean"
  ) {
    return undefined;
  }

  return {
    rails_project_roots: typed.rails_project_roots as string[],
    rails_roles: typed.rails_roles as string[],
    rails_is_config_file: typed.rails_is_config_file,
    rails_is_route_file: typed.rails_is_route_file,
    rails_is_test_file: typed.rails_is_test_file
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
  documentation_concerns: DocumentationConcernIndexPort;
  snapshots: SnapshotPort & SnapshotPublicationPort & SnapshotBuildPort;
  warmups: WarmupCoordinatorPort;
  clock: ClockPort;
  schema_version: number;
  owner_id: string;
  snapshot_id?: string;
  config_identity?: string;
  max_files?: number;
  max_extraction_files?: number;
  repository_composition?: SnapshotRepositoryComposition;
  controller_generation?: number;
  invalidation_generation?: number;
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
      documentation_concerns: input.documentation_concerns,
      snapshots: input.snapshots,
      clock: input.clock,
      schema_version: input.schema_version,
      snapshot_id: snapshotId,
      config_identity: input.config_identity,
      max_files: input.max_files,
      max_extraction_files: input.max_extraction_files,
      repository_composition: input.repository_composition,
      controller_generation: input.controller_generation,
      invalidation_generation: input.invalidation_generation
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
  repository_composition?: SnapshotRepositoryComposition;
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
    updated_at: input.now,
    composition_fingerprint: input.repository_composition?.composition_fingerprint,
    repository_composition: input.repository_composition
  };
}

type CompositionAwareFileCatalogScanPort = {
  scan(input: Parameters<FileCatalogScanPort["scan"]>[0] & {
    repository_composition?: RepositoryCompositionAdmissionReceipt;
  }): ReturnType<FileCatalogScanPort["scan"]>;
};

function scanFileCatalog(
  scanner: FileCatalogScanPort,
  input: Parameters<FileCatalogScanPort["scan"]>[0] & {
    repository_composition?: SnapshotRepositoryComposition;
  }
): ReturnType<FileCatalogScanPort["scan"]> {
  return (scanner as CompositionAwareFileCatalogScanPort).scan(input);
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
  const allNodes = batches.flatMap((batch) => batch.nodes);
  const nodesByName = new Map<string, GraphNodeWriteModel[]>();
  for (const node of allNodes) {
    const key = node.name.toLowerCase();
    nodesByName.set(key, [...(nodesByName.get(key) ?? []), node]);
  }

  const edgesByFile: Array<{ file_path: string; edges: GraphEdgeWriteModel[] }> = [];
  const resolvedBatches = batches.map((batch) => {
    const edges: GraphEdgeWriteModel[] = [];
    const unresolved: UnresolvedReferenceWriteModel[] = [];

    for (const reference of batch.unresolved_references) {
      const edge = resolveOneReference({
        reference,
        allNodes,
        namedCandidates: nodesByName.get(reference.reference_name.toLowerCase()) ?? []
      });
      if (edge !== undefined) {
        edges.push(edge);
        continue;
      }

      const candidateCount = referenceCandidateCount({ reference, allNodes });
      unresolved.push({
        ...reference,
        candidate_metadata: {
          ...reference.candidate_metadata,
          candidate_count: candidateCount,
          resolution: candidateCount > 1 ? "ambiguous" : "unresolved"
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

function resolveOneReference(input: {
  reference: UnresolvedReferenceWriteModel | UnresolvedReference;
  allNodes: readonly GraphNodeWriteModel[] | readonly GraphNode[];
  namedCandidates?: readonly GraphNodeWriteModel[] | readonly GraphNode[];
  finalization?: boolean;
}): GraphEdgeWriteModel | undefined {
  const namedCandidates = input.namedCandidates ?? input.allNodes.filter((candidate) =>
    candidate.name.toLowerCase() === input.reference.reference_name.toLowerCase()
  );
  const candidates = filterReferenceCandidates({
    reference: input.reference,
    candidates: candidatePoolForReference({
      reference: input.reference,
      allNodes: input.allNodes,
      namedCandidates
    })
  });
  const unique = candidates.length === 1 ? candidates[0] : undefined;
  if (unique === undefined) return undefined;
  const sourceProvenance = typeof input.reference.candidate_metadata.provenance === "string"
    ? input.reference.candidate_metadata.provenance
    : "tree-sitter-reference-resolution";
  const confidence = typeof input.reference.candidate_metadata.confidence === "number"
    ? input.reference.candidate_metadata.confidence
    : 0.8;
  return {
    id: `${input.reference.id}:resolved`,
    source_node_id: input.reference.source_node_id,
    target_node_id: unique.id,
    kind: input.reference.reference_kind === "lambda_handler_file"
      ? "routes_to_handler_file"
      : input.reference.reference_kind,
    source_range: input.reference.source_range,
    provenance: input.finalization === true ? "graph-build-final-resolution" : sourceProvenance,
    confidence,
    metadata: {
      ...input.reference.candidate_metadata,
      reference_name: input.reference.reference_name,
      reference_provenance: sourceProvenance
    }
  };
}

function referenceCandidateCount(input: {
  reference: UnresolvedReferenceWriteModel;
  allNodes: readonly GraphNodeWriteModel[];
}): number {
  return filterReferenceCandidates({
    reference: input.reference,
    candidates: candidatePoolForReference({
      reference: input.reference,
      allNodes: input.allNodes,
      namedCandidates: input.allNodes.filter((candidate) =>
        candidate.name.toLowerCase() === input.reference.reference_name.toLowerCase()
      )
    })
  }).length;
}

function candidatePoolForReference(input: {
  reference: UnresolvedReferenceWriteModel;
  allNodes: readonly GraphNodeWriteModel[];
  namedCandidates: readonly GraphNodeWriteModel[];
}): GraphNodeWriteModel[] {
  if (input.reference.reference_kind === "lambda_handler_file") {
    const candidates = handlerFileCandidates(
      input.reference.candidate_metadata.candidates,
      input.reference.reference_name
    );
    return input.allNodes.filter((candidate) => candidates.includes(candidate.file_path));
  }
  if (input.reference.candidate_metadata.provenance !== "tree-sitter-ruby") {
    return [...input.namedCandidates];
  }
  if (input.reference.candidate_metadata.static !== true) {
    return [];
  }

  const metadata = input.reference.candidate_metadata;
  const referenceKind = input.reference.reference_kind;
  const rawNormalizedName = input.reference.reference_name.replaceAll("::", ".").toLowerCase();
  const normalizedName = referenceKind === "ruby_require_relative"
    ? pathPosix.normalize(pathPosix.join(
      pathPosix.dirname(input.reference.source_file_path),
      rawNormalizedName
    )).replace(/\.rb$/u, "")
    : rawNormalizedName.replace(/\.rb$/u, "");
  const additional = input.allNodes.filter((candidate) => {
    if (candidate.language !== "ruby") return false;
    const qualified = candidate.qualified_name?.replaceAll("::", ".").toLowerCase();
    if (qualified === normalizedName) return true;
    if (referenceKind !== "ruby_require" && referenceKind !== "ruby_require_relative") return false;
    const pathWithoutExtension = candidate.file_path.replace(/\.rb$/u, "").toLowerCase();
    return candidate.kind === "module" &&
      (pathWithoutExtension === normalizedName || pathWithoutExtension.endsWith(`/${normalizedName}`));
  });

  if (referenceKind === "ruby_route") {
    if (metadata.route_form === "concerns" && typeof metadata.route_concern_name === "string") {
      const routeConcernName = metadata.route_concern_name.toLowerCase();
      return input.allNodes.filter((candidate) =>
        candidate.language === "ruby" &&
        candidate.kind === "rails_route_concern" &&
        typeof candidate.metadata.route_concern_name === "string" &&
        candidate.metadata.route_concern_name.toLowerCase() === routeConcernName
      );
    }
    if (metadata.route_form === "draw" && typeof metadata.route_file_candidate === "string") {
      const routeFileCandidate = metadata.route_file_candidate.toLowerCase();
      return input.allNodes.filter((candidate) =>
        candidate.language === "ruby" &&
        candidate.kind === "module" &&
        candidate.metadata.parser_version === "tree-sitter-ruby" &&
        candidate.file_path.toLowerCase() === routeFileCandidate
      );
    }
    const namespacedControllerCandidates = controllerClassCandidatesForRouteReference(metadata, input.allNodes);
    const actionCandidates = routeActionCandidatesForReference(input.reference, input.allNodes);
    return uniqueById([...namespacedControllerCandidates, ...actionCandidates]);
  }

  if (referenceKind === "ruby_model_dsl") {
    const modelForm = metadata.model_form;
    if (modelForm !== "belongs_to" && modelForm !== "has_many" && modelForm !== "has_one" &&
      modelForm !== "has_and_belongs_to_many") {
      return [];
    }
    const modelDsnCandidates = modelDslClassCandidates(input.reference, input.allNodes);
    return uniqueById([...input.namedCandidates, ...additional, ...modelDsnCandidates]);
  }

  return [...new Map([...input.namedCandidates, ...additional].map((candidate) => [candidate.id, candidate])).values()];
}

function modelDslClassCandidates(
  reference: UnresolvedReferenceWriteModel,
  allNodes: readonly GraphNodeWriteModel[]
): GraphNodeWriteModel[] {
  if (reference.candidate_metadata.model_form !== "has_many" &&
    reference.candidate_metadata.model_form !== "has_one" &&
    reference.candidate_metadata.model_form !== "belongs_to" &&
    reference.candidate_metadata.model_form !== "has_and_belongs_to_many") {
    return [];
  }

  const explicitClassName = typeof reference.candidate_metadata.class_name === "string"
    ? reference.candidate_metadata.class_name
    : undefined;
  const explicitSourceName = typeof reference.candidate_metadata.model_source === "string"
    ? reference.candidate_metadata.model_source
    : undefined;
  const explicitSourceType = typeof reference.candidate_metadata.model_source_type === "string"
    ? reference.candidate_metadata.model_source_type
    : undefined;
  const throughName = typeof reference.candidate_metadata.model_through === "string"
    ? reference.candidate_metadata.model_through
    : undefined;
  const polymorphic = reference.candidate_metadata.model_polymorphic === true;
  if (polymorphic && explicitClassName === undefined && explicitSourceType === undefined) {
    return [];
  }
  const candidateClassNames = explicitClassName !== undefined && explicitClassName.length > 0
    ? [explicitClassName]
    : explicitSourceType !== undefined && explicitSourceType.length > 0
      ? [explicitSourceType]
      : explicitSourceName !== undefined && throughName !== undefined && throughName.length > 0
        ? inferModelClassNames(reference.candidate_metadata.model_form, explicitSourceName)
        : inferModelClassNames(reference.candidate_metadata.model_form, reference.reference_name);
  return modelClassCandidatesForNames(allNodes, candidateClassNames);
}

function modelClassCandidatesForNames(
  allNodes: readonly GraphNodeWriteModel[],
  names: readonly string[]
): GraphNodeWriteModel[] {
  const normalizedExpectedNames = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const normalized = trimmed.toLowerCase();
    normalizedExpectedNames.add(normalized);
    if (!trimmed.includes(".") && !trimmed.includes("/") && !trimmed.includes("::")) {
      const pascalized = toPascalCase(trimmed).toLowerCase();
      normalizedExpectedNames.add(pascalized);
    }
  }

  return allNodes.filter((candidate) => {
    if (candidate.language !== "ruby" || candidate.kind !== "class") {
      return false;
    }
    const name = candidate.name.toLowerCase();
    const qualifiedName = candidate.qualified_name?.toLowerCase();
    return Array.from(normalizedExpectedNames).some((expectedName) => {
      if (qualifiedName !== undefined && qualifiedName.endsWith(`.${expectedName}`)) {
        return true;
      }
      return name === expectedName;
    });
  });
}

function inferModelClassNames(form: string, associationName: string): string[] {
  const singularAssociationName = form === "has_many" || form === "has_and_belongs_to_many"
    ? singularizeAssociationName(associationName)
    : associationName;
  const pascalized = toPascalCase(singularAssociationName);
  return pascalized.length === 0 ? [] : [pascalized];
}

function singularizeAssociationName(value: string): string {
  const lowered = value.toLowerCase();
  if (lowered.endsWith("_ids") && lowered.length > 4) {
    return lowered.slice(0, -4);
  }
  if (lowered.endsWith("ies") && lowered.length > 3) {
    return `${lowered.slice(0, -3)}y`;
  }
  if (lowered.endsWith("s") && lowered.length > 1) {
    return lowered.slice(0, -1);
  }
  return lowered;
}

function toPascalCase(input: string): string {
  return input
    .split("_")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]!.toUpperCase()}${segment.slice(1)}`)
    .join("");
}

function controllerClassCandidatesForRouteReference(
  metadata: Record<string, unknown>,
  allNodes: readonly GraphNodeWriteModel[]
): GraphNodeWriteModel[] {
  const controllerCandidate = typeof metadata.controller_candidate === "string"
    ? metadata.controller_candidate
    : typeof metadata.route_controller_class === "string"
      ? metadata.route_controller_class
      : undefined;
  if (controllerCandidate === undefined) {
    return [];
  }

  const namespace = typeof metadata.route_namespace === "string"
    ? metadata.route_namespace
    : undefined;
  const namespaceTokens = namespace?.split("/").map((segment) => segment.toLowerCase()).filter(Boolean) ?? [];
  const controllerCandidateContainsNamespace = controllerCandidate.includes(".") || controllerCandidate.includes("/");
  const expectedControllerNames = candidateControllerNamesFromMetadata(controllerCandidate);
  return allNodes.filter((candidate) => {
    if (candidate.language !== "ruby" || candidate.kind !== "class") {
      return false;
    }
    if (!nodeMatchesRouteControllerName(candidate, expectedControllerNames)) {
      return false;
    }
    if (namespaceTokens.length === 0 && !controllerCandidateContainsNamespace) {
      const qualifiedName = candidate.qualified_name ?? "";
      if (qualifiedName.includes(".")) {
        return false;
      }
    }
    return namespaceTokens.length === 0 || nodeMatchesRouteNamespace(candidate, namespaceTokens);
  });
}

function candidateControllerNamesFromMetadata(controllerClass: string): string[] {
  const normalized = controllerClass
    .replaceAll("::", ".")
    .split(".")
    .filter((segment) => segment.length > 0);
  if (normalized.length === 0) {
    return [];
  }
  const full = normalized.join(".");
  return [full];
}

function nodeMatchesRouteControllerName(node: GraphNodeWriteModel, expectedControllerNames: string[]): boolean {
  if (expectedControllerNames.length === 0) {
    return false;
  }
  const lowerName = node.name.toLowerCase();
  const lowerQualified = node.qualified_name?.toLowerCase();
  const normalizedExpected = expectedControllerNames.map((name) => name.toLowerCase());
  return normalizedExpected.some((expectedName) => {
    const finalExpected = expectedName.split(".").at(-1);
    if (finalExpected !== undefined && finalExpected !== expectedName) {
      return lowerQualified === expectedName;
    }
    return lowerName === expectedName ||
      lowerName === (finalExpected ?? expectedName) ||
      (lowerQualified !== undefined && (
        lowerQualified === expectedName ||
        lowerQualified.endsWith(`.${expectedName}`)
      ));
  });
}

function nodeMatchesRouteNamespace(node: GraphNodeWriteModel, namespaceTokens: string[]): boolean {
  if (namespaceTokens.length === 0) {
    return true;
  }
  const nodeTokens = [node.file_path, node.qualified_name ?? ""]
    .join(" ")
    .toLowerCase()
    .replaceAll("/", ".")
    .split(/[^a-z0-9_]+/u)
    .filter(Boolean);
  return namespaceTokens.every((segment) => nodeTokens.includes(segment));
}

function routeActionCandidatesForReference(
  reference: UnresolvedReferenceWriteModel,
  allNodes: readonly GraphNodeWriteModel[]
): GraphNodeWriteModel[] {
  if (reference.candidate_metadata.controller_action_candidate !== true) {
    return [];
  }
  const routeAction = typeof reference.candidate_metadata.route_action === "string"
    ? reference.candidate_metadata.route_action
    : undefined;
  if (routeAction === undefined || routeAction.length === 0) {
    return [];
  }

  const controllers = controllerClassCandidatesForRouteReference(reference.candidate_metadata, allNodes);
  if (controllers.length === 0) {
    return [];
  }

  const controllerScopes = new Set(
    controllers
      .map((controller) => controller.qualified_name)
      .filter((qualified): qualified is string => qualified !== undefined)
      .map((qualified) => qualified.toLowerCase())
  );
  const action = routeAction.toLowerCase();
  return allNodes.filter((candidate) => {
    if (candidate.kind !== "method" && candidate.kind !== "singleton_method") {
      return false;
    }
    if (candidate.name.toLowerCase() !== action) {
      return false;
    }
    const candidateScope = candidate.qualified_name ?? "";
    const hashScope = candidateScope.lastIndexOf("#");
    const parentScope = hashScope >= 0
      ? candidateScope.slice(0, hashScope)
      : candidateScope.slice(0, Math.max(0, candidateScope.lastIndexOf(".")));
    const lowerParentScope = parentScope.toLowerCase();
    return Array.from(controllerScopes).some((controllerScope) => {
      return lowerParentScope === controllerScope || lowerParentScope.startsWith(`${controllerScope}.`);
    });
  });
}

function uniqueById(candidates: readonly GraphNodeWriteModel[]): GraphNodeWriteModel[] {
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
}

function filterReferenceCandidates(input: {
  reference: UnresolvedReferenceWriteModel;
  candidates: readonly GraphNodeWriteModel[];
}): GraphNodeWriteModel[] {
  if (input.reference.candidate_metadata.provenance === "tree-sitter-ruby" &&
    input.reference.candidate_metadata.static !== true) {
    return [];
  }
  const candidates = input.reference.candidate_metadata.provenance === "tree-sitter-ruby"
    ? input.candidates.filter((candidate) => rubyCandidateKindMatches(input.reference, candidate))
    : input.candidates;
  if (candidates.length <= 1) {
    return [...candidates];
  }
  if (input.reference.candidate_metadata.provenance !== "tree-sitter-go") {
    return [...candidates];
  }
  const resolution = input.reference.candidate_metadata.resolution;
  const importPath = input.reference.candidate_metadata.import_path;
  if (resolution === "import_selector" && typeof importPath === "string") {
    const imported = candidates.filter(
      (candidate) => candidate.kind !== "method" && goNodeMatchesImportPath(candidate, importPath)
    );
    return imported.length > 0 ? imported : [...candidates];
  }
  if (resolution === "receiver_or_package_local") {
    const methods = candidates.filter((candidate) => candidate.kind === "method");
    return methods.length > 0 ? methods : [...candidates];
  }
  return [...candidates];
}

function rubyCandidateKindMatches(
  reference: UnresolvedReferenceWriteModel,
  candidate: GraphNodeWriteModel
): boolean {
  const referenceKind = reference.reference_kind;
  if (referenceKind === "ruby_require" || referenceKind === "ruby_require_relative") {
    return candidate.kind === "module" && candidate.metadata.parser_version === "tree-sitter-ruby";
  }
  if (referenceKind === "ruby_inheritance" || referenceKind === "ruby_model_dsl") {
    const modelForm = reference.candidate_metadata.model_form;
    if (referenceKind === "ruby_inheritance") {
      return candidate.kind === "class";
    }
    return (modelForm === "belongs_to" || modelForm === "has_many" || modelForm === "has_one" ||
      modelForm === "has_and_belongs_to_many")
      && candidate.kind === "class";
  }
  if (referenceKind === "ruby_call") {
    return candidate.kind === "method" || candidate.kind === "singleton_method";
  }
  if (referenceKind === "ruby_route") {
    if (reference.candidate_metadata.route_form === "concerns") {
      return candidate.kind === "rails_route_concern";
    }
    if (reference.candidate_metadata.route_form === "draw") {
      return candidate.kind === "module" && candidate.metadata.parser_version === "tree-sitter-ruby";
    }
    if (reference.candidate_metadata.controller_action_candidate === true) {
      return candidate.kind === "method" || candidate.kind === "singleton_method";
    }
    return candidate.kind === "class";
  }
  if (referenceKind === "ruby_constant" || referenceKind === "ruby_include" ||
    referenceKind === "ruby_extend" || referenceKind === "ruby_prepend") {
    return (candidate.kind === "constant" || candidate.kind === "class" || candidate.kind === "module") &&
      typeof candidate.metadata.declaration_kind === "string";
  }
  return false;
}

function goNodeMatchesImportPath(node: GraphNodeWriteModel, importPath: string): boolean {
  const normalizedImport = importPath.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
  const normalizedFile = node.file_path.replaceAll("\\", "/");
  const directory = normalizedFile.includes("/")
    ? normalizedFile.slice(0, normalizedFile.lastIndexOf("/"))
    : ".";
  return normalizedImport.endsWith(`/${directory}`) || normalizedImport === directory;
}
