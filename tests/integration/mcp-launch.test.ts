import path from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs shim imported into the TS test via esbuild.
import { planLaunch } from "../../plugins/agent-workbench/mcp-launch.mjs";

describe("mcp-launch shim planLaunch (spec 033 T002a)", () => {
  const root = "/install/root";
  const baseEnv = { AGENT_WORKBENCH_INSTALL_ROOT: root };

  it("spawns node --import tsx against <root>/src/mcp/stdio.ts", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.command).toBe(process.execPath);
    expect(plan.args).toEqual(["--import", "tsx", path.join(root, "src", "mcp", "stdio.ts")]);
    expect(plan.root).toBe(root);
  });

  it("runs the child with cwd set to the install root (for tsx resolution)", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.options.cwd).toBe(root);
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
    expect(plan.args).toEqual([
      "--import",
      "tsx",
      path.join(root, "src", "mcp", "stdio.ts"),
      "--flag",
      "value"
    ]);
  });

  it("does not invoke a shell (no bash / -lc anywhere in the plan)", () => {
    const plan = planLaunch(baseEnv, [], "/repo");
    expect(plan.command).not.toContain("bash");
    expect(plan.args).not.toContain("-lc");
  });
});
