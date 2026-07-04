/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type { ExtractionRequest, GraphNodeWriteModel } from "../../domain/models/index.js";
import { nodeId } from "./resource-shared.js";

export function cmakeTargetNodes(input: ExtractionRequest): GraphNodeWriteModel[] {
  if (path.basename(input.path) !== "CMakeLists.txt") {
    return [];
  }

  const nodes: GraphNodeWriteModel[] = [];
  const lines = input.content.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    const match = /^\s*add_(library|executable)\s*\(\s*([A-Za-z_][A-Za-z0-9_.:-]*)\b([^)]*)\)/u.exec(line);
    if (!match) {
      continue;
    }
    const targetKind = match[1] === "library" ? "cmake_library" : "cmake_executable";
    const targetName = match[2] ?? "";
    nodes.push({
      id: nodeId(input.snapshot_id, input.path, targetKind, targetName),
      kind: targetKind,
      name: targetName,
      qualified_name: `${input.path}:${targetName}`,
      file_path: input.path,
      language: input.language,
      source_range: {
        start_line: index + 1,
        start_column: line.indexOf("add_"),
        end_line: index + 1,
        end_column: line.length
      },
      signature: line.trim(),
      metadata: {
        domain: "build",
        capability_level: "resource_backed",
        evidence_kinds: ["config"],
        provenance: "cmake_target_scan",
        semantic_scope: "target_declarations_only",
        sources: sourceList(match[3] ?? "")
      }
    });
  }
  return nodes;
}

function sourceList(value: string): string[] {
  return value
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0 && !part.startsWith("$<"));
}
