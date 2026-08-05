/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs smoke helper imported into the TS test via esbuild.
import { buildMcpLaunchSmokePlan } from "../../scripts/ci/mcp-launch-smoke.mjs";

describe("mcp-launch smoke plan", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    while (workspaces.length > 0) {
      fs.rmSync(workspaces.pop()!, { recursive: true, force: true });
    }
  });

  it("uses a fresh temporary workspace cwd and leaves the default repo root unset", () => {
    const checkoutRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-checkout-"));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-workspace-"));
    workspaces.push(checkoutRoot, workspaceRoot);

    const plan = buildMcpLaunchSmokePlan({ checkoutRoot, workspaceRoot });

    expect(plan.child.options.cwd).toBe(workspaceRoot);
    expect(plan.child.options.env?.AGENT_WORKBENCH_INSTALL_ROOT).toBe(checkoutRoot);
    expect(plan.child.options.env?.AGENT_WORKBENCH_DEFAULT_REPO_ROOT).toBeUndefined();
    expect(plan.child.args).toEqual([
      path.join(checkoutRoot, "plugins", "agent-workbench", "mcp-launch.mjs")
    ]);
  });
});
