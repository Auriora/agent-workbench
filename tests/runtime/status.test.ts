import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCatalogRepoStatus,
  getScannedRepoStatus
} from "../../src/application/use-cases/get-repo-status.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import {
  buildStatusEnvelope,
  toStatusPresentationPayload
} from "../../src/presentation/status-presenter.js";

describe("runtime status", () => {
  it("returns raw status result data without response envelope fields", () => {
    const result = getCatalogRepoStatus({
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      files: []
    });

    expect(Object.keys(result)).toEqual(["status", "meta"]);
    expect(result).not.toHaveProperty("contract_version");
    expect(result).not.toHaveProperty("warnings");
    expect(result).not.toHaveProperty("errors");
  });

  it("maps application status result to a presentation payload", () => {
    const result = getCatalogRepoStatus({
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      files: []
    });
    const payload = toStatusPresentationPayload(result);

    expect(payload).toEqual({
      status: result.status,
      meta: result.meta
    });
  });

  it("reports status using the shared envelope", () => {
    const result = getCatalogRepoStatus({
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      files: []
    });
    const status = buildStatusEnvelope(result);

    expect(status).toMatchObject({
      contract_version: "0.1",
      data: {
        repo_root: "/repo",
        indexed_roots: ["."]
      },
      meta: {
        scope: {
          repo_root: "/repo"
        }
      },
      warnings: [],
      errors: []
    });
  });

  it("reports mixed-language and platform coverage without Python-shaped fields", () => {
    const fixtureRoot = path.resolve("tests/fixtures/fixture-mixed-language-platform");
    const fixtureFiles = [
      "src/service.py",
      "src/app.ts",
      "package.json",
      ".github/workflows/ci.yml",
      "Dockerfile"
    ];
    for (const fixtureFile of fixtureFiles) {
      expect(fs.existsSync(path.join(fixtureRoot, fixtureFile))).toBe(true);
    }

    const result = getCatalogRepoStatus({
      repo_root: "/repo",
      indexed_roots: ["src", ".github", "infra"],
      skipped_roots: ["node_modules"],
      files: [
        buildFileCatalogEntry({
          file_identity: {
            path: "src/service.py",
            language: "python",
            content_hash: "sha256:python",
            size_bytes: 10,
            mtime_ms: 1
          }
        }),
        buildFileCatalogEntry({
          file_identity: {
            path: "src/app.ts",
            language: "typescript",
            content_hash: "sha256:ts",
            size_bytes: 10,
            mtime_ms: 1
          }
        }),
        buildFileCatalogEntry({
          file_identity: {
            path: "package.json",
            language: "json",
            content_hash: "sha256:package",
            size_bytes: 10,
            mtime_ms: 1
          }
        }),
        buildFileCatalogEntry({
          file_identity: {
            path: ".github/workflows/ci.yml",
            language: "yaml",
            content_hash: "sha256:workflow",
            size_bytes: 10,
            mtime_ms: 1
          }
        }),
        buildFileCatalogEntry({
          file_identity: {
            path: "Dockerfile",
            language: "infrastructure",
            content_hash: "sha256:docker",
            size_bytes: 10,
            mtime_ms: 1
          }
        })
      ]
    });

    expect(result.meta.scope.languages).toEqual(["infrastructure", "json", "python", "typescript", "yaml"]);
    expect(result.meta.capability_level).toBe("partial_semantic");
    expect(result.status.adapter_coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "language",
          name: "python",
          capability_level: "partial_semantic",
          evidence_kinds: ["parser"]
        }),
        expect.objectContaining({
          domain: "language",
          name: "typescript",
          capability_level: "unsupported",
          evidence_kinds: []
        }),
        expect.objectContaining({
          domain: "package_manager",
          name: "npm",
          capability_level: "resource_backed",
          paths: ["package.json"]
        }),
        expect.objectContaining({
          domain: "infrastructure",
          name: "yaml",
          capability_level: "resource_backed",
          paths: [".github/workflows/ci.yml"]
        }),
        expect.objectContaining({
          domain: "infrastructure",
          name: "infrastructure",
          capability_level: "resource_backed",
          paths: ["Dockerfile"]
        })
      ])
    );

    const keys = collectObjectKeys(result);
    expect(keys.filter((key) => key.startsWith("python_"))).toEqual([]);
  });

  it("builds scanned status from a file catalog scan port", async () => {
    const result = await getScannedRepoStatus({
      repo_root: "/repo",
      scanner: {
        async scan() {
          return {
            repo_root: "/repo",
            indexed_roots: ["."],
            skipped_roots: ["node_modules"],
            truncated: true,
            files: [
              buildFileCatalogEntry({
                file_identity: {
                  path: "src/app.ts",
                  language: "typescript",
                  content_hash: "sha256:ts",
                  size_bytes: 10,
                  mtime_ms: 1
                }
              })
            ]
          };
        }
      },
      max_files: 1
    });

    expect(result.status.freshness).toBe("unknown");
    expect(result.meta.truncated).toBe(true);
    expect(result.meta.budget).toEqual({ row_limit: 1 });
    expect(result.status.adapter_coverage).toEqual([
      expect.objectContaining({
        domain: "language",
        name: "typescript",
        capability_level: "unsupported"
      })
    ]);
  });
});

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectKeys(item));
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectObjectKeys(nested)]);
}
