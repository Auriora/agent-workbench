/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { GraphStore } from "../infrastructure/sqlite/index.js";

export type SemanticValue = null | boolean | number | string | SemanticValue[] | { [key: string]: SemanticValue };
export type RefreshSemanticSection = "snapshot" | "repositories" | "files" | "nodes" | "node_fts" | "edges" |
  "unresolved" | "docs" | "doc_headings" | "docs_fts" | "coverage" | "counters" |
  "concern_state" | "concerns" | "concern_terms" | "concern_owners";
export type RefreshSemanticRecord = {
  section: RefreshSemanticSection;
  key: string;
  /** Relative source paths implicated by this exact record, including edge targets. */
  paths: string[];
  value: { [key: string]: SemanticValue };
};
export type RefreshSemanticEvidence = {
  schema_version: 1;
  records: RefreshSemanticRecord[];
  counts: Partial<Record<RefreshSemanticSection, number>>;
};
export type RefreshExpectedCorrection = {
  reason: "qt-format" | "unique-counters" | "store-identity" | "progress-contract";
  section: RefreshSemanticSection;
  key: string;
  before: RefreshSemanticRecord | null;
  after: RefreshSemanticRecord | null;
};
/** Construct and freeze independently from the candidate runtime's output. */
export type RefreshExpectedCorrections = {
  schema_version: 1;
  source_manifest_sha256: string;
  positive_qt_paths: string[];
  /** Exact, independently declared T004 storage transition; never an ignore-schema flag. */
  store_identity?: { before: 3; after: 4 };
  /** Exact completed-progress v4 fields; no arbitrary cursor normalization. */
  progress_contract?: { before: "unversioned"; after: 2; completed_ordinal_cursor: null };
  changes: RefreshExpectedCorrection[];
  unique_counters: Array<{
    section: "coverage" | "counters";
    key: string;
    expected_values: Record<string, number>;
  }>;
};
export type RefreshSemanticDifference = {
  section: RefreshSemanticSection | "manifest";
  key: string;
  kind: "added" | "removed" | "changed" | "expected_change_not_applied" | "invalid_manifest";
  changed_fields: string[];
};
export type RefreshSemanticComparison = {
  state: "equal" | "corrected" | "mismatch";
  differences: RefreshSemanticDifference[];
  total_differences: number;
  truncated: boolean;
  applied_corrections: number;
};

export class RefreshSemanticCaptureError extends Error {
  constructor(public readonly code: string) {
    super(`Cannot capture complete refresh semantic evidence: ${code}`);
    this.name = "RefreshSemanticCaptureError";
  }
}

type Row = Record<string, unknown>;
const nodeReferenceFields = new Set(["node_id", "source_node_id", "target_node_id", "parent_node_id"]);
const nodeReferenceArrays = new Set(["node_ids", "source_node_ids", "target_node_ids", "parent_node_ids", "candidate_node_ids"]);
const counterFields = new Set([
  "eligible_files", "scanned_files", "admitted_files", "extracted_files", "unsupported_files",
  "resource_backed_files", "nodes", "edges", "unresolved_references", "indexed_files", "eligible_files_seen",
  "counters_version"
]);

/** A read-only SQLite transaction captures one internally consistent selected snapshot. */
export function captureRefreshSemanticEvidence(store: Pick<GraphStore, "db">, snapshotId: string): RefreshSemanticEvidence {
  if (!/^[1-9]\d*$/.test(snapshotId) || !Number.isSafeInteger(Number(snapshotId))) {
    throw new RefreshSemanticCaptureError("invalid_snapshot_identity");
  }
  return store.db.transaction(() => captureInTransaction(store, Number(snapshotId))).deferred();
}

function captureInTransaction(store: Pick<GraphStore, "db">, snapshotId: number): RefreshSemanticEvidence {
  const rows = (sql: string): Row[] => store.db.prepare(sql).all(snapshotId) as Row[];
  const snapshot = rows("SELECT * FROM snapshots WHERE id=?")[0];
  if (!snapshot || snapshot.publication_state !== "published") throw new RefreshSemanticCaptureError("snapshot_not_published");
  const records: RefreshSemanticRecord[] = [];
  const add = (section: RefreshSemanticSection, key: string, paths: string[], value: Row): void => {
    records.push({ section, key, paths: [...new Set(paths)].sort(), value: jsonObject(value) });
  };
  // Epoch/owner IDs and wall-clock observation timestamps are protocol bookkeeping,
  // not semantic graph output. Semantic freshness/configuration/composition remain.
  add("snapshot", "selected", [], omit(snapshot, ["id", "repo_identity", "created_at", "publication_updated_at", "controller_generation", "invalidation_generation"]));
  const repositories = rows("SELECT * FROM snapshot_repository_units WHERE snapshot_id=?");
  for (const unit of repositories) add("repositories", tuple([unit.repository_key, unit.receipt_group]), pathList(unit.path_prefix), omit(unit, ["snapshot_id"]));
  const owner = (path: string): string => {
    const units = repositories.filter(unit => unit.receipt_group === "repository" &&
      (unit.path_prefix === "." || unit.path_prefix === "" || path === unit.path_prefix || path.startsWith(`${unit.path_prefix}/`)))
      .sort((a, b) => String(b.path_prefix).length - String(a.path_prefix).length);
    return units.length ? String(units[0].repository_key) : "superproject";
  };
  const files = rows("SELECT * FROM files WHERE snapshot_id=?");
  const filePaths = new Map(files.map(file => [String(file.id), relativePath(file.path)]));
  const filePath = (id: unknown): string => {
    const result = filePaths.get(String(id));
    if (result === undefined) throw new RefreshSemanticCaptureError("dangling_file_identity");
    return result;
  };
  for (const file of files) {
    const path = filePath(file.id);
    add("files", tuple([owner(path), path]), [path], { ...omit(file, ["id", "snapshot_id", "indexed_at"]), repository_key: owner(path) });
  }
  const nodes = rows("SELECT nodes.* FROM nodes JOIN files ON files.id=nodes.file_id WHERE files.snapshot_id=?");
  const nodeKeys = new Map<string, string>();
  const nodePaths = new Map<string, string>();
  const uniqueNodeKeys = new Set<string>();
  for (const node of nodes) {
    const path = filePath(node.file_id);
    const key = tuple([owner(path), path, node.kind, node.name, node.qualified_name, node.language,
      node.start_line, node.start_column, node.end_line, node.end_column]);
    if (uniqueNodeKeys.has(key)) throw new RefreshSemanticCaptureError("ambiguous_node_semantic_identity");
    uniqueNodeKeys.add(key);
    nodeKeys.set(String(node.id), key);
    nodePaths.set(String(node.id), path);
  }
  const nodeKey = (id: unknown): string | null => {
    if (id === null) return null;
    const key = nodeKeys.get(String(id));
    if (key === undefined) throw new RefreshSemanticCaptureError("dangling_node_identity");
    return key;
  };
  const metadata = (value: unknown, field?: string): SemanticValue => {
    if (field && nodeReferenceFields.has(field)) return nodeKey(value);
    if (field && nodeReferenceArrays.has(field)) {
      if (!Array.isArray(value)) throw new RefreshSemanticCaptureError("invalid_node_reference_array");
      return value.map(nodeKey);
    }
    // Free-form metadata snapshot_id/file_id values may be source literals.
    // Normalize actual relational storage columns above, never these numeric values.
    if (field?.endsWith("_id") && typeof value === "string" && nodeKeys.has(value)) {
      throw new RefreshSemanticCaptureError("unsupported_metadata_identity_field");
    }
    if (Array.isArray(value)) return value.map(item => metadata(item));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, metadata(item, key)]));
    }
    // Never rewrite arbitrary string content merely because it contains a generated ID.
    return jsonValue(value);
  };
  const parsed = (row: Row): Row => Object.fromEntries(Object.entries(row).map(([field, value]) => {
    if (field.endsWith("_json")) {
      if (value === null) return [field, null];
      if (typeof value !== "string") throw new RefreshSemanticCaptureError("invalid_json_storage");
      let decoded: unknown;
      try { decoded = JSON.parse(value); }
      catch { throw new RefreshSemanticCaptureError("invalid_json_storage"); }
      return [field, metadata(decoded)];
    }
    return [field, value];
  }));
  for (const node of nodes) {
    add("nodes", nodeKey(node.id)!, [filePath(node.file_id)], {
      ...parsed(omit(node, ["id", "file_id"])), path: filePath(node.file_id), repository_key: owner(filePath(node.file_id))
    });
  }
  const nodeSearchRows = rows(`SELECT node_fts.node_id,node_fts.name,node_fts.qualified_name,node_fts.signature,node_fts.docstring
    FROM node_fts INNER JOIN nodes ON nodes.id=node_fts.node_id
    INNER JOIN files ON files.id=nodes.file_id WHERE files.snapshot_id=?`)
    .map(row => ({ key: nodeKey(row.node_id)!, path: nodePaths.get(String(row.node_id))!,
      value: { ...omit(row, ["node_id"]), node_key: nodeKey(row.node_id) } }))
    .sort((a, b) => a.key.localeCompare(b.key) || canonical(a.value).localeCompare(canonical(b.value)));
  const nodeSearchOrdinals = new Map<string, number>();
  for (const row of nodeSearchRows) {
    const ordinal = nodeSearchOrdinals.get(row.key) ?? 0;
    nodeSearchOrdinals.set(row.key, ordinal + 1);
    add("node_fts", `${row.key}#${ordinal}`, [row.path], row.value);
  }
  const referenceRows = (section: "edges" | "unresolved", table: string): void => {
    const pending = rows(`SELECT ${table}.* FROM ${table} JOIN files ON files.id=${table}.file_id WHERE files.snapshot_id=?`)
      .map(row => {
        const path = filePath(row.file_id);
        const sourceKey = nodeKey(row.source_node_id);
        const targetKey = section === "edges" ? nodeKey(row.target_node_id) : undefined;
        const value = {
          ...parsed(omit(row, ["id", "file_id", "source_node_id", "target_node_id"])),
          path, repository_key: owner(path), source_node_key: sourceKey,
          ...(section === "edges" ? { target_node_key: targetKey } : {})
        };
        const paths = [path];
        for (const id of [row.source_node_id, row.target_node_id]) {
          if (id !== undefined && id !== null) paths.push(nodePaths.get(String(id))!);
        }
        const base = tuple([path, sourceKey, targetKey ?? null, row.kind ?? row.reference_kind,
          row.reference_name ?? null, row.start_line, row.start_column, row.end_line, row.end_column]);
        return { base, paths, value };
      }).sort((a, b) => a.base.localeCompare(b.base) || canonical(a.value).localeCompare(canonical(b.value)));
    const ordinals = new Map<string, number>();
    for (const row of pending) {
      const ordinal = ordinals.get(row.base) ?? 0;
      ordinals.set(row.base, ordinal + 1);
      add(section, `${row.base}#${ordinal}`, row.paths, row.value);
    }
  };
  referenceRows("edges", "edges");
  referenceRows("unresolved", "unresolved_refs");
  for (const row of rows("SELECT * FROM docs_documents WHERE snapshot_id=?")) {
    const path = relativePath(row.path);
    add("docs", path, [path], omit(row, ["id", "snapshot_id", "indexed_at"]));
  }
  for (const row of rows("SELECT docs_headings.*,docs_documents.path FROM docs_headings JOIN docs_documents ON docs_documents.id=docs_headings.document_id WHERE docs_documents.snapshot_id=?")) {
    const path = relativePath(row.path);
    add("doc_headings", tuple([path, row.heading_id]), [path], omit(row, ["id", "document_id"]));
  }
  for (const row of rows("SELECT docs_fts.path,docs_fts.title,docs_fts.headings_text,docs_fts.selected_text FROM docs_fts JOIN docs_documents ON docs_documents.id=docs_fts.rowid WHERE docs_documents.snapshot_id=?")) {
    add("docs_fts", relativePath(row.path), [relativePath(row.path)], row);
  }
  for (const row of rows("SELECT * FROM snapshot_index_coverage WHERE snapshot_id=?")) {
    add("coverage", String(row.evidence_class), [], parsed(omit(row, ["id", "snapshot_id"])));
  }
  for (const row of rows("SELECT * FROM graph_build_progress WHERE snapshot_id=?")) {
    add("counters", "selected", [], omit(row, ["snapshot_id", "source_snapshot_id", "owner_id", "completion_target_id",
      "generation_source_hash", "controller_generation", "invalidation_generation", "updated_at", "manifest_id"]));
  }
  const concernTables = [
    ["concern_state", "documentation_concern_index_state", []],
    ["concerns", "documentation_concerns", ["concern_key"]],
    ["concern_terms", "documentation_concern_terms", ["concern_key", "normalized_term"]],
    ["concern_owners", "documentation_concern_owners", ["concern_key", "mapped_owner_path"]]
  ] as const;
  for (const [section, table, keys] of concernTables) {
    for (const row of rows(`SELECT * FROM ${table} WHERE snapshot_id=?`)) {
      add(section, keys.length ? tuple(keys.map(key => row[key])) : "selected", pathList(row.mapped_owner_path ?? row.source_path), omit(row, ["snapshot_id"]));
    }
  }
  records.sort((a, b) => a.section.localeCompare(b.section) || a.key.localeCompare(b.key));
  const counts: RefreshSemanticEvidence["counts"] = {};
  for (const record of records) counts[record.section] = (counts[record.section] ?? 0) + 1;
  const evidence = { schema_version: 1 as const, records, counts };
  indexEvidence(evidence);
  return evidence;
}

export function compareRefreshSemanticEvidence(input: {
  baseline: RefreshSemanticEvidence;
  candidate: RefreshSemanticEvidence;
  expectedCorrections?: RefreshExpectedCorrections;
  /** Independently verified current source/fixture receipt; a DB cannot prove this hash. */
  source_manifest_sha256?: string;
  max_differences?: number;
}): RefreshSemanticComparison {
  const max = input.max_differences ?? 20;
  if (!Number.isSafeInteger(max) || max < 1 || max > 1000) throw new TypeError("max_differences must be an integer from 1 to 1000.");
  const baseline = indexEvidence(input.baseline);
  const candidate = indexEvidence(input.candidate);
  const differences: RefreshSemanticDifference[] = [];
  let applied = 0;
  const corrections = new Map<string, RefreshExpectedCorrection>();
  const manifest = input.expectedCorrections;
  if (manifest) {
    if (manifest.schema_version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.source_manifest_sha256)) {
      return invalidManifest("source_manifest_identity");
    }
    if (!input.source_manifest_sha256 || input.source_manifest_sha256 !== manifest.source_manifest_sha256) {
      return invalidManifest("source_manifest_mismatch");
    }
    const positivePaths = manifest.positive_qt_paths.map(relativePath);
    if (new Set(positivePaths).size !== positivePaths.length) return invalidManifest("duplicate_positive_qt_path");
    const oracleKeys = new Set<string>();
    for (const oracle of manifest.unique_counters) {
      const id = recordId(oracle.section, oracle.key);
      const actual = candidate.get(id);
      const entries = Object.entries(oracle.expected_values);
      if (oracleKeys.has(id) || !actual || !entries.length ||
          !["coverage", "counters"].includes(oracle.section) || entries.some(([field, value]) =>
            !counterFields.has(field) || !Number.isSafeInteger(value) || value < 0 || actual.value[field] !== value)) {
        return invalidManifest("counter_oracle_mismatch");
      }
      oracleKeys.add(id);
    }
    for (const change of manifest.changes) {
      const id = recordId(change.section, change.key);
      if (corrections.has(id) || !validCorrection(change, manifest)) return invalidManifest(id);
      corrections.set(id, change);
    }
    if (manifest.store_identity && !manifest.changes.some(change => change.reason === "store-identity")) {
      return invalidManifest("unused_store_identity_declaration");
    }
    if (manifest.progress_contract && !manifest.changes.some(change => change.reason === "progress-contract")) {
      return invalidManifest("unused_progress_contract_declaration");
    }
  }
  for (const id of [...new Set([...baseline.keys(), ...candidate.keys(), ...corrections.keys()])].sort()) {
    const before = baseline.get(id) ?? null;
    const after = candidate.get(id) ?? null;
    const expected = corrections.get(id);
    if (expected) {
      if (canonical(before) === canonical(expected.before) && canonical(after) === canonical(expected.after)) {
        applied += 1;
        continue;
      }
      differences.push({ section: expected.section, key: expected.key, kind: "expected_change_not_applied", changed_fields: changedFields(before, after) });
    } else if (canonical(before) !== canonical(after)) {
      const record = before ?? after!;
      differences.push({ section: record.section, key: record.key,
        kind: before === null ? "added" : after === null ? "removed" : "changed", changed_fields: changedFields(before, after) });
    }
  }
  return { state: differences.length ? "mismatch" : applied ? "corrected" : "equal",
    differences: differences.slice(0, max), total_differences: differences.length,
    truncated: differences.length > max, applied_corrections: applied };
}

function validCorrection(change: RefreshExpectedCorrection, manifest: RefreshExpectedCorrections): boolean {
  if (change.before === null && change.after === null || canonical(change.before) === canonical(change.after)) return false;
  for (const record of [change.before, change.after]) {
    if (record && (record.section !== change.section || record.key !== change.key)) return false;
  }
  if (change.reason === "store-identity") {
    const declared = manifest.store_identity;
    return change.section === "snapshot" && change.key === "selected" &&
      !!change.before && !!change.after && !!declared && declared.before === 3 && declared.after === 4 &&
      change.before.paths.length === 0 && change.after.paths.length === 0 &&
      change.before.value.schema_version === declared.before && change.after.value.schema_version === declared.after &&
      canonical(changedFields(change.before, change.after)) === canonical(["schema_version"]);
  }
  if (change.reason === "qt-format") {
    if (!["files", "nodes", "node_fts", "edges", "unresolved"].includes(change.section)) return false;
    const paths = [...(change.before?.paths ?? []), ...(change.after?.paths ?? [])];
    if (!paths.some(path => manifest.positive_qt_paths.includes(path))) return false;
    if (change.section === "files") {
      if (!change.before || !change.after) return false;
      const allowed = new Set(["language", "node_count", "indexing_error", "classification", "indexed", "skipped_reason"]);
      return changedFields(change.before, change.after).every(field => allowed.has(field)) &&
        change.before.value.language === "typescript" && change.after.value.language !== "typescript";
    }
    return true;
  }
  if (change.reason === "progress-contract") {
    const declared = manifest.progress_contract;
    const before = change.before?.value;
    const after = change.after?.value;
    if (change.section !== "counters" || change.key !== "selected" || !before || !after ||
        declared?.before !== "unversioned" || declared.after !== 2 || declared.completed_ordinal_cursor !== null ||
        Object.hasOwn(before, "counters_version") || Object.hasOwn(before, "ordinal_cursor") ||
        after.phase !== "complete" || after.status !== "completed" || after.scan_cursor !== null ||
        after.counters_version !== 2 || after.ordinal_cursor !== null) return false;
    const oracle = manifest.unique_counters.find(item => item.section === change.section && item.key === change.key);
    return changedFields(change.before, change.after).every(field => field === "ordinal_cursor" || field === "counters_version" ||
      (!!oracle && counterFields.has(field) && Number.isSafeInteger(oracle.expected_values[field]) &&
       oracle.expected_values[field] >= 0 && after[field] === oracle.expected_values[field]));
  }
  if (change.reason !== "unique-counters" || !["coverage", "counters"].includes(change.section) || !change.before || !change.after) return false;
  const fields = changedFields(change.before, change.after);
  const oracle = manifest.unique_counters.find(item => item.section === change.section && item.key === change.key);
  return !!oracle && fields.length > 0 && fields.every(field => counterFields.has(field) &&
    Number.isSafeInteger(oracle.expected_values[field]) && oracle.expected_values[field] >= 0 &&
    change.after!.value[field] === oracle.expected_values[field]);
}
function indexEvidence(evidence: RefreshSemanticEvidence): Map<string, RefreshSemanticRecord> {
  if (evidence.schema_version !== 1) throw new RefreshSemanticCaptureError("unsupported_evidence_schema");
  const result = new Map<string, RefreshSemanticRecord>();
  for (const record of evidence.records) {
    const id = recordId(record.section, record.key);
    if (result.has(id)) throw new RefreshSemanticCaptureError("duplicate_semantic_record_identity");
    canonical(record);
    result.set(id, record);
  }
  const observedCounts: RefreshSemanticEvidence["counts"] = {};
  for (const record of evidence.records) observedCounts[record.section] = (observedCounts[record.section] ?? 0) + 1;
  if (canonical(evidence.counts) !== canonical(observedCounts)) throw new RefreshSemanticCaptureError("inconsistent_record_counts");
  return result;
}
function changedFields(before: RefreshSemanticRecord | null, after: RefreshSemanticRecord | null): string[] {
  if (!before || !after) return ["$record"];
  const changed = [...new Set([...Object.keys(before.value), ...Object.keys(after.value)])]
    .filter(key => Object.hasOwn(before.value, key) !== Object.hasOwn(after.value, key) ||
      canonical(before.value[key]) !== canonical(after.value[key]));
  if (canonical(before.paths) !== canonical(after.paths)) changed.push("$paths");
  return changed.sort();
}
function invalidManifest(key: string): RefreshSemanticComparison {
  return { state: "mismatch", differences: [{ section: "manifest", key, kind: "invalid_manifest", changed_fields: [] }],
    total_differences: 1, truncated: false, applied_corrections: 0 };
}
function omit(row: Row, fields: string[]): Row { return Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key))); }
function recordId(section: string, key: string): string { return `${section}\0${key}`; }
function tuple(value: unknown[]): string { return canonical(value); }
function canonical(value: unknown): string { return JSON.stringify(jsonValue(value)); }
function jsonObject(value: Row): { [key: string]: SemanticValue } { return jsonValue(value) as { [key: string]: SemanticValue }; }
function jsonValue(value: unknown): SemanticValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, jsonValue(item)]));
  }
  throw new RefreshSemanticCaptureError("unsupported_semantic_value");
}
function relativePath(value: unknown): string {
  if (typeof value !== "string" || value.startsWith("/") || /^[A-Za-z]:/.test(value) || value.split("/").includes("..")) {
    throw new RefreshSemanticCaptureError("unsupported_relative_path");
  }
  return value;
}
function pathList(value: unknown): string[] { return typeof value === "string" && value !== "." && value !== "" ? [relativePath(value)] : []; }
