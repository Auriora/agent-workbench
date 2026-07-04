/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ClockPort } from "../../ports/index.js";

export class SystemClockAdapter implements ClockPort {
  public now(): Date {
    return new Date();
  }

  public nowIso8601(): string {
    return this.now().toISOString();
  }

  public nowUnixMs(): number {
    return this.now().getTime();
  }
}
