/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "node:child_process";
import {
  STARTUP_GUARD_RECOVERY_EXIT_CODES,
  MAX_STARTUP_GUARD_RECOVERY_REQUEST_BYTES,
  startupGuardRecoveryRequestSchema,
  type StartupGuardRecoveryOutcome,
  type StartupGuardRecoveryRequest
} from "../../contracts/startup-guard-recovery-contracts.js";

/** The native recovery authority runs in a process, never in the stdio bridge. */
export async function recoverStartupGuardViaHelper(
  entrypointPath: string,
  request: StartupGuardRecoveryRequest,
  signal?: AbortSignal
): Promise<StartupGuardRecoveryOutcome> {
  if (signal?.aborted) return "ambiguous";
  const parsed = startupGuardRecoveryRequestSchema.safeParse(request);
  if (!parsed.success) return "ambiguous";
  const serialized = `${JSON.stringify(parsed.data)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_STARTUP_GUARD_RECOVERY_REQUEST_BYTES) return "ambiguous";

  return await new Promise((resolve) => {
    let settled = false;
    let inputFailed = false;
    const finish = (outcome: StartupGuardRecoveryOutcome): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      resolve(outcome);
    };
    let child: ReturnType<typeof spawn>;
    const onAbort = (): void => {
      // Only the observed dead guard can be removed by a late helper. It never
      // grants ownership; the caller must not resume election after cancellation.
      child.unref();
      finish("ambiguous");
    };
    try {
      child = spawn(process.execPath, [entrypointPath], {
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true
      });
    } catch {
      finish("ambiguous");
      return;
    }
    child.once("error", () => finish("ambiguous"));
    child.once("exit", (code, terminationSignal) => {
      const outcome = terminationSignal === null
        ? Object.entries(STARTUP_GUARD_RECOVERY_EXIT_CODES).find(([, value]) => value === code)?.[0]
        : undefined;
      finish(outcome === "native_module_rebuild_required" ? outcome
        : inputFailed ? "ambiguous" : outcome as StartupGuardRecoveryOutcome | undefined ?? "ambiguous");
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    // A failed native import can close stdin before consuming the request.
    // Preserve its classified exit instead of racing it with EPIPE.
    child.stdin?.once("error", () => { inputFailed = true; });
    child.stdin?.end(serialized);
    if (signal?.aborted) onAbort();
  });
}
