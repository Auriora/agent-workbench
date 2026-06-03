import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyWorkspaceEdit } from "../../src/application/use-cases/apply-workspace-edit.js";
import { previewWorkspaceEdit } from "../../src/application/use-cases/preview-workspace-edit.js";
import type { ClockPort } from "../../src/ports/index.js";
import { InMemoryEditPreviewStoreAdapter } from "../../src/infrastructure/edit-preview-store/index.js";
import {
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "../../src/infrastructure/filesystem/index.js";

const clock: ClockPort = {
  now: () => new Date("2026-05-31T12:00:00.000Z"),
  nowIso8601: () => "2026-05-31T12:00:00.000Z",
  nowUnixMs: () => Date.parse("2026-05-31T12:00:00.000Z")
};

describe("workspace edit preview and apply", () => {
  let repoRoot: string;
  let workspace: WorkspaceFileAdapter;
  let safety: WorkspaceSafetyAdapter;
  let previews: InMemoryEditPreviewStoreAdapter;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-edit-"));
    fs.mkdirSync(path.join(repoRoot, "src"));
    fs.mkdirSync(path.join(repoRoot, "generated"));
    fs.writeFileSync(path.join(repoRoot, "src", "service.py"), "old = 1\n");
    fs.writeFileSync(path.join(repoRoot, "generated", "out.txt"), "generated\n");
    fs.writeFileSync(path.join(repoRoot, ".env"), "TOKEN=old\n");
    workspace = new WorkspaceFileAdapter({ repoRoot });
    safety = new WorkspaceSafetyAdapter({ repoRoot });
    previews = new InMemoryEditPreviewStoreAdapter();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("previews without mutating and applies once after hash checks", async () => {
    const preview = await previewWorkspaceEdit({
      request: {
        edits: [{ path: "src/service.py", replacement_text: "new = 2\n" }],
        expires_in_ms: 600_000
      },
      workspace,
      safety,
      previews,
      clock,
      default_repo_root: repoRoot
    });

    expect(fs.readFileSync(path.join(repoRoot, "src", "service.py"), "utf8")).toBe("old = 1\n");
    expect(preview.preview.preview.files).toEqual([
      expect.objectContaining({
        path: "src/service.py",
        change_count: 1
      })
    ]);

    const applied = await applyWorkspaceEdit({
      request: {
        preview_token: preview.preview.preview.preview_token,
        edits: [{ path: "src/service.py", replacement_text: "new = 2\n" }]
      },
      workspace,
      safety,
      previews,
      clock,
      default_repo_root: repoRoot
    });

    expect(applied.result.status).toBe("applied");
    expect(fs.readFileSync(path.join(repoRoot, "src", "service.py"), "utf8")).toBe("new = 2\n");
    await expect(
      applyWorkspaceEdit({
        request: {
          preview_token: preview.preview.preview.preview_token,
          edits: [{ path: "src/service.py", replacement_text: "new = 2\n" }]
        },
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: repoRoot
      })
    ).rejects.toThrow("Preview token was not found or was already consumed.");
  });

  it("rejects stale previews before writing", async () => {
    const preview = await previewWorkspaceEdit({
      request: {
        edits: [{ path: "src/service.py", replacement_text: "new = 2\n" }],
        expires_in_ms: 600_000
      },
      workspace,
      safety,
      previews,
      clock,
      default_repo_root: repoRoot
    });
    fs.writeFileSync(path.join(repoRoot, "src", "service.py"), "changed elsewhere\n");

    await expect(
      applyWorkspaceEdit({
        request: {
          preview_token: preview.preview.preview.preview_token,
          edits: [{ path: "src/service.py", replacement_text: "new = 2\n" }]
        },
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: repoRoot
      })
    ).rejects.toThrow("Preview is stale because the current file hash changed.");
    expect(fs.readFileSync(path.join(repoRoot, "src", "service.py"), "utf8")).toBe("changed elsewhere\n");
  });

  it("rejects generated paths, .env files, and secret-like replacement text", async () => {
    await expect(
      previewWorkspaceEdit({
        request: {
          edits: [{ path: "generated/out.txt", replacement_text: "x\n" }],
          expires_in_ms: 600_000
        },
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: repoRoot
      })
    ).rejects.toThrow("Generated or vendor paths are read-only by default.");
    await expect(
      previewWorkspaceEdit({
        request: {
          edits: [{ path: ".env", replacement_text: "TOKEN=new\n" }],
          expires_in_ms: 600_000
        },
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: repoRoot
      })
    ).rejects.toThrow("Secret-like files are refused");
    await expect(
      previewWorkspaceEdit({
        request: {
          edits: [{ path: "src/service.py", replacement_text: "token=abc\n" }],
          expires_in_ms: 600_000
        },
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: repoRoot
      })
    ).rejects.toThrow("Replacement text contains secret-like content.");
  });

  it("reports workspace escape separately from generated or vendor read-only paths", async () => {
    await expect(
      previewWorkspaceEdit({
        request: {
          edits: [{ path: "../outside.py", replacement_text: "x = 1\n" }],
          expires_in_ms: 600_000
        },
        workspace,
        safety,
        previews,
        clock,
        default_repo_root: repoRoot
      })
    ).rejects.toThrow("Path resolves outside the repository root.");
  });
});
