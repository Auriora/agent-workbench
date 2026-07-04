/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Type declarations for the JS vendoring script so TS test files importing it
// get typed maps instead of an implicit-any module (was a pre-existing
// tests/integration/claude-plugin.test.ts typecheck failure).

/** Source hook filename -> vendored filename under claude-plugin/hooks. */
export const VENDORED_HOOK_FILES: Record<string, string>;

/** Source plugin-root filename -> vendored filename under claude-plugin/. */
export const VENDORED_PLUGIN_FILES: Record<string, string>;

/** Vendor the shared hook + plugin-root modules into claude-plugin/.
 *  Returns the repo-relative paths written. */
export function syncClaudePluginHooks(): string[];
