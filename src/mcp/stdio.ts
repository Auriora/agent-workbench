/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { connectAgentWorkbenchStdio } from "./stdio-launch.js";

const session = await connectAgentWorkbenchStdio();
await session.completed;
