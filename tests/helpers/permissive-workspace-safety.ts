/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { WorkspaceSafetyPort } from "../../src/ports/index.js";

export const permissiveWorkspaceSafety: WorkspaceSafetyPort = {
  resolveWorkspacePath(requestedPath) {
    return {
      allowed: true,
      absolutePath: requestedPath,
      relativePath: requestedPath,
      readOnly: false
    };
  },
  isReadOnlyPath() {
    return false;
  },
  redactSecretLikeText(value) {
    return value;
  }
};
