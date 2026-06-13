import { describe, expect, it } from "vitest";
import { buildPostEditFeedback } from "../../src/application/use-cases/build-post-edit-feedback.js";
import {
  buildPostEditFeedbackEnvelope,
  buildPostEditHookMessage
} from "../../src/presentation/post-edit-feedback-presenter.js";

describe("post-edit feedback use case", () => {
  it("stays quiet for clean changed files", () => {
    const result = buildPostEditFeedback({
      request: {
        repo_root: "/repo",
        changed_files: ["src/app.ts"],
        edit_risks: []
      },
      default_repo_root: "/default"
    });
    const envelope = buildPostEditFeedbackEnvelope(result);

    expect(result.feedback).toMatchObject({
      status: "done",
      outcome: "checked",
      checked_files: ["src/app.ts"],
      findings: [],
      deferred_checks: [],
      visible_message: undefined,
      next_actions: []
    });
    expect(buildPostEditHookMessage(result)).toBeUndefined();
    expect(envelope.meta.verification_status).toBe("done");
  });

  it("combines diagnostics, edit risks, validation status, and next actions", () => {
    const result = buildPostEditFeedback({
      request: {
        repo_root: "/repo",
        changed_files: ["src/app.py"],
        validation_status: "blocked",
        edit_risks: [
          {
            path: "generated/out.py",
            severity: "warning",
            message: "Generated/local artifact changed.",
            blocking: false,
            suggested_action: "Review whether the artifact should be ignored."
          }
        ],
        diagnostics: {
          repo_root: "/repo",
          status: "blocked",
          summary: "Diagnostics need attention.",
          checked_files: ["src/app.py"],
          findings: [
            {
              path: "src/app.py",
              severity: "blocker",
              message: "Python syntax error.",
              category: "syntax",
              provider_id: "fixture",
              capability_level: "partial_semantic",
              evidence_kinds: ["parser"],
              blocking: true,
              fix_hint: "Fix syntax before validation."
            }
          ],
          provider_statuses: [],
          next_actions: []
        }
      },
      default_repo_root: "/default"
    });

    expect(result.feedback.status).toBe("blocked");
    expect(result.feedback.outcome).toBe("actionable");
    expect(result.feedback.findings.map((finding) => finding.category)).toEqual([
      "diagnostic",
      "edit_risk",
      "validation"
    ]);
    expect(result.feedback.visible_message).toContain("src/app.py: Python syntax error.");
    expect(result.feedback.next_actions).toEqual([
      {
        tool: "diagnostics_for_files",
        args: {
          repo_root: "/repo",
          files: ["src/app.py"]
        }
      },
      {
        tool: "verification_plan",
        args: {
          repo_root: "/repo",
          changed_files: ["src/app.py"]
        }
      }
    ]);
    expect(buildPostEditHookMessage(result)).toBe(result.feedback.visible_message);
  });

  it("sanitizes relative paths in presenter output", () => {
    const result = buildPostEditFeedback({
      request: {
        repo_root: "/repo",
        changed_files: [".\\src\\app.ts"],
        edit_risks: [
          {
            path: ".\\src\\app.ts",
            severity: "warning",
            message: "Validation planning is low confidence.",
            blocking: false
          }
        ]
      },
      default_repo_root: "/default"
    });
    const envelope = buildPostEditFeedbackEnvelope(result);

    expect(envelope.data.checked_files).toEqual(["src/app.ts"]);
    expect(envelope.data.findings[0]).toMatchObject({
      path: "src/app.ts",
      category: "edit_risk"
    });
  });

  it("classifies empty clean feedback as silent", () => {
    const result = buildPostEditFeedback({
      request: {
        repo_root: "/repo",
        changed_files: [],
        edit_risks: []
      },
      default_repo_root: "/default"
    });

    expect(result.feedback).toMatchObject({
      status: "done",
      outcome: "silent",
      checked_files: [],
      findings: [],
      deferred_checks: [],
      visible_message: undefined,
      next_actions: []
    });
  });

  it("classifies over-budget changed files as queued with explicit follow-up evidence", () => {
    const result = buildPostEditFeedback({
      request: {
        repo_root: "/repo",
        changed_files: ["src/a.ts", "src/b.ts", "src/c.ts"],
        max_inline_files: 2,
        edit_risks: []
      },
      default_repo_root: "/default"
    });

    expect(result.feedback).toMatchObject({
      status: "done",
      outcome: "queued",
      checked_files: ["src/a.ts", "src/b.ts", "src/c.ts"],
      deferred_checks: [
        {
          reason: "too_many_files",
          outcome: "queued",
          count: 1,
          paths: ["src/c.ts"],
          follow_up_tool: "diagnostics_for_files"
        }
      ],
      visible_message: undefined
    });
    expect(result.feedback.next_actions).toEqual([
      {
        tool: "diagnostics_for_files",
        args: {
          repo_root: "/repo",
          files: ["src/a.ts", "src/b.ts", "src/c.ts"]
        }
      },
      {
        tool: "verification_plan",
        args: {
          repo_root: "/repo",
          changed_files: ["src/a.ts", "src/b.ts", "src/c.ts"]
        }
      }
    ]);
  });

  it("classifies unavailable, errored, and skipped provider statuses without visible messages", () => {
    const baseDiagnostics = {
      repo_root: "/repo",
      status: "not_applicable" as const,
      summary: "Diagnostics completed with no actionable findings.",
      checked_files: ["config/a.json", "src/app.java", "src/app.py"],
      findings: [],
      next_actions: []
    };
    const result = buildPostEditFeedback({
      request: {
        repo_root: "/repo",
        changed_files: ["config/a.json", "src/app.java", "src/app.py"],
        edit_risks: [],
        diagnostics: {
          ...baseDiagnostics,
          provider_statuses: [
            {
              provider_id: "json",
              path: "config/a.json",
              status: "unavailable",
              capability_level: "resource_backed",
              evidence_kinds: ["config"]
            },
            {
              provider_id: "java",
              path: "src/app.java",
              status: "not_applicable",
              capability_level: "unsupported",
              evidence_kinds: []
            },
            {
              provider_id: "python",
              path: "src/app.py",
              status: "failed",
              capability_level: "partial_semantic",
              evidence_kinds: ["parser"]
            }
          ]
        }
      },
      default_repo_root: "/default"
    });

    expect(result.feedback).toMatchObject({
      status: "done",
      outcome: "errored",
      visible_message: undefined,
      deferred_checks: [
        {
          reason: "provider_failed",
          outcome: "errored",
          count: 1,
          paths: ["src/app.py"]
        },
        {
          reason: "provider_unavailable",
          outcome: "unavailable",
          count: 1,
          paths: ["config/a.json"]
        },
        {
          reason: "provider_not_applicable",
          outcome: "skipped",
          count: 1,
          paths: ["src/app.java"]
        }
      ]
    });
  });

  it("preserves caller-supplied skipped deferred checks", () => {
    const result = buildPostEditFeedback({
      request: {
        repo_root: "/repo",
        changed_files: ["src/large.json"],
        edit_risks: [],
        deferred_checks: [
          {
            reason: "diagnostics_skipped",
            outcome: "skipped",
            count: 1,
            paths: ["./src/large.json"],
            message: "File was too large for inline diagnostics.",
            follow_up_tool: "verification_plan"
          }
        ]
      },
      default_repo_root: "/default"
    });

    expect(result.feedback).toMatchObject({
      status: "done",
      outcome: "skipped",
      checked_files: ["src/large.json"],
      findings: [],
      visible_message: undefined,
      deferred_checks: [
        {
          reason: "diagnostics_skipped",
          outcome: "skipped",
          count: 1,
          paths: ["src/large.json"],
          follow_up_tool: "verification_plan"
        }
      ]
    });
  });
});
