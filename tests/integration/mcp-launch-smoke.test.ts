/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs smoke helper imported into the TS test via esbuild.
import { buildMcpLaunchSmokePlan, terminateChildForCleanup } from "../../scripts/ci/mcp-launch-smoke.mjs";

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
    expect(plan.child.options.env?.AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS).toBe("250");
    expect(plan.child.options.env?.AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS).toBe("60000");
    expect(plan.child.args).toEqual([
      path.join(checkoutRoot, "plugins", "agent-workbench", "mcp-launch.mjs")
    ]);
  });

  it("can prove a portable launch with an explicit bundled Node and constrained environment", () => {
    const checkoutRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-checkout-"));
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-workspace-"));
    workspaces.push(checkoutRoot, workspaceRoot);
    const nodeExecutable = path.join(checkoutRoot, "node.exe");

    const plan = buildMcpLaunchSmokePlan({
      checkoutRoot,
      workspaceRoot,
      nodeExecutable,
      baseEnv: { PATH: checkoutRoot, SYSTEMROOT: "C:\\Windows" }
    });

    expect(plan.child.command).toBe(nodeExecutable);
    expect(plan.child.options.env?.PATH).toBe(checkoutRoot);
    expect(plan.child.options.env?.SYSTEMROOT).toBe("C:\\Windows");
  });

  it("waits for the launcher to exit before allowing workspace cleanup", async () => {
    const events: string[] = [];
    const child = new EventEmitter() as EventEmitter & {
      exitCode: number | null;
      signalCode: NodeJS.Signals | null;
      kill: () => boolean;
    };
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => {
      events.push("kill");
      queueMicrotask(() => {
        events.push("exit");
        child.exitCode = 0;
        child.emit("exit", 0, null);
        queueMicrotask(() => {
          events.push("close");
          child.emit("close", 0, null);
        });
      });
      return true;
    };

    await terminateChildForCleanup(child);
    events.push("cleanup");

    expect(events).toEqual(["kill", "exit", "close", "cleanup"]);
  });
});
