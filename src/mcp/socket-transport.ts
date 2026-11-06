/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Socket } from "node:net";
import { deserializeMessage, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import {
  MCP_FRAME_TOO_LARGE_MESSAGE,
  MCP_SEND_CLOSED_MESSAGE,
  MCP_SEND_PEER_CLOSED_MESSAGE,
  MAX_MCP_FRAME_BYTES
} from "../contracts/mcp-transport-contracts.js";

type PendingSendSettlement = (error?: Error) => void;
const PENDING_FRAME_BLOCK_BYTES = 64 * 1024;

export class SocketServerTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private readonly pendingChunks: Buffer[] = [];
  private pendingBlock: Buffer | undefined;
  private pendingBlockBytes = 0;
  private pendingBytes = 0;
  private readonly pendingSends = new Set<PendingSendSettlement>();
  private started = false;
  private closed = false;
  private socketListenersAttached = false;
  private drainListenerAttached = false;

  constructor(
    private readonly socket: Socket,
    initialData?: Buffer
  ) {
    this.initialData = initialData;
  }

  private initialData: Buffer | undefined;

  async start(): Promise<void> {
    if (this.started) {
      throw new Error("SocketServerTransport already started.");
    }
    this.started = true;
    this.socket.on("data", this.onData);
    this.socket.on("error", this.onSocketError);
    this.socket.on("close", this.onSocketClose);
    this.socketListenersAttached = true;
    if (this.socket.destroyed) {
      this.closeTransport(MCP_SEND_PEER_CLOSED_MESSAGE);
      this.detachSocketListeners();
      return;
    }
    const initialData = this.initialData;
    this.initialData = undefined;
    if (initialData !== undefined && initialData.length > 0) {
      this.processChunk(initialData);
    }
  }

  async close(): Promise<void> {
    this.closeTransport(MCP_SEND_CLOSED_MESSAGE);
    if (!this.socket.destroyed) {
      this.socket.end();
    }
  }

  send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed || this.socket.destroyed) {
        reject(new Error(MCP_SEND_CLOSED_MESSAGE));
        return;
      }

      let settled = false;
      const settle: PendingSendSettlement = (error?: Error): void => {
        if (settled) return;
        settled = true;
        this.pendingSends.delete(settle);
        this.detachDrainListenerIfIdle();
        if (error === undefined) {
          resolve();
        } else {
          reject(error);
        }
      };

      this.pendingSends.add(settle);
      this.ensureDrainListener();

      try {
        if (this.socket.write(serializeMessage(message))) {
          settle();
        }
      } catch (error) {
        settle(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private readonly onData = (chunk: Buffer): void => {
    this.processChunk(chunk);
  };

  private readonly onSocketError = (error: Error): void => {
    this.reportError(error);
    this.settlePendingSends(error);
  };

  private readonly onSocketClose = (): void => {
    this.closeTransport(MCP_SEND_PEER_CLOSED_MESSAGE);
    this.detachSocketListeners();
  };

  private readonly onDrain = (): void => {
    this.drainListenerAttached = false;
    this.settlePendingSends();
  };

  private processChunk(chunk: Buffer): void {
    if (this.closed || chunk.length === 0) return;
    let offset = 0;
    while (offset < chunk.length && !this.closed) {
      const newlineIndex = chunk.indexOf(0x0a, offset);
      if (newlineIndex < 0) {
        this.appendPending(chunk.subarray(offset));
        return;
      }

      const segment = chunk.subarray(offset, newlineIndex);
      const frameBytes = this.pendingBytes + segment.length;
      if (frameBytes > MAX_MCP_FRAME_BYTES) {
        this.failFrameLimit();
        return;
      }

      const line = this.takeFrame(segment).toString("utf8").replace(/\r$/, "");
      try {
        this.onmessage?.(deserializeMessage(line));
      } catch (error) {
        this.reportError(error instanceof Error ? error : new Error(String(error)));
      }
      offset = newlineIndex + 1;
    }
  }

  private appendPending(chunk: Buffer): void {
    if (this.pendingBytes + chunk.length > MAX_MCP_FRAME_BYTES) {
      this.failFrameLimit();
      return;
    }

    let offset = 0;
    while (offset < chunk.length) {
      if (this.pendingBlock === undefined || this.pendingBlockBytes === PENDING_FRAME_BLOCK_BYTES) {
        if (this.pendingBlock !== undefined && this.pendingBlockBytes > 0) {
          this.pendingChunks.push(this.pendingBlock.subarray(0, this.pendingBlockBytes));
        }
        this.pendingBlock = Buffer.allocUnsafe(PENDING_FRAME_BLOCK_BYTES);
        this.pendingBlockBytes = 0;
      }
      const copyBytes = Math.min(
        chunk.length - offset,
        PENDING_FRAME_BLOCK_BYTES - this.pendingBlockBytes
      );
      chunk.copy(this.pendingBlock, this.pendingBlockBytes, offset, offset + copyBytes);
      offset += copyBytes;
      this.pendingBlockBytes += copyBytes;
      this.pendingBytes += copyBytes;
    }
  }

  private takeFrame(segment: Buffer): Buffer {
    const chunks = this.pendingChunks.splice(0);
    const bytes = this.pendingBytes + segment.length;
    if (this.pendingBlock !== undefined && this.pendingBlockBytes > 0) {
      chunks.push(this.pendingBlock.subarray(0, this.pendingBlockBytes));
    }
    this.pendingBlock = undefined;
    this.pendingBlockBytes = 0;
    this.pendingBytes = 0;
    if (segment.length > 0) chunks.push(segment);
    return chunks.length === 0 ? Buffer.alloc(0) : chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, bytes);
  }

  private failFrameLimit(): void {
    const error = new Error(MCP_FRAME_TOO_LARGE_MESSAGE);
    this.reportError(error);
    this.closeTransport(MCP_FRAME_TOO_LARGE_MESSAGE);
    if (!this.socket.destroyed) {
      this.socket.destroy();
    }
  }

  private closeTransport(sendError: string): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.off("data", this.onData);
    this.clearPendingChunks();
    this.settlePendingSends(new Error(sendError));
    try {
      this.onclose?.();
    } catch (error) {
      this.reportError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private ensureDrainListener(): void {
    if (this.drainListenerAttached) return;
    this.drainListenerAttached = true;
    this.socket.once("drain", this.onDrain);
  }

  private detachDrainListenerIfIdle(): void {
    if (this.pendingSends.size > 0 || !this.drainListenerAttached) return;
    this.socket.off("drain", this.onDrain);
    this.drainListenerAttached = false;
  }

  private settlePendingSends(error?: Error): void {
    for (const settle of [...this.pendingSends]) {
      settle(error);
    }
    this.detachDrainListenerIfIdle();
  }

  private reportError(error: Error): void {
    try {
      this.onerror?.(error);
    } catch {
      // Transport callbacks must not turn a client failure into a daemon failure.
    }
  }

  private clearPendingChunks(): void {
    this.pendingChunks.splice(0);
    this.pendingBlock = undefined;
    this.pendingBlockBytes = 0;
    this.pendingBytes = 0;
    this.initialData = undefined;
  }

  private detachSocketListeners(): void {
    if (!this.socketListenersAttached) return;
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onSocketError);
    this.socket.off("close", this.onSocketClose);
    this.socketListenersAttached = false;
  }
}
