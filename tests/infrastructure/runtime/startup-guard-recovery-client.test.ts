/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { recoverStartupGuardViaHelper } from "../../../src/infrastructure/runtime/startup-guard-recovery-client.js";

describe("isolated startup guard recovery client", () => {
  it.each([
    [0, "recovered"],
    [78, "native_module_rebuild_required"],
    [1, "ambiguous"]
  ] as const)("classifies an isolated helper exit %i without importing its code", async (code, outcome) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-recovery-client-"));
    const entrypoint = path.join(root, "helper.mjs");
    fs.writeFileSync(entrypoint, `
      let input = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => input += chunk);
      process.stdin.on('end', () => {
        const value = JSON.parse(input);
        process.exitCode = value.expected.token === 'observed' ? ${code} : 99;
      });
    `);
    try {
      await expect(recoverStartupGuardViaHelper(entrypoint, {
        guard_path: path.join(root, "startup.lock.reclaim"),
        expected: { dev: "1", ino: "2", pid: 999999999, token: "observed", created_at: new Date().toISOString() }
      })).resolves.toBe(outcome);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves the native hint when the helper closes stdin before reading", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-recovery-early-exit-"));
    const entrypoint = path.join(root, "helper.mjs");
    fs.writeFileSync(entrypoint, "import fs from 'node:fs'; fs.closeSync(0); process.exitCode = 78;\n");
    try {
      await expect(recoverStartupGuardViaHelper(entrypoint, {
        guard_path: path.join(root, "startup.lock.reclaim"),
        expected: { dev: "1", ino: "2", pid: 999999999, token: "observed", created_at: new Date().toISOString() }
      })).resolves.toBe("native_module_rebuild_required");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(["{malformed\n", "x".repeat(8193)])("rejects malformed or oversized process input silently", (input) => {
    const result = spawnSync(process.execPath, [path.resolve("src/mcp/startup-guard-recovery-entrypoint.mjs")], {
      input, encoding: "utf8", timeout: 5000
    });
    expect(result.status).toBe(77);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("does not spawn recovery after its caller has cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(recoverStartupGuardViaHelper("missing-entrypoint.mjs", {
      guard_path: "/unreached/startup.lock.reclaim",
      expected: { dev: "1", ino: "2", pid: 999999999, token: "observed", created_at: new Date().toISOString() }
    }, controller.signal)).resolves.toBe("ambiguous");
  });
});
