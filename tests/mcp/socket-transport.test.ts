/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import {
  MCP_FRAME_TOO_LARGE_MESSAGE,
  MCP_SEND_CLOSED_MESSAGE,
  MCP_SEND_PEER_CLOSED_MESSAGE,
  MAX_MCP_FRAME_BYTES
} from "../../src/contracts/mcp-transport-contracts.js";
import { SocketServerTransport } from "../../src/mcp/socket-transport.js";

function asSocket(stream: PassThrough | FakeSocket): Socket {
  return stream as unknown as Socket;
}

class FakeSocket extends EventEmitter {
  destroyed = false;
  writeResult = false;
  throwsOnWrite = false;

  write(_value: string): boolean {
    if (this.throwsOnWrite) throw new Error("write failed");
    return this.writeResult;
  }

  end(): void {
    this.destroyed = true;
    this.emit("close");
  }

  destroy(): this {
    this.destroyed = true;
    this.emit("close");
    return this;
  }
}

describe("SocketServerTransport", () => {
  it("parses fragmented, CRLF, multibyte, and coalesced frames", async () => {
    const socket = new PassThrough();
    const transport = new SocketServerTransport(asSocket(socket), Buffer.from(
      `${JSON.stringify({ jsonrpc: "2.0", method: "initial", params: { text: "€" } })}\n`
    ));
    const messages: string[] = [];
    transport.onmessage = (message) => messages.push(String((message as { method?: string }).method));
    await transport.start();

    socket.write(Buffer.from('{"jsonrpc":"2.0","method":"frag'));
    socket.write(Buffer.from('mented"}\r\n{"jsonrpc":"2.0","method":"second"}\n'));

    expect(messages).toEqual(["initial", "fragmented", "second"]);
    await transport.close();
    socket.destroy();
  });

  it("accepts a frame exactly at the byte limit and rejects one byte over", async () => {
    const makeFrame = (bytes: number): Buffer => {
      const prefix = '{"jsonrpc":"2.0","method":"bounded","params":{"p":"';
      const suffix = '"}}';
      const paddingBytes = bytes - Buffer.byteLength(prefix) - Buffer.byteLength(suffix);
      return Buffer.from(prefix + "a".repeat(paddingBytes) + suffix);
    };

    const exactSocket = new PassThrough();
    const exactTransport = new SocketServerTransport(asSocket(exactSocket));
    const exactMessages: JSONRPCMessage[] = [];
    exactTransport.onmessage = (message) => exactMessages.push(message);
    await exactTransport.start();
    exactSocket.write(Buffer.concat([makeFrame(MAX_MCP_FRAME_BYTES), Buffer.from("\n")]));
    expect(exactMessages).toHaveLength(1);
    await exactTransport.close();
    exactSocket.destroy();

    const overSocket = new PassThrough();
    const overTransport = new SocketServerTransport(asSocket(overSocket));
    const overErrors: string[] = [];
    overTransport.onerror = (error) => overErrors.push(error.message);
    await overTransport.start();
    overSocket.write(Buffer.concat([makeFrame(MAX_MCP_FRAME_BYTES + 1), Buffer.from("\n")]));
    expect(overErrors).toEqual([MCP_FRAME_TOO_LARGE_MESSAGE]);
    expect(overSocket.destroyed).toBe(true);

    const coalescedSocket = new PassThrough();
    const coalescedTransport = new SocketServerTransport(asSocket(coalescedSocket));
    const coalescedMessages: JSONRPCMessage[] = [];
    coalescedTransport.onmessage = (message) => coalescedMessages.push(message);
    await coalescedTransport.start();
    const halfFrame = Math.floor(MAX_MCP_FRAME_BYTES / 2);
    coalescedSocket.write(Buffer.concat([
      makeFrame(halfFrame),
      Buffer.from("\n"),
      makeFrame(halfFrame),
      Buffer.from("\n")
    ]));
    expect(coalescedMessages).toHaveLength(2);
    await coalescedTransport.close();
    coalescedSocket.destroy();
  });

  it("applies the limit to initial remainder and handles a UTF-8 split", async () => {
    const frame = Buffer.from(`${JSON.stringify({ jsonrpc: "2.0", method: "utf8", params: { text: "€" } })}\n`);
    const euroOffset = frame.indexOf(Buffer.from("€"));
    const initialSocket = new PassThrough();
    const initialTransport = new SocketServerTransport(asSocket(initialSocket), frame);
    const initialMessages: JSONRPCMessage[] = [];
    initialTransport.onmessage = (message) => initialMessages.push(message);
    await initialTransport.start();
    expect(initialMessages).toHaveLength(1);
    expect((initialMessages[0] as { params?: { text?: string } }).params?.text).toBe("€");
    await initialTransport.close();
    initialSocket.destroy();

    const splitSocket = new PassThrough();
    const splitTransport = new SocketServerTransport(asSocket(splitSocket));
    const splitMessages: JSONRPCMessage[] = [];
    splitTransport.onmessage = (message) => splitMessages.push(message);
    await splitTransport.start();
    splitSocket.write(frame.subarray(0, euroOffset + 1));
    splitSocket.write(frame.subarray(euroOffset + 1));
    expect(splitMessages).toHaveLength(1);
    expect((splitMessages[0] as { params?: { text?: string } }).params?.text).toBe("€");
    await splitTransport.close();
    splitSocket.destroy();

    const oversizedInitialSocket = new PassThrough();
    const oversizedInitialTransport = new SocketServerTransport(
      asSocket(oversizedInitialSocket),
      Buffer.alloc(MAX_MCP_FRAME_BYTES + 1, 0x78)
    );
    const oversizedErrors: string[] = [];
    oversizedInitialTransport.onerror = (error) => oversizedErrors.push(error.message);
    await oversizedInitialTransport.start();
    expect(oversizedErrors).toEqual([MCP_FRAME_TOO_LARGE_MESSAGE]);
    expect(oversizedInitialSocket.destroyed).toBe(true);
  });

  it("counts UTF-8 bytes and CR at the exact CRLF boundary", async () => {
    const makeUtf8Frame = (contentBytes: number): Buffer => {
      const prefix = '{"jsonrpc":"2.0","method":"bounded","params":{"p":"€';
      const suffix = '"}}';
      const paddingBytes = contentBytes - Buffer.byteLength(prefix) - Buffer.byteLength(suffix);
      expect(paddingBytes).toBeGreaterThanOrEqual(0);
      return Buffer.from(prefix + "a".repeat(paddingBytes) + suffix);
    };

    const exactSocket = new PassThrough();
    const exactTransport = new SocketServerTransport(asSocket(exactSocket));
    const exactMessages: JSONRPCMessage[] = [];
    exactTransport.onmessage = (message) => exactMessages.push(message);
    await exactTransport.start();
    exactSocket.write(Buffer.concat([
      makeUtf8Frame(MAX_MCP_FRAME_BYTES - 1),
      Buffer.from("\r\n")
    ]));
    expect(exactMessages).toHaveLength(1);
    await exactTransport.close();
    exactSocket.destroy();

    const overSocket = new PassThrough();
    const overTransport = new SocketServerTransport(asSocket(overSocket));
    const overErrors: string[] = [];
    overTransport.onerror = (error) => overErrors.push(error.message);
    await overTransport.start();
    overSocket.write(Buffer.concat([
      makeUtf8Frame(MAX_MCP_FRAME_BYTES),
      Buffer.from("\r\n")
    ]));
    expect(overErrors).toEqual([MCP_FRAME_TOO_LARGE_MESSAGE]);
    expect(overSocket.destroyed).toBe(true);
  });

  it("enforces the frame limit before SDK parsing and clears on close", async () => {
    const socket = new PassThrough();
    const transport = new SocketServerTransport(asSocket(socket));
    const errors: string[] = [];
    transport.onerror = (error) => errors.push(error.message);
    await transport.start();

    socket.write(Buffer.alloc(MAX_MCP_FRAME_BYTES + 1, 0x78));

    expect(errors).toEqual([MCP_FRAME_TOO_LARGE_MESSAGE]);
    expect(socket.destroyed).toBe(true);
    expect((transport as unknown as { pendingChunks: Buffer[] }).pendingChunks).toHaveLength(0);
  });

  it("destroys only the offending socket when onclose throws", async () => {
    const badSocket = new PassThrough();
    const badTransport = new SocketServerTransport(asSocket(badSocket));
    badTransport.onclose = () => {
      throw new Error("client close callback failed");
    };
    await badTransport.start();
    badSocket.write(Buffer.alloc(MAX_MCP_FRAME_BYTES + 1, 0x78));
    expect(badSocket.destroyed).toBe(true);

    const goodSocket = new PassThrough();
    const goodTransport = new SocketServerTransport(asSocket(goodSocket));
    const messages: string[] = [];
    goodTransport.onmessage = (message) => messages.push(String((message as { method?: string }).method));
    await goodTransport.start();
    goodSocket.write('{"jsonrpc":"2.0","method":"healthy"}\n');
    expect(messages).toEqual(["healthy"]);
    await goodTransport.close();
    goodSocket.destroy();
  });

  it("bounds fragment metadata while retaining a pending frame", async () => {
    const socket = new PassThrough();
    const transport = new SocketServerTransport(asSocket(socket));
    await transport.start();
    for (let index = 0; index < 4096; index += 1) socket.write(Buffer.from("x"));

    expect((transport as unknown as { pendingChunks: Buffer[] }).pendingChunks.length).toBeLessThanOrEqual(128);
    await transport.close();
    socket.destroy();
  });

  it("clears multi-block pending frame data when closed", async () => {
    const socket = new PassThrough();
    const transport = new SocketServerTransport(asSocket(socket));
    await transport.start();
    socket.write(Buffer.alloc((64 * 1024) + 123, 0x78));

    const pending = transport as unknown as {
      pendingChunks: Buffer[];
      pendingBlock?: Buffer;
      pendingBlockBytes: number;
      pendingBytes: number;
    };
    expect(pending.pendingChunks).toHaveLength(1);
    expect(pending.pendingBlockBytes).toBe(123);
    expect(pending.pendingBytes).toBe((64 * 1024) + 123);

    await transport.close();
    expect(pending.pendingChunks).toHaveLength(0);
    expect(pending.pendingBlock).toBeUndefined();
    expect(pending.pendingBlockBytes).toBe(0);
    expect(pending.pendingBytes).toBe(0);
    socket.destroy();
  });

  it("settles backpressured sends on drain and removes temporary listeners", async () => {
    const socket = new FakeSocket();
    const transport = new SocketServerTransport(asSocket(socket));
    await transport.start();
    const pending = transport.send({ jsonrpc: "2.0", id: 1, result: {} });
    expect(socket.listenerCount("drain")).toBe(1);
    socket.emit("drain");
    await expect(pending).resolves.toBeUndefined();
    expect(socket.listenerCount("drain")).toBe(0);
    expect(socket.listenerCount("error")).toBe(1);
    expect(socket.listenerCount("close")).toBe(1);
    socket.destroy();
  });

  it("settles backpressured sends on peer close, local close, and write error", async () => {
    const peerSocket = new FakeSocket();
    const peerTransport = new SocketServerTransport(asSocket(peerSocket));
    await peerTransport.start();
    const peerPending = peerTransport.send({ jsonrpc: "2.0", id: 1, result: {} });
    peerSocket.destroy();
    await expect(peerPending).rejects.toThrow(MCP_SEND_PEER_CLOSED_MESSAGE);
    expect(peerSocket.listenerCount("drain")).toBe(0);

    const localSocket = new FakeSocket();
    const localTransport = new SocketServerTransport(asSocket(localSocket));
    await localTransport.start();
    const localPending = localTransport.send({ jsonrpc: "2.0", id: 2, result: {} });
    await localTransport.close();
    await expect(localPending).rejects.toThrow(MCP_SEND_CLOSED_MESSAGE);

    const errorSocket = new FakeSocket();
    const errorTransport = new SocketServerTransport(asSocket(errorSocket));
    await errorTransport.start();
    const errorPending = errorTransport.send({ jsonrpc: "2.0", id: 3, result: {} });
    errorSocket.emit("error", new Error("write failed"));
    await expect(errorPending).rejects.toThrow("write failed");

    const repeatedSocket = new FakeSocket();
    const repeatedTransport = new SocketServerTransport(asSocket(repeatedSocket));
    await repeatedTransport.start();
    const repeated = Array.from({ length: 24 }, (_, id) =>
      repeatedTransport.send({ jsonrpc: "2.0", id, result: {} })
    );
    expect(repeatedSocket.listenerCount("error")).toBe(1);
    expect(repeatedSocket.listenerCount("close")).toBe(1);
    expect(repeatedSocket.listenerCount("drain")).toBe(1);
    repeatedSocket.destroy();
    await Promise.allSettled(repeated);
    expect(repeatedSocket.listenerCount("drain")).toBe(0);
    expect(repeatedSocket.listenerCount("error")).toBe(0);
    expect(repeatedSocket.listenerCount("close")).toBe(0);

    const throwingSocket = new FakeSocket();
    throwingSocket.throwsOnWrite = true;
    const throwingTransport = new SocketServerTransport(asSocket(throwingSocket));
    await throwingTransport.start();
    const throwing = throwingTransport.send({ jsonrpc: "2.0", id: 4, result: {} });
    await expect(throwing).rejects.toThrow("write failed");
    expect(throwingSocket.listenerCount("drain")).toBe(0);
    expect(throwingSocket.listenerCount("error")).toBe(1);
    expect(throwingSocket.listenerCount("close")).toBe(1);
    throwingSocket.destroy();
  });
});
