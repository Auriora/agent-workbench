/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type ParserTypes from "tree-sitter";
// @ts-expect-error -- Import the runnable installation script without invoking its CLI.
import { buildRebuildEnv, runTreeSitterSourceBuild, treeSitterSourceBuildPlan, validateTreeSitterSourceBuild } from "../../scripts/rebuild-native.mjs";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function fixture(version = "0.25.0", supported = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-native-build-")); roots.push(root);
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "consumer", private: true }));
  const runtime = path.join(root, "node_modules", "tree-sitter");
  const addon = path.join(runtime, "node_modules", "node-addon-api");
  const loader = path.join(runtime, "node_modules", "node-gyp-build");
  const builder = path.join(root, "node_modules", "node-gyp");
  fs.mkdirSync(addon, { recursive: true }); fs.mkdirSync(loader, { recursive: true }); fs.mkdirSync(path.join(builder, "bin"), { recursive: true });
  fs.writeFileSync(path.join(runtime, "package.json"), JSON.stringify({ name: "tree-sitter", version }));
  fs.writeFileSync(path.join(addon, "package.json"), JSON.stringify({ name: "node-addon-api", version: "8.7.0" }));
  fs.writeFileSync(path.join(addon, "napi-inl.h"), supported ? "#ifdef NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS\n#endif\n" : "// unsupported\n");
  fs.writeFileSync(path.join(loader, "package.json"), JSON.stringify({ name: "node-gyp-build", version: "4.8.4" }));
  fs.writeFileSync(path.join(loader, "index.js"), "exports.path = root => require('node:path').join(root, 'build', 'Release', 'tree_sitter_runtime_binding.node');\n");
  fs.writeFileSync(path.join(builder, "package.json"), JSON.stringify({ name: "node-gyp", version: "11.5.0" }));
  fs.writeFileSync(path.join(builder, "bin", "node-gyp.js"), "// test builder\n");
  return { root, runtime, builder: path.join(builder, "bin", "node-gyp.js") };
}

describe("termination-safe native runtime installation", () => {
  it("selects the installed source builder without requiring consumer pnpm and enforces safe flags", () => {
    const f = fixture();
    const plan = treeSitterSourceBuildPlan({ packageRoot: f.root, env: { PATH: "", CXXFLAGS: "-O2" } });
    expect(plan.command).toBe(process.execPath);
    expect(plan.args).toEqual([f.builder, "rebuild"]);
    expect(plan.cwd).toBe(f.runtime);
    expect(plan.env.npm_config_build_from_source).toBeUndefined();
    expect(plan.env.CXXFLAGS).toBe("-O2 -std=c++20 -DNODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS");
    expect(buildRebuildEnv(plan.env)).toEqual(plan.env);
  });

  it("rejects an unreviewed runtime or unavailable node-addon-api policy before executing a build", () => {
    expect(() => treeSitterSourceBuildPlan({ packageRoot: fixture("0.25.1").root })).toThrow("requires tree-sitter 0.25.0");
    expect(() => treeSitterSourceBuildPlan({ packageRoot: fixture("0.25.0", false).root })).toThrow("does not support termination-safe");
    const f = fixture();
    fs.writeFileSync(path.join(f.root, "node_modules", "node-gyp", "package.json"), JSON.stringify({ name: "node-gyp", version: "11.4.2" }));
    expect(() => treeSitterSourceBuildPlan({ packageRoot: f.root })).toThrow("requires node-gyp 11.5.0");
  });

  it("records the actual source-built binary and refuses a successful command without a binary", () => {
    const f = fixture();
    const binary = Buffer.from("test-source-built-binding");
    const run = (writeBinary: boolean) => runTreeSitterSourceBuild({
      packageRoot: f.root,
      env: { PATH: "", CXXFLAGS: "-O2" },
      spawn(command: string, args: string[], options: { cwd: string; env: Record<string, string> }) {
        expect(command).toBe(process.execPath); expect(args).toEqual([f.builder, "rebuild"]);
        expect(options.cwd).toBe(f.runtime);
        expect(options.env.npm_config_build_from_source).toBeUndefined();
        expect(options.env.CXXFLAGS).toContain("-DNODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS");
        if (writeBinary) {
          fs.mkdirSync(path.join(f.runtime, "build", "Release"), { recursive: true });
          fs.writeFileSync(path.join(f.runtime, "build", "Release", "tree_sitter_runtime_binding.node"), binary);
        }
        return { status: 0 };
      }
    });
    expect(run(false)).toBe(1);
    expect(run(true)).toBe(0);
    const receipt = JSON.parse(fs.readFileSync(path.join(f.runtime, "build", "Release", "agent-workbench-native.json"), "utf8"));
    expect(receipt).toMatchObject({ schema_version: 1, tree_sitter_version: "0.25.0", node_gyp_version: "11.5.0", define: "NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS",
      binding_sha256: createHash("sha256").update(binary).digest("hex") });
    expect(validateTreeSitterSourceBuild({ packageRoot: f.root })).toEqual(receipt);
    const loader = createRequire(path.join(f.runtime, "package.json"))("node-gyp-build");
    const selected = loader.path;
    const unverified = path.join(f.runtime, "unsafe-prebuilt.node"); fs.writeFileSync(unverified, binary);
    loader.path = () => unverified;
    try { expect(() => validateTreeSitterSourceBuild({ packageRoot: f.root })).toThrow("guarded tree-sitter runtime"); }
    finally { loader.path = selected; }
    fs.writeFileSync(path.join(f.runtime, "build", "Release", "tree_sitter_runtime_binding.node"), "changed binary");
    expect(() => validateTreeSitterSourceBuild({ packageRoot: f.root })).toThrow("guarded tree-sitter runtime");
  });

  it.each(["build", "receipt"])("fails postinstall before advertising a runtime when %s validation fails", failure => {
    const f = fixture();
    const scripts = path.join(f.root, "scripts"); const plugin = path.join(f.root, "plugins", "agent-workbench");
    fs.mkdirSync(scripts); fs.mkdirSync(plugin, { recursive: true });
    fs.copyFileSync(new URL("../../scripts/postinstall.mjs", import.meta.url), path.join(scripts, "postinstall.mjs"));
    fs.writeFileSync(path.join(scripts, "rebuild-native.mjs"), `export function runTreeSitterSourceBuild() { return ${failure === "build" ? 1 : 0}; } export function validateTreeSitterSourceBuild() { throw Error('unverified prebuild'); }`);
    const advertised = path.join(f.root, "advertised");
    fs.writeFileSync(path.join(plugin, "install-root.mjs"), `import fs from 'node:fs'; export function runtimePointerPath(){return ''; } export function writeRuntimeRoot(){fs.writeFileSync(${JSON.stringify(advertised)},'unsafe');}`);
    fs.writeFileSync(path.join(plugin, "codex-mcp-config.mjs"), `export function materializeCodexMcpConfig() { throw Error('should not advertise'); }`);
    const result = spawnSync(process.execPath, [path.join(scripts, "postinstall.mjs")], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(fs.existsSync(advertised)).toBe(false);
  });

  it("retains ordinary callback exceptions instead of converting them into a parse result", async () => {
    const { default: Parser } = await import("tree-sitter");
    const { default: Python } = await import("tree-sitter-python");
    const parser = new Parser(); parser.setLanguage(Python as unknown as ParserTypes.Language);
    const original = new Error("ordinary parser callback failure");
    let caught: unknown;
    try { parser.parse(() => { throw original; }); } catch (error) { caught = error; }
    expect(caught).toBe(original);
    expect(parser.parse("def works():\n    return 1\n")?.rootNode.type).toBe("module");
  });
});
