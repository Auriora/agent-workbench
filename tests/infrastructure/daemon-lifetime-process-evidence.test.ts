/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { FileDaemonLifetimeEvidenceAdapter } from "../../src/infrastructure/runtime/daemon-lifetime-evidence.js";
import { daemonLifetimeEvidenceFileSchema } from "../../src/contracts/daemon-lifetime-contracts.js";

const directories: string[] = [];
const detachedPids: number[] = [];
const storeModule = pathToFileURL(path.resolve("src/infrastructure/runtime/daemon-lifetime-evidence.ts")).href;
const hooksModule = pathToFileURL(path.resolve("src/infrastructure/runtime/daemon-process-hooks.ts")).href;
const secretError = "private fixture /home/private-source token=never-store-this";

afterEach(() => {
  for (const pid of detachedPids.splice(0)) {
    try { process.kill(pid, "SIGKILL"); } catch { /* already exited */ }
  }
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("daemon lifetime evidence from real processes", () => {
  it.each([
    ["normal", "process.exit(0)", 0, "exit"],
    ["nonzero", "process.exit(19)", 19, "exit"],
    ["exception", `setImmediate(() => { throw new Error(${JSON.stringify(secretError)}); })`, 1, "uncaughtException"],
    ["rejection", `Promise.reject(new Error(${JSON.stringify(secretError)}))`, 1, "unhandledRejection"]
  ] as const)("persists %s exit independently of stderr", (_name, action, code, reason) => {
    const receiptPath = createPath();
    const result = runChild(source(receiptPath, action));
    expect(result.status).toBe(code);
    const receipt = readReceipt(receiptPath);
    expect(receipt.current).toMatchObject({ phase: "exit", reason, observed_code: code });
    expect(fs.readFileSync(receiptPath, "utf8")).not.toContain(secretError);
    expect(fs.readFileSync(receiptPath, "utf8")).not.toContain("/home/");
  });

  it("persists SIGTERM before the existing shutdown handler exits", async () => {
    const receiptPath = createPath();
    const child = startChild(source(receiptPath, `
      process.once("SIGTERM", () => process.exit(0));
      setInterval(() => {}, 1000);
      process.stdout.write("ready\\n");
    `));
    try {
      const exited = childExit(child);
      await ready(child);
      child.kill("SIGTERM");
      expect(await exited).toEqual({ code: 0, signal: null });
      expect(readReceipt(receiptPath).current).toMatchObject({
        phase: "exit", reason: "sigterm", observed_signal: "SIGTERM", observed_code: 0
      });
    } finally { child.kill("SIGKILL"); }
  });

  it("classifies SIGKILL as unknown on the next admission without inventing a signal", async () => {
    const receiptPath = createPath();
    const child = startChild(source(receiptPath, `setInterval(() => {}, 1000); process.stdout.write("ready\\n");`));
    try {
      const exited = childExit(child);
      await ready(child);
      child.kill("SIGKILL");
      expect(await exited).toEqual({ code: null, signal: "SIGKILL" });
      expect(readReceipt(receiptPath).current.phase).toBe("ready");
      expect(runChild(source(receiptPath, "process.exit(0)")).status).toBe(0);
      expect(readReceipt(receiptPath).previous).toMatchObject({
        phase: "owner_loss", reason: "unknown_prior_owner_loss"
      });
      expect(readReceipt(receiptPath).previous?.observed_code).toBeUndefined();
      expect(readReceipt(receiptPath).previous?.observed_signal).toBeUndefined();
    } finally { child.kill("SIGKILL"); }
  });

  it("preserves fatal termination when the evidence sink is unavailable", () => {
    const blocker = createPath();
    fs.writeFileSync(blocker, "not a directory", { mode: 0o600 });
    const receiptPath = path.join(blocker, "receipt.json");
    const result = runChild(source(receiptPath, `
      process.stdout.write(JSON.stringify(evidence.getEvidence()));
      setImmediate(() => { throw new Error(${JSON.stringify(secretError)}); });
    `));
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "unavailable" });
    expect(fs.existsSync(receiptPath)).toBe(false);
  });

  it("persists a fatal exit after the launching parent has exited", async () => {
    const receiptPath = createPath();
    const parentGoneAction = `
      const launchingPid = Number(process.env.FIXTURE_LAUNCHER_PID);
      const timer = setInterval(() => {
        try { process.kill(launchingPid, 0); }
        catch (error) {
          if (error.code !== "ESRCH") return;
          clearInterval(timer);
          throw new Error(${JSON.stringify(secretError)});
        }
      }, 10);
      setTimeout(() => process.exit(23), 10000).unref();
    `;
    const launcher = `
      import { spawn } from "node:child_process";
      const child = spawn(process.execPath, ${JSON.stringify(["--import", "tsx", "--input-type=module", "-e", source(receiptPath, parentGoneAction)])}, {
        detached: true, stdio: "ignore", env: { ...process.env, FIXTURE_LAUNCHER_PID: String(process.pid) }
      });
      process.stdout.write(String(child.pid));
      child.unref();
    `;
    const launched = runChild(launcher);
    expect(launched.status).toBe(0);
    detachedPids.push(Number(launched.stdout));
    await until(() => fs.existsSync(receiptPath) && readReceipt(receiptPath).current.phase === "exit");
    expect(readReceipt(receiptPath).current).toMatchObject({ reason: "uncaughtException", observed_code: 1 });
  });

  it("leaves permissions on unrelated ancestors unchanged", () => {
    const directory = path.dirname(createPath());
    const parentMode = fs.statSync(path.dirname(directory)).mode;
    const directoryMode = fs.statSync(directory).mode;
    const evidence = new FileDaemonLifetimeEvidenceAdapter(path.join(directory, "nested", "receipt.json"));
    evidence.ready({ daemon_id: "a".repeat(64), launch_token: crypto.randomUUID(), pid: process.pid,
      runtime_version: "0.6.9", started_at: new Date().toISOString() });
    expect(evidence.getEvidence().status).toBe("available");
    expect(fs.statSync(directory).mode).toBe(directoryMode);
    expect(fs.statSync(path.dirname(directory)).mode).toBe(parentMode);
  });
});

function source(receiptPath: string, action: string): string {
  return `
    import { FileDaemonLifetimeEvidenceAdapter } from ${JSON.stringify(storeModule)};
    import { installDaemonProcessHooks } from ${JSON.stringify(hooksModule)};
    import crypto from "node:crypto";
    const evidence = new FileDaemonLifetimeEvidenceAdapter(${JSON.stringify(receiptPath)});
    installDaemonProcessHooks({ evidence });
    evidence.ready({ daemon_id: "a".repeat(64), launch_token: crypto.randomUUID(), pid: process.pid,
      runtime_version: "0.6.9", build_fingerprint: "b".repeat(64), started_at: new Date().toISOString() });
    ${action}
  `;
}
function createPath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "awb-lifetime-process-"));
  directories.push(directory);
  return path.join(directory, "receipt.json");
}
function readReceipt(receiptPath: string) {
  return daemonLifetimeEvidenceFileSchema.parse(JSON.parse(fs.readFileSync(receiptPath, "utf8")));
}
function runChild(code: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], {
    cwd: process.cwd(), encoding: "utf8", timeout: 15000
  });
}
function startChild(code: string) {
  return spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: process.cwd() });
}
function childExit(child: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}
function ready(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Child readiness timed out")), 10000);
    let output = "";
    const onData = (chunk: Buffer) => { output += chunk.toString(); if (output.includes("ready\n")) finish(); };
    const onExit = () => finish(new Error("Child exited before readiness"));
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.off("exit", onExit);
      if (error) reject(error); else resolve();
    };
    child.stdout?.on("data", onData);
    child.once("exit", onExit);
  });
}
async function until(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Receipt observation timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
