/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-cmake-cpp-repo");

describe("CMake C++ routing fixture", () => {
  it("covers first-party CMake, source, tests, include references, local calls, and skipped dependency noise", async () => {
    const scanned = await new FileCatalogScannerAdapter().scan({
      repo_root: fixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 2000
    });
    const paths = scanned.files.map((file) => file.path).sort();
    const documentObject = fs.readFileSync(path.join(fixtureRoot, "src/App/DocumentObject.cpp"), "utf8");
    const executionController = fs.readFileSync(path.join(fixtureRoot, "src/App/ExecutionController.cpp"), "utf8");
    const test = fs.readFileSync(path.join(fixtureRoot, "src/App/DocumentObjectTest.cpp"), "utf8");
    const cmake = fs.readFileSync(path.join(fixtureRoot, "src/App/CMakeLists.txt"), "utf8");

    expectCMakeFixtureInventory(paths);
    expectGeneratedDependencyNoiseSkipped(scanned);
    expectCMakeTargetEvidence(cmake);
    expectCppReferenceEvidence({ documentObject, executionController, test });
  });
});

function expectCMakeFixtureInventory(paths: string[]): void {
  expect(paths).toEqual(
    expect.arrayContaining([
      "CMakeLists.txt",
      "src/App/CMakeLists.txt",
      "src/App/DocumentObject.cpp",
      "src/App/DocumentObject.h",
      "src/App/DocumentObject.pyi",
      "src/App/DocumentObjectTest.cpp",
      "src/App/ExecutionController.cpp"
    ])
  );
}

function expectGeneratedDependencyNoiseSkipped(scanned: Awaited<ReturnType<FileCatalogScannerAdapter["scan"]>>): void {
  const paths = scanned.files.map((file) => file.path).sort();
  expect(paths).not.toContain("third_party/noise/DocumentObject.cpp");
  expect(paths).not.toContain("vendor/noise/DocumentObject.cpp");
  expect(scanned.skipped_paths).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "third_party", reason: "generated_or_vendor" }),
      expect.objectContaining({ path: "vendor", reason: "generated_or_vendor" })
    ])
  );
}

function expectCMakeTargetEvidence(cmake: string): void {
  expect(cmake).toContain("add_library(App DocumentObject.cpp ExecutionController.cpp)");
}

function expectCppReferenceEvidence(input: {
  documentObject: string;
  executionController: string;
  test: string;
}): void {
  expect(input.documentObject).toContain('#include "DocumentObject.h"');
  expect(input.executionController).toContain("shouldRecompute(object)");
  expect(input.executionController).toContain("object.recompute()");
  expect(input.test).toContain("object.mustExecute()");
}
