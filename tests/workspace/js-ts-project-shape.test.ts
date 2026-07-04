/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { getRepoOverview } from "../../src/application/use-cases/get-repo-overview.js";
import { getRepoScope } from "../../src/application/use-cases/get-repo-scope.js";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { detectJsTsProjectShape } from "../../src/application/use-cases/js-ts-project-shape.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-js-ts-monorepo");

describe("JavaScript/TypeScript project-shape routing", () => {
  it("covers workspace packages, configs, imports, exports, generated files, dependency skips, and tests", async () => {
    const scanner = new FileCatalogScannerAdapter();
    const scanned = await scanner.scan({
      repo_root: fixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 200
    });
    const shape = detectJsTsProjectShape(scanned.files);

    expectGeneratedDependenciesSkipped(scanned);
    expectWorkspacePackageShape(shape);
    expectTypeScriptConfigShape(shape);
    expectSourceAndTestShape(shape);
    expectGeneratedSourceShape(shape);
  });

  it("reports JS/TS-heavy scope as resource-backed rather than unsupported", async () => {
    const result = await getRepoScope({
      repo_root: fixtureRoot,
      scanner: new FileCatalogScannerAdapter()
    });

    expect(result.scope.languages).toEqual(expect.arrayContaining(["json", "typescript", "yaml"]));
    expect(result.scope.file_counts.typescript).toBeGreaterThanOrEqual(9);
    expect(result.scope.capability_counts.unsupported).toBe(0);
    expect(result.scope.capability_counts.resource_backed).toBeGreaterThan(result.scope.file_counts.typescript);
  });

  it("promotes package, workspace, TypeScript config, source, and test anchors in overview", async () => {
    const result = await getRepoOverview({
      repo_root: fixtureRoot,
      scanner: new FileCatalogScannerAdapter()
    });
    const paths = result.overview.key_files.map((file) => file.path);

    expect(result.overview.platforms).toEqual(expect.arrayContaining(["node", "typescript"]));
    expect(paths).toEqual(
      expect.arrayContaining([
        "apps/web/package.json",
        "package.json",
        "packages/shared/package.json",
        "services/api/package.json",
        "apps/web/tsconfig.json",
        "packages/shared/tsconfig.json",
        "services/api/tsconfig.json"
      ])
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        "apps/web/src/Login.tsx",
        "apps/web/src/components/LoginForm.tsx",
        "apps/web/src/components/LoginForm.test.tsx",
        "services/api/src/routes/auth-route.ts"
      ])
    );
    expect(paths.indexOf("apps/web/src/generated/client.ts")).toBeGreaterThan(
      paths.indexOf("apps/web/src/components/LoginForm.test.tsx")
    );
    expect(result.overview.validation_hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "verification_plan",
          reason: expect.stringContaining("JS/TS project-shape evidence")
        }),
        expect.objectContaining({
          command: "pnpm typecheck",
          reason: expect.stringContaining("non-executed typecheck candidate")
        })
      ])
    );
  });

  it("routes seeded JS/TS context to package-local config and nearby tests", async () => {
    const result = await getTaskContext({
      request: {
        task: "Update login page authentication handling",
        files: ["apps/web/src/Login.tsx"],
        symbols: [],
        max_files: 8,
        max_docs: 2
      },
      scanner: new FileCatalogScannerAdapter(),
      default_repo_root: fixtureRoot
    });
    const related = result.context.related_files.map((file) => file.path);

    expect(related).toEqual(
      expect.arrayContaining([
        "apps/web/package.json",
        "apps/web/tsconfig.json",
        "apps/web/src/components/LoginForm.tsx",
        "apps/web/src/components/LoginForm.test.tsx"
      ])
    );
    expect(result.context.related_files.find((file) => file.path === "apps/web/package.json")?.reason).toContain(
      "Package-local JavaScript/TypeScript configuration"
    );
    expect(result.context.related_files.find((file) => file.path === "apps/web/src/components/LoginForm.test.tsx")?.reason).toContain(
      "Package-local JavaScript/TypeScript test"
    );
  });
});

type JsTsScan = Awaited<ReturnType<FileCatalogScannerAdapter["scan"]>>;
type JsTsShape = ReturnType<typeof detectJsTsProjectShape>;

function expectGeneratedDependenciesSkipped(scanned: JsTsScan): void {
  expect(scanned.skipped_paths).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: "apps/web/node_modules",
        reason: "generated_or_vendor"
      })
    ])
  );
}

function expectWorkspacePackageShape(shape: JsTsShape): void {
  expect(shape.package_manifests).toEqual([
    "apps/web/package.json",
    "package.json",
    "packages/shared/package.json",
    "services/api/package.json"
  ]);
  expect(shape.workspace_files).toEqual(["pnpm-lock.yaml", "pnpm-workspace.yaml"]);
}

function expectTypeScriptConfigShape(shape: JsTsShape): void {
  expect(shape.tsconfig_files).toEqual([
    "apps/web/tsconfig.json",
    "packages/shared/tsconfig.json",
    "services/api/tsconfig.json",
    "tsconfig.base.json"
  ]);
}

function expectSourceAndTestShape(shape: JsTsShape): void {
  expect(shape.source_files).toEqual(
    expect.arrayContaining([
      "apps/web/src/Login.tsx",
      "apps/web/src/components/LoginForm.tsx",
      "packages/shared/src/auth.ts",
      "services/api/src/auth-controller.ts",
      "services/api/src/routes/auth-route.ts"
    ])
  );
  expect(shape.test_files).toEqual(
    expect.arrayContaining([
      "apps/web/src/components/LoginForm.test.tsx",
      "e2e/login.spec.ts",
      "services/api/src/auth-controller.test.ts"
    ])
  );
}

function expectGeneratedSourceShape(shape: JsTsShape): void {
  expect(shape.generated_files).toEqual(["apps/web/src/generated/client.ts"]);
}
