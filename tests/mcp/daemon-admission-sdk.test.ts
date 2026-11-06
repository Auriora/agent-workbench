/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DaemonAdmissionBudget } from "../../src/infrastructure/runtime/daemon-admission.js";
import { installMcpAdmission } from "../../src/interface-adapters/mcp/admission.js";
import { SocketServerTransport } from "../../src/mcp/socket-transport.js";

class FakeSocket extends EventEmitter {
  destroyed = false;
  writable = true;
  writeResult = true;
  readonly writes: string[] = [];

  get writableLength(): number {
    return this.writes.reduce((total, value) => total + Buffer.byteLength(value), 0);
  }

  write(value: string): boolean {
    this.writes.push(value);
    return this.writeResult;
  }

  resume(): void {
    // The real socket resumes reads after transport setup.
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

function frame(message: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(message)}\n`);
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await settle();
  }
  throw new Error("Timed out waiting for MCP admission fixture state.");
}

async function connectedFixture(input: {
  handler?: (request: unknown, extra: { signal: AbortSignal }) => unknown;
  writeResult?: boolean;
} = {}) {
  const budget = new DaemonAdmissionBudget();
  const admission = budget.tryOpenSession();
  if (admission === undefined) throw new Error("fixture session admission failed");
  const socket = new FakeSocket();
  socket.writeResult = input.writeResult ?? true;
  const transport = new SocketServerTransport(socket as never, undefined, admission);
  const server = new McpServer({ name: "fixture", version: "1.0.0" }, {
    capabilities: { tools: {} }
  });
  installMcpAdmission(server, admission);
  server.server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra) => input.handler?.(request, extra) ?? ({ content: [] })
  );
  await server.connect(transport);
  return { budget, admission, socket, transport, server };
}

const validCall = (id: number) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name: "fixture", arguments: {} }
});

describe("MCP SDK admission lifetime", () => {
  it("retains a running handler after cancellation and peer close", async () => {
    let release!: () => void;
    let entered = false;
    const fixture = await connectedFixture({
      handler: async () => {
        entered = true;
        await new Promise<void>((resolve) => { release = resolve; });
        return { content: [] };
      }
    });

    fixture.socket.emit("data", frame(validCall(1)));
    await waitFor(() => entered);
    expect(fixture.budget.snapshot().messages).toBe(1);
    fixture.socket.destroy();
    expect(fixture.budget.snapshot().messages).toBe(1);

    release();
    await waitFor(() => fixture.budget.snapshot().messages === 0);
    expect(fixture.budget.snapshot().sessions).toBe(0);
  });

  it("does not start a cancelled request queued before SDK dispatch", async () => {
    const handler = vi.fn(async () => ({ content: [] }));
    const fixture = await connectedFixture({ handler });

    fixture.socket.emit("data", frame(validCall(2)));
    fixture.socket.emit("data", frame({
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId: 2, reason: "fixture" }
    }));
    await waitFor(() => fixture.budget.snapshot().messages === 0);

    expect(handler).not.toHaveBeenCalled();
    fixture.socket.destroy();
    await waitFor(() => fixture.budget.snapshot().sessions === 0);
    expect(fixture.budget.snapshot().sessions).toBe(0);
  });

  it("releases a completed handler when cancellation wins before a backpressured response", async () => {
    let release!: () => void;
    let entered = false;
    const fixture = await connectedFixture({
      writeResult: false,
      handler: async () => {
        entered = true;
        await new Promise<void>((resolve) => { release = resolve; });
        return { content: [] };
      }
    });

    fixture.socket.emit("data", frame(validCall(3)));
    await waitFor(() => entered);
    release();
    await waitFor(() => fixture.socket.writes.length >= 1);
    expect(fixture.budget.snapshot().messages).toBe(1);

    fixture.socket.emit("data", frame({
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId: 3, reason: "fixture" }
    }));
    await waitFor(() => fixture.budget.snapshot().messages === 0);
    fixture.socket.emit("drain");
    fixture.socket.destroy();
    await waitFor(() => fixture.budget.snapshot().sessions === 0);
    expect(fixture.budget.snapshot().sessions).toBe(0);
  });

  it("releases SDK validation and unknown-method responses", async () => {
    const fixture = await connectedFixture();

    fixture.socket.emit("data", frame({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: 7 }
    }));
    await waitFor(() => fixture.budget.snapshot().messages === 0);

    fixture.socket.emit("data", frame({
      jsonrpc: "2.0",
      id: 5,
      method: "fixture/unknown"
    }));
    await waitFor(() => fixture.budget.snapshot().messages === 0);
    fixture.socket.destroy();
    await waitFor(() => fixture.budget.snapshot().sessions === 0);
    expect(fixture.budget.snapshot().sessions).toBe(0);
    expect(fixture.socket.writes.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects duplicate outstanding request IDs on the offending session", async () => {
    let release!: () => void;
    let calls = 0;
    const fixture = await connectedFixture({
      handler: async () => {
        calls += 1;
        await new Promise<void>((resolve) => { release = resolve; });
        return { content: [] };
      }
    });

    fixture.socket.emit("data", frame(validCall(7)));
    await waitFor(() => calls === 1);
    fixture.socket.emit("data", frame(validCall(7)));
    await waitFor(() => fixture.socket.destroyed);
    expect(calls).toBe(1);
    expect(fixture.budget.snapshot().messages).toBe(1);

    release();
    await waitFor(() => fixture.budget.snapshot().messages === 0);
  });

  it("releases an unsupported task request without invoking the tool handler", async () => {
    const handler = vi.fn(async () => ({ content: [] }));
    const fixture = await connectedFixture({ handler });

    fixture.socket.emit("data", frame({
      ...validCall(8),
      params: { name: "fixture", arguments: {}, task: { ttl: 1000 } }
    }));
    await waitFor(() => fixture.budget.snapshot().messages === 0);
    expect(handler).not.toHaveBeenCalled();
    expect(fixture.socket.writes.length).toBeGreaterThanOrEqual(1);
    fixture.socket.destroy();
  });

  it("accounts constructor-installed ping through transport", async () => {
    const fixture = await connectedFixture();

    fixture.socket.emit("data", frame({
      jsonrpc: "2.0",
      id: 6,
      method: "ping"
    }));
    await waitFor(() => fixture.budget.snapshot().messages === 0);
    expect(fixture.socket.writes.at(-1)).toContain('"id":6');
    fixture.socket.destroy();
  });
});
