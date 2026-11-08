/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { nativeRuntimeModulesPlugin } from "../../scripts/runtime-build-contract.mjs";
import { afterEach, describe, expect, it } from "vitest";
import { runtimePackageRoot, validateTreeSitterSourceBuild, NativeRuntimeGuardError } from "../../src/infrastructure/runtime/native-runtime-guard.mjs";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-runtime-native-guard-")); roots.push(root);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@auriora/agent-workbench", version: "0.6.12" }));
  const runtime = path.join(root, "node_modules", "tree-sitter");
  const addon = path.join(runtime, "node_modules", "node-addon-api");
  fs.mkdirSync(addon, { recursive: true });
  fs.writeFileSync(path.join(runtime, "package.json"), JSON.stringify({ name: "tree-sitter", version: "0.25.0" }));
  fs.writeFileSync(path.join(addon, "package.json"), JSON.stringify({ name: "node-addon-api", version: "8.7.0" }));
  fs.writeFileSync(path.join(addon, "napi-inl.h"), "#ifdef NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS\n#endif\n");
  const shared = path.join(root, "src", "infrastructure", "runtime"); fs.mkdirSync(shared, { recursive: true });
  for (const name of ["native-runtime-guard.mjs", "native-runtime-startup.mjs"]) {
    fs.copyFileSync(new URL(`../../src/infrastructure/runtime/${name}`, import.meta.url), path.join(shared, name));
  }
  fs.writeFileSync(path.join(runtime, "index.js"), `require('node:fs').writeFileSync(${JSON.stringify(path.join(root, "binding-loaded"))}, 'unsafe'); module.exports = {};`);
  return { root, runtime };
}

describe("native runtime admission guard", () => {
  it("finds source and bundled ownership from the module URL without cwd or environment fallback", () => {
    const { root } = fixture();
    expect(runtimePackageRoot(pathToFileURL(path.join(root, "src/infrastructure/runtime/native-runtime-guard.mjs")))).toBe(root);
    expect(runtimePackageRoot(pathToFileURL(path.join(root, "dist/mcp/stdio-entrypoint.mjs")))).toBe(root);
    expect(() => runtimePackageRoot(pathToFileURL(path.join(root, ...Array(8).fill("deep"), "entry.mjs")))).toThrow("ownership could not be verified");
  });

  it("rejects missing receipt evidence with one actionable error rather than trusting a loadable binary", () => {
    const { root } = fixture();
    let caught: unknown;
    try { validateTreeSitterSourceBuild({ packageRoot: root }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(NativeRuntimeGuardError);
    expect(caught).toMatchObject({ code: "NATIVE_RUNTIME_UNGUARDED", message: expect.stringContaining("guarded tree-sitter runtime") });
  });

  it("does not expose malformed receipt bytes in startup errors", () => {
    const { root, runtime } = fixture();
    fs.mkdirSync(path.join(runtime, "build", "Release"), { recursive: true });
    fs.writeFileSync(path.join(runtime, "build", "Release", "agent-workbench-native.json"), "SENSITIVE_NATIVE_RECEIPT_MARKER invalid-json");
    let caught: unknown;
    try { validateTreeSitterSourceBuild({ packageRoot: root }); } catch (error) { caught = error; }
    expect(caught).toMatchObject({ code: "NATIVE_RUNTIME_UNGUARDED", reason: "native_evidence_invalid" });
    expect(String(caught) + JSON.stringify(caught) + (caught as Error).stack).not.toContain("SENSITIVE_NATIVE_RECEIPT_MARKER");
    expect((caught as Error).cause).toBeUndefined();
  });

  it("blocks actual bundled executor admission before a worker factory when native safety evidence is missing", async () => {
    const { root } = fixture();
    const marker = path.join(root, "worker-started");
    const outfile = path.join(root, "dist", "mcp", "probe.mjs");
    await build({
      stdin: {
        resolveDir: process.cwd(), loader: "ts",
        contents: `import fs from 'node:fs';
          import { StartupGraphRefreshExecutor } from ${JSON.stringify(path.resolve("src/infrastructure/runtime/startup-graph-refresh-executor.ts"))};
          import 'tree-sitter';
          const observation = { epoch:'test', sequence:0, healthy:true, pending_events:0, covered_directories:['.'] };
          const executor = new StartupGraphRefreshExecutor({ database_path:'unused', config_identity:'test', max_files:1, retain_latest_snapshots:1, retain_latest_fresh_snapshots:1, controller_generation:1,
            observation:{ observe:()=>observation, drain:async()=>observation },
            worker_factory(){ fs.writeFileSync(${JSON.stringify(marker)},'unsafe'); throw Error('unguarded worker factory reached'); }
          });
          try { await executor.run({ execution_id:'test', repo_root:'unused', target_snapshot_id:'1', generation:1, deadline:{ timeout_ms:60000, deadline_at:'2026-11-08T00:01:00.000Z' } }); process.exitCode=2; }
          catch(error) { if(error.code !== 'NATIVE_RUNTIME_UNGUARDED') throw error; console.log(error.code); }
        `
      }, outfile, bundle: true, platform: "node", format: "esm", target: "node22", packages: "external", plugins: [nativeRuntimeModulesPlugin()], logLevel: "silent"
    });
    const result = spawnSync(process.execPath, [outfile], { encoding: "utf8", cwd: root });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("NATIVE_RUNTIME_UNGUARDED");
    expect(fs.existsSync(marker)).toBe(false);
    expect(fs.existsSync(path.join(root, "binding-loaded"))).toBe(false);
  });
});
