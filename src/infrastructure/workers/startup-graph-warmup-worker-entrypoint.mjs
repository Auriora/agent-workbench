/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { register } from "tsx/esm/api";

register({ parentURL: import.meta.url });
await import("./startup-graph-warmup-worker.ts");
