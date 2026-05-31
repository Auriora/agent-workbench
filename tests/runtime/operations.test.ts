import { describe, expect, it } from "vitest";
import type { ClockPort } from "../../src/ports/index.js";
import {
  InMemoryCancellationAdapter,
  InMemoryRuntimeOperationsAdapter
} from "../../src/infrastructure/runtime/index.js";

class MutableClock implements ClockPort {
  private timestamp: number;

  constructor(initialIso: string) {
    this.timestamp = Date.parse(initialIso);
  }

  public now(): Date {
    return new Date(this.timestamp);
  }

  public nowIso8601(): string {
    return this.now().toISOString();
  }

  public nowUnixMs(): number {
    return this.timestamp;
  }

  public advance(ms: number): void {
    this.timestamp += ms;
  }
}

describe("runtime operation adapters", () => {
  it("stores cache entries with TTL and explicit snapshot/file invalidation", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });

    await runtime.set({
      namespace: "query",
      key: "symbol:Runner",
      value: { rows: 1 },
      ttl_ms: 1_000,
      depends_on_snapshot_id: "snap-1",
      depends_on_file_paths: ["src/service.py"]
    });
    await runtime.set({
      namespace: "query",
      key: "symbol:Other",
      value: { rows: 2 },
      depends_on_snapshot_id: "snap-1",
      depends_on_file_paths: ["src/other.py"]
    });

    expect(await runtime.has({ namespace: "query", key: "symbol:Runner" })).toBe(true);
    expect(await runtime.invalidateFile({ snapshot_id: "snap-1", file_path: "./src/service.py" })).toBe(1);
    expect(await runtime.get({ namespace: "query", key: "symbol:Runner" })).toBeNull();
    expect(await runtime.get<{ rows: number }>({ namespace: "query", key: "symbol:Other" })).toEqual({
      rows: 2
    });

    await runtime.set({
      namespace: "query",
      key: "symbol:Runner",
      value: { rows: 1 },
      ttl_ms: 1_000
    });
    clock.advance(1_000);
    expect(await runtime.get({ namespace: "query", key: "symbol:Runner" })).toBeNull();
    expect(await runtime.invalidateSnapshot({ snapshot_id: "snap-1" })).toBe(1);
  });

  it("refuses duplicate warm-up work unless forced and records terminal state", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });

    const first = await runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-1" });
    const duplicate = await runtime.requestWarmup({ repo_root: "/repo", snapshot_id: "snap-1" });
    const forced = await runtime.requestWarmup({
      repo_root: "/repo",
      snapshot_id: "snap-2",
      force: true
    });

    expect(duplicate).toBe(first);
    expect(forced).not.toBe(first);
    await runtime.markOwner({ execution_id: forced, owner_id: "owner-1" });
    expect(await runtime.getState({ repo_root: "/repo" })).toEqual(
      expect.objectContaining({
        execution_id: forced,
        state: "running",
        owner_id: "owner-1"
      })
    );

    await runtime.completeWarmup({
      execution_id: forced,
      success: false,
      reason: "parser unavailable"
    });
    expect(await runtime.getState({ repo_root: "/repo" })).toEqual(
      expect.objectContaining({
        state: "failed",
        reason: "parser unavailable"
      })
    );
  });

  it("coordinates owner, observer, stale owner, dead owner, and isolated worker states", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({
      clock,
      owner_stale_after_ms: 1_000,
      owner_dead_after_ms: 3_000
    });

    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-1" })
    ).resolves.toMatchObject({ state: "owner", owner_id: "owner-1" });
    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-2" })
    ).resolves.toMatchObject({ state: "observer", owner_id: "owner-1" });

    clock.advance(1_000);
    await expect(runtime.getOwner({ repo_root: "/repo" })).resolves.toMatchObject({
      state: "stale_owner"
    });
    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-1", owner_id: "owner-2" })
    ).resolves.toMatchObject({ state: "stale_owner", owner_id: "owner-1" });

    clock.advance(2_000);
    await expect(runtime.getOwner({ repo_root: "/repo" })).resolves.toMatchObject({
      state: "dead_owner"
    });
    await expect(
      runtime.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-2", owner_id: "owner-2" })
    ).resolves.toMatchObject({ state: "owner", owner_id: "owner-2", snapshot_id: "snap-2" });
    clock.advance(500);
    await runtime.heartbeat({ repo_root: "/repo", snapshot_id: "snap-2", owner_id: "owner-2" });
    clock.advance(600);
    await expect(runtime.getOwner({ repo_root: "/repo" })).resolves.toMatchObject({
      state: "owner",
      owner_id: "owner-2"
    });

    const isolated = new InMemoryRuntimeOperationsAdapter({
      clock,
      isolated_worker: true
    });
    await expect(
      isolated.claimOwnership({ repo_root: "/repo", snapshot_id: "snap-3", owner_id: "debug" })
    ).resolves.toMatchObject({ state: "isolated_worker", owner_id: "debug" });
    await expect(isolated.getOwner({ repo_root: "/repo" })).resolves.toBeNull();
  });

  it("creates stable runtime context signatures and scoped cancellation", async () => {
    const clock = new MutableClock("2026-05-31T12:00:00.000Z");
    const runtime = new InMemoryRuntimeOperationsAdapter({ clock });
    const cancellation = new InMemoryCancellationAdapter({ clock });
    const context = await runtime.create({
      operation: "symbol_search",
      repo_root: "/repo",
      workspace_root: "/repo",
      request_id: "request-1",
      snapshot_id: "snap-1",
      freshness: "fresh",
      budget_ms: 100
    });
    const same = await runtime.create({
      operation: "symbol_search",
      repo_root: "/repo",
      workspace_root: "/repo",
      request_id: "request-2",
      snapshot_id: "snap-1",
      freshness: "fresh",
      budget_ms: 100
    });
    const changed = runtime.applyOverrides({
      context,
      overrides: { freshness: "stale" }
    });

    await expect(runtime.getSignature({ context })).resolves.toBe(
      await runtime.getSignature({ context: same })
    );
    await expect(runtime.getSignature({ context: changed })).resolves.not.toBe(
      await runtime.getSignature({ context })
    );

    const token = await cancellation.create({ scope: "index", ttl_ms: 1_000 });
    await expect(cancellation.isCancelled({ token: token.token })).resolves.toBe(false);
    clock.advance(1_000);
    await expect(cancellation.isCancelled({ token: token.token })).resolves.toBe(true);

    const scoped = await cancellation.create({ scope: "index" });
    await expect(cancellation.revokeScope({ scope: "index" })).resolves.toBe(1);
    await expect(cancellation.isCancelled({ token: scoped.token })).resolves.toBe(true);
  });
});
