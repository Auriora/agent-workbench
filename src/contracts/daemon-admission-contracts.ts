/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** A JSON-RPC request identifier accepted by the MCP protocol. */
export type DaemonRequestId = string | number;

export const MAX_DAEMON_SESSIONS = 64;
export const MAX_DAEMON_SESSION_INPUT_BYTES = 32 * 1024 * 1024;
export const GUARANTEED_DAEMON_SESSION_INPUT_BYTES = 64 * 1024;
export const MAX_DAEMON_SHARED_INPUT_BYTES = 64 * 1024 * 1024;
export const MAX_DAEMON_SESSION_MESSAGES = 8;
export const MAX_DAEMON_MESSAGES = 512;
export const DAEMON_PARTIAL_FRAME_IDLE_MS = 30_000;
export const MAX_DAEMON_SESSION_OUTPUT_BYTES = 32 * 1024 * 1024;

export const DAEMON_ADMISSION_REJECTED_MESSAGE =
  "Agent Workbench daemon admission budget is exhausted.";

export type DaemonAdmissionSnapshot = {
  sessions: number;
  input_bytes: number;
  shared_input_bytes: number;
  messages: number;
};
