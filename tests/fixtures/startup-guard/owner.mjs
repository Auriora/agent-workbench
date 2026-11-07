/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });
const { createDaemonStartupLock } = await import("../../../src/mcp/daemon-client.ts");
createDaemonStartupLock(process.argv[2]);
fs.writeSync(1, "guard-ready\n");
setInterval(() => undefined, 1000);
