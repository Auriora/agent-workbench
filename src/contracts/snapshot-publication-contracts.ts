/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { z } from "zod";

export const snapshotPublicationStateSchema = z.enum([
  "building",
  "published",
  "superseded",
  "failed"
]);
export type SnapshotPublicationState = z.infer<typeof snapshotPublicationStateSchema>;
