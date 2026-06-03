import { describe, expect, it } from "vitest";
import { getTaskContext } from "../../src/application/use-cases/get-task-context.js";
import { planVerification } from "../../src/application/use-cases/plan-verification.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";

const scanner = new FileCatalogScannerAdapter();

describe("Codex replacement readiness", () => {
  it("keeps first-pass context and docs/config routing in MVP schema terms", async () => {
    const basicContext = await getTaskContext({
      request: {
        task: "Update the Python Runner service",
        repo_root: "tests/fixtures/fixture-basic-python",
        files: ["src/sample_pkg/service.py"],
        symbols: ["Runner"],
        max_files: 5,
        max_docs: 5
      },
      scanner,
      default_repo_root: "."
    });
    const docsConfigContext = await getTaskContext({
      request: {
        task: "Update architecture docs and package validation",
        repo_root: "tests/fixtures/fixture-markdown-config",
        files: ["README.md", "package.json"],
        symbols: [],
        max_files: 5,
        max_docs: 5
      },
      scanner,
      default_repo_root: "."
    });

    expect(basicContext.context.requested_files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/sample_pkg/service.py",
          exists: true
        })
      ])
    );
    expect(basicContext.context.next_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "symbol_search",
          args: expect.objectContaining({
            query: "Runner"
          })
        })
      ])
    );
    expect(docsConfigContext.context.governing_docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "README.md",
          evidence_kinds: ["docs"]
        }),
        expect.objectContaining({
          path: "docs/architecture.md",
          evidence_kinds: ["docs"]
        })
      ])
    );
    expect(docsConfigContext.context.validation_hints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "pnpm typecheck" }),
        expect.objectContaining({ command: "pnpm test" })
      ])
    );
    expect(JSON.stringify([basicContext.context, docsConfigContext.context])).not.toMatch(
      /agent-ide|python-agent-ide|diagnostics_for_files|run_nearest_tests/u
    );
  });

  it("maps validation planning, test planning, and post-edit feedback to verification_plan", async () => {
    const mixedRoot = "tests/fixtures/fixture-mixed-language-platform";
    const pythonRoot = "tests/fixtures/fixture-basic-python";
    const docsRoot = "tests/fixtures/fixture-markdown-config";

    const mixedPlan = await planVerification({
      request: {
        task: "Validate app and package changes",
        repo_root: mixedRoot,
        files: ["src/app.ts", "package.json"],
        changed_files: ["src/app.ts"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner,
      workspace: new WorkspaceFileAdapter({ repoRoot: mixedRoot }),
      default_repo_root: "."
    });
    const pythonPlan = await planVerification({
      request: {
        task: "Validate Python service changes",
        repo_root: pythonRoot,
        files: ["src/sample_pkg/service.py"],
        changed_files: [],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner,
      workspace: new WorkspaceFileAdapter({ repoRoot: pythonRoot }),
      default_repo_root: "."
    });
    const docsPlan = await planVerification({
      request: {
        task: "Validate documentation and config changes",
        repo_root: docsRoot,
        files: ["README.md", "package.json"],
        changed_files: ["README.md"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner,
      workspace: new WorkspaceFileAdapter({ repoRoot: docsRoot }),
      default_repo_root: "."
    });
    const missingChangedFilePlan = await planVerification({
      request: {
        task: "Check post-edit feedback for a stale changed-file target",
        repo_root: docsRoot,
        files: [],
        changed_files: ["docs/missing.md"],
        include_static_feedback: true,
        max_commands: 10
      },
      scanner,
      workspace: new WorkspaceFileAdapter({ repoRoot: docsRoot }),
      default_repo_root: "."
    });

    expect(mixedPlan.plan.status).toBe("planned");
    expect(mixedPlan.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display: "pnpm run typecheck",
          execution: "not_executed"
        }),
        expect.objectContaining({
          display: "pnpm run test",
          execution: "not_executed"
        })
      ])
    );
    expect(mixedPlan.plan.static_feedback).toBeUndefined();

    expect(pythonPlan.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display: "python3 -m pytest",
          execution: "not_executed"
        })
      ])
    );
    expect(pythonPlan.plan.next_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "symbol_search",
          args: expect.objectContaining({
            query: "service"
          })
        })
      ])
    );

    expect(docsPlan.plan.planned_commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          display: "planned docs/config syntax review",
          execution: "not_executed"
        })
      ])
    );
    expect(docsPlan.plan.static_feedback).toBeUndefined();

    expect(missingChangedFilePlan.plan.status).toBe("blocked");
    expect(missingChangedFilePlan.plan.static_feedback).toEqual(
      expect.objectContaining({
        status: "actionable",
        checked_files: ["docs/missing.md"],
        findings: [
          expect.objectContaining({
            path: "docs/missing.md",
            message: "Changed file was not found in the scanned repository."
          })
        ]
      })
    );
    expect(
      JSON.stringify([
        mixedPlan.plan,
        pythonPlan.plan,
        docsPlan.plan,
        missingChangedFilePlan.plan
      ])
    ).not.toMatch(/agent-ide|python-agent-ide|raw_test|worker|diagnostic_payload/u);
  });
});
