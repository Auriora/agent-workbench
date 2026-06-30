import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs shim imported into the TS test via esbuild.
import { planLaunch } from "../../plugins/agent-workbench/mcp-launch.mjs";
import {
  resolveRuntimeRoot,
  runtimePointerPath,
  writeRuntimeRoot
  // @ts-expect-error -- ESM .mjs resolver imported into the TS test via esbuild.
} from "../../plugins/agent-workbench/install-root.mjs";

describe("mcp-launch shim planLaunch (spec 033)", () => {
  const root = "/install/root";
  const baseEnv = { AGENT_WORKBENCH_INSTALL_ROOT: root };
  const entry = path.join(root, "src", "mcp", "stdio-entrypoint.mjs");

  it("spawns node directly against <root>/src/mcp/stdio-entrypoint.mjs", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.command).toBe(process.execPath);
    expect(plan.args).toEqual([entry]);
    expect(plan.root).toBe(root);
  });

  it("does not force a cwd or use --import tsx (the entrypoint self-resolves tsx)", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.options.cwd).toBeUndefined();
    expect(plan.args).not.toContain("--import");
    expect(plan.args).not.toContain("tsx");
    expect(plan.options.stdio).toBe("inherit");
  });

  it("defaults AGENT_WORKBENCH_DEFAULT_REPO_ROOT to the launch cwd when unset", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBe("/repo");
  });

  it("preserves an explicit AGENT_WORKBENCH_DEFAULT_REPO_ROOT", () => {
    const env = { ...baseEnv, AGENT_WORKBENCH_DEFAULT_REPO_ROOT: "/explicit/repo" };
    const plan = planLaunch(env, [], "/repo");
    expect(plan.options.env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBe("/explicit/repo");
  });

  it("passes through extra argv after the entry script", () => {
    const plan = planLaunch(baseEnv, ["--flag", "value"], "/repo");
    expect(plan.args).toEqual([entry, "--flag", "value"]);
  });

  it("does not invoke a shell (no bash / -lc anywhere in the plan)", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.command).not.toContain("bash");
    expect(plan.args).not.toContain("-lc");
  });

  it("throws an actionable error when the runtime root cannot be resolved", () => {
    expect(() => planLaunch({ HOME: "/nonexistent-runtime-root" }, [], "/repo")).toThrow(
      /runtime not found.*GitHub release tarball/s
    );
  });
});

describe("runtime-root pointer resolution (spec 033)", () => {
  let home: string;
  const env = (): NodeJS.ProcessEnv => ({ HOME: home });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-runtime-root-"));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("writes the pointer under the per-OS state dir and reads it back", () => {
    const pointer = writeRuntimeRoot("/opt/pkg", env(), "linux");
    expect(pointer).toBe(runtimePointerPath(env(), "linux"));
    expect(fs.readFileSync(pointer, "utf8").trim()).toBe("/opt/pkg");
    expect(resolveRuntimeRoot(env(), "linux")).toBe("/opt/pkg");
  });

  it("lets AGENT_WORKBENCH_INSTALL_ROOT override the recorded pointer", () => {
    writeRuntimeRoot("/opt/pkg", env(), "linux");
    expect(resolveRuntimeRoot({ ...env(), AGENT_WORKBENCH_INSTALL_ROOT: "/checkout" }, "linux")).toBe(
      "/checkout"
    );
  });

  it("returns null when no override and no pointer file exist", () => {
    expect(resolveRuntimeRoot(env(), "linux")).toBeNull();
  });
});
