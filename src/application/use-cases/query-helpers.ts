import type {
  CapabilityLevel,
  EvidenceKind,
  FileReference,
  ResponseMetadata,
  SourceSection,
  SymbolReference
} from "../../contracts/index.js";
import type { GraphNode } from "../../domain/models/index.js";
import type {
  FileCatalogPort,
  GraphQueryPort,
  SnapshotPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import {
  buildResponseMeta,
  invalidResponseMeta,
  strongestCapabilityLevel,
  uniqueSorted
} from "../../presentation/metadata.js";

export type ResolvedSnapshot = {
  snapshot_id: string;
  repo_root: string;
  meta: ResponseMetadata;
};

export async function resolveSnapshot(input: {
  repo_root: string;
  snapshot_id?: string;
  snapshots: SnapshotPort;
  catalog: FileCatalogPort;
  row_limit: number;
  traversal_depth?: number;
  source_byte_limit?: number;
}): Promise<ResolvedSnapshot | null> {
  const snapshot = await input.snapshots.getSnapshot({
    repo_root: input.repo_root,
    snapshot_id: input.snapshot_id
  });
  if (!snapshot) {
    return null;
  }

  const files = await input.catalog.listFiles({
    snapshot_id: snapshot.id,
    max_rows: input.row_limit + 1
  });
  const pageFiles = files.slice(0, input.row_limit);
  const languages = uniqueSorted(pageFiles.map((file) => file.file_identity.language));
  const fileRefs = pageFiles.map((file) => ({
    capability_level: file.adapter_evidence?.capability_level ?? capabilityForLanguage(file.file_identity.language),
    evidence_kinds: file.adapter_evidence?.evidence_kinds ?? evidenceForLanguage(file.file_identity.language)
  }));
  return {
    snapshot_id: snapshot.id,
    repo_root: snapshot.repo_root,
    meta: buildResponseMeta({
      analysis_validity: "valid",
      freshness: snapshot.freshness,
      scope: {
        repo_root: snapshot.repo_root,
        indexed_roots: ["."],
        skipped_roots: [],
        languages
      },
      capability_level: strongestCapabilityLevel(fileRefs.map((file) => file.capability_level)),
      files: fileRefs,
      verification_status: "needed",
      truncated: false,
      budget: {
        row_limit: input.row_limit,
        traversal_depth: input.traversal_depth,
        source_byte_limit: input.source_byte_limit
      }
    })
  };
}

export function blockedMeta(input: {
  repo_root: string;
  row_limit: number;
  traversal_depth?: number;
  source_byte_limit?: number;
}): ResponseMetadata {
  return invalidResponseMeta({
    repoRoot: input.repo_root,
    freshness: "cold",
    budget: {
      row_limit: input.row_limit,
      traversal_depth: input.traversal_depth,
      source_byte_limit: input.source_byte_limit
    }
  });
}

export async function toSymbolReference(input: {
  node: GraphNode;
  workspace?: WorkspaceFilePort;
  source_byte_limit: number;
}): Promise<SymbolReference> {
  const capabilityLevel = capabilityFromNode(input.node);
  const evidenceKinds = evidenceFromNode(input.node);
  return {
    node_id: input.node.id,
    kind: input.node.kind,
    name: input.node.name,
    qualified_name: input.node.qualified_name,
    path: input.node.file_path,
    language: input.node.language,
    source_range: input.node.source_range,
    signature: groupedLambdaSignature(input.node) ?? input.node.signature,
    docstring: input.node.docstring,
    capability_level: capabilityLevel,
    evidence_kinds: evidenceKinds,
    source_section:
      input.workspace && input.source_byte_limit > 0
        ? await sourceSection({
            workspace: input.workspace,
            path: input.node.file_path,
            start_line: input.node.source_range.start_line,
            end_line: input.node.source_range.end_line,
            byte_limit: input.source_byte_limit,
            caveat: capabilityLevel === "resource_backed" ? "Routing evidence only; not semantic source evidence." : undefined
          })
        : undefined
  };
}

export async function fileReferencesForNodes(input: {
  nodes: readonly GraphNode[];
  catalog: FileCatalogPort;
  snapshot_id: string;
}): Promise<FileReference[]> {
  const byPath = new Map<string, FileReference>();
  for (const node of input.nodes) {
    if (byPath.has(node.file_path)) {
      continue;
    }
    const entry = await input.catalog.getFile({
      snapshot_id: input.snapshot_id,
      path: node.file_path
    });
    byPath.set(node.file_path, {
      path: node.file_path,
      language: entry?.file_identity.language ?? node.language,
      exists: true,
      capability_level: entry?.adapter_evidence?.capability_level ?? capabilityFromNode(node),
      evidence_kinds: entry?.adapter_evidence?.evidence_kinds ?? evidenceFromNode(node),
      reason: "Affected through bounded graph traversal."
    });
  }
  return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

export function capabilityForLanguage(language: string): CapabilityLevel {
  if (language === "python") {
    return "partial_semantic";
  }
  if (["json", "toml", "yaml", "markdown", "text", "infrastructure"].includes(language)) {
    return "resource_backed";
  }
  return "unsupported";
}

function capabilityFromNode(node: GraphNode): CapabilityLevel {
  const value = node.metadata.capability_level;
  if (value === "semantic" || value === "partial_semantic" || value === "resource_backed" || value === "unsupported") {
    return value;
  }
  return capabilityForLanguage(node.language);
}

function groupedLambdaSignature(node: GraphNode): string | undefined {
  if (node.kind === "lambda_handler_binding") {
    const logicalId = stringMetadata(node, "logical_id");
    const handlerFile = stringMetadata(node, "handler_file_candidate");
    const base = `${logicalId ?? "Lambda handler"} -> ${node.name}`;
    const events = eventSourcesText(node);
    const suffix = events === undefined ? "" : `, events ${events}`;
    return handlerFile === undefined
      ? `${base} (template ${node.file_path}${suffix})`
      : `${base} (template ${node.file_path}, handler file ${handlerFile}${suffix})`;
  }
  if (node.kind === "lambda_handler_file") {
    const logicalId = stringMetadata(node, "logical_id");
    const exportName = stringMetadata(node, "handler_export_candidate");
    const templatePath = stringMetadata(node, "template_path") ?? lambdaTemplatePathFromQualifiedName(node.qualified_name);
    const target = exportName === undefined ? node.name : `${node.name}#${exportName}`;
    const events = eventSourcesText(node);
    const suffix = events === undefined ? "" : `, events ${events}`;
    return templatePath === undefined
      ? `${logicalId ?? "Lambda handler"} -> ${target}`
      : `${logicalId ?? "Lambda handler"} -> ${target} (template ${templatePath}${suffix})`;
  }
  return undefined;
}

function eventSourcesText(node: GraphNode): string | undefined {
  const value = node.metadata.event_sources;
  if (!Array.isArray(value)) {
    return undefined;
  }
  const events = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return events.length === 0 ? undefined : events.join(", ");
}

function stringMetadata(node: GraphNode, key: string): string | undefined {
  const value = node.metadata[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function lambdaTemplatePathFromQualifiedName(qualifiedName: string | undefined): string | undefined {
  if (qualifiedName === undefined) {
    return undefined;
  }
  const marker = ":file:";
  const markerIndex = qualifiedName.indexOf(marker);
  const prefix = markerIndex >= 0 ? qualifiedName.slice(0, markerIndex) : qualifiedName;
  const logicalSeparator = prefix.lastIndexOf(":");
  if (logicalSeparator <= 0) {
    return undefined;
  }
  return prefix.slice(0, logicalSeparator);
}

function evidenceFromNode(node: GraphNode): EvidenceKind[] {
  const value = node.metadata.evidence_kinds;
  if (Array.isArray(value)) {
    return value.filter((item): item is EvidenceKind =>
      item === "parser" ||
      item === "lsp" ||
      item === "compiler_api" ||
      item === "sqlite" ||
      item === "fts" ||
      item === "docs" ||
      item === "tests" ||
      item === "direct_read" ||
      item === "config" ||
      item === "infra_parser" ||
      item === "heuristic" ||
      item === "text_fallback" ||
      item === "executed_command"
    );
  }
  return evidenceForLanguage(node.language);
}

function evidenceForLanguage(language: string): EvidenceKind[] {
  if (language === "python") {
    return ["parser"];
  }
  if (language === "markdown" || language === "text") {
    return ["docs"];
  }
  if (["json", "toml", "yaml", "infrastructure"].includes(language)) {
    return ["config"];
  }
  return [];
}

async function sourceSection(input: {
  workspace: WorkspaceFilePort;
  path: string;
  start_line: number;
  end_line: number;
  byte_limit: number;
  caveat?: string;
}): Promise<SourceSection | undefined> {
  const text = await input.workspace.readText({ path: input.path });
  const lines = text.split(/\r?\n/u).slice(input.start_line - 1, input.end_line);
  const full = lines.join("\n");
  const buffer = Buffer.from(full, "utf8");
  const truncated = buffer.length > input.byte_limit;
  const clipped = truncated ? buffer.subarray(0, input.byte_limit).toString("utf8") : full;
  return {
    path: input.path,
    start_line: input.start_line,
    end_line: input.end_line,
    byte_count: Buffer.byteLength(clipped, "utf8"),
    truncated,
    text: clipped,
    caveat: input.caveat
  };
}
