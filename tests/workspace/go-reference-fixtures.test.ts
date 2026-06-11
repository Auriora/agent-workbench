import path from "node:path";
import { describe, expect, it } from "vitest";
import { planVerification } from "../../src/application/use-cases/plan-verification.js";
import { FileCatalogScannerAdapter, WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";

const serviceFixtureRoot = path.resolve("tests/fixtures/fixture-go-service-repo");
const dockerPolicyFixtureRoot = path.resolve("tests/fixtures/fixture-go-docker-policy-repo");

describe("Go reference and validation-policy fixtures", () => {
  it("covers packages, imports, methods, selectors, ambiguous names, generated skips, tests, Makefile, and CI evidence", async () => {
    const scanner = new FileCatalogScannerAdapter();
    const scanned = await scanner.scan({
      repo_root: serviceFixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 200
    });
    const paths = scanned.files.map((file) => file.path).sort();

    expectGoFixtureInventory(paths);
    expectGoCacheSkipped(scanned);
    const goFiles = scanned.files.filter((file) => file.file_identity.language === "go");
    expectGoParserEvidence(goFiles);
  });

  it("blocks generic host Go validation for Docker-only policy fixture", async () => {
    const result = await planVerification({
      request: {
        repo_root: dockerPolicyFixtureRoot,
        files: ["internal/service/service.go"],
        changed_files: ["internal/service/service.go"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot: dockerPolicyFixtureRoot }),
      default_repo_root: "."
    });

    expect(result.plan.status).toBe("blocked");
    expect(result.plan.planned_commands.map((command) => command.display)).not.toEqual(
      expect.arrayContaining(["make test", "go test ./..."])
    );
    expect(result.plan.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "blocker",
          message: expect.stringContaining("Docker")
        })
      ])
    );
  });
});

type ScannedGoFixture = Awaited<ReturnType<FileCatalogScannerAdapter["scan"]>>;

function expectGoFixtureInventory(paths: string[]): void {
  expect(paths).toEqual(
    expect.arrayContaining([
      ".github/workflows/go.yml",
      "Makefile",
      "cmd/service/main.go",
      "go.mod",
      "internal/cache/ambiguous.go",
      "internal/graph/ambiguous.go",
      "internal/graph/response_cache.go",
      "internal/graph/response_cache_test.go",
      "internal/generated/client.go"
    ])
  );
}

function expectGoCacheSkipped(scanned: ScannedGoFixture): void {
  expect(scanned.skipped_paths).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: ".gocache",
        reason: "generated_or_vendor"
      })
    ])
  );
}

function expectGoParserEvidence(goFiles: ScannedGoFixture["files"]): void {
  expect(goFiles.map((file) => file.path)).toEqual(
    expect.arrayContaining([
      "cmd/service/main.go",
      "internal/cache/ambiguous.go",
      "internal/graph/ambiguous.go",
      "internal/graph/response_cache.go",
      "internal/graph/response_cache_test.go"
    ])
  );
  expect(goFiles.every((file) => file.adapter_evidence?.capability_level === "partial_semantic")).toBe(true);
  expect(goFiles.every((file) => file.adapter_evidence?.evidence_kinds.includes("parser"))).toBe(true);
}
