/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { connectAgentWorkbenchStdio } from "./stdio-launch.js";

const socket = await connectAgentWorkbenchStdio();
await new Promise<void>((resolve) => {
  if (socket.destroyed) {
    resolve();
    return;
  }
  socket.once("close", resolve);
});
process.stdin.pause();
