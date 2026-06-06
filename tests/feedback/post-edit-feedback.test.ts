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
      checked_files: ["src/app.ts"],
      findings: [],
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
});
