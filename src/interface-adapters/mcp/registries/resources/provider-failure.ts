/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function providerFailureMessage(resourceUri: string, error: unknown): string {
  const reason = sanitizedProviderFailureReason(error);
  return `${resourceUri} provider could not read required runtime evidence: ${reason}`;
}

function sanitizedProviderFailureReason(error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  if (/database is locked|sqlite/i.test(reason)) {
    return "graph store is temporarily unavailable; retry after the current owner or lock clears.";
  }
  return reason;
}
