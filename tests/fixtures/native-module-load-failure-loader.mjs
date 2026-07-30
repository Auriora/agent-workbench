/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const failureUrl = "data:text/javascript," + encodeURIComponent(`
  const error = new Error("ERR_DLOPEN_FAILED: injected native module load failure");
  error.code = "ERR_DLOPEN_FAILED";
  throw error;
`);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "better-sqlite3") {
    return {
      url: failureUrl,
      shortCircuit: true
    };
  }
  return nextResolve(specifier, context);
}
