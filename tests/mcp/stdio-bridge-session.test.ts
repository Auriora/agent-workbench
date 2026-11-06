/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Socket } from "node:net";
import { once, PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  createStdioBridgeSession,
  type StdioBridgeSession
} from "../../src/mcp/stdio-launch.js";

function createHarness(input = new PassThrough()): {
  input: PassThrough;
  output: PassThrough;
  stderr: PassThrough;
  socketStream: PassThrough;
  socket: Socket;
  session: StdioBridgeSession;
} {
  const output = new PassThrough();
  const stderr = new PassThrough();
  const socketStream = new PassThrough();
  const socket = socketStream as unknown as Socket;
  const session = createStdioBridgeSession(socket, {
    stdin: input,
    stdout: output,
    stderr
  });
  return { input, output, stderr, socketStream, socket, session };
}

type BridgeHarness = {
  input: PassThrough;
  output: Writable;
  stderr: Writable;
  socketStream: PassThrough;
  socket: Socket;
  session: StdioBridgeSession;
};

async function expectOwnedListenersRemoved(harness: BridgeHarness): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.input.listenerCount("end")).toBe(0);
  expect(harness.input.listenerCount("close")).toBe(0);
  expect(harness.input.listenerCount("error")).toBe(0);
  expect(harness.stderr.listenerCount("error")).toBe(0);
  expect(harness.stderr.listenerCount("close")).toBe(0);
  expect(harness.output.listenerCount("close")).toBe(0);
  expect(harness.output.listenerCount("error")).toBe(0);
  expect(harness.output.listenerCount("drain")).toBe(0);
  expect(harness.socketStream.listenerCount("close")).toBe(0);
  expect(harness.socketStream.listenerCount("error")).toBe(0);
  expect(harness.socketStream.listenerCount("data")).toBe(0);
}

describe("stdio bridge session", () => {
  it("stays open and forwards bytes while both transports are open", async () => {
    const harness = createHarness();
    const output: Buffer[] = [];
    harness.output.on("data", (chunk: Buffer) => output.push(chunk));

    harness.input.write("request\n");
    await new Promise((resolve) => setImmediate(resolve));

    expect(Buffer.concat(output).toString("utf8")).toBe("request\n");
    expect(harness.socket.destroyed).toBe(false);
    let completed = false;
    void harness.session.completed.then(() => {
      completed = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(completed).toBe(false);

    harness.session.close();
    await harness.session.completed;
  });

  it("keeps racing stdin and socket errors quiet after manual teardown", async () => {
    const harness = createHarness();
    const diagnostics: Buffer[] = [];
    harness.stderr.on("data", (chunk: Buffer) => diagnostics.push(chunk));

    harness.session.close();
    harness.input.emit("error", new Error("late stdin error"));
    harness.socketStream.emit("error", new Error("late socket error"));
    await harness.session.completed;
    await new Promise((resolve) => setImmediate(resolve));

    expect(Buffer.concat(diagnostics).toString("utf8")).toBe("");
    await expectOwnedListenersRemoved(harness);
  });

  it.each([
    ["stdin end", (harness: ReturnType<typeof createHarness>) => harness.input.end()],
    ["stdin close", (harness: ReturnType<typeof createHarness>) => harness.input.destroy()]
  ])("tears down on %s", async (_label, terminate) => {
    const harness = createHarness();
    terminate(harness);
    await harness.session.completed;

    expect(harness.socket.destroyed).toBe(true);
    await expectOwnedListenersRemoved(harness);
  });

  it("tears down immediately when stdin already ended", async () => {
    const input = new PassThrough();
    input.resume();
    input.end();
    await once(input, "end");

    const harness = createHarness(input);
    await harness.session.completed;

    expect(harness.socket.destroyed).toBe(true);
    await expectOwnedListenersRemoved(harness);
  });

  it("reports an unexpected daemon socket close and pauses stdin", async () => {
    const harness = createHarness();
    const stderr: Buffer[] = [];
    harness.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    harness.socket.destroy();
    await harness.session.completed;

    expect(harness.input.isPaused()).toBe(true);
    expect(Buffer.concat(stderr).toString("utf8")).toBe(
      "agent-workbench: daemon socket closed unexpectedly; the MCP session is ending. " +
        "Restart the MCP connection and inspect integration:///health/agent-workbench.\n"
    );
    await new Promise((resolve) => setImmediate(resolve));
    await expectOwnedListenersRemoved(harness);
  });

  it("keeps intentional stdin and manual teardown quiet", async () => {
    const stdinHarness = createHarness();
    const stdinStderr: Buffer[] = [];
    stdinHarness.stderr.on("data", (chunk: Buffer) => stdinStderr.push(chunk));
    stdinHarness.input.end();
    await stdinHarness.session.completed;
    await new Promise((resolve) => setImmediate(resolve));
    expect(Buffer.concat(stdinStderr).toString("utf8")).toBe("");

    const manualHarness = createHarness();
    const manualStderr: Buffer[] = [];
    manualHarness.stderr.on("data", (chunk: Buffer) => manualStderr.push(chunk));
    manualHarness.session.close();
    await manualHarness.session.completed;
    await new Promise((resolve) => setImmediate(resolve));
    expect(Buffer.concat(manualStderr).toString("utf8")).toBe("");
  });

  it("reports a socket error once and converges on the same teardown", async () => {
    const harness = createHarness();
    const stderr: Buffer[] = [];
    harness.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    harness.socket.emit("error", new Error("socket failed"));
    await harness.session.completed;
    harness.socket.destroy();
    await new Promise((resolve) => setImmediate(resolve));

    expect(Buffer.concat(stderr).toString("utf8")).toBe(
      "agent-workbench: daemon socket error: socket failed\n"
    );
    await expectOwnedListenersRemoved(harness);
  });

  it("contains an asynchronous stdout EPIPE and closes only this bridge", async () => {
    const input = new PassThrough();
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        setImmediate(() => callback(Object.assign(new Error("client closed"), { code: "EPIPE" })));
      }
    });
    const stderr = new PassThrough();
    const socketStream = new PassThrough();
    const socket = socketStream as unknown as Socket;
    const session = createStdioBridgeSession(socket, { stdin: input, stdout: output, stderr });
    const stderrBytes: Buffer[] = [];
    stderr.on("data", (chunk: Buffer) => stderrBytes.push(chunk));

    socketStream.write("response\n");
    await session.completed;

    expect(input.isPaused()).toBe(true);
    expect(socket.destroyed).toBe(true);
    expect(Buffer.concat(stderrBytes).toString("utf8")).toBe(
      "agent-workbench: MCP stdout error; the MCP session is ending.\n"
    );
    await expectOwnedListenersRemoved({ input, output, stderr, socketStream, socket, session });
  });

  it("settles when stdout closes and does not forward further bytes", async () => {
    const harness = createHarness();
    const output: Buffer[] = [];
    harness.output.on("data", (chunk: Buffer) => output.push(chunk));

    harness.output.destroy();
    await harness.session.completed;
    harness.socketStream.write("discarded\n");
    await new Promise((resolve) => setImmediate(resolve));

    expect(harness.input.isPaused()).toBe(true);
    expect(harness.socket.destroyed).toBe(true);
    expect(Buffer.concat(output).toString("utf8")).toBe("");
    await expectOwnedListenersRemoved(harness);
  });

  it("settles immediately for a pre-closed stdout", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    output.destroy();
    const stderr = new PassThrough();
    const socketStream = new PassThrough();
    const socket = socketStream as unknown as Socket;
    const session = createStdioBridgeSession(socket, { stdin: input, stdout: output, stderr });
    await session.completed;

    expect(input.isPaused()).toBe(true);
    expect(socket.destroyed).toBe(true);
    await expectOwnedListenersRemoved({ input, output, stderr, socketStream, socket, session });
  });

  it("keeps stderr failure from interrupting stdout failure teardown", async () => {
    const input = new PassThrough();
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback(new Error("stdout failed"));
      }
    });
    const stderr = new Writable();
    stderr.write = (() => {
      throw new Error("stderr unavailable");
    }) as typeof stderr.write;
    const socketStream = new PassThrough();
    const socket = socketStream as unknown as Socket;
    const session = createStdioBridgeSession(socket, { stdin: input, stdout: output, stderr });

    socketStream.write("response\n");
    await session.completed;

    expect(input.isPaused()).toBe(true);
    expect(socket.destroyed).toBe(true);
    await expectOwnedListenersRemoved({ input, output, stderr, socketStream, socket, session });
  });

  it("retains stream error guards while delayed stdout and stderr failures settle", async () => {
    let releaseStdout!: (error?: Error) => void;
    let releaseStderr!: (error?: Error) => void;
    const input = new PassThrough();
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        releaseStdout = callback;
      }
    });
    const stderr = new Writable({
      write(_chunk, _encoding, callback) {
        releaseStderr = callback;
      }
    });
    const socketStream = new PassThrough();
    const socket = socketStream as unknown as Socket;
    const session = createStdioBridgeSession(socket, { stdin: input, stdout: output, stderr });

    socketStream.write("response\n");
    await new Promise((resolve) => setImmediate(resolve));
    expect(releaseStdout).toBeTypeOf("function");
    releaseStdout(new Error("delayed stdout EPIPE"));
    await new Promise((resolve) => setImmediate(resolve));
    expect(stderr.listenerCount("error")).toBe(1);
    session.close();
    await session.completed;
    releaseStderr(new Error("delayed stderr failure"));
    await new Promise((resolve) => setImmediate(resolve));

    await expectOwnedListenersRemoved({ input, output, stderr, socketStream, socket, session });
  });

  it("contains a pending stdout failure after manual session completion", async () => {
    const input = new PassThrough();
    let releaseOutput!: (error?: Error | null) => void;
    const output = new Writable({
      write(_chunk, _encoding, callback) { releaseOutput = callback; }
    });
    const stderr = new PassThrough();
    const diagnostics: Buffer[] = [];
    stderr.on("data", (chunk: Buffer) => diagnostics.push(chunk));
    const socketStream = new PassThrough();
    const socket = socketStream as unknown as Socket;
    const session = createStdioBridgeSession(socket, { stdin: input, stdout: output, stderr });

    socketStream.write("pending response\n");
    session.close();
    await session.completed;

    expect(output.destroyed).toBe(false);
    expect(output.listenerCount("error")).toBe(1);
    releaseOutput(Object.assign(new Error("late output failure"), { code: "EPIPE" }));
    await new Promise((resolve) => setImmediate(resolve));

    expect(Buffer.concat(diagnostics).toString("utf8")).toBe("");
    await expectOwnedListenersRemoved({ input, output, stderr, socketStream, socket, session });
  });

  it.each([
    ["stdin then socket", false],
    ["socket then stdin", true]
  ])("keeps teardown idempotent when %s terminate in one turn", async (_label, socketFirst) => {
    const harness = createHarness();
    if (socketFirst) {
      harness.socket.destroy();
      harness.input.end();
    } else {
      harness.input.end();
      harness.socket.destroy();
    }
    harness.session.close();
    harness.session.close();
    await harness.session.completed;

    await expectOwnedListenersRemoved(harness);
  });
});
