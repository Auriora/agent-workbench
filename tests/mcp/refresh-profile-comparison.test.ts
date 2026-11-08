/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openGraphStore, SCHEMA_VERSION, type GraphStore } from "../../src/infrastructure/sqlite/index.js";
import {
  captureRefreshSemanticEvidence,
  compareRefreshSemanticEvidence,
  type RefreshExpectedCorrections,
  type RefreshSemanticEvidence,
  type RefreshSemanticRecord
} from "../../src/debug/refresh-profile-comparison.js";

const stores: GraphStore[] = [];
const roots: string[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function storedFixture(snapshotId: number, fileId: number, observedAt: string): GraphStore {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-semantic-comparison-"));
  roots.push(root);
  const store = openGraphStore(path.join(root, "graph.sqlite"));
  stores.push(store);
  store.db.prepare(`INSERT INTO snapshots(id,repo_identity,config_identity,freshness,schema_version,
    publication_state,controller_generation,invalidation_generation,created_at,publication_updated_at)
    VALUES(?, '/owned-fixture', 'default', 'fresh', ?, 'published', ?, ?, ?, ?)`)
    .run(snapshotId, SCHEMA_VERSION, snapshotId, snapshotId, observedAt, observedAt);
  store.db.prepare(`INSERT INTO files(id,snapshot_id,path,language,content_hash,size_bytes,mtime_ms,indexed_at,node_count)
    VALUES(?,?,'main.py','python','sha256:fixed',30,123,?,2)`).run(fileId, snapshotId, observedAt);
  const insertNode = store.db.prepare(`INSERT INTO nodes(id,file_id,kind,name,lower_name,qualified_name,language,
    start_line,start_column,end_line,end_column,signature,metadata_json)
    VALUES(?,?,'function',?,?,?,'python',?,0,?,10,?,?)`);
  insertNode.run(`${snapshotId}:main.py:caller`, fileId, "caller", "caller", "main.caller", 1, 2,
    "def caller():", JSON.stringify({ provenance: "fixture", literal: "123:source text", source_count: 123, snapshot_id: 123, file_id: 10 }));
  insertNode.run(`${snapshotId}:main.py:helper`, fileId, "helper", "helper", "main.helper", 4, 5,
    "def helper():", JSON.stringify({ source_node_id: `${snapshotId}:main.py:caller`, indexed_at: "user metadata remains literal" }));
  store.db.prepare(`INSERT INTO node_fts(node_id,name,qualified_name,signature,docstring)
    SELECT id,name,qualified_name,signature,docstring FROM nodes WHERE file_id=?`).run(fileId);
  store.db.prepare(`INSERT INTO edges(source_node_id,target_node_id,kind,file_id,start_line,start_column,end_line,end_column,provenance,confidence,metadata_json)
    VALUES(?,?,'calls',?,2,4,2,12,'fixture-resolution',0.8,'{"reference_name":"helper"}')`)
    .run(`${snapshotId}:main.py:caller`, `${snapshotId}:main.py:helper`, fileId);
  store.db.prepare(`INSERT INTO unresolved_refs(source_node_id,reference_name,reference_kind,file_id,start_line,start_column,end_line,end_column,candidate_metadata_json)
    VALUES(?,'unknown','calls',?,2,14,2,23,'{"resolution":"ambiguous","candidate_count":2}')`)
    .run(`${snapshotId}:main.py:caller`, fileId);
  store.db.prepare(`INSERT INTO docs_documents(id,snapshot_id,path,title,content_hash,byte_count,indexed_at)
    VALUES(?,?,'README.md','Fixture','sha256:docs',10,?)`).run(fileId + 100, snapshotId, observedAt);
  store.db.prepare(`INSERT INTO docs_headings(document_id,heading_id,heading_text,depth,line)
    VALUES(?,'fixture','Fixture',1,1)`).run(fileId + 100);
  store.db.prepare(`INSERT INTO docs_fts(rowid,path,title,headings_text,selected_text)
    VALUES(?,'README.md','Fixture','Fixture','Source text 123: must remain')`).run(fileId + 100);
  store.db.prepare(`INSERT INTO snapshot_index_coverage(snapshot_id,evidence_class,state,indexed_files,eligible_files_seen,admitted_files,extracted_files,scan_truncated)
    VALUES(?,'graph','complete',1,4,1,1,0)`).run(snapshotId);
  return store;
}
function evidence(records: RefreshSemanticRecord[]): RefreshSemanticEvidence {
  const counts: RefreshSemanticEvidence["counts"] = {};
  for (const record of records) counts[record.section] = (counts[record.section] ?? 0) + 1;
  return { schema_version: 1, records, counts };
}
function row(section: RefreshSemanticRecord["section"], key: string, paths: string[], value: RefreshSemanticRecord["value"]): RefreshSemanticRecord {
  return { section, key, paths, value };
}
function cloned<T>(value: T): T { return structuredClone(value); }

describe("refresh semantic evidence and frozen corrections", () => {
  it("captures inspectable graph/docs/coverage and normalizes only actual storage identities and observation timestamps", () => {
    const left = captureRefreshSemanticEvidence(storedFixture(123, 10, "2026-01-01T00:00:00Z"), "123");
    const right = captureRefreshSemanticEvidence(storedFixture(456, 20, "2026-02-01T00:00:00Z"), "456");
    expect(compareRefreshSemanticEvidence({ baseline: left, candidate: right }).state).toBe("equal");
    const caller = left.records.find(record => record.section === "nodes" && record.value.name === "caller")!;
    expect(caller.value.signature).toBe("def caller():");
    expect(caller.value.metadata_json).toMatchObject({ literal: "123:source text", source_count: 123, snapshot_id: 123, file_id: 10 });
    const helper = left.records.find(record => record.section === "nodes" && record.value.name === "helper")!;
    expect(helper.value.metadata_json).toMatchObject({ source_node_id: caller.key, indexed_at: "user metadata remains literal" });
    expect(left.counts.node_fts).toBe(2);
    expect(left.records.find(record => record.section === "node_fts" && record.value.name === "caller")?.value)
      .toMatchObject({ node_key: caller.key, name: "caller", qualified_name: "main.caller", signature: "def caller():", docstring: null });
    expect(left.counts.edges).toBe(1);
    expect(left.counts.unresolved).toBe(1);
    expect(left.counts.docs_fts).toBe(1);
    expect(left.counts.coverage).toBe(1);
    expect(left.records.find(record => record.section === "docs_fts")?.value.selected_text).toBe("Source text 123: must remain");
  });

  it.each(["confidence", "provenance", "ambiguity", "doc text", "source literal"])("rejects unlisted %s changes", change => {
    const baseline = captureRefreshSemanticEvidence(storedFixture(123, 10, "2026-01-01T00:00:00Z"), "123");
    const candidate = cloned(baseline);
    if (change === "confidence") candidate.records.find(record => record.section === "edges")!.value.confidence = 0.5;
    if (change === "provenance") candidate.records.find(record => record.section === "edges")!.value.provenance = "heuristic";
    if (change === "ambiguity") candidate.records.find(record => record.section === "unresolved")!.value.candidate_metadata_json = { resolution: "unresolved", candidate_count: 0 };
    if (change === "doc text") candidate.records.find(record => record.section === "docs_fts")!.value.selected_text = "changed";
    if (change === "source literal") candidate.records.find(record => record.section === "nodes" && record.value.name === "caller")!.value.metadata_json = { literal: "456:source text", source_count: 123 };
    const comparison = compareRefreshSemanticEvidence({ baseline, candidate });
    expect(comparison.state).toBe("mismatch");
    expect(comparison.total_differences).toBe(1);
  });

  it("accepts only enumerated Qt rows and independently expected unique-counter values", () => {
    const qt = "translations/standard.ts";
    const oldFile = row("files", "qt-file", [qt], { path: qt, language: "typescript", node_count: 1, size_bytes: 80 });
    const newFile = row("files", "qt-file", [qt], { path: qt, language: "text", node_count: 0, size_bytes: 80 });
    const falseModule = row("nodes", "qt-module", [qt], { path: qt, kind: "module", language: "typescript" });
    const falseModuleFts = row("node_fts", "qt-module-fts#0", [qt], { node_key: "qt-module", name: "standard", qualified_name: "standard", signature: null, docstring: null });
    const dependentEdge = row("edges", "dependent-edge", ["main.py", qt], { path: "main.py", kind: "imports", target_node_key: "qt-module", confidence: 0.8 });
    const oldCounter = row("coverage", "graph", [], { eligible_files_seen: 20, extracted_files: 2, state: "complete" });
    const newCounter = row("coverage", "graph", [], { eligible_files_seen: 2, extracted_files: 2, state: "complete" });
    const unchanged = row("files", "inconclusive-qt", ["translations/root-beyond-bound.ts"], { language: "typescript" });
    const baseline = evidence([oldFile, falseModule, falseModuleFts, dependentEdge, oldCounter, unchanged]);
    const candidate = evidence([newFile, newCounter, unchanged]);
    const expectedCorrections: RefreshExpectedCorrections = {
      schema_version: 1, source_manifest_sha256: "a".repeat(64), positive_qt_paths: [qt],
      unique_counters: [{ section: "coverage", key: "graph", expected_values: { eligible_files_seen: 2 } }],
      changes: [
        { reason: "qt-format", section: "files", key: oldFile.key, before: oldFile, after: newFile },
        { reason: "qt-format", section: "nodes", key: falseModule.key, before: falseModule, after: null },
        { reason: "qt-format", section: "node_fts", key: falseModuleFts.key, before: falseModuleFts, after: null },
        { reason: "qt-format", section: "edges", key: dependentEdge.key, before: dependentEdge, after: null },
        { reason: "unique-counters", section: "coverage", key: oldCounter.key, before: oldCounter, after: newCounter }
      ]
    };
    expect(compareRefreshSemanticEvidence({ baseline, candidate, expectedCorrections, source_manifest_sha256: "a".repeat(64) })).toMatchObject({ state: "corrected", applied_corrections: 5, total_differences: 0 });
    expect(compareRefreshSemanticEvidence({ baseline, candidate })).toMatchObject({ state: "mismatch", total_differences: 5 });
    const unrelated = cloned(candidate);
    unrelated.records.find(record => record.key === unchanged.key)!.value.language = "text";
    expect(compareRefreshSemanticEvidence({ baseline, candidate: unrelated, expectedCorrections, source_manifest_sha256: "a".repeat(64) })).toMatchObject({ state: "mismatch", applied_corrections: 5, total_differences: 1 });
    expect(compareRefreshSemanticEvidence({ baseline, candidate: baseline, expectedCorrections, source_manifest_sha256: "a".repeat(64) })).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest", key: "counter_oracle_mismatch" }] });
    expect(compareRefreshSemanticEvidence({ baseline, candidate, expectedCorrections })).toMatchObject({
      state: "mismatch", differences: [{ kind: "invalid_manifest", key: "source_manifest_mismatch" }] });
    expect(compareRefreshSemanticEvidence({ baseline, candidate, expectedCorrections, source_manifest_sha256: "b".repeat(64) })).toMatchObject({
      state: "mismatch", differences: [{ kind: "invalid_manifest", key: "source_manifest_mismatch" }] });
    const inventedCounter = cloned(expectedCorrections);
    inventedCounter.unique_counters[0].expected_values.extracted_files = 99;
    expect(compareRefreshSemanticEvidence({ baseline, candidate, expectedCorrections: inventedCounter, source_manifest_sha256: "a".repeat(64) })).toMatchObject({ state: "mismatch", differences: [{ section: "manifest", kind: "invalid_manifest" }] });
  });

  it("permits only the declared completed v4 progress shape and independent numeric counter oracle", () => {
    const before = row("counters", "selected", [], { phase: "complete", status: "completed", scan_cursor: null, eligible_files: 4 });
    const after = row("counters", "selected", [], { phase: "complete", status: "completed", scan_cursor: null, eligible_files: 2, counters_version: 2, ordinal_cursor: null });
    const manifest: RefreshExpectedCorrections = {
      schema_version: 1, source_manifest_sha256: "a".repeat(64), positive_qt_paths: [],
      progress_contract: { before: "unversioned", after: 2, completed_ordinal_cursor: null },
      unique_counters: [{ section: "counters", key: "selected", expected_values: { eligible_files: 2 } }],
      changes: [{ reason: "progress-contract", section: "counters", key: "selected", before, after }]
    };
    const input = { baseline: evidence([before]), candidate: evidence([after]), expectedCorrections: manifest, source_manifest_sha256: "a".repeat(64) };
    expect(compareRefreshSemanticEvidence(input)).toMatchObject({ state: "corrected", applied_corrections: 1, total_differences: 0 });
    for (const [field, value] of [["ordinal_cursor", 1], ["phase", "extracting"], ["unexpected", "literal"]] as const) {
      const invalid = cloned(input);
      invalid.candidate.records[0].value[field] = value;
      invalid.expectedCorrections.changes[0].after!.value[field] = value;
      expect(compareRefreshSemanticEvidence(invalid)).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest" }] });
    }
    const undeclared = cloned(input); delete undeclared.expectedCorrections.progress_contract;
    expect(compareRefreshSemanticEvidence(undeclared)).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest" }] });
  });

  it("permits only the independently declared exact selected-store identity 3-to-4 correction", () => {
    const before = row("snapshot", "selected", [], { schema_version: 3, freshness: "fresh", config_identity: "default" });
    const after = row("snapshot", "selected", [], { schema_version: 4, freshness: "fresh", config_identity: "default" });
    const manifest: RefreshExpectedCorrections = {
      schema_version: 1, source_manifest_sha256: "a".repeat(64), positive_qt_paths: [], unique_counters: [],
      store_identity: { before: 3, after: 4 },
      changes: [{ reason: "store-identity", section: "snapshot", key: "selected", before, after }]
    };
    const input = { baseline: evidence([before]), candidate: evidence([after]),
      expectedCorrections: manifest, source_manifest_sha256: "a".repeat(64) };
    expect(compareRefreshSemanticEvidence(input)).toMatchObject({ state: "corrected", applied_corrections: 1 });
    expect(compareRefreshSemanticEvidence({ baseline: input.baseline, candidate: input.candidate })).toMatchObject({ state: "mismatch" });
    expect(compareRefreshSemanticEvidence({ ...input, source_manifest_sha256: "b".repeat(64) })).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest" }] });
    const otherChange = cloned(input);
    otherChange.candidate.records[0].value.freshness = "stale";
    otherChange.expectedCorrections.changes[0].after!.value.freshness = "stale";
    expect(compareRefreshSemanticEvidence(otherChange)).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest" }] });
    const wrongTransition = cloned(input);
    wrongTransition.candidate.records[0].value.schema_version = 5;
    wrongTransition.expectedCorrections.changes[0].after!.value.schema_version = 5;
    expect(compareRefreshSemanticEvidence(wrongTransition)).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest" }] });
    const undeclared = cloned(input);
    delete undeclared.expectedCorrections.store_identity;
    expect(compareRefreshSemanticEvidence(undeclared)).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest" }] });
    const unused = cloned(input);
    unused.expectedCorrections.changes = [];
    expect(compareRefreshSemanticEvidence(unused)).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest", key: "unused_store_identity_declaration" }] });
  });

  it("does not treat a positive Qt path as permission to ignore other changed fields", () => {
    const qt = "standard.ts";
    const before = row("files", "qt-file", [qt], { language: "typescript", node_count: 1, size_bytes: 80 });
    const after = row("files", "qt-file", [qt], { language: "text", node_count: 0, size_bytes: 90 });
    const manifest: RefreshExpectedCorrections = { schema_version: 1, source_manifest_sha256: "a".repeat(64), positive_qt_paths: [qt], unique_counters: [],
      changes: [{ reason: "qt-format", section: "files", key: before.key, before, after }] };
    expect(compareRefreshSemanticEvidence({ baseline: evidence([before]), candidate: evidence([after]), expectedCorrections: manifest, source_manifest_sha256: "a".repeat(64) })).toMatchObject({ state: "mismatch", differences: [{ kind: "invalid_manifest" }] });
  });

  it("bounds difference display without accepting missing or unexpected rows", () => {
    const baseline = evidence([]);
    const candidate = evidence(Array.from({ length: 5 }, (_, index) => row("files", String(index), [`${index}.py`], { language: "python" })));
    expect(compareRefreshSemanticEvidence({ baseline, candidate, max_differences: 2 })).toMatchObject({ state: "mismatch", total_differences: 5, truncated: true, differences: [{ kind: "added" }, { kind: "added" }] });
  });

  it("rejects ambiguous semantic nodes and duplicate evidence records rather than merging them", () => {
    const store = storedFixture(123, 10, "2026-01-01T00:00:00Z");
    store.db.prepare(`INSERT INTO nodes SELECT 'other-storage-id',file_id,kind,name,lower_name,qualified_name,language,
      start_line,start_column,end_line,end_column,signature,docstring,visibility,metadata_json FROM nodes WHERE id='123:main.py:caller'`).run();
    expect(() => captureRefreshSemanticEvidence(store, "123")).toThrow("ambiguous_node_semantic_identity");
    const duplicate = row("files", "same", ["main.py"], { language: "python" });
    expect(() => compareRefreshSemanticEvidence({ baseline: evidence([duplicate, duplicate]), candidate: evidence([]) })).toThrow("duplicate_semantic_record_identity");
  });

  it("rejects unrecognized metadata identity fields and inconsistent record counts", () => {
    const store = storedFixture(123, 10, "2026-01-01T00:00:00Z");
    store.db.prepare("UPDATE nodes SET metadata_json=? WHERE id=?")
      .run('{"undocumented_id":"123:main.py:caller"}', "123:main.py:helper");
    expect(() => captureRefreshSemanticEvidence(store, "123")).toThrow("unsupported_metadata_identity_field");
    const invalid = evidence([row("files", "one", ["one.py"], { language: "python" })]);
    invalid.counts.files = 99;
    expect(() => compareRefreshSemanticEvidence({ baseline: invalid, candidate: invalid })).toThrow("inconsistent_record_counts");
  });

  it.each(["removed", "modified"])("rejects %s node search-index rows", change => {
    const store = storedFixture(123, 10, "2026-01-01T00:00:00Z");
    const baseline = captureRefreshSemanticEvidence(store, "123");
    if (change === "removed") store.db.prepare("DELETE FROM node_fts WHERE node_id=?").run("123:main.py:caller");
    else store.db.prepare("UPDATE node_fts SET name=?,qualified_name=?,signature=?,docstring=? WHERE node_id=?")
      .run("wrong name", "wrong.qualified", "wrong signature", "wrong docstring", "123:main.py:caller");
    const candidate = captureRefreshSemanticEvidence(store, "123");
    expect(compareRefreshSemanticEvidence({ baseline, candidate })).toMatchObject({
      state: "mismatch", total_differences: 1,
      differences: [{ section: "node_fts", kind: change === "removed" ? "removed" : "changed" }]
    });
  });

  it("preserves node search-index multiplicities instead of merging duplicate rows", () => {
    const store = storedFixture(123, 10, "2026-01-01T00:00:00Z");
    const baseline = captureRefreshSemanticEvidence(store, "123");
    store.db.prepare(`INSERT INTO node_fts(node_id,name,qualified_name,signature,docstring)
      SELECT node_id,name,qualified_name,signature,docstring FROM node_fts WHERE node_id=?`).run("123:main.py:caller");
    const candidate = captureRefreshSemanticEvidence(store, "123");
    expect(candidate.counts.node_fts).toBe(3);
    expect(compareRefreshSemanticEvidence({ baseline, candidate })).toMatchObject({
      state: "mismatch", total_differences: 1, differences: [{ section: "node_fts", kind: "added" }]
    });
  });

  it("preserves repeated equivalent edges as a multiset", () => {
    const store = storedFixture(123, 10, "2026-01-01T00:00:00Z");
    store.db.prepare(`INSERT INTO edges(source_node_id,target_node_id,kind,file_id,start_line,start_column,end_line,end_column,provenance,confidence,metadata_json)
      SELECT source_node_id,target_node_id,kind,file_id,start_line,start_column,end_line,end_column,provenance,confidence,metadata_json FROM edges`).run();
    const captured = captureRefreshSemanticEvidence(store, "123");
    expect(captured.records.filter(record => record.section === "edges")).toHaveLength(2);
    const after = evidence(captured.records.filter(record => record.section !== "edges" || record.key.endsWith("#0")));
    expect(compareRefreshSemanticEvidence({ baseline: captured, candidate: after })).toMatchObject({ state: "mismatch", total_differences: 1 });
  });
});
