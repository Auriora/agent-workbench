/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Socket } from "node:net";
import { once, PassThrough } from "node:stream";
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

function expectOwnedListenersRemoved(harness: ReturnType<typeof createHarness>): void {
  expect(harness.input.listenerCount("end")).toBe(0);
  expect(harness.input.listenerCount("close")).toBe(0);
  expect(harness.input.listenerCount("error")).toBe(0);
  expect(harness.socketStream.listenerCount("close")).toBe(0);
  expect(harness.socketStream.listenerCount("error")).toBe(0);
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

  it.each([
    ["stdin end", (harness: ReturnType<typeof createHarness>) => harness.input.end()],
    ["stdin close", (harness: ReturnType<typeof createHarness>) => harness.input.destroy()]
  ])("tears down on %s", async (_label, terminate) => {
    const harness = createHarness();
    terminate(harness);
    await harness.session.completed;

    expect(harness.socket.destroyed).toBe(true);
    expectOwnedListenersRemoved(harness);
  });

  it("tears down immediately when stdin already ended", async () => {
    const input = new PassThrough();
    input.resume();
    input.end();
    await once(input, "end");

    const harness = createHarness(input);
    await harness.session.completed;

    expect(harness.socket.destroyed).toBe(true);
    expectOwnedListenersRemoved(harness);
  });

  it("tears down and pauses stdin when the daemon socket closes", async () => {
    const harness = createHarness();
    harness.socket.destroy();
    await harness.session.completed;

    expect(harness.input.isPaused()).toBe(true);
    expectOwnedListenersRemoved(harness);
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
    expectOwnedListenersRemoved(harness);
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

    expectOwnedListenersRemoved(harness);
  });
});
