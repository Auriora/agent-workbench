/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { feedbackMode } from "./hook-common.js";

const DEFAULT_SKILL_REFERENCE = "the packaged Agent Workbench skill";

export function shouldEmitSessionStartContext(payload) {
  const eventName = typeof payload?.hook_event_name === "string" ? payload.hook_event_name : "";
  if (eventName && eventName !== "SessionStart") {
    return true;
  }

  const source = typeof payload?.source === "string" ? payload.source.trim().toLowerCase() : "";
  return source === "" || source === "startup";
}

export function buildSessionStartContext(
  payload,
  env = process.env,
  { skillReference = DEFAULT_SKILL_REFERENCE } = {}
) {
  if (feedbackMode(env) !== "basic" || !shouldEmitSessionStartContext(payload)) {
    return undefined;
  }

  return `Before making a repository claim you have not verified in this session, including a quick overview, invoke ${skillReference} for read-only authority, freshness, and claim-boundary evidence; skip when the task needs no repository evidence.`;
}
