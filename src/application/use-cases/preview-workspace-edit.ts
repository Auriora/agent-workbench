import path from "node:path";
import type {
  FileReference,
  PreviewWorkspaceEditRequest,
  PreviewWorkspaceEditResult,
  ResponseMetadata
} from "../../contracts/index.js";
import type {
  ClockPort,
  EditPreviewStorePort,
  WorkspaceFilePort,
  WorkspaceSafetyPort
} from "../../ports/index.js";
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
            edits: input.request.edits
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
  return {
    path: normalizeRepoPath(filePath),
    language: languageFromPath(filePath),
    exists: true,
    capability_level: languageFromPath(filePath) === "python" ? "partial_semantic" : "unsupported",
    evidence_kinds: languageFromPath(filePath) === "python" ? ["parser"] : [],
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

function languageFromPath(filePath: string): string {
  if (filePath.endsWith(".py")) return "python";
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
  if (filePath.endsWith(".md")) return "markdown";
  if (filePath.endsWith(".json")) return "json";
  if (filePath.endsWith(".toml")) return "toml";
  if (filePath.endsWith(".yml") || filePath.endsWith(".yaml")) return "yaml";
  return "text";
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
