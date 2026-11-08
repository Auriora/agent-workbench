/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { ReferenceCandidateIndex } from "../../src/application/use-cases/reference-candidate-index.js";
import type { GraphNodeWriteModel } from "../../src/domain/models/index.js";

const node = (id: string, extra: Partial<GraphNodeWriteModel> = {}): GraphNodeWriteModel => ({
  id, name: id, language: "ruby", kind: "class", file_path: `app/${id}.rb`,
  qualified_name: id, metadata: { parser_version: "tree-sitter-ruby" },
  source_range: { start_line: 1, start_column: 0, end_line: 1, end_column: 1 }, ...extra
});

describe("reference candidate index", () => {
  it("retains original occurrence order, duplicate IDs and exact case for file targets", () => {
    const first = node("duplicate", { name: "Target", file_path: "src/Target.py", language: "python" });
    const second = node("other", { name: "target", file_path: "src/target.py" });
    const last = node("duplicate", { name: "TARGET", file_path: "src/Target.py", language: "typescript" });
    const universe = [first, second, first, last];
    const index = new ReferenceCandidateIndex(universe);
    expect(index.named("TaRgEt")).toEqual(universe);
    expect(index.atFiles(["src/target.py", "src/Target.py", "src/target.py"])).toEqual(universe);
    expect(index.atFiles(["SRC/Target.py"])).toEqual([]);
    expect(index.nodeById("duplicate")).toBe(first);
    expect(index.nodeById("missing")).toBeUndefined();
  });

  it("matches Ruby require/additional predicates without changing extension or namespace normalization", () => {
    const universe = [
      node("qualified", { qualified_name: "App::Shared", kind: "constant" }),
      node("module", { qualified_name: "elsewhere", kind: "module", file_path: "lib/app/shared.rb" }),
      node("upper", { qualified_name: "Upper", kind: "module", file_path: "lib/app/shared.RB" }),
      node("other-language", { qualified_name: "App::Shared", kind: "module", language: "python" }),
      node("overlap", { qualified_name: "App::Shared", kind: "module", file_path: "app.shared.rb" })
    ];
    const index = new ReferenceCandidateIndex(universe);
    for (const name of ["app.shared", "app/shared", "shared", "shared.rb", "", "missing"]) {
      for (const requirePath of [false, true]) {
        const expected = universe.filter(candidate => candidate.language === "ruby" && (
          candidate.qualified_name?.replaceAll("::", ".").toLowerCase() === name ||
          (requirePath && candidate.kind === "module" && (
            candidate.file_path.replace(/\.rb$/u, "").toLowerCase() === name ||
            candidate.file_path.replace(/\.rb$/u, "").toLowerCase().endsWith(`/${name}`)
          ))
        ));
        expect(index.rubyAdditional(name, requirePath)).toEqual(expected);
      }
    }
  });

  it("preserves raw-qualified model and controller rules, concerns and draw-file admission", () => {
    const universe = [
      node("simple", { name: "Order", qualified_name: "Order" }),
      node("dot", { name: "Record", qualified_name: "Admin.Order" }),
      node("colon", { name: "Record", qualified_name: "Admin::Order" }),
      node("lower", { name: "order", qualified_name: "Other.Record" }),
      node("foreign", { name: "Order", qualified_name: "Admin.Order", language: "go" }),
      node("concern", { kind: "rails_route_concern", metadata: { route_concern_name: "Searchable" } }),
      node("foreign-concern", { kind: "rails_route_concern", language: "python", metadata: { route_concern_name: "Searchable" } }),
      node("draw", { kind: "module", file_path: "config/routes/Admin.rb" }),
      node("unparsed", { kind: "module", file_path: "config/routes/admin.rb", metadata: {} })
    ];
    const index = new ReferenceCandidateIndex(universe);
    for (const names of [["order"], ["admin.order"], ["record", "order"], ["admin::order"], ["missing"]]) {
      const rubyClasses = universe.filter(candidate => candidate.language === "ruby" && candidate.kind === "class");
      expect(index.rubyModelClasses(names)).toEqual(rubyClasses.filter(candidate => names.some(name =>
        candidate.name.toLowerCase() === name || candidate.qualified_name?.toLowerCase().endsWith(`.${name}`)
      )));
      expect(index.rubyControllerClasses(names)).toEqual(rubyClasses.filter(candidate => names.some(name =>
        name.includes(".") ? candidate.qualified_name?.toLowerCase() === name :
          candidate.name.toLowerCase() === name || candidate.qualified_name?.toLowerCase() === name ||
          candidate.qualified_name?.toLowerCase().endsWith(`.${name}`)
      )));
    }
    expect(index.rubyConcern("searchable")).toEqual([universe[5]]);
    expect(index.rubyDrawFile("config/routes/admin.rb")).toEqual([universe[7]]);
  });

  it("retains action scope prefix, singleton and cross-language matching", () => {
    const universe = [
      node("exact", { kind: "method", name: "Show", qualified_name: "Admin.Controller#show" }),
      node("child", { kind: "singleton_method", name: "SHOW", qualified_name: "Admin.Controller.Nested.show", language: "typescript" }),
      node("other", { kind: "method", name: "show", qualified_name: "Admin.Controllers#show" }),
      node("wrong-kind", { kind: "function", name: "show", qualified_name: "Admin.Controller#show" }),
      node("unqualified", { kind: "method", name: "show", qualified_name: undefined }),
      node("leading-dot", { kind: "method", name: "show", qualified_name: ".Nested#show" })
    ];
    const index = new ReferenceCandidateIndex(universe);
    for (const scopes of [["admin.controller"], ["admin"], [""], ["admin.controller", "admin"], ["missing"]]) {
      const expected = universe.filter(candidate => {
        if ((candidate.kind !== "method" && candidate.kind !== "singleton_method") || candidate.name.toLowerCase() !== "show") return false;
        const qualified = candidate.qualified_name ?? "";
        const hash = qualified.lastIndexOf("#");
        const parent = (hash >= 0 ? qualified.slice(0, hash) : qualified.slice(0, Math.max(0, qualified.lastIndexOf(".")))).toLowerCase();
        return scopes.some(scope => parent === scope || parent.startsWith(`${scope}.`));
      });
      expect(index.routeActions("show", scopes)).toEqual(expected);
    }
  });

  it.each([100, 10_000])("indexes %i unrelated nodes once, then only retrieves matching buckets", size => {
    let visits = 0;
    const unrelated = Array.from({ length: size }, (_, position) => {
      const value = node(`unrelated-${position}`, { kind: position % 2 === 0 ? "module" : "method", qualified_name: `Other.Unrelated${position}#work` });
      return new Proxy(value, { get(target, property, receiver) { visits += 1; return Reflect.get(target, property, receiver); } });
    });
    const target = node("target", { name: "Wanted", kind: "class", qualified_name: "Admin.Wanted", file_path: "app/wanted.rb" });
    const index = new ReferenceCandidateIndex([...unrelated, target]);
    // Construction touches each node a bounded number of times, without
    // copying a growing same-name bucket for every insertion.
    expect(visits).toBeGreaterThan(size);
    expect(visits).toBeLessThan(size * 40);
    visits = 0;
    for (let query = 0; query < 1000; query += 1) {
      expect(index.named("wanted")).toEqual([target]);
      expect(index.named("missing")).toEqual([]);
      expect(index.atFiles(["app/wanted.rb"])).toEqual([target]);
      expect(index.rubyAdditional("admin.wanted", true)).toEqual([target]);
      expect(index.rubyModelClasses(["wanted"])).toEqual([target]);
      expect(index.rubyControllerClasses(["admin.wanted"])).toEqual([target]);
      expect(index.rubyConcern("missing")).toEqual([]);
      expect(index.rubyDrawFile("missing")).toEqual([]);
      expect(index.routeActions("show", ["admin.wanted"])).toEqual([]);
      expect(index.nodeById("target")).toBe(target);
    }
    expect(visits).toBe(0);
  });
});
