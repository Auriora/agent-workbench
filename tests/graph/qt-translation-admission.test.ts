/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import { ResourceExtractorAdapter, createProductionExtractorRegistry } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { JavaScriptTypeScriptTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { SystemClockAdapter } from "../../src/infrastructure/time/index.js";

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Qt translation graph admission", () => {
  it("invokes the canonical TS extractor only for genuine and inconclusive source and reports unsupported Qt coverage", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-qt-graph-"));
    roots.push(root);
    const repoRoot = path.join(root, "source");
    fs.mkdirSync(path.join(repoRoot, "translations"), { recursive: true });
    const positive = ["translations/standard.ts", "translations/prolog.ts"];
    const admitted = ["translations/module.ts", "translations/long-comment.ts", "beyond-bound.ts", "malformed.ts", "component.tsx"];
    const sources: Record<string, string> = {
      [positive[0]]: '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE TS>\n<TS version="2.1"/>\n',
      [positive[1]]: '\uFEFF \n<!DOCTYPE TS>\n<!-- prolog --><?qt stable?>\n<TS language="en"/>',
      [admitted[0]]: 'export function answer(): string { return \'<?xml version="1.0"?><TS/>\'; }\n',
      [admitted[1]]: '/*' + 'x'.repeat(16_400) + '*/\nexport const afterLongComment = 7;\n',
      [admitted[2]]: '<?xml version="1.0"?>' + ' '.repeat(16_384) + '<TS/>',
      [admitted[3]]: '<?xml version="1.0"?><TS attr="unterminated>',
      [admitted[4]]: 'export const Component = () => <div>TypeScript JSX</div>;\n'
    };
    for (const [file, source] of Object.entries(sources)) fs.writeFileSync(path.join(repoRoot, file), source);
    const store = openGraphStore(path.join(root, "graph.sqlite"));
    // Spy delegates to the real extractor and its canonical tree-sitter parser.
    const extract = vi.spyOn(JavaScriptTypeScriptTreeSitterExtractorAdapter.prototype, "extract");
    try {
      const scanner = new FileCatalogScannerAdapter();
      const scan = await scanner.scan({ repo_root: repoRoot, indexed_roots: ["."], skipped_roots: [], max_files: 20 });
      for (const file of positive) {
        expect(scan.files.find(entry => entry.path === file)).toMatchObject({
          file_identity: { language: "xml" }, adapter_evidence: { capability_level: "unsupported" }
        });
      }
      const result = await indexRepositoryGraph({
        repo_root: repoRoot, scanner,
        workspace: new WorkspaceFileAdapter({ repoRoot }), extractors: createProductionExtractorRegistry(),
        resource_extractor: new ResourceExtractorAdapter(), graph: store, catalog: store,
        snapshots: store, clock: new SystemClockAdapter(), schema_version: SCHEMA_VERSION, snapshot_id: "101"
      });
      expect(extract.mock.calls.map(([request]) => request.path).sort()).toEqual([...admitted].sort());
      expect(extract).toHaveBeenCalledTimes(5);
      expect(result).toMatchObject({ scanned_files: 7, admitted_files: 7, extracted_files: 5, unsupported_files: 2 });
      expect(result.coverage.find(row => row.evidence_class === "graph")).toMatchObject({
        state: "complete", indexed_files: 5, admitted_files: 7, extracted_files: 5
      });
      for (const file of positive) {
        expect(await store.getFile({ snapshot_id: "101", path: file })).toMatchObject({
          file_identity: { language: "xml" }, indexed: false, skipped_reason: "unsupported"
        });
      }
      for (const file of admitted) {
        expect(await store.getFile({ snapshot_id: "101", path: file })).toMatchObject({
          file_identity: { language: "typescript" }, indexed: true
        });
      }
      const declarations = store.db.prepare("SELECT files.path,nodes.name FROM nodes JOIN files ON files.id=nodes.file_id WHERE files.snapshot_id=101")
        .all() as Array<{ path: string; name: string }>;
      expect(declarations.some(node => positive.includes(node.path))).toBe(false);
      expect(declarations).toEqual(expect.arrayContaining([
        { path: admitted[0], name: "answer" }, { path: admitted[1], name: "afterLongComment" },
        { path: admitted[4], name: "Component" }
      ]));
    } finally { store.close(); }
  });
});
