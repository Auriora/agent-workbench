/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import packageJson from "../../package.json" with { type: "json" };

export const AGENT_WORKBENCH_RUNTIME_VERSION = packageJson.version;
