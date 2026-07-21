/* Copyright (C) 2026 Auriora; SPDX-License-Identifier: GPL-3.0-or-later */

export function buildSessionStartContext(payload) {
  return payload.source === "startup" ? "claude-ready" : undefined;
}

export const claudeStartup = buildSessionStartContext({ source: "startup" });
export const claudeResume = buildSessionStartContext({ source: "resume" });
export const claudeCompact = buildSessionStartContext({ source: "compact" });
