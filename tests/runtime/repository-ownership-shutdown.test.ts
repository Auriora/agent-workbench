/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type {
  RepositoryOwnershipLease,
  RepositoryOwnershipPort,
  SnapshotRefreshAdmission,
  SnapshotRefreshControllerPort,
  SnapshotRefreshRequest
} from "../../src/ports/index.js";
import { LazyOwnershipGatedRefreshAuthority } from "../../src/infrastructure/runtime/repository-ownership.js";

const request: SnapshotRefreshRequest = {
  repo_root: "/repo",
  reason: "startup",
  source: "test",
  invalidation_generation: 1
};

function lease(): RepositoryOwnershipLease & { state: "active" } {
  return {
    repo_root: "/repo",
    runtime_identity: "runtime:test",
    schema_version: 1,
    owner_id: "owner-1",
    owner_pid: 123,
    owner_generation: 1,
    heartbeat_at: "2026-11-06T12:00:00.000Z",
    state: "active"
  };
}

function createController(shutdown: () => Promise<void>): SnapshotRefreshControllerPort {
  const receipt = {
    repo_root: "/repo",
    controller_generation: 1,
    execution_state: "idle" as const,
    started_generation: 0,
    requested_generation: 0,
    activity_lease: null,
    worker_invocations: 0,
    worker_termination_state: "not_required" as const
  };
  return {
    request: async (): Promise<SnapshotRefreshAdmission> => ({
      outcome: "blocked",
      reused: false,
      state: "idle",
      reason: "controller_shutdown",
      message: "Refresh controller is shutting down."
    }),
    getReceipt: () => receipt,
    shutdown,
    onTransition: () => () => undefined
  };
}

function createAuthority(options?: {
  createController?: (admission: Extract<Awaited<ReturnType<RepositoryOwnershipPort["acquire"]>>, { outcome: "acquired" }>) => Promise<SnapshotRefreshControllerPort>;
  prepareController?: () => Promise<"ready" | "ownership_ambiguous">;
  cleanupBeforeRelease?: () => Promise<void>;
}) {
  const currentLease = lease();
  let releaseCalls = 0;
  const ownership: RepositoryOwnershipPort = {
    acquire: async () => ({ outcome: "acquired", lease: currentLease }),
    release: async () => { releaseCalls += 1; }
  };
  const authority = new LazyOwnershipGatedRefreshAuthority({
    ownership,
    ownership_request: {
      repo_root: "/repo",
      runtime_identity: "runtime:test",
      schema_version: 1,
      owner_id: "owner-1",
      owner_pid: 123,
      owner_generation: 1,
      heartbeat_at: currentLease.heartbeat_at
    },
    prepare_controller: options?.prepareController,
    cleanup_before_release: options?.cleanupBeforeRelease,
    create_controller: options?.createController ?? (async () => createController(async () => undefined))
  });
  return {
    authority,
    get releaseCalls() { return releaseCalls; }
  };
}

describe("lazy refresh authority shutdown", () => {
  it("quiesces the controller before close releases the ownership lease", async () => {
    let shutdownCalls = 0;
    const harness = createAuthority({
      createController: async () => createController(async () => { shutdownCalls += 1; })
    });

    await expect(harness.authority.request(request)).resolves.toMatchObject({ outcome: "blocked" });
    await harness.authority.shutdown();
    expect(shutdownCalls).toBe(1);
    expect(harness.releaseCalls).toBe(0);
    await expect(harness.authority.request(request)).resolves.toMatchObject({
      outcome: "blocked",
      reason: "controller_shutdown"
    });

    await harness.authority.close();
    expect(shutdownCalls).toBe(1);
    expect(harness.releaseCalls).toBe(1);
  });

  it("retains ownership when controller shutdown rejects", async () => {
    const harness = createAuthority({
      createController: async () => createController(async () => {
        throw new Error("termination unconfirmed");
      })
    });
    await harness.authority.request(request);

    await expect(harness.authority.close()).rejects.toThrow("termination unconfirmed");
    expect(harness.releaseCalls).toBe(0);
    await expect(harness.authority.request(request)).resolves.toMatchObject({
      outcome: "blocked",
      reason: "controller_shutdown"
    });
  });

  it("closes preparation resources before releasing an ambiguous acquired lease", async () => {
    const order: string[] = [];
    const currentLease = lease();
    const authority = new LazyOwnershipGatedRefreshAuthority({
      ownership: {
        acquire: async () => ({ outcome: "acquired", lease: currentLease }),
        release: async () => { order.push("release"); }
      },
      ownership_request: { ...currentLease },
      prepare_controller: async () => { order.push("close-store"); return "ownership_ambiguous"; },
      cleanup_before_release: async () => { throw new Error("must preserve unopened shared resources"); },
      create_controller: async () => { throw new Error("must not create controller"); }
    });
    await expect(authority.prepare()).resolves.toMatchObject({ outcome: "blocked", reason: "ownership_ambiguous" });
    expect(order).toEqual(["close-store", "release"]);
  });

  it("retains an acquired lease when preparation cleanup cannot close its store", async () => {
    const harness = createAuthority({
      prepareController: async () => { throw new Error("preparation failed after opening store"); },
      cleanupBeforeRelease: async () => { throw new Error("store still open"); }
    });
    await expect(harness.authority.prepare()).rejects.toThrow("store still open");
    expect(harness.releaseCalls).toBe(0);
  });

  it("admits again after short-lived ambiguous preparation without closing the shared session", async () => {
    let preparations = 0, sharedClosed = false, created = 0;
    const harness = createAuthority({
      prepareController: async () => ++preparations === 1 ? "ownership_ambiguous" : "ready",
      cleanupBeforeRelease: async () => { sharedClosed = true; },
      createController: async () => {
        expect(sharedClosed).toBe(false);
        created += 1;
        return createController(async () => undefined);
      }
    });
    await expect(harness.authority.prepare()).resolves.toMatchObject({ outcome: "blocked", reason: "ownership_ambiguous" });
    expect(harness.releaseCalls).toBe(1);
    await expect(harness.authority.prepare()).resolves.toMatchObject({ outcome: "ready" });
    expect(created).toBe(1);
    await harness.authority.close();
  });

  it("wins an initialization race by blocking admission and shutting down the created controller", async () => {
    let releaseAcquire!: () => void;
    let releaseCreate!: () => void;
    const acquireGate = new Promise<void>((resolve) => { releaseAcquire = resolve; });
    const createGate = new Promise<void>((resolve) => { releaseCreate = resolve; });
    let shutdownCalls = 0;
    const currentLease = lease();
    const ownership: RepositoryOwnershipPort = {
      acquire: async () => {
        await acquireGate;
        return { outcome: "acquired", lease: currentLease };
      },
      release: async () => undefined
    };
    const authority = new LazyOwnershipGatedRefreshAuthority({
      ownership,
      ownership_request: {
        repo_root: "/repo",
        runtime_identity: "runtime:test",
        schema_version: 1,
        owner_id: "owner-1",
        owner_pid: 123,
        owner_generation: 1,
        heartbeat_at: currentLease.heartbeat_at
      },
      create_controller: async () => {
        await createGate;
        return createController(async () => { shutdownCalls += 1; });
      }
    });

    const admission = authority.request(request);
    const shutdown = authority.shutdown();
    releaseAcquire();
    releaseCreate();
    await shutdown;
    await expect(admission).resolves.toMatchObject({
      outcome: "blocked",
      reason: "controller_shutdown"
    });
    expect(shutdownCalls).toBe(1);
  });
});
