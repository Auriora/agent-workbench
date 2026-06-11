import { describe, expect, it } from "vitest";
import { getRepoOverview } from "../../src/application/use-cases/get-repo-overview.js";
import { getRepoScope } from "../../src/application/use-cases/get-repo-scope.js";
import { getScannedRepoStatus } from "../../src/application/use-cases/get-repo-status.js";
import type { ResponseEnvelope } from "../../src/contracts/index.js";
import { DEFAULT_SKIPPED_ROOTS } from "../../src/domain/policies/index.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";
import { buildRepoOverviewEnvelope } from "../../src/presentation/repo-overview-presenter.js";
import { buildRepoScopeEnvelope } from "../../src/presentation/repo-scope-presenter.js";
import { buildStatusEnvelope } from "../../src/presentation/status-presenter.js";

const skippedRoots = [...DEFAULT_SKIPPED_ROOTS].sort();

describe("repo orientation golden responses", () => {
  it.each([
    {
      repoRoot: "tests/fixtures/fixture-basic-python",
      languages: ["python", "toml"],
      statusCoverage: [
        coverage("language", "python", "partial_semantic", ["parser"], [
          "src/sample_pkg/__init__.py",
          "src/sample_pkg/service.py",
          "tests/test_service.py"
        ]),
        coverage("package_manager", "python", "resource_backed", ["config"], ["pyproject.toml"])
      ],
      scopeCounts: {
        file_counts: { python: 3, toml: 1 },
        capability_counts: {
          semantic: 0,
          partial_semantic: 3,
          resource_backed: 1,
          unsupported: 0
        }
      },
      skippedPaths: [
        skippedPath("src/sample_pkg/__pycache__"),
        skippedPath("tests/__pycache__")
      ],
      overview: {
        summary: "Repository has 4 indexed file(s) across 2 language/category value(s).",
        platforms: ["python"],
        key_files: [
          file("pyproject.toml", "toml", "resource_backed", ["config"], "Promoted as package configuration evidence."),
          file("src/sample_pkg/__init__.py", "python", "partial_semantic", ["parser"], "Promoted as first-party source evidence."),
          file("src/sample_pkg/service.py", "python", "partial_semantic", ["parser"], "Promoted as first-party source evidence."),
          file("tests/test_service.py", "python", "partial_semantic", ["parser"], "Promoted as test evidence.")
        ],
        key_docs: [],
        validation_hints: [
          {
            command: "python3 -m pytest",
            reason: "pyproject.toml indicates Python tests may be available.",
            status: "needed"
          }
        ]
      }
    },
    {
      repoRoot: "tests/fixtures/fixture-markdown-config",
      languages: ["json", "markdown", "text"],
      statusCoverage: [
        coverage("documentation", "markdown", "resource_backed", ["docs"], [
          "README.md",
          "docs/architecture.md"
        ], "medium"),
        coverage("documentation", "text", "resource_backed", ["docs"], ["generated/output.txt"], "medium"),
        coverage("package_manager", "npm", "resource_backed", ["config"], ["package.json"])
      ],
      scopeCounts: {
        file_counts: { json: 1, markdown: 2, text: 1 },
        capability_counts: {
          semantic: 0,
          partial_semantic: 0,
          resource_backed: 4,
          unsupported: 0
        }
      },
      skippedPaths: undefined,
      overview: {
        summary: "Repository has 4 indexed file(s) across 3 language/category value(s).",
        platforms: ["node"],
        key_files: [
          file("package.json", "json", "resource_backed", ["config"], "Promoted as package configuration evidence.")
        ],
        key_docs: [
          {
            path: "README.md",
            title: "README",
            reason: "Repository entry document.",
            evidence_kinds: ["docs"]
          },
          {
            path: "docs/architecture.md",
            title: "Architecture",
            reason: "Durable architecture or design document.",
            evidence_kinds: ["docs"]
          }
        ],
        validation_hints: [
          {
            command: "verification_plan",
            reason: "package.json and JS/TS project-shape evidence indicate package-local validation should be planned without executing package managers.",
            status: "needed"
          },
          {
            command: "pnpm typecheck",
            reason: "TypeScript configuration or package scripts indicate a non-executed typecheck candidate; confirm repo policy and package manager before running.",
            status: "needed"
          },
          {
            command: "pnpm test",
            reason: "Package/test-root evidence indicates a non-executed JavaScript/TypeScript test candidate; confirm repo policy and package manager before running.",
            status: "needed"
          }
        ]
      }
    },
    {
      repoRoot: "tests/fixtures/fixture-mixed-language-platform",
      languages: ["infrastructure", "json", "python", "typescript", "yaml"],
      statusCoverage: [
        coverage("infrastructure", "infrastructure", "resource_backed", ["config"], ["Dockerfile"]),
        coverage("infrastructure", "yaml", "resource_backed", ["config"], [
          ".github/workflows/ci.yml"
        ]),
        coverage("language", "python", "partial_semantic", ["parser"], ["src/service.py"]),
        coverage("language", "typescript", "partial_semantic", ["parser"], ["src/app.ts"]),
        coverage("package_manager", "npm", "resource_backed", ["config"], ["package.json"])
      ],
      scopeCounts: {
        file_counts: { infrastructure: 1, json: 1, python: 1, typescript: 1, yaml: 1 },
        capability_counts: {
          semantic: 0,
          partial_semantic: 2,
          resource_backed: 3,
          unsupported: 0
        }
      },
      skippedPaths: [
        skippedPath(".cache")
      ],
      overview: {
        summary: "Repository has 5 indexed file(s) across 5 language/category value(s).",
        platforms: ["docker", "github_actions", "node", "typescript"],
        key_files: [
          file(
            "src/app.ts",
            "typescript",
            "partial_semantic",
            ["parser"],
            "Promoted as application entrypoint and first-party source evidence."
          ),
          file("package.json", "json", "resource_backed", ["config"], "Promoted as package configuration evidence."),
          file("Dockerfile", "infrastructure", "resource_backed", ["config"], "Promoted as infrastructure environment evidence."),
          file("src/service.py", "python", "partial_semantic", ["parser"], "Promoted as first-party source evidence."),
          file(".github/workflows/ci.yml", "yaml", "resource_backed", ["config"], "Promoted as workflow configuration evidence.")
        ],
        key_docs: [],
        validation_hints: [
          {
            command: "verification_plan",
            reason: "package.json and JS/TS project-shape evidence indicate package-local validation should be planned without executing package managers.",
            status: "needed"
          },
          {
            command: "pnpm typecheck",
            reason: "TypeScript configuration or package scripts indicate a non-executed typecheck candidate; confirm repo policy and package manager before running.",
            status: "needed"
          },
          {
            command: "pnpm test",
            reason: "Package/test-root evidence indicates a non-executed JavaScript/TypeScript test candidate; confirm repo policy and package manager before running.",
            status: "needed"
          }
        ]
      }
    }
  ])("matches golden orientation envelopes for $repoRoot", async (fixture) => {
    const scanner = new FileCatalogScannerAdapter();
    const status = normalizeEnvelope(
      buildStatusEnvelope(
        await getScannedRepoStatus({
          repo_root: fixture.repoRoot,
          scanner
        })
      )
    );
    const scope = normalizeEnvelope(
      buildRepoScopeEnvelope(
        await getRepoScope({
          repo_root: fixture.repoRoot,
          scanner
        })
      )
    );
    const overview = normalizeEnvelope(
      buildRepoOverviewEnvelope(
        await getRepoOverview({
          repo_root: fixture.repoRoot,
          scanner
        })
      )
    );

    const baseMeta = {
      analysis_validity: "valid",
      freshness: "unknown",
      scope: {
        repo_root: "<repo_root>",
        indexed_roots: ["."],
        skipped_roots: skippedRoots,
        languages: fixture.languages
      },
      capability_level: fixture.statusCoverage.some((item) => item.capability_level === "partial_semantic")
        ? "partial_semantic"
        : "resource_backed",
      evidence_kinds: fixture.statusCoverage.some((item) => item.evidence_kinds.includes("parser"))
        ? ["config", "parser"]
        : ["config", "docs"],
      verification_status: "needed",
      truncated: false,
      budget: {
        row_limit: 15000
      }
    };

    expect(status).toEqual({
      contract_version: "0.1",
      data: {
        repo_root: "<repo_root>",
        runtime_state: "partial",
        freshness: "unknown",
        indexed_roots: ["."],
        skipped_roots: skippedRoots,
        adapter_coverage: fixture.statusCoverage
      },
      meta: baseMeta,
      warnings: [],
      errors: []
    });
    expect(scope).toEqual({
      contract_version: "0.1",
      data: {
        repo_root: "<repo_root>",
        indexed_roots: ["."],
        skipped_roots: skippedRoots,
        languages: fixture.languages,
        ...fixture.scopeCounts,
        generated_or_vendor_roots: skippedRoots,
        skipped_paths: fixture.skippedPaths
      },
      meta: baseMeta,
      warnings: [],
      errors: []
    });
    expect(overview).toEqual({
      contract_version: "0.1",
      data: {
        repo_root: "<repo_root>",
        summary: fixture.overview.summary,
        languages: fixture.languages,
        platforms: fixture.overview.platforms,
        key_files: fixture.overview.key_files,
        key_docs: fixture.overview.key_docs,
        validation_hints: fixture.overview.validation_hints,
        skipped_paths: fixture.skippedPaths,
        recommended_first_calls: [
          { tool: "read_resource", args: { uri: "repo:///status" } },
          { tool: "read_resource", args: { uri: "repo:///scope" } },
          { tool: "context_for_task", args: { task: "Describe the planned change before editing." } },
          { tool: "verification_plan", args: { files: [] } }
        ]
      },
      meta: baseMeta,
      warnings: [],
      errors: []
    });
  });
});

function coverage(
  domain: string,
  name: string,
  capabilityLevel: string,
  evidenceKinds: string[],
  paths: string[],
  confidence = "high"
) {
  return {
    domain,
    name,
    capability_level: capabilityLevel,
    evidence_kinds: evidenceKinds,
    paths,
    provenance: "file_identity",
    confidence,
    metadata: {}
  };
}

function file(
  path: string,
  language: string,
  capabilityLevel: string,
  evidenceKinds: string[],
  reason: string
) {
  return {
    path,
    language,
    exists: true,
    capability_level: capabilityLevel,
    evidence_kinds: evidenceKinds,
    reason
  };
}

function skippedPath(path: string) {
  return {
    path,
    reason: "generated_or_vendor",
    detail: "Generated, dependency, cache, build, or vendor path was excluded from catalog evidence."
  };
}

function normalizeEnvelope(envelope: ResponseEnvelope<unknown>): ResponseEnvelope<unknown> {
  return replaceRepoRoot(envelope) as ResponseEnvelope<unknown>;
}

function replaceRepoRoot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replaceRepoRoot(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key === "repo_root" ? "<repo_root>" : replaceRepoRoot(nested)
    ])
  );
}
