/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs CI helper imported into the TS test via esbuild.
import * as portableSmoke from "../../scripts/ci/windows-portable-smoke.mjs";
// @ts-expect-error -- ESM .mjs CI helper imported into the TS test via esbuild.
import { PAYLOAD_HASH_EXCLUSIONS } from "../../scripts/ci/build-windows-portable.mjs";

const {
  buildBundledEntrypointStatusSmokePlan,
  parsePortableSmokeArgs,
  validatePortableManifest,
  validateRepoStatusReadMessage
} = portableSmoke;

describe("Windows portable consumer smoke contract", () => {
  it("requires exact release identity inputs", () => {
    expect(() => parsePortableSmokeArgs([])).toThrow("--bundle-root is required");
    expect(() => parsePortableSmokeArgs([
      "--bundle-root", "bundle",
      "--expected-version", "next",
      "--git-sha", "a".repeat(40)
    ])).toThrow("X.Y.Z");
  });

  it("rejects manifest drift and accepts the exact Windows x64 identity", () => {
    const expectedVersion = "9.8.7";
    const gitSha = "c".repeat(40);
    const manifest = {
      schema_version: "1",
      package: "@auriora/agent-workbench",
      version: expectedVersion,
      git_sha: gitSha,
      platform: "win32",
      architecture: "x64",
      node_version: "22.23.1",
      node_modules_abi: "127",
      package_root: "runtime/node_modules/@auriora/agent-workbench",
      entrypoint: "agent-workbench.cmd",
      configure: "configure.cmd",
      source_package_sha256: "d".repeat(64),
      source_lock_sha256: "a".repeat(64),
      deployment_lock_sha256: "f".repeat(64),
      payload_hash_exclusions: PAYLOAD_HASH_EXCLUSIONS,
      payload_sha256: "e".repeat(64)
    };
    expect(() => validatePortableManifest(manifest, { expectedVersion, gitSha })).not.toThrow();
    expect(() => validatePortableManifest({ ...manifest, architecture: "arm64" }, { expectedVersion, gitSha })).toThrow(
      "manifest architecture"
    );
    expect(() => validatePortableManifest({ ...manifest, node_version: "24.8.0" }, { expectedVersion, gitSha })).toThrow(
      "not Node 22"
    );
  });

  it("launches the shipped cmd entrypoint through cmd.exe with a constrained read-only status path", () => {
    const env = {
      COMSPEC: "C:\\Windows\\System32\\cmd.exe",
      PATH: "C:\\bundle;C:\\Windows\\System32"
    };
    const plan = buildBundledEntrypointStatusSmokePlan({
      bundleRoot: "C:\\bundle",
      workspaceRoot: "C:\\workspace",
      env
    });

    expect(plan).toMatchObject({
      child: {
        command: env.COMSPEC,
        args: ["/d", "/s", "/c", '"C:\\bundle\\agent-workbench.cmd"'],
        options: {
          cwd: "C:\\workspace",
          env,
          stdio: ["pipe", "pipe", "pipe"]
        }
      }
    });
  });

  it("accepts repo status responses only for the bounded workspace root", () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-portable-status-workspace-"));
    const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-portable-status-other-"));
    try {
      const expected = {
        data: {
          repo_root: workspaceRoot,
          runtime_state: "fresh",
          freshness: "fresh"
        }
      };
      const message = {
        result: {
          contents: [
            {
              uri: "repo:///status",
              text: JSON.stringify(expected)
            }
          ]
        }
      };

      expect(validateRepoStatusReadMessage(message, workspaceRoot)).toMatchObject(expected);
      expect(() => validateRepoStatusReadMessage({
        result: {
          contents: [
            {
              uri: "repo:///status",
              text: JSON.stringify({
                data: {
                  repo_root: otherRoot,
                  runtime_state: "fresh",
                  freshness: "fresh"
                }
              })
            }
          ]
        }
      }, workspaceRoot)).toThrow("repo_root did not match");
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
      fs.rmSync(otherRoot, { recursive: true, force: true });
    }
  });
});
