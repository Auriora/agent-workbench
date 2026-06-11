import path from "node:path";
import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel
} from "../../domain/models/index.js";
import { describeFileCapability } from "../../domain/policies/index.js";
import type { ExtractorPort } from "../../ports/index.js";
import { cloudFormationTemplateExtraction } from "./cloudformation-resource-extractor.js";
import { cmakeTargetNodes } from "./cmake-resource-extractor.js";
import { dotnetResourceNodes } from "./dotnet-resource-extractor.js";
import { fullFileRange, nodeId } from "./resource-shared.js";

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
    const cloudFormation = cloudFormationTemplateExtraction(input);
    const nodes: GraphNodeWriteModel[] = [
      genericResourceNode({ input, capability }),
      ...cmakeTargetNodes(input),
      ...dotnetResourceNodes(input),
      ...cloudFormation.nodes
    ];

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
      nodes,
      edges: cloudFormation.edges,
      unresolved_references: cloudFormation.unresolved_references,
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: extractedAt
    };
  }
}

function genericResourceNode(input: {
  input: ExtractionRequest;
  capability: ReturnType<typeof describeFileCapability>;
}): GraphNodeWriteModel {
  return {
    id: nodeId(input.input.snapshot_id, input.input.path, "resource", input.input.path),
    kind: "resource",
    name: path.basename(input.input.path),
    qualified_name: input.input.path,
    file_path: input.input.path,
    language: input.input.language,
    source_range: fullFileRange(input.input.content),
    metadata: {
      domain: input.capability.domain,
      capability_level: input.capability.capability_level,
      evidence_kinds: input.capability.evidence_kinds,
      provenance: input.capability.provenance
    }
  };
}
