/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const DISTRIBUTION_ANALYTICS_ENABLED_DEFINE =
  "__AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED__";
export const DISTRIBUTION_POSTHOG_TOKEN_DEFINE =
  "__AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN__";

export function distributionAnalyticsDefines(env = process.env) {
  const requested = env.AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED;
  const enabled = requested === "1" || requested === "true";
  if (!enabled) {
    if (requested !== undefined && requested !== "0" && requested !== "false") {
      throw new Error(
        "AGENT_WORKBENCH_DISTRIBUTION_ANALYTICS_ENABLED must be true, false, 1, or 0"
      );
    }
    return {
      [DISTRIBUTION_ANALYTICS_ENABLED_DEFINE]: "false",
      [DISTRIBUTION_POSTHOG_TOKEN_DEFINE]: JSON.stringify("")
    };
  }

  const projectToken = env.AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN?.trim();
  if (projectToken === undefined || projectToken === "") {
    throw new Error(
      "Distribution analytics was enabled without AGENT_WORKBENCH_DISTRIBUTION_POSTHOG_PROJECT_TOKEN"
    );
  }

  return {
    [DISTRIBUTION_ANALYTICS_ENABLED_DEFINE]: "true",
    [DISTRIBUTION_POSTHOG_TOKEN_DEFINE]: JSON.stringify(projectToken)
  };
}
