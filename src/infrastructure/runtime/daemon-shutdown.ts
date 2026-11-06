/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DAEMON_SHUTDOWN_BUDGET_MS,
  type DaemonShutdownReceipt
} from "../../contracts/daemon-shutdown-contracts.js";
import type { SnapshotPublicationState } from "../../contracts/index.js";

type StartupExclusion = { release(): void };
type ControllerReceipt = {
  worker_termination_state: DaemonShutdownReceipt["worker_termination_state"];
  activity_lease?: { state: "held" | "released" } | null;
  publication_state?: SnapshotPublicationState;
};

export type DaemonShutdownCoordinatorOptions = {
  acquire_startup_exclusion: () => StartupExclusion | "ambiguous" | null;
  stop_admission: () => void;
  stop_triggers: () => void;
  publish_draining: () => void;
  close_sockets: () => void;
  controller_shutdown: () => Promise<void>;
  controller_receipt: () => ControllerReceipt;
  await_startup_refresh: () => Promise<void>;
  close_clients: () => Promise<void>;
  close_resources: () => Promise<void>;
  close_store: () => Promise<void>;
  release_authority: () => Promise<void>;
  cleanup_endpoint: () => void;
  observe: (receipt: DaemonShutdownReceipt) => void;
  budget_ms?: number;
};

/**
 * Owns the daemon's single, finite shutdown protocol.
 *
 * The callbacks deliberately describe boundaries rather than implementation
 * details. The coordinator is the only owner of ordering, the deadline and
 * the terminal fence: once a phase fails, no later callback is invoked.
 */
export class DaemonShutdownCoordinator {
  private readonly options: DaemonShutdownCoordinatorOptions;
  private readonly budgetMs: number;
  private closePromise: Promise<DaemonShutdownReceipt> | undefined;
  private active = true;
  private deadline = 0;
  private deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  private deadlineReached = false;
  private deadlinePromise: Promise<never> | undefined;

  public constructor(options: DaemonShutdownCoordinatorOptions) {
    this.options = options;
    this.budgetMs = options.budget_ms ?? DAEMON_SHUTDOWN_BUDGET_MS;
    if (!Number.isFinite(this.budgetMs) || this.budgetMs <= 0) {
      throw new TypeError("Shutdown budget must be a positive finite number.");
    }
  }

  public close(): Promise<DaemonShutdownReceipt> {
    this.closePromise ??= this.run();
    return this.closePromise;
  }

  private async run(): Promise<DaemonShutdownReceipt> {
    const startedAt = performance.now();
    this.deadline = startedAt + this.budgetMs;
    this.deadlinePromise = new Promise<never>((_, reject) => {
      this.deadlineTimer = setTimeout(() => {
        this.deadlineReached = true;
        reject(new ShutdownDeadlineError());
      }, this.budgetMs);
    });
    // The shared deadline is deliberately referenced. Its rejection is also
    // consumed here because it can fire after a phase has already completed.
    void this.deadlinePromise.catch(() => undefined);

    // These operations are the admission linearization point. No await is
    // allowed before all three have run.
    try {
      this.options.stop_admission();
      this.options.stop_triggers();
    } catch {
      return this.blocked("admission", "cleanup_failed");
    }

    const draining = this.receipt("draining", "admission", "requested");
    this.observe(draining);

    // Request worker cancellation before waiting on any startup refresh or
    // disposal or deciding whether destructive cleanup is authorized. The
    // promise is observed even when admission exclusion is unavailable, so a
    // late rejection cannot become an unhandled process error.
    let controllerShutdown: Promise<void>;
    try {
      this.assertActive();
      controllerShutdown = Promise.resolve(this.options.controller_shutdown());
      void controllerShutdown.catch(() => undefined);
    } catch {
      return this.blocked("refresh", "refresh_unconfirmed");
    }

    try {
      this.options.publish_draining();
    } catch {
      return this.blocked("admission", "cleanup_failed");
    }
    try {
      this.options.close_sockets();
    } catch {
      return this.blocked("admission", "cleanup_failed");
    }

    let exclusion: StartupExclusion;
    try {
      const acquired = this.options.acquire_startup_exclusion();
      if (acquired === null || acquired === "ambiguous") {
        return this.blocked("admission", "startup_exclusion_unavailable");
      }
      exclusion = acquired;
    } catch {
      return this.blocked("admission", "startup_exclusion_unavailable");
    }

    if (this.deadlineReached || performance.now() >= this.deadline) {
      return this.blocked("admission", "deadline");
    }

    try {
      await this.phase("refresh", async () => {
        await Promise.all([
          controllerShutdown,
          this.options.await_startup_refresh()
        ]);
        this.assertControllerSafe();
      });
      await this.phase("resources", async () => {
        await Promise.all([
          this.options.close_clients(),
          this.options.close_resources()
        ]);
      });
      await this.phase("store", () => this.options.close_store());
      await this.phase("ownership", () => this.options.release_authority());
      await this.phase("endpoint", async () => {
        this.options.cleanup_endpoint();
        this.assertActive();
        exclusion.release();
      });
    } catch (error) {
      const phase = this.lastPhase ?? "refresh";
      const cause = error instanceof ShutdownDeadlineError
        ? "deadline"
        : phase === "refresh" ? "refresh_unconfirmed" : "cleanup_failed";
      return this.blocked(phase, cause);
    } finally {
      this.clearDeadlineTimer();
    }

    const settled = this.receipt("settled", "complete", "complete");
    this.observe(settled);
    this.active = false;
    return settled;
  }

  private lastPhase: DaemonShutdownReceipt["phase"] | undefined;

  private async phase(
    phase: Exclude<DaemonShutdownReceipt["phase"], "admission" | "complete">,
    operation: () => Promise<void> | void
  ): Promise<void> {
    this.lastPhase = phase;
    this.assertActive();
    this.observe(this.receipt("draining", phase, "requested"));
    let result: Promise<void>;
    try {
      result = Promise.resolve(operation());
      void result.catch(() => undefined);
    } catch (error) {
      throw error;
    }
    if (this.deadlineReached || performance.now() >= this.deadline) throw new ShutdownDeadlineError();
    await Promise.race([result, this.deadlinePromise]);
    this.assertActive();
  }

  private assertControllerSafe(): void {
    const receipt = this.options.controller_receipt();
    if (
      receipt.worker_termination_state === "unconfirmed" ||
      receipt.activity_lease?.state === "held" ||
      receipt.publication_state === "building"
    ) throw new Error("Refresh activity remains unsafe during daemon shutdown.");
  }

  private assertActive(): void {
    if (!this.active || this.deadlineReached || performance.now() >= this.deadline) {
      throw new ShutdownDeadlineError();
    }
  }

  private blocked(
    phase: DaemonShutdownReceipt["phase"],
    cause: Extract<DaemonShutdownReceipt["cause"], "deadline" | "startup_exclusion_unavailable" | "refresh_unconfirmed" | "cleanup_failed">
  ): DaemonShutdownReceipt {
    this.active = false;
    this.clearDeadlineTimer();
    const blocked = this.receipt("blocked", phase, cause);
    this.observe(blocked);
    return blocked;
  }

  private observe(receipt: DaemonShutdownReceipt): void {
    try {
      this.options.observe(receipt);
    } catch {
      // Evidence sinks are diagnostic and cannot change shutdown safety.
    }
  }

  private receipt(
    state: DaemonShutdownReceipt["state"],
    phase: DaemonShutdownReceipt["phase"],
    cause: DaemonShutdownReceipt["cause"]
  ): DaemonShutdownReceipt {
    let controller: ControllerReceipt;
    try {
      controller = this.options.controller_receipt();
    } catch {
      controller = {
        worker_termination_state: "unconfirmed",
        activity_lease: { state: "held" }
      };
    }
    return {
      state,
      phase,
      cause,
      worker_termination_state: controller.worker_termination_state,
      activity_lease_held: controller.activity_lease?.state === "held",
      ...(controller.publication_state === undefined ? {} : { publication_state: controller.publication_state })
    };
  }

  private clearDeadlineTimer(): void {
    if (this.deadlineTimer !== undefined) {
      clearTimeout(this.deadlineTimer);
      this.deadlineTimer = undefined;
    }
  }
}

class ShutdownDeadlineError extends Error {
  public constructor() {
    super("daemon shutdown deadline exceeded");
  }
}
