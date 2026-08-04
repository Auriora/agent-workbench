/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it, vi } from "vitest";
import { boundaryForPath, discoverRepositoryBoundaries, pathIsOutsideRepositoryBoundaries } from "../../src/application/use-cases/project-unit-boundaries.js";
import type { FileCatalogSkippedPath, WorkspaceFilePort } from "../../src/ports/index.js";

describe("project-unit repository boundaries", () => {
  it.each([false, true])("detects declared submodule paths without exposing URLs or traversing (initialized=%s)", async (initialized) => {
    const workspace = memoryWorkspace({
      ".gitmodules": "[submodule \"private\"]\n path = libs/private\n url = https://user:secret@example.invalid/repo.git\n",
      ...(initialized ? { "libs/private/.git": "gitdir: elsewhere" } : {})
    });
    const result = await discoverRepositoryBoundaries({ workspace: workspace.port });
    expect(result.boundaries).toEqual([expect.objectContaining({
      path: "libs/private",
      boundary: "declared_submodule",
      availability: initialized ? "initialized" : "uninitialized",
      evidence_paths: [".gitmodules"],
      blocker: expect.objectContaining({ kind: "submodule_unavailable", blocked_claims: ["repository_traversal"] })
    })]);
    expect(JSON.stringify(result)).not.toContain("example.invalid");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.boundaries[0]?.blocker.next_action).toBeUndefined();
    expect(workspace.writeText).not.toHaveBeenCalled();
  });

  it("reports an undeclared embedded repository as an incomplete boundary", async () => {
    const skipped: FileCatalogSkippedPath = { path: "vendor/embedded", reason: "nested_git_repository", detail: "Nested repository paths are skipped." };
    const result = await discoverRepositoryBoundaries({ workspace: memoryWorkspace({}).port, skipped_paths: [skipped] });
    expect(result.boundaries[0]).toMatchObject({ path: "vendor/embedded", boundary: "repository_boundary_unknown", availability: "incomplete" });
  });

  it("keeps parent paths usable while confining selected boundary descendants", async () => {
    const result = await discoverRepositoryBoundaries({ workspace: memoryWorkspace({ ".gitmodules": "path = modules/child\n" }).port });
    expect(boundaryForPath("modules/child/src/main.rs", result.boundaries)?.path).toBe("modules/child");
    expect(pathIsOutsideRepositoryBoundaries("src/main.ts", result.boundaries)).toBe(true);
  });

  it("returns bounded limitations for malformed and oversized metadata", async () => {
    const malformed = await discoverRepositoryBoundaries({ workspace: memoryWorkspace({ ".gitmodules": "path = ../escape\n" }).port });
    expect(malformed.limitations[0]?.kind).toBe("gitmodules_malformed");
    const oversized = await discoverRepositoryBoundaries({ workspace: memoryWorkspace({ ".gitmodules": "x".repeat(32_001) }).port });
    expect(oversized.limitations[0]?.kind).toBe("gitmodules_oversized");
  });
});

function memoryWorkspace(files: Readonly<Record<string, string>>) {
  const writeText = vi.fn<WorkspaceFilePort["writeText"]>();
  const port: WorkspaceFilePort = {
    readText: async ({ path }) => files[path] ?? "",
    readTextPrefix: async ({ path, max_bytes }) => (files[path] ?? "").slice(0, max_bytes),
    readBinary: async () => new Uint8Array(),
    writeText,
    writeBinary: vi.fn(),
    stat: async ({ path }) => ({ exists: files[path] !== undefined, is_file: files[path] !== undefined, size_bytes: files[path]?.length ?? 0, mtime_ms: 1 }),
    deletePath: vi.fn(),
    ensureDirectory: vi.fn()
  };
  return { port, writeText };
}
