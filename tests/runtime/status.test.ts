import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCatalogRepoStatus,
  getSnapshotRepoStatus,
  getScannedRepoStatus
} from "../../src/application/use-cases/get-repo-status.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import type {
  FileCatalogPort,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../src/ports/index.js";
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
    expect(result.status.runtime_state).toBe("fresh");
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
          capability_level: "partial_semantic",
          evidence_kinds: ["parser"]
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

  it("classifies snapshot-backed runtime status transitions", async () => {
    const file = buildFileCatalogEntry({
      file_identity: {
        path: "src/service.py",
        language: "python",
        content_hash: "sha256:python",
        size_bytes: 10,
        mtime_ms: 1
      }
    });
    const cases = [
      {
        name: "cold",
        snapshot: null,
        expected: {
          runtime_state: "cold",
          freshness: "cold",
          analysis_validity: "invalid"
        }
      },
      {
        name: "refreshing",
        snapshot: snapshot({ freshness: "fresh" }),
        warmup: {
          execution_id: "warm-1",
          repo_root: "/repo",
          snapshot_id: "snap-1",
          state: "running" as const,
          owner_id: "owner",
          queued_jobs: 1,
          started_at: "2026-06-02T12:00:00.000Z",
          updated_at: "2026-06-02T12:00:00.000Z"
        },
        expected: {
          runtime_state: "refreshing",
          freshness: "refreshing",
          analysis_validity: "valid"
        }
      },
      {
        name: "fresh",
        snapshot: snapshot({ freshness: "fresh" }),
        expected: {
          runtime_state: "fresh",
          freshness: "fresh",
          analysis_validity: "valid"
        }
      },
      {
        name: "stale",
        snapshot: snapshot({ freshness: "stale" }),
        expected: {
          runtime_state: "stale",
          freshness: "stale",
          analysis_validity: "valid"
        }
      },
      {
        name: "partial",
        snapshot: snapshot({ freshness: "unknown", analysis_validity: "partial" }),
        expected: {
          runtime_state: "partial",
          freshness: "unknown",
          analysis_validity: "partial"
        }
      },
      {
        name: "invalid",
        snapshot: snapshot({ freshness: "stale", analysis_validity: "invalid", reason: "schema mismatch" }),
        expected: {
          runtime_state: "invalid",
          freshness: "stale",
          analysis_validity: "invalid"
        }
      },
      {
        name: "invalid due to environment",
        snapshot: snapshot({
          freshness: "cold",
          analysis_validity: "invalid_due_to_environment",
          reason: "tree-sitter grammar unavailable"
        }),
        expected: {
          runtime_state: "invalid_due_to_environment",
          freshness: "cold",
          analysis_validity: "invalid_due_to_environment"
        }
      }
    ];

    for (const testCase of cases) {
      const result = await getSnapshotRepoStatus({
        repo_root: "/repo",
        snapshots: snapshotPort(testCase.snapshot),
        catalog: catalogPort(testCase.snapshot === null ? [] : [file]),
        warmups: warmupPort(testCase.warmup ?? null),
        max_files: 10
      });

      expect(result.status.runtime_state, testCase.name).toBe(testCase.expected.runtime_state);
      expect(result.status.freshness, testCase.name).toBe(testCase.expected.freshness);
      expect(result.meta.analysis_validity, testCase.name).toBe(testCase.expected.analysis_validity);
      expect(result.meta.freshness, testCase.name).toBe(testCase.expected.freshness);
    }
  });

  it("adds structured caveats for degraded snapshot states", async () => {
    const pythonFile = buildFileCatalogEntry({
      file_identity: {
        path: "src/service.py",
        language: "python",
        content_hash: "sha256:python",
        size_bytes: 10,
        mtime_ms: 1
      }
    });
    const unsupportedFile = buildFileCatalogEntry({
      file_identity: {
        path: "src/App.java",
        language: "java",
        content_hash: "sha256:java",
        size_bytes: 10,
        mtime_ms: 1
      }
    });

    const cases = [
      {
        name: "missing parser grammar",
        snapshot: snapshot({
          freshness: "fresh",
          reason: "tree-sitter grammar unavailable"
        }),
        files: [pythonFile],
        expectedKind: "missing_parser_grammar" as const
      },
      {
        name: "parser timeout",
        snapshot: snapshot({
          freshness: "fresh",
          reason: "parser timeout while extracting symbols"
        }),
        files: [pythonFile],
        expectedKind: "parser_timeout" as const
      },
      {
        name: "parser crash",
        snapshot: snapshot({
          freshness: "fresh",
          reason: "parser crashed during worker startup"
        }),
        files: [pythonFile],
        expectedKind: "parser_crash" as const
      },
      {
        name: "missing optional enrichment evidence",
        snapshot: snapshot({ freshness: "fresh" }),
        files: [pythonFile],
        expectedKind: "missing_optional_enrichment_evidence" as const
      },
      {
        name: "unsupported language or platform",
        snapshot: snapshot({ freshness: "fresh" }),
        files: [unsupportedFile],
        expectedKind: "unsupported_language_or_platform" as const
      },
      {
        name: "missing test runner",
        snapshot: snapshot({ freshness: "fresh", reason: "test runner missing for this repository" }),
        files: [pythonFile],
        expectedKind: "missing_test_runner" as const
      },
      {
        name: "stale watcher snapshot",
        snapshot: snapshot({ freshness: "stale", owner_state: "stale_owner" }),
        files: [pythonFile],
        expectedKind: "stale_watcher_snapshot" as const
      }
    ];

    for (const testCase of cases) {
      const result =
        testCase.expectedKind === "missing_optional_enrichment_evidence" ||
        testCase.expectedKind === "unsupported_language_or_platform"
          ? getCatalogRepoStatus({
              repo_root: "/repo",
              indexed_roots: ["."],
              skipped_roots: [],
              files: testCase.files,
              snapshot: testCase.snapshot,
              freshness: testCase.snapshot.freshness
            })
          : await getSnapshotRepoStatus({
              repo_root: "/repo",
              snapshots: snapshotPort(testCase.snapshot),
              catalog: catalogPort(testCase.files),
              max_files: 10
            });
      const caveats = result.meta.caveats ?? [];

      expect(caveats, testCase.name).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: testCase.expectedKind
          })
        ])
      );
    }
  });

  it("keeps snapshot status bounded while using persisted catalog evidence", async () => {
    let listFilesCalled = false;
    const result = await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
      catalog: {
        async listFiles(input) {
          listFilesCalled = true;
          expect(input.max_rows).toBe(10);
          return [
            buildFileCatalogEntry({
              file_identity: {
                path: "src/main.go",
                language: "go",
                content_hash: "sha256:go",
                size_bytes: 10,
                mtime_ms: 1
              }
            }),
            buildFileCatalogEntry({
              file_identity: {
                path: "src/app/DocumentObject.cpp",
                language: "cpp",
                content_hash: "sha256:cpp",
                size_bytes: 20,
                mtime_ms: 1
              }
            })
          ];
        },
        async getFile() {
          return null;
        },
        async upsertEntry() {},
        async removeEntry() {}
      },
      max_files: 10
    });

    expect(listFilesCalled).toBe(true);
    expect(result.status.adapter_coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "go", capability_level: "partial_semantic" }),
        expect.objectContaining({ name: "cpp", capability_level: "resource_backed" })
      ])
    );
    expect(result.meta.scope.languages).toEqual(["cpp", "go"]);
    expect(result.meta.budget).toEqual({ row_limit: 10 });
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
        capability_level: "partial_semantic"
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

function snapshot(input: {
  freshness: SnapshotState["freshness"];
  analysis_validity?: SnapshotState["analysis_validity"];
  reason?: string;
  owner_state?: SnapshotState["owner_state"];
}): SnapshotState {
  return {
    id: "snap-1",
    repo_root: "/repo",
    workspace_root: "/repo",
    repo_identity: "repo",
    config_identity: "config",
    schema_version: 1,
    freshness: input.freshness,
    analysis_validity: input.analysis_validity,
    owner_state: input.owner_state ?? "owner",
    created_at: "2026-06-02T12:00:00.000Z",
    updated_at: "2026-06-02T12:00:00.000Z",
    reason: input.reason
  };
}

function snapshotPort(value: SnapshotState | null): SnapshotPort {
  return {
    async getSnapshot() {
      return value;
    },
    async listSnapshots() {
      return value === null ? [] : [value];
    },
    async upsertSnapshot() {},
    async markSnapshotFreshness() {}
  };
}

function catalogPort(files: Parameters<typeof getCatalogRepoStatus>[0]["files"]): FileCatalogPort {
  return {
    async listFiles() {
      return files;
    },
    async getFile(input) {
      return files.find((file) => file.path === input.path) ?? null;
    },
    async upsertEntry() {},
    async removeEntry() {}
  };
}

function warmupPort(value: Awaited<ReturnType<WarmupCoordinatorPort["getState"]>>): WarmupCoordinatorPort {
  return {
    async getState() {
      return value;
    },
    async requestWarmup() {
      return "warm-1";
    },
    async markOwner() {},
    async completeWarmup() {}
  };
}
