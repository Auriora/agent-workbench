/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel,
  SourceRange,
  UnresolvedReferenceWriteModel
} from "../../domain/models/index.js";
import type { ExtractorPort } from "../../ports/index.js";
import { RubyParserAdapter } from "./ruby-parser.js";

export class RubyTreeSitterExtractorAdapter implements ExtractorPort {
  public readonly language = "ruby";
  private readonly parser: RubyParserAdapter;

  constructor(input: { parser?: RubyParserAdapter } = {}) {
    this.parser = input.parser ?? new RubyParserAdapter();
  }

  public supports(input: { language: string; path: string }): boolean {
    return input.language === "ruby" && input.path.endsWith(".rb");
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const extractedAt = new Date(0).toISOString();
    const extracted = this.parser.extractRuby(input.content, input.path);
    const moduleNode = moduleGraphNode(input);
    const nodes = [moduleNode, ...extracted.declarations.map((declaration) => toNode(input, declaration))];
    const nodeByQualifiedName = new Map(nodes.map((node) => [node.qualified_name ?? node.name, node]));
    const unresolvedReferences = extracted.references.map((reference, index) => toUnresolvedReference({
      input,
      reference,
      index,
      moduleNode,
      nodeByQualifiedName
    }));
    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "tree-sitter-ruby",
      language: "ruby",
      file_identity: {
        path: input.path,
        language: "ruby",
        content_hash: `content:${Buffer.byteLength(input.content, "utf8")}`,
        size_bytes: Buffer.byteLength(input.content, "utf8"),
        mtime_ms: 0,
        indexed_at: extractedAt
      },
      nodes,
      edges: [],
      unresolved_references: unresolvedReferences,
      diagnostics_hints: [],
      test_hints: [],
      extracted_at: extractedAt
    };
  }
}

function toNode(input: ExtractionRequest, declaration: ReturnType<RubyParserAdapter["extractRuby"]>["declarations"][number]): GraphNodeWriteModel {
  return {
    id: nodeId(input.snapshot_id, input.path, declaration.kind, declaration.qualifiedName),
    kind: declaration.kind,
    name: declaration.name,
    qualified_name: declaration.qualifiedName,
    file_path: input.path,
    language: "ruby",
    source_range: {
      start_line: declaration.startLine,
      start_column: declaration.startColumn,
      end_line: declaration.endLine,
      end_column: declaration.endColumn
    },
    signature: declaration.signature,
    metadata: {
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      parser: "tree-sitter-ruby",
      ...declaration.metadata
    }
  };
}

function toUnresolvedReference(input: {
  input: ExtractionRequest;
  reference: ReturnType<RubyParserAdapter["extractRuby"]>["references"][number];
  index: number;
  moduleNode: GraphNodeWriteModel;
  nodeByQualifiedName: Map<string | undefined, GraphNodeWriteModel>;
}): UnresolvedReferenceWriteModel {
  const sourceNode = input.reference.sourceQualifiedName === undefined
    ? input.moduleNode
    : input.nodeByQualifiedName.get(input.reference.sourceQualifiedName) ?? input.moduleNode;
  return {
    id: `${input.input.snapshot_id}:${input.input.path}:ruby-ref:${input.index}`,
    source_node_id: sourceNode.id,
    source_file_path: input.input.path,
    reference_name: input.reference.name,
    reference_kind: input.reference.kind,
    source_range: sourceRangeFrom(input.reference),
    candidate_metadata: {
      ...input.reference.metadata,
      provenance: "tree-sitter-ruby",
      confidence: input.reference.static ? 0.75 : 0.2,
      static: input.reference.static,
      source_qualified_name: input.reference.sourceQualifiedName
    }
  };
}

function moduleGraphNode(input: ExtractionRequest): GraphNodeWriteModel {
  return {
    id: nodeId(input.snapshot_id, input.path, "module", input.path),
    kind: "module",
    name: moduleName(input.path),
    qualified_name: moduleQualifiedName(input.path),
    file_path: input.path,
    language: "ruby",
    source_range: fullFileRange(input.content),
    metadata: {
      capability_level: "partial_semantic",
      evidence_kinds: ["parser"],
      parser: "tree-sitter-ruby",
      parser_version: "tree-sitter-ruby"
    }
  };
}

function sourceRangeFrom(reference: { startLine: number; startColumn: number; endLine: number; endColumn: number }): SourceRange {
  return {
    start_line: reference.startLine,
    start_column: reference.startColumn,
    end_line: reference.endLine,
    end_column: reference.endColumn
  };
}

function fullFileRange(content: string): SourceRange {
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

function moduleName(filePath: string): string {
  const basename = filePath.slice(filePath.lastIndexOf("/") + 1);
  return basename.replace(/\.rb$/u, "");
}

function moduleQualifiedName(filePath: string): string {
  return filePath.replace(/\.rb$/u, "").replaceAll("/", ".");
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}
