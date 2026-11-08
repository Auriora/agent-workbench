/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { GraphNodeWriteModel } from "../../domain/models/index.js";

type Entry = { node: GraphNodeWriteModel; ordinal: number };
type Buckets = Map<string, Entry[]>;

/** Invocation-owned lookup tables over the exact authoritative node universe. */
export class ReferenceCandidateIndex {
  private readonly names: Buckets = new Map();
  private readonly files: Buckets = new Map();
  private readonly ids = new Map<string, GraphNodeWriteModel>();
  private readonly rubyQualified: Buckets = new Map();
  private readonly rubyModulePaths: Buckets = new Map();
  private readonly rubyClassNames: Buckets = new Map();
  private readonly rubyClassQualified: Buckets = new Map();
  private readonly rubyClassQualifiedSuffixes: Buckets = new Map();
  private readonly rubyConcerns: Buckets = new Map();
  private readonly rubyDrawFiles: Buckets = new Map();
  private readonly actions = new Map<string, Buckets>();

  constructor(nodes: readonly GraphNodeWriteModel[]) {
    for (const [ordinal, node] of nodes.entries()) {
      const entry = { node, ordinal };
      add(this.names, node.name.toLowerCase(), entry);
      add(this.files, node.file_path, entry);
      // Array.find, used for deferred Lambda sources, selects the first ID.
      if (!this.ids.has(node.id)) this.ids.set(node.id, node);
      if (node.kind === "method" || node.kind === "singleton_method") {
        const qualified = node.qualified_name ?? "";
        const hash = qualified.lastIndexOf("#");
        const parent = (hash >= 0 ? qualified.slice(0, hash) : qualified.slice(0, Math.max(0, qualified.lastIndexOf(".")))).toLowerCase();
        const scopes = new Set([parent]);
        for (let index = parent.indexOf("."); index >= 0; index = parent.indexOf(".", index + 1)) scopes.add(parent.slice(0, index));
        const byScope = this.actions.get(node.name.toLowerCase()) ?? new Map<string, Entry[]>();
        this.actions.set(node.name.toLowerCase(), byScope);
        for (const scope of scopes) add(byScope, scope, entry);
      }
      if (node.language !== "ruby") continue;
      if (node.qualified_name !== undefined) add(this.rubyQualified, node.qualified_name.replaceAll("::", ".").toLowerCase(), entry);
      if (node.kind === "module") {
        // Preserve the old case-sensitive extension removal before folding case.
        const stem = node.file_path.replace(/\.rb$/u, "").toLowerCase();
        for (const suffix of suffixes(stem, "/", true)) add(this.rubyModulePaths, suffix, entry);
        if (node.metadata.parser_version === "tree-sitter-ruby") add(this.rubyDrawFiles, node.file_path.toLowerCase(), entry);
      }
      if (node.kind === "class") {
        add(this.rubyClassNames, node.name.toLowerCase(), entry);
        if (node.qualified_name !== undefined) {
          const qualified = node.qualified_name.toLowerCase();
          add(this.rubyClassQualified, qualified, entry);
          for (const suffix of suffixes(qualified, ".", false)) add(this.rubyClassQualifiedSuffixes, suffix, entry);
        }
      }
      if (node.kind === "rails_route_concern" && typeof node.metadata.route_concern_name === "string") {
        add(this.rubyConcerns, node.metadata.route_concern_name.toLowerCase(), entry);
      }
    }
  }

  named(name: string): GraphNodeWriteModel[] { return nodes(this.names.get(name.toLowerCase())); }
  nodeById(id: string): GraphNodeWriteModel | undefined { return this.ids.get(id); }
  atFiles(paths: readonly string[]): GraphNodeWriteModel[] { return ordered(paths.map(path => this.files.get(path))); }
  rubyAdditional(name: string, requirePath: boolean): GraphNodeWriteModel[] {
    return ordered([this.rubyQualified.get(name), ...(requirePath ? [this.rubyModulePaths.get(name)] : [])]);
  }
  rubyModelClasses(names: readonly string[]): GraphNodeWriteModel[] {
    return ordered(names.flatMap(name => [this.rubyClassNames.get(name), this.rubyClassQualifiedSuffixes.get(name)]));
  }
  rubyControllerClasses(expected: readonly string[]): GraphNodeWriteModel[] {
    return ordered(expected.flatMap(name => name.includes(".")
      ? [this.rubyClassQualified.get(name)]
      : [this.rubyClassNames.get(name), this.rubyClassQualified.get(name), this.rubyClassQualifiedSuffixes.get(name)]));
  }
  rubyConcern(name: string): GraphNodeWriteModel[] { return nodes(this.rubyConcerns.get(name)); }
  rubyDrawFile(path: string): GraphNodeWriteModel[] { return nodes(this.rubyDrawFiles.get(path)); }
  routeActions(action: string, controllerScopes: readonly string[]): GraphNodeWriteModel[] {
    const byScope = this.actions.get(action);
    return ordered(controllerScopes.map(scope => byScope?.get(scope)));
  }
}

function add(buckets: Buckets, key: string, entry: Entry): void {
  const bucket = buckets.get(key);
  if (bucket === undefined) buckets.set(key, [entry]);
  else bucket.push(entry);
}
function nodes(entries: readonly Entry[] | undefined): GraphNodeWriteModel[] { return entries?.map(entry => entry.node) ?? []; }
function ordered(buckets: readonly (readonly Entry[] | undefined)[]): GraphNodeWriteModel[] {
  // Merge predicate alternatives by occurrence, not node ID. The caller retains
  // the original ID deduplication rule where its semantic operation requires it.
  const matches = new Map<number, Entry>();
  for (const bucket of buckets) for (const entry of bucket ?? []) matches.set(entry.ordinal, entry);
  return [...matches.values()].sort((left, right) => left.ordinal - right.ordinal).map(entry => entry.node);
}
function suffixes(value: string, separator: string, includeFull: boolean): Set<string> {
  const result = new Set<string>(includeFull ? [value] : []);
  for (let index = value.indexOf(separator); index >= 0; index = value.indexOf(separator, index + 1)) result.add(value.slice(index + 1));
  return result;
}
