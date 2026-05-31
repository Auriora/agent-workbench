import path from "node:path";
import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel
} from "../../domain/models/index.js";
import { describeFileCapability } from "../../domain/policies/index.js";
import type { ExtractorPort } from "../../ports/index.js";

const resourceLanguages = new Set(["config", "json", "toml", "yaml", "markdown", "text", "infrastructure"]);

export class ResourceExtractorAdapter implements ExtractorPort {
  public readonly language = "resource";

  public supports(input: { language: string; path: string }): boolean {
    const capability = describeFileCapability({
      path: input.path,
      language: input.language
    });
    return capability.capability_level === "resource_backed" || resourceLanguages.has(input.language);
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const capability = describeFileCapability({
      path: input.path,
      language: input.language
    });
    const extractedAt = new Date(0).toISOString();
    const node: GraphNodeWriteModel = {
      id: nodeId(input.snapshot_id, input.path, "resource", input.path),
      kind: "resource",
      name: path.basename(input.path),
      qualified_name: input.path,
      file_path: input.path,
      language: input.language,
      source_range: fullFileRange(input.content),
      metadata: {
        domain: capability.domain,
        capability_level: capability.capability_level,
        evidence_kinds: capability.evidence_kinds,
        provenance: capability.provenance
      }
    };

    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "resource-backed",
      language: input.language,
      file_identity: {
        path: input.path,
        language: input.language,
        content_hash: `content:${Buffer.byteLength(input.content, "utf8")}`,
        size_bytes: Buffer.byteLength(input.content, "utf8"),
        mtime_ms: 0,
        indexed_at: extractedAt
      },
      nodes: [node],
      edges: [],
      unresolved_references: [],
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: extractedAt
    };
  }
}

function fullFileRange(content: string) {
  const lines = content.split("\n");
  const endLine = Math.max(1, lines.length);
  const lastLine = lines[lines.length - 1] ?? "";
  return {
    start_line: 1,
    start_column: 0,
    end_line: endLine,
    end_column: lastLine.length
  };
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}
