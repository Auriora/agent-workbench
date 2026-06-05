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
    max_rows: input.row_limit
  });
  const languages = uniqueSorted(files.map((file) => file.file_identity.language));
  const fileRefs = files.map((file) => ({
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
      truncated: files.length >= input.row_limit,
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
    signature: input.node.signature,
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
