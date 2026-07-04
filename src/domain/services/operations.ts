/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { FileContentHashBinding } from "../models/runtime.js";

export type WorkPriority = "fast" | "medium" | "slow";

export interface QueueWorkItem<TPayload = unknown> {
  kind: string;
  payload: TPayload;
  queue_name?: string;
  trace_id?: string;
  dedupe_key?: string;
}

export interface QueueHandle {
  queue_id: string;
  priority: WorkPriority;
  enqueued_at: string;
}

export interface CacheValidationInput {
  depends_on_snapshot_id?: string;
  depends_on_config_identity?: string;
  depends_on_file_hashes?: readonly FileContentHashBinding[];
}

export interface CacheSetInput extends CacheValidationInput {
  namespace: string;
  key: string;
  ttl_ms?: number;
  depends_on_file_paths?: readonly string[];
}

export type RuntimeCacheValidationInput = CacheValidationInput & {
  namespace: string;
  key: string;
};

export interface CancellationToken {
  token: string;
  reason?: string;
  issued_at: string;
  expires_at?: string;
}
