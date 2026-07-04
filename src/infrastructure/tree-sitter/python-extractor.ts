/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  ExtractionBatch,
  ExtractionRequest,
  GraphNodeWriteModel,
  UnresolvedReferenceWriteModel
} from "../../domain/models/index.js";
import type { ExtractorPort } from "../../ports/index.js";
import { PythonParserAdapter } from "./python-parser.js";

export class PythonTreeSitterExtractorAdapter implements ExtractorPort {
  public readonly language = "python";
  private readonly parser: PythonParserAdapter;

  constructor(input: { parser?: PythonParserAdapter } = {}) {
    this.parser = input.parser ?? new PythonParserAdapter();
  }

  public supports(input: { language: string; path: string }): boolean {
    return input.language === "python" && (input.path.endsWith(".py") || input.path.endsWith(".pyi"));
  }

  public async extract(input: ExtractionRequest): Promise<ExtractionBatch> {
    const extracted = this.parser.extractPython(input.content);
    const extractedAt = new Date(0).toISOString();
    const moduleNode: GraphNodeWriteModel = {
      id: nodeId(input.snapshot_id, input.path, "module", input.path),
      kind: "module",
      name: moduleName(input.path),
      qualified_name: moduleQualifiedName(input.path),
      file_path: input.path,
      language: "python",
      source_range: fullFileRange(input.content),
      metadata: {
        capability_level: "partial_semantic",
        evidence_kinds: ["parser"],
        parser: "tree-sitter-python"
      }
    };
    const nodes: GraphNodeWriteModel[] = [
      moduleNode,
      ...extracted.symbols.map((symbol) => ({
        id: nodeId(input.snapshot_id, input.path, symbol.kind, symbol.qualifiedName),
        kind: symbol.kind,
        name: symbol.name,
        qualified_name: symbol.qualifiedName,
        file_path: input.path,
        language: "python",
        source_range: {
          start_line: symbol.startLine,
          start_column: symbol.startColumn,
          end_line: symbol.endLine,
          end_column: symbol.endColumn
        },
        signature: symbol.signature,
        docstring: symbol.docstring,
        metadata: {
          capability_level: "partial_semantic",
          evidence_kinds: ["parser"],
          parser: "tree-sitter-python"
        }
      }))
    ];
    const nodeByQualifiedName = new Map(nodes.map((node) => [node.qualified_name ?? node.name, node]));
    const unresolvedReferences: UnresolvedReferenceWriteModel[] = extracted.references.map((reference, index) => {
      const sourceNode = reference.sourceQualifiedName
        ? nodeByQualifiedName.get(reference.sourceQualifiedName)
        : moduleNode;
      return {
        id: `${input.snapshot_id}:${input.path}:ref:${index}`,
        source_node_id: sourceNode?.id ?? moduleNode.id,
        source_file_path: input.path,
        reference_name: reference.name,
        reference_kind: reference.kind,
        source_range: {
          start_line: reference.startLine,
          start_column: reference.startColumn,
          end_line: reference.endLine,
          end_column: reference.endColumn
        },
        candidate_metadata: {
          source_qualified_name: reference.sourceQualifiedName
        }
      };
    });

    return {
      snapshot_id: input.snapshot_id,
      source_path: input.path,
      extractor_id: "tree-sitter-python",
      language: "python",
      file_identity: {
        path: input.path,
        language: "python",
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

function moduleName(filePath: string): string {
  const basename = filePath.slice(filePath.lastIndexOf("/") + 1);
  return basename.replace(/\.py$/u, "");
}

function moduleQualifiedName(filePath: string): string {
  return filePath.replace(/\.py$/u, "").replaceAll("/", ".");
}

function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}
