/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function withDefaultRepoRoot<T extends { repo_root?: string }>(
  request: T,
  repoRoot: string
): T & { repo_root: string } {
  return {
    ...request,
    repo_root: request.repo_root ?? repoRoot
  };
}
