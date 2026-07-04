/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type {
  FileReference,
  PreviewWorkspaceEditRequest,
  PreviewWorkspaceEditResult,
  ResponseMetadata
} from "../../contracts/index.js";
import { describeFileCapability } from "../../domain/policies/index.js";
import type {
  ClockPort,
  EditPreviewStorePort,
  WorkspaceFilePort,
  WorkspaceSafetyPort
} from "../../ports/index.js";
import { inferLanguageFromPath } from "./file-catalog-entry.js";
import { createPreviewToken } from "./preview-edit-token.js";

export type PreviewWorkspaceEditUseCaseResult = {
  preview: PreviewWorkspaceEditResult;
  meta: ResponseMetadata;
};

export async function previewWorkspaceEdit(input: {
  request: PreviewWorkspaceEditRequest;
  workspace: WorkspaceFilePort;
  safety: WorkspaceSafetyPort;
  previews: EditPreviewStorePort;
  clock: ClockPort;
  default_repo_root: string;
}): Promise<PreviewWorkspaceEditUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  validateEdits(input.request.edits, input.safety);

  const token = createPreviewToken({
    files: await Promise.all(
      input.request.edits.map(async (edit) => ({
        path: normalizeRepoPath(edit.path),
        before: await readWorkspaceEditTarget(input.workspace, edit.path),
        after: edit.replacement_text
      }))
    ),
    now: input.clock.now(),
    expiresInMs: input.request.expires_in_ms
  });
  await input.previews.put({ preview: token });

  return {
    preview: {
      repo_root: repoRoot,
      preview: token,
      changed_files: token.files.map((file) => fileReference(file.path)),
      next_actions: [
        {
          tool: "apply_workspace_edit",
          args: {
            preview_token: token.preview_token,
            paths: token.files.map((file) => file.path),
            requires_original_edits: true
          }
        }
      ]
    },
    meta: meta(repoRoot, "planned")
  };
}

export function validateEdits(
  edits: readonly { path: string; replacement_text: string }[],
  safety: WorkspaceSafetyPort
): void {
  for (const edit of edits) {
    const normalizedPath = normalizeRepoPath(edit.path);
    if (normalizedPath === ".env" || normalizedPath.endsWith("/.env")) {
      throw new Error("Secret-like files are refused by workspace edit preview.");
    }
    const decision = safety.resolveWorkspacePath(edit.path, { write: true });
    if (!decision.allowed) {
      throw new Error(decision.message);
    }
    if (safety.redactSecretLikeText(edit.replacement_text) !== edit.replacement_text) {
      throw new Error("Replacement text contains secret-like content.");
    }
  }
}

export function fileReference(filePath: string): FileReference {
  const normalizedPath = normalizeRepoPath(filePath);
  const language = inferLanguageFromPath(normalizedPath);
  const capability = describeFileCapability({
    path: normalizedPath,
    language
  });

  return {
    path: normalizedPath,
    language,
    exists: true,
    capability_level: capability.capability_level,
    evidence_kinds: [...capability.evidence_kinds],
    reason: "Workspace edit preview target."
  };
}

export function editMeta(repoRoot: string, verificationStatus: ResponseMetadata["verification_status"]): ResponseMetadata {
  return meta(repoRoot, verificationStatus);
}

function meta(repoRoot: string, verificationStatus: ResponseMetadata["verification_status"]): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "unknown",
    scope: {
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      languages: []
    },
    capability_level: "unsupported",
    evidence_kinds: ["direct_read"],
    verification_status: verificationStatus,
    truncated: false
  };
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

async function readWorkspaceEditTarget(workspace: WorkspaceFilePort, filePath: string): Promise<string> {
  try {
    return await workspace.readText({ path: filePath });
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(`Workspace edit target was not found: ${normalizeRepoPath(filePath)}`);
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
