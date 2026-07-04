/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ExtractionRequest } from "../../domain/models/index.js";

export function nodeId(snapshotId: string, filePath: string, kind: string, name: string): string {
  return `${snapshotId}:${filePath}:${kind}:${name}`;
}

export function lineRange(line: string, lineNumber: number) {
  return {
    start_line: lineNumber,
    start_column: 0,
    end_line: lineNumber,
    end_column: line.length
  };
}

export function fullFileRange(content: string) {
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

export function lambdaHandlerTarget(handler: string): { file_paths: string[]; export_name: string } | undefined {
  const normalized = handler.trim().replaceAll("\\", "/");
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === normalized.length - 1) {
    return undefined;
  }
  const modulePath = normalized.slice(0, lastDot);
  const exportName = normalized.slice(lastDot + 1);
  if (!/^[A-Za-z0-9_./-]+$/u.test(modulePath) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(exportName)) {
    return undefined;
  }
  const candidateExtensions = [".py", ".ts", ".js", ".mjs", ".cjs"];
  const existingExtension = pathExtension(modulePath);
  return {
    file_paths: existingExtension.length > 0 ? [modulePath] : candidateExtensions.map((extension) => `${modulePath}${extension}`),
    export_name: exportName
  };
}

export function resourceNodeIdentity(input: ExtractionRequest): {
  id: string;
  qualified_name: string;
  file_path: string;
  language: string;
} {
  return {
    id: nodeId(input.snapshot_id, input.path, "resource", input.path),
    qualified_name: input.path,
    file_path: input.path,
    language: input.language
  };
}

export function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function pathExtension(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  const basename = slash >= 0 ? filePath.slice(slash + 1) : filePath;
  const dot = basename.lastIndexOf(".");
  return dot <= 0 ? "" : basename.slice(dot);
}
