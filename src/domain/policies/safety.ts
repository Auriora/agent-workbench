/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type WorkspaceSafetyDecision =
  | {
      allowed: true;
      path: string;
      reason?: undefined;
    }
  | {
      allowed: false;
      path: string;
      reason: "outside_scope" | "generated_path" | "symlink_escape" | "secret_like";
      message: string;
    };

export type FreshnessPolicyDecision =
  | {
      accepted: true;
      freshness: "fresh" | "refreshing" | "cold" | "stale" | "unknown";
    }
  | {
      accepted: false;
      freshness: "stale" | "cold" | "unknown";
      reason: "refresh_in_progress" | "requires_preflight" | "owner_stale";
      message: string;
    };
