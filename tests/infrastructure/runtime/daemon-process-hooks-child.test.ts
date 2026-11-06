/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";

const childModule = "./src/infrastructure/runtime/daemon-process-hooks.ts";

describe("daemon process hooks real-child behavior", () => {
  it.each([
    ["uncaught exception", "setImmediate(() => { throw new Error('fixture fatal'); })", "uncaughtException"],
    ["default-fatal rejection", "Promise.reject(new Error('fixture rejection'))", "unhandledRejection"]
  ])("records %s without suppressing termination", (_label, action, origin) => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", childSource(action)],
      { cwd: process.cwd(), encoding: "utf8" }
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(`fatal:${origin}`);
  });

  it("observes SIGTERM before the existing shutdown handler", async () => {
    const child = spawn(process.execPath, [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      childSource("process.once('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000);")
    ], { cwd: process.cwd() });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    await new Promise<void>((resolve) => {
      const onReady = (chunk: Buffer): void => {
        stdout += chunk.toString("utf8");
        if (stdout.includes("ready\n")) {
          child.stdout.off("data", onReady);
          resolve();
        }
      };
      child.stdout.on("data", onReady);
    });
    child.kill("SIGTERM");
    const [code, signal] = await once(child, "exit") as [number | null, NodeJS.Signals | null];

    expect(code).toBe(0);
    expect(signal).toBeNull();
    expect(stdout).toContain("signal:SIGTERM");
  });
});

function childSource(action: string): string {
  return `
    import fs from "node:fs";
    import { installDaemonProcessHooks } from "${childModule}";
    const evidence = {
      ready() {},
      observeFatal(origin) { fs.writeSync(1, "fatal:" + origin + "\\n"); },
      observeSignal(signal) { fs.writeSync(1, "signal:" + signal + "\\n"); },
      observeExit(code) { fs.writeSync(1, "exit:" + String(code) + "\\n"); },
      getEvidence() { return { status: "unavailable", reason: "not_admitted" }; }
    };
    installDaemonProcessHooks({ evidence });
    fs.writeSync(1, "ready\\n");
    ${action}
  `;
}
