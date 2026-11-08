/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../infrastructure/runtime/native-runtime-startup.mjs";
import { validateTreeSitterSourceBuild } from "../infrastructure/runtime/native-runtime-guard.mjs";
import { connectAgentWorkbenchStdio } from "./stdio-launch.js";

validateTreeSitterSourceBuild();
const session = await connectAgentWorkbenchStdio();
await session.completed;
