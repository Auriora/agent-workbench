/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCatalogRepoStatus,
  getSnapshotRepoStatus as getSnapshotRepoStatusUseCase,
  getScannedRepoStatus
} from "../../src/application/use-cases/get-repo-status.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import type { WatcherFreshnessState } from "../../src/application/use-cases/response-metadata.js";
import type { RepositoryRefreshTriggerPort } from "../../src/application/use-cases/repository-refresh-triggers.js";
import type {
  DocumentationConcernIndexPort,
  FileCatalogPort,
  SnapshotPort,
  WarmupCoordinatorPort
} from "../../src/ports/index.js";
import {
  buildStatusEnvelope,
  toStatusPresentationPayload
} from "../../src/presentation/status-presenter.js";

type SnapshotStatusInput = Parameters<typeof getSnapshotRepoStatusUseCase>[0];

function getSnapshotRepoStatus(
  input: Omit<SnapshotStatusInput, "refresh_triggers"> & {
    refresh_triggers?: RepositoryRefreshTriggerPort;
  }
) {
  return getSnapshotRepoStatusUseCase({
    ...input,
    refresh_triggers: input.refresh_triggers ?? refreshTriggerPort(async () => ({
      outcome: "accepted",
      reused: false,
      execution_id: "test-refresh",
      state: "planned",
      started_generation: 1,
      requested_generation: 1
    }))
  });
}

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
        documentation_concerns: documentationConcernPort(),
        warmups: warmupPort(testCase.warmup ?? null),
        max_files: 10
      });

      expect(result.status.runtime_state, testCase.name).toBe(testCase.expected.runtime_state);
      expect(result.status.freshness, testCase.name).toBe(testCase.expected.freshness);
      expect(result.meta.analysis_validity, testCase.name).toBe(testCase.expected.analysis_validity);
      expect(result.meta.freshness, testCase.name).toBe(testCase.expected.freshness);
    }
  });

  it("exposes watcher freshness and prevents fresh claims when watcher evidence is not synchronized", async () => {
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
        name: "synchronized watcher",
        watcher: watcherFreshness({
          status: "fresh",
          queue_state: "drained",
          scope_status: "synchronized",
          ignore_rules_status: "synchronized"
        }),
        expected: {
          runtime_state: "fresh",
          freshness: "fresh",
          caveatKind: undefined
        }
      },
      {
        name: "pending watcher queue",
        watcher: watcherFreshness({
          status: "refreshing",
          queue_state: "pending",
          scope_status: "synchronized",
          ignore_rules_status: "synchronized"
        }),
        expected: {
          runtime_state: "refreshing",
          freshness: "refreshing",
          caveatKind: "watcher_refreshing"
        }
      },
      {
        name: "scope changed",
        watcher: watcherFreshness({
          status: "stale",
          queue_state: "drained",
          scope_status: "changed",
          ignore_rules_status: "synchronized"
        }),
        expected: {
          runtime_state: "stale",
          freshness: "stale",
          caveatKind: "stale_watcher_snapshot"
        }
      },
      {
        name: "watcher processing failure",
        watcher: watcherFreshness({
          status: "degraded",
          queue_state: "failed",
          scope_status: "unknown",
          ignore_rules_status: "unknown"
        }),
        expected: {
          runtime_state: "degraded",
          freshness: "stale",
          caveatKind: "degraded_watcher_freshness"
        }
      }
    ];

    for (const testCase of cases) {
      const result = await getSnapshotRepoStatus({
        repo_root: "/repo",
        snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
        catalog: catalogPort([file]),
        documentation_concerns: documentationConcernPort(),
        watcher: testCase.watcher,
        max_files: 10
      });

      expect(result.status.runtime_state, testCase.name).toBe(testCase.expected.runtime_state);
      expect(result.status.freshness, testCase.name).toBe(testCase.expected.freshness);
      expect(result.status.watcher_freshness, testCase.name).toEqual(testCase.watcher);
      expect(result.meta.freshness, testCase.name).toBe(testCase.expected.freshness);
      if (testCase.expected.caveatKind === undefined) {
        expect(result.meta.caveats ?? [], testCase.name).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: expect.stringMatching(/watcher/)
            })
          ])
        );
      } else {
        expect(result.meta.caveats ?? [], testCase.name).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: testCase.expected.caveatKind
            })
          ])
        );
      }
    }
  });

  it("projects every documentation ranking state from one read of the selected snapshot", async () => {
    const cases = [
      {
        name: "complete",
        concern: { status: "ready", snapshot_id: "snap-1", state: "complete" } as const,
        receipt: { state: "ready", recovery: "none", authority_map: "present" },
        validity: "valid",
        verification: "needed"
      },
      {
        name: "no authority map",
        concern: { status: "ready", snapshot_id: "snap-1", state: "no_map" } as const,
        receipt: { state: "ready", recovery: "none", authority_map: "absent" },
        validity: "partial",
        verification: "needed"
      },
      {
        name: "invalid ready state",
        concern: { status: "ready", snapshot_id: "snap-1", state: "invalid", failure_reason: "bad map" } as const,
        receipt: { state: "invalid", recovery: "source_repair", authority_map: "unknown", reason: "bad map" },
        validity: "invalid",
        verification: "blocked"
      },
      {
        name: "invalid concern index",
        concern: { status: "unavailable", snapshot_id: "snap-1", reason: "concern_index_invalid" } as const,
        receipt: { state: "invalid", recovery: "source_repair", authority_map: "unknown" },
        validity: "invalid",
        verification: "blocked"
      },
      ...(["snapshot_not_published", "snapshot_schema_incompatible", "concern_index_state_missing"] as const).map(
        (reason) => ({
          name: reason,
          concern: { status: "unavailable" as const, snapshot_id: "snap-1", reason },
          receipt: { state: "unavailable", recovery: "refresh", authority_map: "unknown", reason },
          validity: "invalid_due_to_environment",
          verification: "blocked"
        })
      ),
      {
        name: "snapshot not found",
        concern: { status: "unavailable", snapshot_id: "snap-1", reason: "snapshot_not_found" } as const,
        receipt: {
          state: "unavailable",
          recovery: "request_repair",
          authority_map: "unknown",
          reason: "snapshot_not_found"
        },
        validity: "invalid",
        verification: "blocked"
      }
    ];
    for (const testCase of cases) {
      const calls: string[] = [];
      const concerns = documentationConcernPort(testCase.concern);
      const originalRead = concerns.getDocumentationConcernIndexState.bind(concerns);
      concerns.getDocumentationConcernIndexState = async (input) => {
        calls.push(input.snapshot_id);
        return originalRead(input);
      };
      const result = await getSnapshotRepoStatus({
        repo_root: "/repo",
        snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
        catalog: catalogPort([statusTypeScriptFile()]),
        documentation_concerns: concerns,
        selected_snapshot_id: "snap-1"
      });

      expect(calls, testCase.name).toEqual(["snap-1"]);
      expect(result.status.snapshot_id, testCase.name).toBe("snap-1");
      expect(result.status.documentation_ranking, testCase.name).toMatchObject({
        snapshot_id: "snap-1",
        ...testCase.receipt
      });
      expect(result.meta.analysis_validity, testCase.name).toBe(testCase.validity);
      expect(result.meta.verification_status, testCase.name).toBe(testCase.verification);
      expect(result.status.runtime_state, testCase.name).toBe("fresh");
      expect(result.status.freshness, testCase.name).toBe("fresh");
      if (testCase.name === "no authority map") {
        expect(result.meta.caveats).toEqual(expect.arrayContaining([
          expect.objectContaining({ kind: "authority_map_absent", severity: "warning" })
        ]));
      }
    }
  });

  it("does not join mismatched readiness and contains concern-store failures", async () => {
    const mismatched = await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
      catalog: catalogPort([statusTypeScriptFile()]),
      documentation_concerns: documentationConcernPort({
        status: "ready",
        snapshot_id: "different-snapshot",
        state: "complete"
      })
    });
    expect(mismatched.status.documentation_ranking).toEqual({
      snapshot_id: "snap-1",
      state: "unavailable",
      recovery: "environment_repair",
      authority_map: "unknown",
      reason: "Documentation ranking readiness did not match the selected snapshot."
    });
    expect(mismatched.meta).toMatchObject({
      analysis_validity: "invalid_due_to_environment",
      verification_status: "blocked"
    });

    const failing = documentationConcernPort();
    failing.getDocumentationConcernIndexState = async () => {
      throw new Error("database is locked at /home/example/private.sqlite token=secret-value");
    };
    const failed = await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
      catalog: catalogPort([statusTypeScriptFile()]),
      documentation_concerns: failing
    });
    expect(failed.status.documentation_ranking).toEqual({
      snapshot_id: "snap-1",
      state: "unavailable",
      recovery: "environment_repair",
      authority_map: "unknown",
      reason: "Documentation ranking readiness could not be read from the snapshot store."
    });
    expect(JSON.stringify(failed)).not.toContain("database is locked");
  });

  it("admits only refresh-class readiness through the shared coordinator before reading warmup", async () => {
    const events: string[] = [];
    const triggers = refreshTriggerPort(async (input) => {
      events.push(`trigger:${input.source}:${input.visible_snapshot_id}`);
      return {
        outcome: "accepted",
        reused: false,
        execution_id: "refresh-1",
        state: "planned",
        started_generation: 1,
        requested_generation: 1
      };
    });
    const result = await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
      catalog: catalogPort([statusTypeScriptFile()]),
      documentation_concerns: documentationConcernPort({
        status: "unavailable",
        snapshot_id: "snap-1",
        reason: "snapshot_not_published"
      }),
      refresh_triggers: triggers,
      warmups: {
        ...warmupPort(null),
        async getState() {
          events.push("warmup");
          return null;
        }
      }
    });

    expect(events).toEqual([
      "trigger:documentation-ranking-readiness:snap-1",
      "warmup"
    ]);
    expect(result.status.documentation_ranking?.recovery).toBe("refresh");
  });

  it.each([
    {
      concern: { status: "ready", snapshot_id: "snap-1", state: "invalid" } as const,
      recovery: "source_repair"
    },
    {
      concern: { status: "ready", snapshot_id: "snap-1", state: "complete" } as const,
      recovery: "none"
    },
    {
      concern: { status: "ready", snapshot_id: "snap-1", state: "no_map" } as const,
      recovery: "none"
    },
    {
      concern: { status: "unavailable", snapshot_id: "snap-1", reason: "snapshot_not_found" } as const,
      recovery: "request_repair"
    },
    {
      concern: { status: "ready", snapshot_id: "different-snapshot", state: "complete" } as const,
      recovery: "environment_repair"
    }
  ])("does not admit $recovery readiness through refresh", async ({ concern }) => {
    const calls: string[] = [];
    await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
      catalog: catalogPort([statusTypeScriptFile()]),
      documentation_concerns: documentationConcernPort(concern),
      refresh_triggers: refreshTriggerPort(async () => {
        calls.push("triggered");
        throw new Error("unexpected trigger");
      })
    });
    expect(calls).toEqual([]);
  });

  it("projects blocked refresh admission without retrying the coordinator", async () => {
    let calls = 0;
    const result = await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
      catalog: catalogPort([statusTypeScriptFile()]),
      documentation_concerns: documentationConcernPort({
        status: "unavailable",
        snapshot_id: "snap-1",
        reason: "concern_index_state_missing"
      }),
      refresh_triggers: refreshTriggerPort(async () => {
        calls += 1;
        return {
          outcome: "blocked",
          reused: false,
          state: "idle",
          reason: "store_failure",
          message: "Refresh store operation failed."
        };
      })
    });
    expect(calls).toBe(1);
    expect(result.status.watcher_freshness?.refresh_admission).toMatchObject({
      outcome: "blocked",
      reason: "store_failure"
    });
    expect(result.meta.verification_status).toBe("blocked");
  });

  it("never weakens stronger status trust while projecting documentation readiness", async () => {
    const cases = [
      {
        name: "complete preserves environment invalidity",
        snapshotValidity: "invalid_due_to_environment" as const,
        concern: { status: "ready", snapshot_id: "snap-1", state: "complete" } as const,
        expected: "invalid_due_to_environment"
      },
      {
        name: "no-map preserves invalidity",
        snapshotValidity: "invalid" as const,
        concern: { status: "ready", snapshot_id: "snap-1", state: "no_map" } as const,
        expected: "invalid"
      },
      {
        name: "ranking invalid preserves environment invalidity",
        snapshotValidity: "invalid_due_to_environment" as const,
        concern: { status: "ready", snapshot_id: "snap-1", state: "invalid" } as const,
        expected: "invalid_due_to_environment"
      }
    ];
    for (const testCase of cases) {
      const result = await getSnapshotRepoStatus({
        repo_root: "/repo",
        snapshots: snapshotPort(snapshot({
          freshness: "fresh",
          analysis_validity: testCase.snapshotValidity
        })),
        catalog: catalogPort([statusTypeScriptFile()]),
        documentation_concerns: documentationConcernPort(testCase.concern)
      });
      expect(result.meta.analysis_validity, testCase.name).toBe(testCase.expected);
      expect(result.meta.verification_status, testCase.name).toBe("blocked");
      expect(result.status.runtime_state, testCase.name).toBe(testCase.snapshotValidity);
      expect(result.status.freshness, testCase.name).toBe("fresh");
    }
  });

  it("redacts then UTF-8 bounds public documentation ranking reasons", async () => {
    const result = await getSnapshotRepoStatus({
      repo_root: "/repo",
      snapshots: snapshotPort(snapshot({ freshness: "fresh" })),
      catalog: catalogPort([statusTypeScriptFile()]),
      documentation_concerns: documentationConcernPort({
        status: "ready",
        snapshot_id: "snap-1",
        state: "invalid",
        failure_reason: `/home/example/private/map.md token=secret-value ${"🙂".repeat(200)}`
      })
    });
    const envelope = buildStatusEnvelope(result);
    const reason = envelope.data.documentation_ranking?.reason ?? "";
    expect(reason).toContain("[REDACTED_ABSOLUTE_PATH]");
    expect(reason).toContain("token=[REDACTED]");
    expect(reason).not.toContain("/home/example");
    expect(reason).not.toContain("secret-value");
    expect(Buffer.byteLength(reason, "utf8")).toBeLessThanOrEqual(512);
    expect(reason).not.toContain("�");
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
        name: "no adapter coverage",
        snapshot: undefined,
        files: [],
        expectedKind: "no_adapter_coverage" as const
      },
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
        testCase.snapshot === undefined ||
        testCase.expectedKind === "missing_optional_enrichment_evidence" ||
        testCase.expectedKind === "unsupported_language_or_platform"
          ? getCatalogRepoStatus({
              repo_root: "/repo",
              indexed_roots: ["."],
              skipped_roots: [],
              files: testCase.files,
              snapshot: testCase.snapshot,
              freshness: testCase.snapshot?.freshness
            })
          : await getSnapshotRepoStatus({
              repo_root: "/repo",
              snapshots: snapshotPort(testCase.snapshot),
              catalog: catalogPort(testCase.files),
              documentation_concerns: documentationConcernPort(),
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
      documentation_concerns: documentationConcernPort(),
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
    expect(buildStatusEnvelope(result).meta.trust).toMatchObject({
      not_safe_to_use_for: expect.arrayContaining(["task_completion_claim", "whole_program_impact_claim"]),
      must_verify_by: expect.arrayContaining(["direct_read_relevant_source", "refresh_runtime_snapshot"])
    });
    expect(result.status.adapter_coverage).toEqual([
      expect.objectContaining({
        domain: "language",
        name: "typescript",
        capability_level: "partial_semantic"
      })
    ]);
  });

  it("reports no adapter coverage as explicit status evidence instead of an unexplained partial", async () => {
    const result = await getScannedRepoStatus({
      repo_root: "/repo",
      scanner: {
        async scan(input) {
          return {
            repo_root: input.repo_root,
            indexed_roots: input.indexed_roots,
            skipped_roots: input.skipped_roots,
            truncated: false,
            files: []
          };
        }
      }
    });

    expect(result.status.runtime_state).toBe("partial");
    expect(result.status.adapter_coverage).toEqual([]);
    expect(result.meta).toMatchObject({
      analysis_validity: "partial",
      capability_level: "unsupported",
      verification_status: "needed"
    });
    expect(result.meta.caveats).toEqual([
      expect.objectContaining({
        kind: "no_adapter_coverage",
        message: expect.stringContaining("No scanner-visible adapter coverage")
      })
    ]);
  });

  it("distinguishes unsupported language coverage from cold runtime state", async () => {
    const result = await getScannedRepoStatus({
      repo_root: "/repo",
      scanner: {
        async scan(input) {
          return {
            repo_root: input.repo_root,
            indexed_roots: input.indexed_roots,
            skipped_roots: input.skipped_roots,
            truncated: false,
            files: [
              buildFileCatalogEntry({
                file_identity: {
                  path: "src/App.java",
                  language: "java",
                  content_hash: "sha256:java",
                  size_bytes: 10,
                  mtime_ms: 1
                }
              })
            ]
          };
        }
      }
    });

    expect(result.status.freshness).toBe("unknown");
    expect(result.meta.analysis_validity).toBe("valid");
    expect(result.meta.capability_level).toBe("unsupported");
    expect(result.status.adapter_coverage).toEqual([
      expect.objectContaining({
        domain: "language",
        name: "java",
        capability_level: "unsupported"
      })
    ]);
    expect(result.meta.caveats).toEqual([
      expect.objectContaining({
        kind: "unsupported_language_or_platform"
      })
    ]);
  });

  it("maps first-read fixture scan limits through shared status metadata", async () => {
    const result = await getScannedRepoStatus({
      repo_root: path.resolve("tests/fixtures/fixture-first-read-failure-modes"),
      scanner: {
        async scan(input) {
          return {
            repo_root: input.repo_root,
            indexed_roots: input.indexed_roots,
            skipped_roots: ["dist", "vendor"],
            truncated: true,
            files: [
              buildFileCatalogEntry({
                file_identity: {
                  path: "src/Main.java",
                  language: "java",
                  content_hash: "sha256:java",
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
    expect(result.status.skipped_roots).toEqual(["dist", "vendor"]);
    expect(result.meta).toMatchObject({
      analysis_validity: "valid",
      truncated: true,
      budget: {
        row_limit: 1
      },
      scope: {
        skipped_roots: ["dist", "vendor"],
        languages: ["java"]
      }
    });
    expect(buildStatusEnvelope(result).meta.trust).toMatchObject({
      not_safe_to_use_for: expect.arrayContaining(["task_completion_claim"]),
      must_verify_by: expect.arrayContaining(["direct_read_relevant_source"])
    });
    expect(result.meta.caveats).toEqual([
      expect.objectContaining({
        kind: "unsupported_language_or_platform"
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

function statusTypeScriptFile() {
  return buildFileCatalogEntry({
    file_identity: {
      path: "src/app.ts",
      language: "typescript",
      content_hash: "sha256:ts",
      size_bytes: 10,
      mtime_ms: 1
    }
  });
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

function documentationConcernPort(
  state: Awaited<ReturnType<DocumentationConcernIndexPort["getDocumentationConcernIndexState"]>> = {
    status: "ready",
    snapshot_id: "snap-1",
    state: "complete"
  }
): DocumentationConcernIndexPort {
  return {
    async replaceSnapshotDocumentationConcerns() {},
    async getDocumentationConcernIndexState() {
      return state;
    },
    async listDocumentationConcernTerms() {
      return { status: "ready", snapshot_id: state.snapshot_id, rows: [] };
    },
    async listDocumentationConcernOwners() {
      return { status: "ready", snapshot_id: state.snapshot_id, rows: [] };
    }
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

function refreshTriggerPort(
  staleFirstRead: RepositoryRefreshTriggerPort["staleFirstRead"]
): RepositoryRefreshTriggerPort {
  return {
    async startup() {
      throw new Error("unexpected startup refresh");
    },
    staleFirstRead,
    async watcherBatch() {
      throw new Error("unexpected watcher refresh");
    },
    async hasPendingGeneration() {
      return false;
    },
    getGenerationReceipt() {
      return { generation: 0 };
    }
  };
}

function watcherFreshness(input: WatcherFreshnessState): WatcherFreshnessState {
  return {
    ...input,
    reason: input.reason ?? "test watcher state"
  };
}
