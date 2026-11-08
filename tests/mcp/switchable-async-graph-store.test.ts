/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it, vi } from "vitest";
import type { GraphStore } from "../../src/infrastructure/sqlite/graph-store.js";
import {
  createSwitchableAsyncGraphStore,
  type AsyncGraphStoreLoader
} from "../../src/infrastructure/runtime/switchable-async-graph-store.js";

describe("switchable async graph store", () => {
  it("waits for an in-flight observer port method before closing and swapping its handle", async () => {
    let finish!: () => void;
    const held = new Promise<void>((resolve) => { finish = resolve; });
    const observerClose = vi.fn(async () => undefined);
    const ownedClose = vi.fn(async () => undefined);
    const prepare = vi.fn(async () => undefined);
    const observer = loader({
      async getLatestPublished() {
        await held;
        return { source: "observer" };
      }
    }, observerClose);
    const owned = loader({
      async getLatestPublished() {
        return { source: "owner" };
      }
    }, ownedClose);
    const switchable = createSwitchableAsyncGraphStore(observer);
    const graph = await switchable() as unknown as {
      getLatestPublished(): Promise<{ source: string }>;
    };

    const inFlight = graph.getLatestPublished();
    const promotion = switchable.promote({ next: owned, prepare });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(observerClose).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();

    finish();
    await expect(inFlight).resolves.toEqual({ source: "observer" });
    await promotion;
    expect(observerClose).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
    await expect(graph.getLatestPublished()).resolves.toEqual({ source: "owner" });
    expect(ownedClose).not.toHaveBeenCalled();
  });

  it("fails closed after ownership preparation fails instead of reusing its closed observer handle", async () => {
    const observerClose = vi.fn(async () => undefined);
    const observer = loader({
      async getLatestPublished() { return { source: "observer" }; }
    }, observerClose);
    const owned = loader({
      async getLatestPublished() { return { source: "owner" }; }
    }, vi.fn(async () => undefined));
    const switchable = createSwitchableAsyncGraphStore(observer);
    const graph = await switchable() as unknown as {
      getLatestPublished(): Promise<{ source: string }>;
    };
    const preparationFailure = new Error("migration rejected");

    await expect(switchable.promote({
      next: owned,
      prepare: () => { throw preparationFailure; }
    })).rejects.toBe(preparationFailure);
    expect(observerClose).toHaveBeenCalledTimes(1);
    await expect(graph.getLatestPublished()).rejects.toBe(preparationFailure);
  });

  it("makes concurrent close callers wait for the same active borrow to settle", async () => {
    let finish!: () => void;
    const held = new Promise<void>((resolve) => { finish = resolve; });
    const close = vi.fn(async () => undefined);
    const switchable = createSwitchableAsyncGraphStore(loader({
      async getLatestPublished() {
        await held;
        return { source: "observer" };
      }
    }, close));
    const graph = await switchable() as unknown as {
      getLatestPublished(): Promise<{ source: string }>;
    };
    const inFlight = graph.getLatestPublished();
    let firstSettled = false;
    let secondSettled = false;
    const first = switchable.close().then(() => { firstSettled = true; });
    const second = switchable.close().then(() => { secondSettled = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(firstSettled).toBe(false);
    expect(secondSettled).toBe(false);
    finish();
    await inFlight;
    await Promise.all([first, second]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("makes shutdown wait for an already-started promotion before closing the replacement handle", async () => {
    let finishPreparation!: () => void;
    const preparing = new Promise<void>((resolve) => { finishPreparation = resolve; });
    const observerClose = vi.fn(async () => undefined);
    const ownedClose = vi.fn(async () => undefined);
    const switchable = createSwitchableAsyncGraphStore(loader({
      async getLatestPublished() { return { source: "observer" }; }
    }, observerClose));
    const owned = loader({
      async getLatestPublished() { return { source: "owner" }; }
    }, ownedClose);

    const promotion = switchable.promote({ next: owned, prepare: async () => await preparing });
    await vi.waitFor(() => expect(observerClose).toHaveBeenCalledTimes(1));
    let closeSettled = false;
    const shutdown = switchable.close().then(() => { closeSettled = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(closeSettled).toBe(false);
    expect(ownedClose).not.toHaveBeenCalled();

    finishPreparation();
    await Promise.all([promotion, shutdown]);
    expect(ownedClose).toHaveBeenCalledTimes(1);
  });
});

function loader(
  store: unknown,
  close: () => Promise<void>
): AsyncGraphStoreLoader {
  const load = (() => Promise.resolve(store as GraphStore)) as AsyncGraphStoreLoader;
  load.close = close;
  return load;
}
