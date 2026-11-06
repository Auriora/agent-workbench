/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { DaemonLifetimeEvidencePort } from "../../ports/index.js";

export type DaemonProcessHookTarget = Pick<
  NodeJS.Process,
  "on" | "once" | "prependListener" | "removeListener"
>;

/**
 * Installs observation-only process hooks. The monitor and signal listeners do
 * not replace Node's fatal handling or the daemon's existing shutdown path.
 */
export function installDaemonProcessHooks(input: {
  evidence: DaemonLifetimeEvidencePort;
  process?: DaemonProcessHookTarget;
}): () => void {
  const target = input.process ?? process;
  const onFatal = (
    _error: unknown,
    origin: NodeJS.UncaughtExceptionOrigin
  ): void => {
    try {
      input.evidence.observeFatal(
        origin === "unhandledRejection" ? "unhandledRejection" : "uncaughtException"
      );
    } catch {
      // Evidence loss must not alter Node's fatal exception behavior.
    }
  };
  const onSignal = (): void => {
    try {
      input.evidence.observeSignal("SIGTERM");
    } catch {
      // Evidence loss must not alter the existing SIGTERM shutdown path.
    }
  };
  const onExit = (code: number): void => {
    try {
      input.evidence.observeExit(code);
    } catch {
      // Evidence loss must not prevent process exit.
    }
  };

  target.prependListener("uncaughtExceptionMonitor", onFatal);
  target.prependListener("SIGTERM", onSignal);
  target.on("exit", onExit);

  return () => {
    target.removeListener("uncaughtExceptionMonitor", onFatal);
    target.removeListener("SIGTERM", onSignal);
    target.removeListener("exit", onExit);
  };
}
