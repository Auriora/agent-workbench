/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyPathPolicy,
  parseGitignoreRules
} from "../../src/domain/policies/index.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/file-catalog-scanner.js";
import { FileIdentityAdapter } from "../../src/infrastructure/filesystem/file-identity.js";
import { resolveWorkspacePath } from "../../src/infrastructure/filesystem/workspace-safety.js";

type HookModule = {
  hookPathPolicyReason(file: string): string | undefined;
  buildPostEditFeedback(payload: unknown): {
    findings: Array<{ message: string; category: string; blocking: boolean }>;
  };
};

const hookPath = path.resolve("plugins/agent-workbench/hooks/post-edit-feedback.js");

describe("shared path policy consistency", () => {
  let repoRoot: string;
  let hook: HookModule;

  beforeEach(async () => {
    hook = (await import(pathToFileURL(hookPath).href)) as HookModule;
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-path-policy-"));
    fs.mkdirSync(path.join(repoRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "dist"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "generated"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "vendor"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".vscode"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "ignored-dir"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "nested", ".git"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "src", "app.ts"), "export const app = true;\n");
    fs.writeFileSync(path.join(repoRoot, "dist", "bundle.js"), "export const dist = true;\n");
    fs.writeFileSync(path.join(repoRoot, "generated", "out.ts"), "export const generated = true;\n");
    fs.writeFileSync(path.join(repoRoot, "vendor", "dep.ts"), "export const dep = true;\n");
    fs.writeFileSync(path.join(repoRoot, ".env"), "TOKEN=secret\n");
    fs.writeFileSync(path.join(repoRoot, ".env.local"), "TOKEN=secret\n");
    fs.writeFileSync(path.join(repoRoot, ".envrc"), "export TOKEN=secret\n");
    fs.writeFileSync(path.join(repoRoot, ".env.example"), "TOKEN=\n");
    fs.writeFileSync(path.join(repoRoot, "credentials.json"), "{\"token\":\"secret\"}\n");
    fs.writeFileSync(path.join(repoRoot, "secrets.yaml"), "token: secret\n");
    fs.writeFileSync(path.join(repoRoot, "id_rsa.pem"), "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n");
    fs.writeFileSync(path.join(repoRoot, ".vscode", "settings.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, "ignored.log"), "debug\n");
    fs.writeFileSync(path.join(repoRoot, "keep.log"), "keep\n");
    fs.writeFileSync(path.join(repoRoot, "assistant.log"), "assistant trace\n");
    fs.writeFileSync(path.join(repoRoot, "assistant.keep"), "kept assistant trace\n");
    fs.writeFileSync(path.join(repoRoot, "ignored-dir", "state.json"), "{}\n");
    fs.writeFileSync(path.join(repoRoot, "nested", ".git", "HEAD"), "ref: refs/heads/main\n");
    fs.writeFileSync(path.join(repoRoot, "nested", "foreign.ts"), "export const foreign = true;\n");
    fs.writeFileSync(path.join(repoRoot, ".gitignore"), "*.log\n!keep.log\nignored-dir/\n");
    fs.writeFileSync(path.join(repoRoot, ".aiignore"), "assistant.*\n!assistant.keep\n");
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("classifies secret-bearing paths while preserving safe env examples", () => {
    const gitignoreRules = parseGitignoreRules(fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8"));

    expect(classifyPathPolicy({ relativePath: ".env", isDirectory: false }).reason).toBe("secret");
    expect(classifyPathPolicy({ relativePath: ".env.local", isDirectory: false }).reason).toBe("secret");
    expect(classifyPathPolicy({ relativePath: ".envrc", isDirectory: false }).reason).toBe("secret");
    expect(classifyPathPolicy({ relativePath: "credentials.json", isDirectory: false }).reason).toBe("secret");
    expect(classifyPathPolicy({ relativePath: "secrets.yaml", isDirectory: false }).reason).toBe("secret");
    expect(classifyPathPolicy({ relativePath: "id_rsa.pem", isDirectory: false }).reason).toBe("secret");
    expect(classifyPathPolicy({ relativePath: ".env.example", isDirectory: false }).reason).toBe("source");
    expect(
      classifyPathPolicy({
        relativePath: "ignored.log",
        isDirectory: false,
        gitignoreRules
      }).reason
    ).toBe("gitignore");
  });

  it("keeps scanner skip reasons and workspace write refusals aligned", async () => {
    const scanner = new FileCatalogScannerAdapter();
    const scan = await scanner.scan({
      repo_root: repoRoot,
      indexed_roots: ["."],
      skipped_roots: ["configured-skip"],
      max_files: 100
    });
    const skippedByPath = new Map(scan.skipped_paths?.map((skipped) => [skipped.path, skipped.reason]));

    expect(scan.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        ".aiignore",
        ".env.example",
        ".gitignore",
        "assistant.keep",
        "generated/out.ts",
        "keep.log",
        "src/app.ts"
      ])
    );
    expect(skippedByPath.get(".env")).toBe("secret");
    expect(skippedByPath.get(".envrc")).toBe("secret");
    expect(skippedByPath.get("credentials.json")).toBe("secret");
    expect(skippedByPath.get("secrets.yaml")).toBe("secret");
    expect(skippedByPath.get("id_rsa.pem")).toBe("secret");
    expect(skippedByPath.get("dist")).toBe("generated_or_vendor");
    expect(skippedByPath.get("vendor")).toBe("generated_or_vendor");
    expect(skippedByPath.get(".vscode")).toBe("hidden_path");
    expect(skippedByPath.get("ignored.log")).toBe("gitignore");
    expect(skippedByPath.get("assistant.log")).toBe("gitignore");
    expect(skippedByPath.get("ignored-dir")).toBe("gitignore");
    expect(skippedByPath.get("nested")).toBe("nested_git_repository");

    const fileIdentity = new FileIdentityAdapter();
    await expect(
      fileIdentity.isSkipped({
        path: path.join(repoRoot, "ignored.log"),
        repo_root: repoRoot,
        indexed_roots: ["."],
        skipped_roots: ["configured-skip"]
      })
    ).resolves.toBe(true);
    await expect(
      fileIdentity.isSkipped({
        path: path.join(repoRoot, "assistant.log"),
        repo_root: repoRoot,
        indexed_roots: ["."],
        skipped_roots: ["configured-skip"]
      })
    ).resolves.toBe(true);
    await expect(
      fileIdentity.isSkipped({
        path: path.join(repoRoot, "assistant.keep"),
        repo_root: repoRoot,
        indexed_roots: ["."],
        skipped_roots: ["configured-skip"]
      })
    ).resolves.toBe(false);
    await expect(
      fileIdentity.isSkipped({
        path: path.join(repoRoot, "nested"),
        repo_root: repoRoot,
        indexed_roots: ["."],
        skipped_roots: ["configured-skip"]
      })
    ).resolves.toBe(true);

    for (const target of [
      ".env",
      ".envrc",
      "credentials.json",
      "secrets.yaml",
      "generated/out.ts",
      "vendor/dep.ts",
      ".vscode/settings.json",
      "ignored.log"
    ]) {
      expect(resolveWorkspacePath({ repoRoot }, target, { write: true })).toMatchObject({
        allowed: false,
        reason: "path_refused"
      });
    }
    expect(resolveWorkspacePath({ repoRoot }, ".env.example", { write: true })).toMatchObject({
      allowed: true,
      readOnly: false
    });
  });

  it("keeps hook path-risk vocabulary aligned with runtime classifications", () => {
    expect(hook.hookPathPolicyReason(".env")).toBe("secret");
    expect(hook.hookPathPolicyReason(".env.local")).toBe("secret");
    expect(hook.hookPathPolicyReason(".env.example")).toBeUndefined();
    expect(hook.hookPathPolicyReason("credentials.json")).toBe("secret");
    expect(hook.hookPathPolicyReason("secrets.yaml")).toBe("secret");
    expect(hook.hookPathPolicyReason("generated/out.ts")).toBe("generated_or_vendor");
    expect(hook.hookPathPolicyReason("vendor/dep.ts")).toBe("generated_or_vendor");

    const feedback = hook.buildPostEditFeedback({
      cwd: repoRoot,
      tool_input: {
        path: ".env"
      },
      tool_response: {
        success: true
      }
    });

    expect(feedback.findings).toEqual([
      expect.objectContaining({
        category: "edit_risk",
        message: "Secret-bearing path changed: .env."
      })
    ]);
  });
});
