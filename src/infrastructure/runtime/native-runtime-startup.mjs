/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
// Keep this the first dependency of runtime entrypoints so a stock/unguarded
// binding is rejected before other modules initialize their native parsers.
// Installation imports only the side-effect-free validator, not this module.
import { validateTreeSitterSourceBuild } from "./native-runtime-guard.mjs";
validateTreeSitterSourceBuild();
