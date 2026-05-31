import { describe, expect, it } from "vitest";
import {
  applyWorkspaceEditResultSchema,
  previewWorkspaceEditResultSchema,
  responseEnvelopeSchema
} from "../../src/contracts/index.js";
import {
  buildApplyWorkspaceEditEnvelope,
  buildInvalidApplyWorkspaceEditInputEnvelope,
  buildInvalidPreviewWorkspaceEditInputEnvelope,
  buildPreviewWorkspaceEditEnvelope
} from "../../src/presentation/workspace-edit-presenter.js";

const meta = {
  analysis_validity: "valid" as const,
  freshness: "fresh" as const,
  scope: {
    repo_root: "/repo",
    indexed_roots: ["."],
    skipped_roots: [],
    languages: ["typescript"]
  },
  capability_level: "resource_backed" as const,
  evidence_kinds: ["direct_read" as const],
  verification_status: "needed" as const,
  truncated: false
};

describe("workspace edit presenter golden responses", () => {
  it("builds the preview response envelope without mutation evidence", () => {
    const envelope = buildPreviewWorkspaceEditEnvelope({
      preview: {
        repo_root: "/repo",
        preview: {
          preview_token: "preview-1",
          created_at: "2026-05-31T00:00:00.000Z",
          expires_at: "2026-05-31T00:10:00.000Z",
          files: [
            {
              path: "src/app.ts",
              base_hash: "base",
              after_hash: "after",
              change_count: 1
            }
          ],
          operation: "bounded_text_edit",
          mutation_class: "workspace_write"
        },
        changed_files: [
          {
            path: "src/app.ts",
            language: "typescript",
            exists: true,
            capability_level: "unsupported",
            evidence_kinds: [],
            reason: "Edit preview requested."
          }
        ],
        next_actions: [
          {
            tool: "apply_workspace_edit",
            args: { preview_token: "preview-1" }
          }
        ]
      },
      meta
    });

    expect(responseEnvelopeSchema(previewWorkspaceEditResultSchema).parse(envelope)).toEqual(
      envelope
    );
    expect(envelope).toMatchObject({
      data: {
        preview: {
          preview_token: "preview-1",
          operation: "bounded_text_edit",
          mutation_class: "workspace_write"
        },
        next_actions: [
          {
            tool: "apply_workspace_edit"
          }
        ]
      },
      warnings: [],
      errors: []
    });
  });

  it("builds apply success and blocked invalid-input envelopes", () => {
    const applied = buildApplyWorkspaceEditEnvelope({
      result: {
        repo_root: "/repo",
        preview_token: "preview-1",
        applied_files: [
          {
            path: "src/app.ts",
            language: "typescript",
            exists: true,
            capability_level: "unsupported",
            evidence_kinds: [],
            reason: "Edit applied."
          }
        ],
        status: "applied",
        next_actions: [
          {
            tool: "verification_plan",
            args: { changed_files: ["src/app.ts"] }
          }
        ]
      },
      meta
    });
    const invalidPreview = buildInvalidPreviewWorkspaceEditInputEnvelope({
      repoRoot: "/repo",
      message: "unsafe path"
    });
    const invalidApply = buildInvalidApplyWorkspaceEditInputEnvelope({
      repoRoot: "/repo",
      message: "stale preview"
    });

    expect(responseEnvelopeSchema(applyWorkspaceEditResultSchema).parse(applied)).toEqual(applied);
    expect(responseEnvelopeSchema(previewWorkspaceEditResultSchema).parse(invalidPreview)).toEqual(
      invalidPreview
    );
    expect(responseEnvelopeSchema(applyWorkspaceEditResultSchema).parse(invalidApply)).toEqual(
      invalidApply
    );
    expect(applied.data).toMatchObject({
      status: "applied",
      next_actions: [{ tool: "verification_plan" }]
    });
    expect(invalidPreview).toMatchObject({
      meta: { analysis_validity: "invalid", verification_status: "blocked" },
      errors: [{ code: "invalid_input", retryable: false }]
    });
    expect(invalidApply).toMatchObject({
      data: { status: "blocked" },
      meta: { analysis_validity: "invalid", verification_status: "blocked" },
      errors: [{ code: "invalid_input", retryable: false }]
    });
  });
});
