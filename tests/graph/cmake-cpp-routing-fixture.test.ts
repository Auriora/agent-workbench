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
    expect(paths).not.toContain("third_party/noise/DocumentObject.cpp");
    expect(paths).not.toContain("vendor/noise/DocumentObject.cpp");
    expect(scanned.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "third_party", reason: "generated_or_vendor" }),
        expect.objectContaining({ path: "vendor", reason: "generated_or_vendor" })
      ])
    );
    expect(cmake).toContain("add_library(App DocumentObject.cpp ExecutionController.cpp)");
    expect(documentObject).toContain('#include "DocumentObject.h"');
    expect(executionController).toContain("shouldRecompute(object)");
    expect(executionController).toContain("object.recompute()");
    expect(test).toContain("object.mustExecute()");
  });
});
