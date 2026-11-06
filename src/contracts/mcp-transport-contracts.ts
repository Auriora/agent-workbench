/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Maximum UTF-8 bytes in a daemon handshake line, excluding LF. */
export const MAX_DAEMON_HANDSHAKE_BYTES = 16 * 1024;

/** Maximum UTF-8 bytes in one MCP JSON-RPC frame, excluding LF. */
export const MAX_MCP_FRAME_BYTES = 16 * 1024 * 1024;

export const DAEMON_HANDSHAKE_TOO_LARGE_MESSAGE =
  "Agent Workbench daemon handshake exceeds the 16 KiB limit.";

export const MCP_FRAME_TOO_LARGE_MESSAGE =
  "Agent Workbench MCP frame exceeds the 16 MiB limit.";

export const MCP_SEND_CLOSED_MESSAGE =
  "SocketServerTransport closed before the send completed.";

export const MCP_SEND_PEER_CLOSED_MESSAGE =
  "SocketServerTransport peer closed before the send completed.";
