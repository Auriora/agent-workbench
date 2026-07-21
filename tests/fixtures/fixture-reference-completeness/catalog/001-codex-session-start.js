/* Copyright (C) 2026 Auriora; SPDX-License-Identifier: GPL-3.0-or-later */

export function buildSessionStartContext(payload) {
  return payload.source === "startup" ? "codex-ready" : undefined;
}

export const codexStartup = buildSessionStartContext({ source: "startup" });
export const codexResume = buildSessionStartContext({ source: "resume" });
export const codexCompact = buildSessionStartContext({ source: "compact" });
export const codexClear = buildSessionStartContext({ source: "clear" });
