import { describe, expect, it } from "vitest";
import { getRepoOverview } from "../../src/application/use-cases/get-repo-overview.js";
import { getRepoScope } from "../../src/application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "../../src/application/use-cases/get-repo-status.js";
import { buildFileCatalogEntry } from "../../src/domain/policies/index.js";
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

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectKeys(item));
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [key, ...collectObjectKeys(nested)]);
}
