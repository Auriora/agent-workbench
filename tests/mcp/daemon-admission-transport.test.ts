/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "node:net";
import {
  DAEMON_ADMISSION_REJECTED_MESSAGE,
  DAEMON_PARTIAL_FRAME_IDLE_MS,
  MAX_DAEMON_SESSION_INPUT_BYTES,
  MAX_DAEMON_SESSION_MESSAGES,
  MAX_DAEMON_SESSION_OUTPUT_BYTES
} from "../../src/contracts/daemon-admission-contracts.js";
import { DaemonAdmissionBudget } from "../../src/infrastructure/runtime/daemon-admission.js";
import { SocketServerTransport } from "../../src/mcp/socket-transport.js";
import type { DaemonSessionAdmissionPort } from "../../src/ports/daemon-admission.js";

class FakeSocket extends EventEmitter {
  destroyed = false;
  writableLength = 0;
  writeResult = true;
  writes: string[] = [];
  resumed = false;
  paused = false;

  write(value: string): boolean {
    this.writes.push(value);
    return this.writeResult;
  }

  resume(): this {
    this.resumed = true;
    return this;
  }

  pause(): this {
    this.paused = true;
    return this;
  }

  end(): void {
    this.destroy();
  }

  destroy(): this {
    if (!this.destroyed) {
      this.destroyed = true;
      this.emit("close");
    }
    return this;
  }
}

function asSocket(socket: FakeSocket): Socket {
  return socket as unknown as Socket;
}

function request(id: string | number, method = "ping"): Buffer {
  return Buffer.from(`${JSON.stringify({ jsonrpc: "2.0", id, method })}\n`);
}

function notification(method = "notifications/initialized"): Buffer {
  return Buffer.from(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
}

function openTransport(): {
  budget: DaemonAdmissionBudget;
  admission: DaemonSessionAdmissionPort;
  socket: FakeSocket;
  transport: SocketServerTransport;
} {
  const budget = new DaemonAdmissionBudget();
  const admission = budget.tryOpenSession();
  if (admission === undefined) throw new Error("session admission unexpectedly unavailable");
  const socket = new FakeSocket();
  const transport = new SocketServerTransport(asSocket(socket), undefined, admission);
  return { budget, admission, socket, transport };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("daemon admission transport", () => {
  it("releases a response lease when serialization fails before socket write", async () => {
    const { budget, socket, transport } = openTransport();
    await transport.start();
    socket.emit("data", request("serialize"));
    const result: Record<string, unknown> = {};
    result.circular = result;
    await expect(transport.send({ jsonrpc: "2.0", id: "serialize", result })).rejects.toThrow();
    expect(socket.writes).toHaveLength(0);
    expect(budget.snapshot()).toMatchObject({ input_bytes: 0, messages: 0 });
    socket.destroy();
  });

  it("keeps a running request charged after cancellation until the handler settles", async () => {
    const { budget, admission, socket, transport } = openTransport();
    await transport.start();
    let releaseWork!: () => void;
    const workDone = new Promise<void>((resolve) => { releaseWork = resolve; });
    const controller = new AbortController();
    let handler!: Promise<void>;
    transport.onmessage = (message) => {
      if (!("id" in message) || message.id === undefined) return;
      handler = admission.runRequest(message.id, controller.signal, async () => workDone);
    };

    socket.emit("data", request(1));
    await Promise.resolve();
    expect(budget.snapshot().messages).toBe(1);
    admission.cancelRequest(1);
    controller.abort();
    expect(budget.snapshot().messages).toBe(1);

    releaseWork();
    await handler;
    expect(budget.snapshot().messages).toBe(0);
    await transport.send({ jsonrpc: "2.0", id: 1, result: {} });
    expect(budget.snapshot()).toMatchObject({ input_bytes: 0, messages: 0 });
    socket.destroy();
  });

  it("rejects an offending session while another established session remains callable", async () => {
    const budget = new DaemonAdmissionBudget();
    const offender = budget.tryOpenSession();
    const healthy = budget.tryOpenSession();
    if (offender === undefined || healthy === undefined) throw new Error("session admission unexpectedly unavailable");
    expect(offender.reserveInput(MAX_DAEMON_SESSION_INPUT_BYTES)).toBe(true);

    const badSocket = new FakeSocket();
    const badTransport = new SocketServerTransport(asSocket(badSocket), undefined, offender);
    const errors: string[] = [];
    badTransport.onerror = (error) => errors.push(error.message);
    await badTransport.start();
    badSocket.emit("data", request(1));
    expect(badSocket.destroyed).toBe(true);
    expect(errors).toContain(DAEMON_ADMISSION_REJECTED_MESSAGE);

    const goodSocket = new FakeSocket();
    const goodTransport = new SocketServerTransport(asSocket(goodSocket), undefined, healthy);
    await goodTransport.start();
    let healthyWork!: Promise<void>;
    goodTransport.onmessage = (message) => {
      if (!("id" in message) || message.id === undefined) return;
      const id = message.id;
      healthyWork = healthy.runRequest(id, new AbortController().signal, async () => {
        await goodTransport.send({ jsonrpc: "2.0", id, result: { ok: true } });
      });
    };
    goodSocket.emit("data", request(2));
    await healthyWork;
    expect(goodSocket.writes).toHaveLength(1);
    expect(budget.snapshot()).toMatchObject({ input_bytes: 0, messages: 0, sessions: 1 });
    goodSocket.destroy();
    expect(budget.snapshot().sessions).toBe(0);
  });

  it("keeps one session's eight-message quota from denying a healthy session", async () => {
    const budget = new DaemonAdmissionBudget();
    const offender = budget.tryOpenSession();
    const healthy = budget.tryOpenSession();
    if (offender === undefined || healthy === undefined) throw new Error("session admission unexpectedly unavailable");
    const offenderSocket = new FakeSocket();
    const offenderTransport = new SocketServerTransport(asSocket(offenderSocket), undefined, offender);
    await offenderTransport.start();
    offenderSocket.emit("data", Buffer.concat(Array.from({ length: MAX_DAEMON_SESSION_MESSAGES }, (_, id) => request(id))));
    expect(offenderSocket.destroyed).toBe(false);
    expect(budget.snapshot().messages).toBe(MAX_DAEMON_SESSION_MESSAGES);

    const healthySocket = new FakeSocket();
    const healthyTransport = new SocketServerTransport(asSocket(healthySocket), undefined, healthy);
    await healthyTransport.start();
    let healthyWork!: Promise<void>;
    healthyTransport.onmessage = (message) => {
      if (!("id" in message) || message.id === undefined) return;
      const id = message.id;
      healthyWork = healthy.runRequest(id, new AbortController().signal, async () => {
        await healthyTransport.send({ jsonrpc: "2.0", id, result: {} });
      });
    };
    healthySocket.emit("data", request("healthy"));
    await healthyWork;
    expect(healthySocket.writes).toHaveLength(1);
    expect(budget.snapshot().messages).toBe(MAX_DAEMON_SESSION_MESSAGES);

    offenderSocket.emit("data", request("overflow"));
    expect(offenderSocket.destroyed).toBe(true);
    healthySocket.destroy();
    expect(budget.snapshot().sessions).toBe(0);
  });

  it("counts mixed controls and requests against the same eight-message session quota", async () => {
    const { socket, transport } = openTransport();
    await transport.start();
    socket.emit("data", Buffer.concat([
      ...Array.from({ length: 4 }, () => notification()),
      ...Array.from({ length: 4 }, (_, id) => request(id))
    ]));
    expect(socket.destroyed).toBe(false);
    socket.emit("data", request("ninth"));
    expect(socket.destroyed).toBe(true);
  });

  it("rejects duplicate requests and releases malformed frame bytes", async () => {
    const { budget, socket, transport } = openTransport();
    await transport.start();
    const messages: unknown[] = [];
    const errors: string[] = [];
    transport.onmessage = (message) => messages.push(message);
    transport.onerror = (error) => errors.push(error.message);

    socket.emit("data", Buffer.concat([request("same"), request("same")]));
    expect(messages).toHaveLength(1);
    expect(socket.destroyed).toBe(true);
    expect(errors).toContain(DAEMON_ADMISSION_REJECTED_MESSAGE);

    const malformed = openTransport();
    await malformed.transport.start();
    malformed.socket.emit("data", Buffer.from("{bad json}\n"));
    expect(malformed.budget.snapshot()).toMatchObject({ input_bytes: 0, messages: 0 });
    malformed.socket.destroy();
  });

  it("bounds control bursts and lets queued controls release exactly once", async () => {
    const { budget, socket, transport } = openTransport();
    await transport.start();
    const burst = Buffer.concat(Array.from({ length: MAX_DAEMON_SESSION_MESSAGES + 1 }, () => notification()));
    socket.emit("data", burst);
    expect(socket.destroyed).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(budget.snapshot()).toMatchObject({ input_bytes: 0, messages: 0 });
  });

  it("closes only an incomplete, inactive frame and resets its timer on progress", async () => {
    vi.useFakeTimers();
    const first = openTransport();
    await first.transport.start();
    first.socket.emit("data", Buffer.from("{\"jsonrpc\":\"2.0\""));
    vi.advanceTimersByTime(DAEMON_PARTIAL_FRAME_IDLE_MS - 1);
    expect(first.socket.destroyed).toBe(false);
    first.socket.emit("data", Buffer.from(",\"id\":1"));
    vi.advanceTimersByTime(DAEMON_PARTIAL_FRAME_IDLE_MS - 1);
    expect(first.socket.destroyed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(first.socket.destroyed).toBe(true);

    const closePartial = openTransport();
    await closePartial.transport.start();
    closePartial.socket.emit("data", Buffer.from("{\"jsonrpc\":\"2.0\""));
    expect(closePartial.budget.snapshot().input_bytes).toBeGreaterThan(0);
    closePartial.socket.destroy();
    expect(closePartial.budget.snapshot()).toMatchObject({ input_bytes: 0, sessions: 0 });

    const complete = openTransport();
    await complete.transport.start();
    complete.socket.emit("data", request(2));
    vi.advanceTimersByTime(DAEMON_PARTIAL_FRAME_IDLE_MS + 1);
    expect(complete.socket.destroyed).toBe(false);
    complete.socket.destroy();
  });

  it("caps pending output sends and settles all backpressure on close", async () => {
    const { budget, socket, transport } = openTransport();
    socket.writeResult = false;
    await transport.start();
    const sends = Array.from({ length: MAX_DAEMON_SESSION_MESSAGES }, (_, id) =>
      transport.send({ jsonrpc: "2.0", id, result: {} })
    );
    const overflow = transport.send({ jsonrpc: "2.0", id: 100, result: {} });
    await expect(overflow).rejects.toThrow(DAEMON_ADMISSION_REJECTED_MESSAGE);
    expect(socket.destroyed).toBe(true);
    await expect(Promise.allSettled(sends)).resolves.toHaveLength(MAX_DAEMON_SESSION_MESSAGES);
    expect(budget.snapshot().sessions).toBe(0);
  });

  it("rejects output when the socket already exceeds the retained output bound", async () => {
    const { budget, socket, transport } = openTransport();
    socket.writableLength = MAX_DAEMON_SESSION_OUTPUT_BYTES;
    await transport.start();
    await expect(transport.send({ jsonrpc: "2.0", id: 1, result: {} }))
      .rejects.toThrow(DAEMON_ADMISSION_REJECTED_MESSAGE);
    expect(socket.destroyed).toBe(true);
    expect(budget.snapshot().sessions).toBe(0);
  });

  it("releases pre-reserved initial data when a socket dies before transport start", async () => {
    const { budget, admission, socket } = openTransport();
    const initialData = request("initial");
    expect(admission.reserveInput(initialData.length)).toBe(true);
    socket.destroy();
    const transport = new SocketServerTransport(asSocket(socket), initialData, admission, true);
    await transport.start();
    expect(budget.snapshot()).toMatchObject({ input_bytes: 0, sessions: 0 });
  });
});
