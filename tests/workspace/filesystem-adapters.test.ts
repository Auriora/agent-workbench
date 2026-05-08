import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FileIdentityAdapter,
  WorkspaceFileAdapter,
  WorkspaceSafetyAdapter
} from "../../src/infrastructure/filesystem/index.js";

describe("workspace file adapter", () => {
  let repoRoot: string;
  let workspaceFileAdapter: WorkspaceFileAdapter;
  let safetyAdapter: WorkspaceSafetyAdapter;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-fs-"));
    fs.mkdirSync(path.join(repoRoot, "src"));
    fs.mkdirSync(path.join(repoRoot, "generated"));
    fs.mkdirSync(path.join(repoRoot, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "generated", "out.txt"), "generated\n");
    fs.writeFileSync(path.join(repoRoot, "node_modules", "report.txt"), "vendor\n");

    workspaceFileAdapter = new WorkspaceFileAdapter({ repoRoot });
    safetyAdapter = new WorkspaceSafetyAdapter({ repoRoot });
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("reads and writes text", async () => {
    await workspaceFileAdapter.writeText({ path: "src/app.py", content: "print('ok')\n" });
    const value = await workspaceFileAdapter.readText({ path: "src/app.py" });
    expect(value).toBe("print('ok')\n");
  });

  it("writes and reads binary payloads", async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    await workspaceFileAdapter.writeBinary({ path: "src/buffer.bin", content: payload });
    const loaded = await workspaceFileAdapter.readBinary({ path: "src/buffer.bin" });

    expect(Array.from(loaded)).toEqual(Array.from(payload));
  });

  it("returns file stats and missing-path stats", async () => {
    await workspaceFileAdapter.writeText({ path: "src/app.py", content: "print('ok')\n" });
    const content = "print('ok')\n";

    const tracked = await workspaceFileAdapter.stat({ path: "src/app.py" });
    expect(tracked.exists).toBe(true);
    expect(tracked.is_file).toBe(true);
    expect(tracked.size_bytes).toBe(Buffer.byteLength(content));
    expect(tracked.mtime_ms).toBeGreaterThan(0);

    const missing = await workspaceFileAdapter.stat({ path: "src/missing.py" });
    expect(missing).toEqual({
      exists: false,
      is_file: false,
      size_bytes: 0,
      mtime_ms: 0
    });
  });

  it("creates directories with ensureDirectory", async () => {
    await workspaceFileAdapter.ensureDirectory({ path: "src/nested" });
    await workspaceFileAdapter.writeText({
      path: "src/nested/out.txt",
      content: "ok",
      overwrite: true
    });

    const tracked = await workspaceFileAdapter.stat({ path: "src/nested/out.txt" });
    expect(tracked.exists).toBe(true);
  });

  it("prevents writes to generated and vendor paths by default", async () => {
    await expect(
      workspaceFileAdapter.writeText({ path: "generated/out.txt", content: "blocked" })
    ).rejects.toThrow("Generated or vendor paths are read-only by default.");
    await expect(
      workspaceFileAdapter.writeBinary({ path: "node_modules/report.txt", content: new Uint8Array([1]) })
    ).rejects.toThrow("Generated or vendor paths are read-only by default.");
    await expect(
      workspaceFileAdapter.deletePath({ path: "generated/out.txt" })
    ).rejects.toThrow("Generated or vendor paths are read-only by default.");
  });

  it("allows generated and vendor writes when policy permits", async () => {
    const writable = new WorkspaceFileAdapter({ repoRoot, allowGeneratedWrites: true });
    await writable.writeText({ path: "generated/out.txt", content: "modified\n" });
    const value = await writable.readText({ path: "generated/out.txt" });
    expect(value).toBe("modified\n");
  });

  it("marks generated and vendor paths as read-only by decision", () => {
    expect(safetyAdapter.isReadOnlyPath("generated/out.txt")).toBe(true);
    expect(safetyAdapter.isReadOnlyPath("node_modules/report.txt")).toBe(true);
  });
});

describe("file identity adapter", () => {
  let repoRoot: string;
  let fileIdentityAdapter: FileIdentityAdapter;
  let samplePath: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-id-"));
    fs.mkdirSync(path.join(repoRoot, "src"));
    samplePath = path.join(repoRoot, "src", "service.py");
    fileIdentityAdapter = new FileIdentityAdapter();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("computes deterministic sha256 identity", async () => {
    const content = "x = 1\n";
    fs.writeFileSync(samplePath, content);
    const expectedHash = `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
    const identity = await fileIdentityAdapter.compute({ path: samplePath, content });

    expect(identity.path).toBe(samplePath);
    expect(identity.language).toBe("python");
    expect(identity.content_hash).toBe(expectedHash);
    expect(identity.size_bytes).toBe(Buffer.byteLength(content));
    expect(identity.mtime_ms).toBeGreaterThan(0);
  });

  it("infers language from file path", async () => {
    expect(await fileIdentityAdapter.inferLanguage({ path: "/x/src/main.py" })).toBe("python");
    expect(await fileIdentityAdapter.inferLanguage({ path: "/x/docs/notes.md" })).toBe("markdown");
    expect(await fileIdentityAdapter.inferLanguage({ path: "/x/config.json" })).toBe("json");
    expect(await fileIdentityAdapter.inferLanguage({ path: "/x/pyproject.toml" })).toBe("toml");
    expect(await fileIdentityAdapter.inferLanguage({ path: "/x/README.config" })).toBe("config");
    expect(await fileIdentityAdapter.inferLanguage({ path: "/x/notes.txt" })).toBe("text");
  });

  it("treats configured scope as skipped when not indexed", async () => {
    expect(
      await fileIdentityAdapter.isSkipped({
        path: path.join(repoRoot, "src", "ignored", "file.py"),
        repo_root: repoRoot,
        indexed_roots: ["src"],
        skipped_roots: ["src/ignored"]
      })
    ).toBe(true);
  });
});
