import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COPY_COMPONENTS,
  REQUIRED_PATHS,
  install,
  parseArgs,
  resolveOnPath
} from "../../packaging/agent-workbench/installer.mjs";

// Build a hermetic fake package source satisfying every REQUIRED_PATHS entry,
// so the install exercises copy/sanitize/launcher generation without dragging in
// the real repo's node_modules. A node_modules/tsx marker skips the native rebuild.
function buildFakeSource(root: string): void {
  for (const relativePath of REQUIRED_PATHS as string[]) {
    const target = path.join(root, relativePath);
    if (relativePath === "package.json") continue;
    if (path.extname(relativePath)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, relativePath.endsWith(".json") ? "{}\n" : `// ${relativePath}\n`);
    } else {
      fs.mkdirSync(target, { recursive: true });
    }
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "agent-workbench", scripts: { build: "tsc", "debug:dump": "node x" } }, null, 2)}\n`
  );
  // Checkout-only artifacts the installer must strip.
  fs.mkdirSync(path.join(root, "src", "debug"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "debug", "scratch.ts"), "export {};\n");
  fs.mkdirSync(path.join(root, "docs", "specs", "033"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "specs", "033", "requirements.md"), "# spec\n");
  // tsx marker → rebuild skipped.
  fs.mkdirSync(path.join(root, "node_modules", "tsx"), { recursive: true });
  fs.writeFileSync(path.join(root, "node_modules", "tsx", "package.json"), "{}\n");
}

describe("Agent Workbench installer (spec 033, R1/R2.4 shell-free install)", () => {
  let work: string;
  let source: string;
  let prefix: string;

  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), "aw-installer-"));
    source = path.join(work, "source");
    prefix = path.join(work, "install");
    fs.mkdirSync(source, { recursive: true });
    buildFakeSource(source);
  });

  afterEach(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  describe("parseArgs", () => {
    it("parses the documented options", () => {
      const options = parseArgs([
        "--source", "/s", "--prefix", "/p", "--codex-home", "/c", "--skip-codex-config", "--dry-run"
      ]);
      expect(options).toMatchObject({
        source: "/s",
        prefix: "/p",
        codexHome: "/c",
        writeCodexConfig: false,
        dryRun: true
      });
    });

    it("rejects unknown options", () => {
      expect(() => parseArgs(["--nope"])).toThrowError(/Unknown option: --nope/);
    });
  });

  describe("resolveOnPath", () => {
    it("resolves the running Node executable name on PATH", () => {
      const resolved = resolveOnPath("node");
      expect(resolved).toBeTruthy();
    });

    it("returns null for a command that is not installed", () => {
      expect(resolveOnPath("definitely-not-a-real-command-xyz")).toBeNull();
    });
  });

  describe("dry run", () => {
    it("plans every component and writes nothing", () => {
      const result = install({ source, prefix, writeCodexConfig: false, dryRun: true });
      expect(fs.existsSync(prefix)).toBe(false);
      const actions = result.actions.join("\n");
      for (const component of COPY_COMPONENTS as string[]) {
        if (fs.existsSync(path.join(source, component))) {
          expect(actions).toContain(`copy ${component} ->`);
        }
      }
      expect(actions).toContain("write");
      expect(actions).toContain("agent-workbench-mcp.mjs");
    });
  });

  describe("real install to a temp prefix", () => {
    it("copies the runtime, sanitizes checkout-only files, and generates a Node launcher", () => {
      const result = install({ source, prefix, writeCodexConfig: false });

      // Components copied.
      expect(fs.existsSync(path.join(prefix, "src"))).toBe(true);
      expect(fs.existsSync(path.join(prefix, "plugins", "agent-workbench", "mcp-launch.mjs"))).toBe(true);

      // Sanitized: no checkout-only debug/specs, no debug:* scripts.
      expect(fs.existsSync(path.join(prefix, "src", "debug"))).toBe(false);
      expect(fs.existsSync(path.join(prefix, "docs", "specs"))).toBe(false);
      const installedPkg = JSON.parse(fs.readFileSync(path.join(prefix, "package.json"), "utf8"));
      expect(Object.keys(installedPkg.scripts)).toEqual(["build"]);

      // Launcher generated as shell-free .mjs (no bash shebang).
      const launcher = fs.readFileSync(result.launcherPath, "utf8");
      expect(result.launcherPath).toBe(path.join(prefix, "bin", "agent-workbench-mcp.mjs"));
      expect(launcher.startsWith("#!/usr/bin/env node")).toBe(true);
      expect(launcher).not.toContain("bash");
      expect(launcher).toContain("AGENT_WORKBENCH_DEFAULT_REPO_ROOT");
      expect(launcher).toContain('"stdio.ts"');
      expect(launcher).toContain('"--import", "tsx"');

      // Launcher is valid JS (syntax-checked by Node).
      const check = spawnSync(process.execPath, ["--check", result.launcherPath]);
      expect(check.status).toBe(0);
    });

    it("fails loud when a required component is missing", () => {
      fs.rmSync(path.join(source, "tsconfig.json"));
      expect(() => install({ source, prefix, writeCodexConfig: false })).toThrowError(
        /Missing package component: tsconfig\.json/
      );
    });
  });
});
