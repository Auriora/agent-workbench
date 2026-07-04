/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  redactSecretLikeText,
  resolveWorkspacePath
} from "../../src/infrastructure/filesystem/workspace-safety.js";

describe("workspace safety", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-"));
    fs.mkdirSync(path.join(repoRoot, "src"));
    fs.mkdirSync(path.join(repoRoot, "generated"));
    fs.writeFileSync(path.join(repoRoot, "src", "app.py"), "print('ok')\n");
    fs.writeFileSync(path.join(repoRoot, "generated", "out.txt"), "generated\n");
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("allows contained paths", () => {
    const decision = resolveWorkspacePath({ repoRoot }, "src/app.py");

    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.relativePath).toBe("src/app.py");
      expect(decision.readOnly).toBe(false);
    }
  });

  it("rejects parent traversal outside the repo", () => {
    const decision = resolveWorkspacePath({ repoRoot }, "../outside.py");

    expect(decision).toMatchObject({
      allowed: false,
      reason: "path_refused"
    });
  });

  it("rejects symlinks that resolve outside the repo", () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-outside-"));
    try {
      fs.writeFileSync(path.join(outsideDir, "secret.txt"), "outside\n");
      fs.symlinkSync(path.join(outsideDir, "secret.txt"), path.join(repoRoot, "src", "escape"));

      const decision = resolveWorkspacePath({ repoRoot }, "src/escape");

      expect(decision).toMatchObject({
        allowed: false,
        reason: "path_refused"
      });
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it("rejects generated writes by default", () => {
    const decision = resolveWorkspacePath({ repoRoot }, "generated/out.txt", { write: true });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "path_refused"
    });
  });

  it("redacts obvious secret-like values", () => {
    expect(redactSecretLikeText("TOKEN=abc123 password=hunter2")).toBe(
      "TOKEN=[REDACTED] password=[REDACTED]"
    );
  });
});
