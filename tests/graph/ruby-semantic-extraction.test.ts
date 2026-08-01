/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findReferences as executeFindReferences } from "../../src/application/use-cases/find-references.js";
import { computeImpact } from "../../src/application/use-cases/compute-impact.js";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import type { ClockPort } from "../../src/ports/index.js";
import { ExtractorRegistryAdapter, ResourceExtractorAdapter } from "../../src/infrastructure/extraction/index.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import { RubyTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { createReferenceCursorCodec } from "../../src/infrastructure/runtime/index.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/index.js";
import { permissiveWorkspaceSafety } from "../helpers/permissive-workspace-safety.js";

const queryReferenceCursorCodec = createReferenceCursorCodec({
  key: Buffer.alloc(32, 7),
  key_epoch: "ruby-semantic"
});

const clock: ClockPort = {
  now: () => new Date("2026-05-31T12:00:00.000Z"),
  nowIso8601: () => "2026-05-31T12:00:00.000Z",
  nowUnixMs: () => 801
};

function findReferences(
  input: Omit<Parameters<typeof executeFindReferences>[0], "cursor_codec" | "workspace_safety"> & {
    cursor_codec?: Parameters<typeof executeFindReferences>[0]["cursor_codec"];
  }
) {
  return executeFindReferences({
    ...input,
    workspace_safety: permissiveWorkspaceSafety,
    cursor_codec: input.cursor_codec ?? queryReferenceCursorCodec
  });
}

describe("Ruby partial-semantic graph extraction", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-ruby-semantic-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("indexes nested declarations, module shapes, singleton forms, and parser metadata", async () => {
    const fixture = await indexedRubyFixture(dir, "601");
    try {
      const [commerceModule] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce"
      });
      const [billingModule] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce.Billing"
      });
      const [checkoutNode] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce.Billing.Checkout"
      });
      const [singletonClass] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce.Billing.Checkout.<<self>>"
      });
      const [defaultCurrencyMethod] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce.Billing.Checkout#default_currency"
      });
      const [calculateMethod] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce.Billing.Checkout#calculate"
      });
      const trackerNodes = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce.Billing.Tracker"
      });
      const [limitConstant] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "601",
        qualified_name: "Commerce.Billing.Checkout.DEFAULT_LIMIT"
      });

      expect(commerceModule).toMatchObject({
        kind: "module",
        metadata: expect.objectContaining({
          capability_level: "partial_semantic",
          evidence_kinds: ["parser"],
          parser: "tree-sitter-ruby"
        })
      });
      expect(billingModule).toMatchObject({
        kind: "module",
        metadata: expect.objectContaining({ capability_level: "partial_semantic" })
      });
      expect(checkoutNode).toMatchObject({
        kind: "class",
        name: "Checkout",
        qualified_name: "Commerce.Billing.Checkout",
        metadata: expect.objectContaining({
          declaration_kind: "class",
          parser: "tree-sitter-ruby"
        })
      });
      expect(singletonClass).toMatchObject({
        kind: "singleton_class",
        name: "<<self>>",
        metadata: expect.objectContaining({
          declaration_kind: "singleton_class",
          declaration_stability: "static"
        })
      });
      expect(defaultCurrencyMethod).toMatchObject({
        kind: "singleton_method",
        metadata: expect.objectContaining({
          declaration_kind: "singleton_method"
        })
      });
      expect(calculateMethod).toMatchObject({
        kind: "method",
        metadata: expect.objectContaining({
          declaration_kind: "method"
        })
      });
      expect(limitConstant).toMatchObject({
        kind: "constant",
        name: "DEFAULT_LIMIT",
        metadata: expect.objectContaining({
          declaration_kind: "constant"
        }),
        source_range: expect.objectContaining({
          start_line: expect.any(Number),
          end_line: expect.any(Number)
        })
      });

      expect(trackerNodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "class",
            name: "Tracker"
          }),
          expect.objectContaining({
            kind: "class",
            name: "Tracker",
            metadata: expect.objectContaining({
              reopened: true,
              reopen_sequence: 2
            })
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("resolves unique Ruby references and preserves ambiguous/multiple declaration ambiguity", async () => {
    const fixture = await indexedRubyFixture(dir, "602");
    try {
      const checkout = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "602",
        qualified_name: "Commerce.Billing.Checkout"
      });
      const customer = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "602",
        qualified_name: "Commerce.Customer"
      });
      const bootstrap = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "602",
        qualified_name: "Commerce.Services.Bootstrap"
      });
      const routesFile = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "602",
        qualified_name: "config.routes"
      });
      const sharedConfigUnresolved = await fixture.store.getUnresolvedReferences({
        snapshot_id: "602",
        file_path: "app/services/bootstrap.rb",
        max_rows: 50
      });
      const bootstrapDynamicRefs = await fixture.store.getUnresolvedReferences({
        snapshot_id: "602",
        file_path: "app/services/bootstrap.rb",
        max_rows: 50
      });
      const routeRefs = await fixture.store.getUnresolvedReferences({
        snapshot_id: "602",
        file_path: "config/routes.rb",
        max_rows: 50
      });
      const customerDynamicRefs = await fixture.store.getUnresolvedReferences({
        snapshot_id: "602",
        file_path: "app/models/customer.rb",
        max_rows: 50
      });

      expect(customer).toHaveLength(1);
      expect(checkout).toHaveLength(1);
      expect(bootstrap).toHaveLength(1);
      expect(routesFile).toHaveLength(1);

      const checkoutReferences = await fixture.store.getReferences({
        snapshot_id: "602",
        node_id: checkout[0]!.id
      });
      const customerReferences = await fixture.store.getReferences({
        snapshot_id: "602",
        node_id: customer[0]!.id
      });
      const bootstrapReferences = await fixture.store.getReferences({
        snapshot_id: "602",
        node_id: bootstrap[0]!.id
      });
      const routeFileReferences = await fixture.store.getReferences({
        snapshot_id: "602",
        node_id: routesFile[0]!.id
      });

      expect(bootstrapReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_file_path: "app/models/base_record.rb",
            provenance: "tree-sitter-ruby"
          })
        ])
      );
      expect(routeFileReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_file_path: "app/controllers/checkouts_controller.rb",
            provenance: "tree-sitter-ruby"
          })
        ])
      );

      expect(checkoutReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_file_path: "app/models/base_record.rb",
            provenance: "tree-sitter-ruby"
          }),
          expect.objectContaining({
            target_file_path: "app/models/checkout.rb",
            provenance: "tree-sitter-ruby"
          })
        ])
      );

      expect(customerReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target_file_path: "app/models/account.rb",
            provenance: "tree-sitter-ruby"
          })
        ])
      );

      const ambiguousInclude = sharedConfigUnresolved.find((reference) =>
        reference.reference_kind === "ruby_include" && reference.reference_name === "SharedConfig"
      );
      const dynamicRequire = bootstrapDynamicRefs.find((reference) =>
        reference.reference_kind === "ruby_dynamic" && reference.reference_name === "require"
      );
      const dynamicInclude = bootstrapDynamicRefs.find((reference) =>
        reference.reference_kind === "ruby_dynamic" && reference.reference_name === "include"
      );
      const dynamicExtend = bootstrapDynamicRefs.find((reference) =>
        reference.reference_kind === "ruby_dynamic" && reference.reference_name === "extend"
      );
      const dynamicPrepend = bootstrapDynamicRefs.find((reference) =>
        reference.reference_kind === "ruby_dynamic" && reference.reference_name === "prepend"
      );

      expect(ambiguousInclude).toMatchObject({
        candidate_metadata: expect.objectContaining({
          resolution: "ambiguous",
          candidate_count: 2,
          static: true,
          mixin_name: "include"
        }),
        source_range: expect.objectContaining({
          start_line: expect.any(Number),
          start_column: expect.any(Number),
          end_line: expect.any(Number),
          end_column: expect.any(Number)
        })
      });

      for (const reference of [dynamicRequire, dynamicInclude, dynamicExtend, dynamicPrepend]) {
        expect(reference).toMatchObject({
          reference_kind: "ruby_dynamic",
          candidate_metadata: expect.objectContaining({
            static: false,
            declaration_source: "tree-sitter-ruby"
          }),
          source_range: expect.objectContaining({
            start_line: expect.any(Number)
          })
        });
      }

      expect(routeRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_kind: "ruby_route",
            reference_name: "checkouts",
            candidate_metadata: expect.objectContaining({
              static: true,
              route_form: "resources",
              controller_candidate: "CheckoutsController"
            })
          }),
          expect.objectContaining({
            reference_kind: "ruby_dynamic",
            reference_name: "resources",
            candidate_metadata: expect.objectContaining({
              static: false,
              reason: "non_literal_resource_name"
            })
          })
        ])
      );

      expect(customerDynamicRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reference_kind: "ruby_dynamic",
            reference_name: "belongs_to",
            candidate_metadata: expect.objectContaining({
              static: false,
              reason: "non_literal_model_dsl_argument"
            })
          })
        ])
      );
    } finally {
      fixture.store.close();
    }
  });

  it("returns parser-route reference coverage for Ruby nodes without lexical fallback", async () => {
    const fixture = await indexedRubyFixture(dir, "603");
    try {
      const [checkout] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "603",
        qualified_name: "Commerce.Billing.Checkout"
      });

      const references = await findReferences({
        request: {
          node_id: checkout?.id,
          repo_root: fixture.repoRoot,
          max_depth: 3,
          max_results: 100
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        snapshot_validity: {
          snapshot_id: "603",
          state: "valid",
          complete: true,
          checked_path_count: 1,
          observed_path_count: 1,
          missing_paths: [],
          inaccessible_paths: [],
          refresh_required: false
        },
        default_repo_root: fixture.repoRoot
      });

      expect(references.references.coverage_status).toBe("evidence_backed");
      if (references.references.coverage_status !== "evidence_backed") {
        throw new Error("Expected Ruby parser-backed reference coverage.");
      }
      expect(references.references.coverage).toMatchObject({
        route: "parser",
        route_exhaustion: {
          outgoing: true,
          incoming: true,
          unresolved: true
        },
        stop_reason: "route_exhausted"
      });
      expect(references.meta.verification_status).toBe("done");
      expect(
        references.references.references.every((reference) => reference.provenance !== "bounded_lexical_identifier_scan")
      ).toBe(true);
    } finally {
      fixture.store.close();
    }
  });

  it("computes conservative cross-file impact from resolved Ruby parser edges", async () => {
    const fixture = await indexedRubyFixture(dir, "605");
    try {
      const [checkout] = await fixture.store.findNodesByQualifiedName({
        snapshot_id: "605",
        qualified_name: "Commerce.Billing.Checkout"
      });
      const result = await computeImpact({
        request: {
          node_id: checkout!.id,
          repo_root: fixture.repoRoot,
          direction: "outgoing",
          max_depth: 2,
          max_nodes: 100
        },
        graph: fixture.store,
        snapshots: fixture.store,
        catalog: fixture.store,
        snapshot_validity: {
          snapshot_id: "605",
          state: "valid",
          complete: true,
          checked_path_count: 1,
          observed_path_count: 1,
          missing_paths: [],
          inaccessible_paths: [],
          refresh_required: false
        },
        default_repo_root: fixture.repoRoot
      });

      expect(result.impact.affected_files.map((file) => file.path)).toEqual(expect.arrayContaining([
        "app/models/base_record.rb",
        "app/models/checkout.rb"
      ]));
      expect(result.impact.confidence).toMatchObject({
        scope: "graph",
        evidence_kinds: ["parser"]
      });
      expect(result.impact.traversal_truncated).toBe(false);
    } finally {
      fixture.store.close();
    }
  });

  it("keeps generated, vendor, and secret paths outside parser-backed indexing", async () => {
    const fixture = await indexedRubyFixture(dir, "604");
    try {
      await expect(fixture.store.getFile({ snapshot_id: "604", path: "dist/build.rb" })).resolves.toBeNull();
      await expect(fixture.store.getFile({ snapshot_id: "604", path: "vendor/legacy.rb" })).resolves.toBeNull();
      await expect(fixture.store.getFile({ snapshot_id: "604", path: ".env" })).resolves.toBeNull();
      await expect(fixture.store.getFile({ snapshot_id: "604", path: "app/models/base_record.rb" })).resolves.toMatchObject({
        indexed: true,
        file_identity: expect.objectContaining({ language: "ruby" })
      });
    } finally {
      fixture.store.close();
    }
  });
});

async function indexedRubyFixture(dir: string, snapshotId: string) {
  const repoRoot = path.resolve("tests/fixtures/fixture-ruby-semantic-repo");
  const store = openGraphStore(path.join(dir, `${snapshotId}.sqlite`));
  const registry = new ExtractorRegistryAdapter();
  registry.register(new RubyTreeSitterExtractorAdapter());
  const workspace = new WorkspaceFileAdapter({ repoRoot });

  await indexRepositoryGraph({
    repo_root: repoRoot,
    scanner: new FileCatalogScannerAdapter(),
    workspace,
    extractors: registry,
    resource_extractor: new ResourceExtractorAdapter(),
    graph: store,
    catalog: store,
    snapshots: store,
    clock,
    schema_version: SCHEMA_VERSION,
    snapshot_id: snapshotId
  });

  return { repoRoot, store, workspace };
}
