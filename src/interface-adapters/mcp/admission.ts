/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DaemonSessionAdmissionPort } from "../../ports/index.js";

/**
 * Installs the one admission boundary used by all handlers registered after
 * the MCP server is constructed. The SDK's constructor-installed handlers
 * (initialize and ping) remain owned by the transport admission layer.
 */
export function installMcpAdmission(
  server: McpServer,
  admission: DaemonSessionAdmissionPort | undefined
): void {
  if (admission === undefined) {
    return;
  }

  const protocol = server.server;
  type AdmissionExtra = { requestId: string | number; signal: AbortSignal };
  type GenericHandler = (request: unknown, extra: AdmissionExtra) => unknown;
  const register = protocol.setRequestHandler.bind(protocol) as unknown as (
    requestSchema: unknown,
    handler: GenericHandler
  ) => void;

  protocol.setRequestHandler = ((requestSchema: unknown, handler: unknown): void => {
    register(
      requestSchema as never,
      (request: unknown, extra: AdmissionExtra): unknown =>
        admission.runRequest(
          extra.requestId,
          extra.signal,
          () => (handler as GenericHandler)(request, extra)
        )
    );
  }) as typeof protocol.setRequestHandler;
}
