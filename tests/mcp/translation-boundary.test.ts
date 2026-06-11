import { describe, expect, it } from "vitest";
import type { GetTaskContextResult } from "../../src/application/use-cases/get-task-context.js";
import type { PlanVerificationResult } from "../../src/application/use-cases/plan-verification.js";
import { taskContextSchema, verificationPlanSchema } from "../../src/contracts/index.js";
import { contextForTaskTool } from "../../src/interface-adapters/mcp/registries/tools/context-for-task.js";
import { verificationPlanTool } from "../../src/interface-adapters/mcp/registries/tools/verification-plan.js";
import { registerMcpTool } from "../helpers/mcp-harness.js";

describe("MCP translation boundaries", () => {
  it("filters backend parser and diagnostic payloads from context_for_task responses", async () => {
    const registered = registerMcpTool(contextForTaskTool, {
      repoRoot: "/repo",
      getTaskContext: () =>
        ({
          context: {
            task: "Parse-only context for translation test",
            repo_root: "/repo",
            summary: "Backend payloads should be stripped.",
            requested_files: [
              {
                path: "src/app.py",
                language: "python",
                exists: true,
                capability_level: "partial_semantic",
                evidence_kinds: ["parser"],
                reason: "Requested file.",
                backend_parser_payload: {
                  worker: "parser-worker-1",
                  raw_ast: ["module", "tree", "nodes"]
                }
              }
            ],
            related_files: [],
            ranked_symbols: [],
            governing_docs: [],
            validation_hints: [],
            skipped_work: [],
            completeness: {
              complete_enough: true,
              markers: ["parser_evidence"],
              caveats: []
            },
            risks: [],
            next_actions: [],
            __parser_diagnostic_payload: {
              backend: "lsp",
              raw: [{ code: "P100", message: "unused import", severity: "warning" }]
            }
          },
          meta: {
            analysis_validity: "valid",
            freshness: "fresh",
            scope: {
              repo_root: "/repo",
              indexed_roots: ["."],
              skipped_roots: [],
              languages: ["python"]
            },
            capability_level: "partial_semantic",
            evidence_kinds: ["parser"],
            verification_status: "needed",
            truncated: false
          }
        }) as unknown as GetTaskContextResult
    });

    const response = await registered.handler({
      task: "Parse-only context for translation test"
    });
    const responseText = response.content[0]?.text ?? "{}";
    const parsed = JSON.parse(responseText) as { data: unknown; contract_version: string };

    expect(parsed.contract_version).toBe("0.1");
    expect(taskContextSchema.parse(parsed.data as never)).toMatchObject({
      task: "Parse-only context for translation test"
    });
    expect(responseText).not.toContain("backend_parser_payload");
    expect(responseText).not.toContain("__parser_diagnostic_payload");
    expect(responseText).not.toContain("parser-worker-1");
  });

  it("filters validation discovery and worker payloads from verification_plan responses", async () => {
    const registered = registerMcpTool(verificationPlanTool, {
      repoRoot: "/repo",
      planVerification: () =>
        ({
          plan: {
            repo_root: "/repo",
            status: "blocked",
            summary: "Validation should be blocked from raw discovery payloads.",
            planned_commands: [
              {
                command: "pnpm",
                args: ["run", "lint"],
                display: "pnpm run lint",
                reason: "fixture test-discovery",
                status: "planned",
                execution: "not_executed",
                test_discovery_raw: {
                  source: "pytest-worker",
                  raw_result: {
                    artifacts: [{ kind: "raw_test", value: "1 failing case" }]
                  }
                }
              }
            ],
            static_feedback: {
              status: "actionable",
              checked_files: ["src/app.py"],
              findings: [
                {
                  path: "src/app.py",
                  severity: "warning",
                  message: "Changed file missing in scan.",
                  suggested_action: "Review file path.",
                  __raw_worker_trace: {
                    id: "trace-worker",
                    message: "raw worker payload"
                  }
                }
              ]
            },
            risks: [
              {
                severity: "warning",
                message: "Validation discovery hit parse-only payload.",
                why_this_matters: "No stable payload field should be passed out."
              }
            ],
            next_actions: [
              {
                tool: "context_for_task",
                args: {
                  task: "Refresh context",
                  files: ["src/app.py"]
                }
              }
            ],
            __worker_discovery_payload: {
              pid: 404,
              backend: "worker-discovery"
            }
          },
          meta: {
            analysis_validity: "partial",
            freshness: "unknown",
            scope: {
              repo_root: "/repo",
              indexed_roots: ["."],
              skipped_roots: [],
              languages: ["python"]
            },
            capability_level: "unsupported",
            evidence_kinds: ["infra_parser"],
            verification_status: "blocked",
            truncated: false,
            __raw_worker_payload: {
              id: "bg-worker-12",
              diagnostics: [{ code: "E001", detail: "raw" }]
            }
          }
        }) as unknown as PlanVerificationResult
    });

    const response = await registered.handler({
      files: ["src/app.py"]
    });
    const responseText = response.content[0]?.text ?? "{}";
    const parsed = JSON.parse(responseText) as {
      data: unknown;
      contract_version: string;
    };

    expect(parsed.contract_version).toBe("0.1");
    expect(verificationPlanSchema.parse(parsed.data as never)).toMatchObject({
      status: "blocked"
    });
    expect(responseText).not.toContain("test_discovery_raw");
    expect(responseText).not.toContain("__worker_discovery_payload");
    expect(responseText).not.toContain("__raw_worker_payload");
    expect(responseText).not.toContain("__raw_worker_trace");
    expect(responseText).not.toContain("worker-discovery");
  });
});
