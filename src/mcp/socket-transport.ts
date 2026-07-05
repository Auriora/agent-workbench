/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Socket } from "node:net";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class SocketServerTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private readonly readBuffer = new ReadBuffer();
  private started = false;
  private closed = false;

  constructor(
    private readonly socket: Socket,
    initialData?: Buffer
  ) {
    if (initialData !== undefined && initialData.length > 0) {
      this.readBuffer.append(initialData);
    }
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error("SocketServerTransport already started.");
    }
    this.started = true;
    this.socket.on("data", this.onData);
    this.socket.on("error", this.onSocketError);
    this.socket.on("close", this.onSocketClose);
    this.processReadBuffer();
  }

  async close(): Promise<void> {
    this.closeTransport();
    if (!this.socket.destroyed) {
      this.socket.end();
    }
  }

  send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed || this.socket.destroyed) {
        reject(new Error("SocketServerTransport is closed."));
        return;
      }
      const serialized = serializeMessage(message);
      if (this.socket.write(serialized)) {
        resolve();
        return;
      }
      this.socket.once("drain", resolve);
      this.socket.once("error", reject);
    });
  }

  private readonly onData = (chunk: Buffer): void => {
    this.readBuffer.append(chunk);
    this.processReadBuffer();
  };

  private readonly onSocketError = (error: Error): void => {
    this.onerror?.(error);
  };

  private readonly onSocketClose = (): void => {
    this.closeTransport();
  };

  private processReadBuffer(): void {
    while (!this.closed) {
      try {
        const message = this.readBuffer.readMessage();
        if (message === null) {
          return;
        }
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private closeTransport(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onSocketError);
    this.socket.off("close", this.onSocketClose);
    this.readBuffer.clear();
    this.onclose?.();
  }
}
