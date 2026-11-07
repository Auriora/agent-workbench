/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  DaemonShutdownCoordinator,
  type DaemonShutdownCoordinatorOptions
} from "../../../src/infrastructure/runtime/daemon-shutdown.js";
import type { DaemonShutdownReceipt } from "../../../src/contracts/daemon-shutdown-contracts.js";

function options(overrides: Partial<DaemonShutdownCoordinatorOptions> = {}) {
  const events: string[] = [];
  const receipts: DaemonShutdownReceipt[] = [];
  let released = false;
  const base = {
    acquire_startup_exclusion: async () => ({ release: () => { released = true; events.push("release"); } }),
    stop_admission: () => events.push("admission"),
    stop_triggers: () => events.push("triggers"),
    publish_draining: () => events.push("draining"),
    close_sockets: () => events.push("sockets"),
    controller_shutdown: async () => { events.push("controller"); },
    controller_receipt: () => ({
      worker_termination_state: "confirmed" as const,
      activity_lease: { state: "released" as const },
      publication_state: "published" as const
    }),
    await_startup_refresh: async () => { events.push("startup"); },
    close_clients: async () => { events.push("clients"); },
    close_resources: async () => { events.push("resources"); },
    close_store: async () => { events.push("store"); },
    release_authority: async () => { events.push("authority"); },
    cleanup_endpoint: () => events.push("endpoint"),
    observe: (receipt: DaemonShutdownReceipt) => receipts.push(receipt),
    budget_ms: 100
  } satisfies DaemonShutdownCoordinatorOptions;
  return {
    events,
    receipts,
    get released() { return released; },
    coordinator: new DaemonShutdownCoordinator({ ...base, ...overrides })
  };
}

describe("DaemonShutdownCoordinator", () => {
  it("gates synchronously, requests cancellation before drain, and is idempotent", async () => {
    const state = options();
    const first = state.coordinator.close();
    const second = state.coordinator.close();
    expect(first).toBe(second);
    const receipt = await first;

    expect(receipt).toMatchObject({ state: "settled", phase: "complete", cause: "complete" });
    expect(state.events.slice(0, 6)).toEqual(["admission", "triggers", "controller", "draining", "sockets", "startup"]);
    expect(state.events).toEqual([
      "admission", "triggers", "controller", "draining", "sockets", "startup",
      "clients", "resources", "store", "authority", "endpoint", "release"
    ]);
    expect(state.receipts.map((item) => `${item.state}:${item.phase}`)).toEqual([
      "draining:admission", "draining:refresh", "draining:resources",
      "draining:store", "draining:ownership", "draining:endpoint", "settled:complete"
    ]);
    expect(state.released).toBe(true);
  });

  it("blocks on unavailable startup exclusion without destructive cleanup", async () => {
    const state = options({ acquire_startup_exclusion: async () => null });
    const receipt = await state.coordinator.close();

    expect(receipt).toMatchObject({
      state: "blocked",
      phase: "admission",
      cause: "startup_exclusion_unavailable"
    });
    expect(state.events).toEqual(["admission", "triggers", "controller", "draining", "sockets"]);
    expect(state.released).toBe(false);
  });

  it("fences authority and endpoint cleanup after a bounded failure", async () => {
    const state = options({
      budget_ms: 20,
      close_resources: () => new Promise<void>(() => undefined)
    });
    const receipt = await state.coordinator.close();

    expect(receipt).toMatchObject({ state: "blocked", phase: "resources", cause: "deadline" });
    expect(state.events).toEqual([
      "admission", "triggers", "controller", "draining", "sockets", "startup", "clients"
    ]);
    expect(state.released).toBe(false);
  });

  it("includes asynchronous exclusion in the same deadline and fences late acquisition", async () => {
    let acquired!: (value: { release(): void }) => void;
    let signal!: AbortSignal;
    let lateRelease = false;
    const state = options({
      budget_ms: 20,
      acquire_startup_exclusion: (input) => {
        signal = input;
        return new Promise((resolve) => { acquired = resolve; });
      }
    });
    const closing = state.coordinator.close();
    expect(state.events).toEqual(["admission", "triggers", "controller", "draining", "sockets"]);
    expect(signal.aborted).toBe(false);

    await expect(closing).resolves.toMatchObject({ state: "blocked", phase: "admission", cause: "deadline" });
    expect(signal.aborted).toBe(true);
    acquired({ release: () => { lateRelease = true; } });
    await Promise.resolve();
    await Promise.resolve();
    expect(lateRelease).toBe(false);
    expect(state.events).toEqual(["admission", "triggers", "controller", "draining", "sockets"]);
    expect(state.coordinator.close()).toBe(closing);
  });

  it("records refresh failure and does not release the startup exclusion", async () => {
    const state = options({
      controller_shutdown: async () => { state.events.push("controller"); throw new Error("worker failed"); }
    });
    const receipt = await state.coordinator.close();

    expect(receipt).toMatchObject({ state: "blocked", phase: "refresh", cause: "refresh_unconfirmed" });
    expect(state.released).toBe(false);
    expect(state.events).toEqual(["admission", "triggers", "controller", "draining", "sockets", "startup"]);
  });

  it("fences cleanup when draining publication fails after cancellation starts", async () => {
    const state = options({
      publish_draining: () => { state.events.push("publish-failed"); throw new Error("metadata unavailable"); }
    });
    const receipt = await state.coordinator.close();

    expect(receipt).toMatchObject({ state: "blocked", phase: "admission", cause: "cleanup_failed" });
    expect(state.events).toEqual(["admission", "triggers", "controller", "publish-failed"]);
    expect(state.released).toBe(false);
  });
});
