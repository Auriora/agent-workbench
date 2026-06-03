import path from "node:path";
import type {
  ApplyWorkspaceEditRequest,
  ApplyWorkspaceEditResult,
  ResponseMetadata
} from "../../contracts/index.js";
import type {
  ClockPort,
  EditPreviewStorePort,
  WorkspaceFilePort,
  WorkspaceSafetyPort
} from "../../ports/index.js";
import { sha256Text } from "./preview-edit-token.js";
import { editMeta, fileReference, validateEdits } from "./preview-workspace-edit.js";

export type ApplyWorkspaceEditUseCaseResult = {
  result: ApplyWorkspaceEditResult;
  meta: ResponseMetadata;
};

export async function applyWorkspaceEdit(input: {
  request: ApplyWorkspaceEditRequest;
  workspace: WorkspaceFilePort;
  safety: WorkspaceSafetyPort;
  previews: EditPreviewStorePort;
  clock: ClockPort;
  default_repo_root: string;
}): Promise<ApplyWorkspaceEditUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  validateEdits(input.request.edits, input.safety);

  const preview = await input.previews.consume({
    preview_token: input.request.preview_token
  });
  if (!preview) {
    throw new Error("Preview token was not found or was already consumed.");
  }
  if (Date.parse(preview.expires_at) <= input.clock.nowUnixMs()) {
    throw new Error("Preview token has expired.");
  }
  if (preview.files.length !== input.request.edits.length) {
    throw new Error("Apply edits do not match the preview token.");
  }

  const editsByPath = new Map(input.request.edits.map((edit) => [normalizeRepoPath(edit.path), edit]));
  for (const file of preview.files) {
    const edit = editsByPath.get(file.path);
    if (!edit) {
      throw new Error("Apply edits do not match the preview token.");
    }
    const current = await readPreviewTarget(input.workspace, file.path);
    if (sha256Text(current) !== file.base_hash) {
      throw new Error("Preview is stale because the current file hash changed.");
    }
    if (sha256Text(edit.replacement_text) !== file.after_hash) {
      throw new Error("Apply edit content does not match the preview token.");
    }
  }

  for (const file of preview.files) {
    const edit = editsByPath.get(file.path);
    if (!edit) {
      throw new Error("Apply edits do not match the preview token.");
    }
    await input.workspace.writeText({
      path: file.path,
      content: edit.replacement_text,
      overwrite: true
    });
  }

  return {
    result: {
      repo_root: repoRoot,
      preview_token: preview.preview_token,
      applied_files: preview.files.map((file) => fileReference(file.path)),
      status: "applied",
      next_actions: [
        {
          tool: "verification_plan",
          args: {
            changed_files: preview.files.map((file) => file.path)
          }
        }
      ]
    },
    meta: editMeta(repoRoot, "done")
  };
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

async function readPreviewTarget(workspace: WorkspaceFilePort, filePath: string): Promise<string> {
  try {
    return await workspace.readText({ path: filePath });
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error("Preview is stale because the target file is missing.");
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
