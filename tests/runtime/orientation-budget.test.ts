/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { getRepoOverview } from "../../src/application/use-cases/get-repo-overview.js";
import { getRepoScope } from "../../src/application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "../../src/application/use-cases/get-repo-status.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
import type { FileCatalogEntry } from "../../src/domain/models/index.js";
import type { FileCatalogScanPort } from "../../src/ports/index.js";
import { buildRepoOverviewEnvelope } from "../../src/presentation/repo-overview-presenter.js";
import { buildRepoScopeEnvelope } from "../../src/presentation/repo-scope-presenter.js";
import { buildStatusEnvelope } from "../../src/presentation/status-presenter.js";

describe("repo orientation budgets", () => {
  it("passes explicit row budgets to orientation scans and reports truncation", async () => {
    const scanner = recordingScanner();
    const status = await getScannedRepoStatus({
      repo_root: "/repo",
      scanner,
      max_files: 7
    });

    expect(scanner.calls).toEqual([
      {
        repo_root: "/repo",
        indexed_roots: ["."],
        skipped_roots: [],
        max_files: 7
      }
    ]);
    expect(status.meta).toMatchObject({
      truncated: true,
      budget: {
        row_limit: 7
      }
    });
  });

  it("keeps scope and overview bounded to catalog evidence without source payloads", async () => {
    const scopeScanner = recordingScanner();
    const overviewScanner = recordingScanner();
    const scopeEnvelope = buildRepoScopeEnvelope(
      await getRepoScope({
        repo_root: "/repo",
        scanner: scopeScanner
      })
    );
    const overviewEnvelope = buildRepoOverviewEnvelope(
      await getRepoOverview({
        repo_root: "/repo",
        scanner: overviewScanner
      })
    );

    expect(scopeScanner.calls[0]?.max_files).toBe(15000);
    expect(overviewScanner.calls[0]?.max_files).toBe(15000);
    expect(scopeEnvelope.meta.budget).toEqual({ row_limit: 15000 });
    expect(overviewEnvelope.meta.budget).toEqual({ row_limit: 15000 });
    const statusKeys = collectObjectKeys(buildStatusEnvelope({
      status: {
        repo_root: "/repo",
        runtime_state: "partial",
        freshness: "unknown",
        indexed_roots: ["."],
        skipped_roots: [],
        adapter_coverage: []
      },
      meta: scopeEnvelope.meta
    }));
    const scopeKeys = collectObjectKeys(scopeEnvelope);
    const overviewKeys = collectObjectKeys(overviewEnvelope);

    expect(statusKeys).not.toEqual(expect.arrayContaining(["content", "source", "source_text"]));
    expect(scopeKeys).not.toEqual(expect.arrayContaining(["content", "source", "source_text"]));
    expect(overviewKeys).not.toEqual(expect.arrayContaining(["content", "source", "source_text"]));
  });

  it("keeps embedded fixture projects out of overview routing signals", async () => {
    const overviewEnvelope = buildRepoOverviewEnvelope(
      await getRepoOverview({
        repo_root: "/repo",
        scanner: fixedScanner([
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
              path: "src/index.ts",
              language: "typescript",
              content_hash: "sha256:index",
              size_bytes: 10,
              mtime_ms: 1
            }
          }),
          buildFileCatalogEntry({
            file_identity: {
              path: "docs/architecture.md",
              language: "markdown",
              content_hash: "sha256:architecture",
              size_bytes: 10,
              mtime_ms: 1
            }
          }),
          buildFileCatalogEntry({
            file_identity: {
              path: "plugins/agent-workbench/skills/agent-workbench/SKILL.md",
              language: "markdown",
              content_hash: "sha256:plugin-skill",
              size_bytes: 10,
              mtime_ms: 1
            }
          }),
          buildFileCatalogEntry({
            file_identity: {
              path: "tests/fixtures/fixture-dotnet-web-repo/Fixture.sln",
              language: "config",
              content_hash: "sha256:sln",
              size_bytes: 10,
              mtime_ms: 1
            }
          }),
          buildFileCatalogEntry({
            file_identity: {
              path: "tests/fixtures/fixture-sam-lambda-repo/infra/sam/orders/template.yaml",
              language: "yaml",
              content_hash: "sha256:sam",
              size_bytes: 10,
              mtime_ms: 1
            }
          })
        ])
      })
    );

    expect(overviewEnvelope.data.platforms).toEqual(["node", "typescript"]);
    expect(overviewEnvelope.data.key_files.map((file) => file.path)).not.toEqual(
      expect.arrayContaining([
        "tests/fixtures/fixture-dotnet-web-repo/Fixture.sln",
        "tests/fixtures/fixture-sam-lambda-repo/infra/sam/orders/template.yaml"
      ])
    );
    expect(overviewEnvelope.data.key_docs.map((doc) => doc.path)).toEqual(["docs/architecture.md"]);
    expect(overviewEnvelope.data.validation_hints.map((hint) => hint.reason).join("\n")).not.toContain("tests/fixtures");
  });
});

function recordingScanner(): FileCatalogScanPort & {
  calls: Array<{
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
    max_files: number;
  }>;
} {
  const calls: Array<{
    repo_root: string;
    indexed_roots: readonly string[];
    skipped_roots: readonly string[];
    max_files: number;
  }> = [];
  return {
    calls,
    async scan(input) {
      calls.push(input);
      return {
        repo_root: input.repo_root,
        indexed_roots: input.indexed_roots,
        skipped_roots: input.skipped_roots,
        truncated: true,
        files: [
          buildFileCatalogEntry({
            file_identity: {
              path: "src/service.py",
              language: "python",
              content_hash: "sha256:service",
              size_bytes: 10,
              mtime_ms: 1
            }
          })
        ]
      };
    }
  };
}

function fixedScanner(files: FileCatalogEntry[]): FileCatalogScanPort {
  return {
    async scan(input) {
      return {
        repo_root: input.repo_root,
        indexed_roots: input.indexed_roots,
        skipped_roots: input.skipped_roots,
        truncated: false,
        files
      };
    }
  };
}

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectKeys(item));
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectObjectKeys(nested)]);
}
