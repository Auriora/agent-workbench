/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { GraphStore } from "../sqlite/graph-store.js";

export type AsyncGraphStoreLoader = (() => Promise<GraphStore>) & {
  close(): Promise<void>;
};

export type SwitchableAsyncGraphStore = AsyncGraphStoreLoader & {
  promote(input: { next: AsyncGraphStoreLoader; prepare: () => Promise<void> | void }): Promise<void>;
};

/**
 * Provides one stable, async-port-only store facade while ownership promotion
 * exchanges the physical SQLite handle. A borrow lasts for one port method;
 * this deliberately permits stale-first-read to promote between calls in a
 * single MCP request without recursively waiting for itself.
 */
export function createSwitchableAsyncGraphStore(initial: AsyncGraphStoreLoader): SwitchableAsyncGraphStore {
  let current = initial;
  let transition: Promise<void> | undefined;
  let closing = false;
  let failed = false;
  let failure: unknown;
  let closePromise: Promise<void> | undefined;
  let active = 0;
  const idleWaiters = new Set<() => void>();

  const notifyIdle = (): void => {
    if (active !== 0) return;
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  };
  const waitForIdle = async (): Promise<void> => {
    if (active === 0) return;
    await new Promise<void>((resolve) => idleWaiters.add(resolve));
  };
  const acquire = async (): Promise<AsyncGraphStoreLoader> => {
    while (true) {
      const pending = transition;
      if (pending !== undefined) {
        await pending;
        continue;
      }
      if (failed) throw failure;
      if (closing) throw new Error("Switchable graph store is closed.");
      // No await separates observing the gate from recording this borrow.
      active += 1;
      if (transition === pending) return current;
      active -= 1;
      notifyIdle();
    }
  };
  const release = (): void => {
    active -= 1;
    notifyIdle();
  };
  const invoke = async (property: PropertyKey, args: readonly unknown[]): Promise<unknown> => {
    const loader = await acquire();
    try {
      const store = await loader();
      const member = Reflect.get(store, property);
      if (typeof member !== "function") throw new TypeError(`Graph store member ${String(property)} is not callable.`);
      return await Reflect.apply(member, store, args);
    } finally {
      release();
    }
  };
  const beginTransition = async (): Promise<() => void> => {
    while (transition !== undefined) await transition;
    if (failed) throw failure;
    if (closing) throw new Error("Switchable graph store is closed.");
    let resolve!: () => void;
    const gate = new Promise<void>((done) => { resolve = done; });
    // No await separates observing an open gate from claiming it.
    transition = gate;
    return () => {
      if (transition !== gate) throw new Error("Switchable graph store transition ownership was lost.");
      transition = undefined;
      resolve();
    };
  };
  const facade = new Proxy({} as GraphStore, {
    get(_target, property) {
      // Prevent Promise.resolve(facade) from treating it as a thenable.
      if (property === "then") return undefined;
      // The daemon query facade intentionally excludes synchronous lifecycle
      // members: handing out a physical db would bypass the borrow gate.
      if (
        property === "db" || property === "databasePath" || property === "validateSchema" ||
        property === "close" || property === "publishValidatedGraphBuild"
      ) {
        throw new Error("Synchronous GraphStore lifecycle access is unavailable through the switchable daemon facade.");
      }
      return (...args: readonly unknown[]) => invoke(property, args);
    }
  });
  const loader = (() => Promise.resolve(facade)) as SwitchableAsyncGraphStore;
  loader.promote = async ({ next, prepare }): Promise<void> => {
    const endTransition = await beginTransition();
    try {
      await waitForIdle();
      await current.close();
      await prepare();
      current = next;
    } catch (error) {
      // The prior handle has already been closed. Never route a later query
      // back to it after a failed ownership preparation.
      failed = true;
      failure = error;
      throw error;
    } finally {
      endTransition();
    }
  };
  loader.close = async (): Promise<void> => {
    closePromise ??= (async () => {
      closing = true;
      if (transition !== undefined) await transition;
      await waitForIdle();
      await current.close();
    })();
    await closePromise;
  };
  return loader;
}
