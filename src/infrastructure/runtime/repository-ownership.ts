/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import type {
  RepositoryOwnershipAdmission,
  RepositoryOwnershipLease,
  RepositoryOwnershipPort,
  SnapshotRefreshAdmission,
  SnapshotRefreshAdmissionFailurePort,
  SnapshotRefreshControllerPort,
  SnapshotRefreshPort,
  SnapshotRefreshRequest
} from "../../ports/index.js";

type ProcessState = "active" | "dead" | "ambiguous";
type BlockedOwnershipAdmission = Extract<RepositoryOwnershipAdmission, { outcome: "blocked" }>;
const MAX_RECOVERED_OWNER_EVIDENCE = 32;

export class FileRepositoryOwnershipAdapter implements RepositoryOwnershipPort {
  public constructor(
    private readonly lockPath: string,
    private readonly processState: (pid: number) => ProcessState = currentProcessState,
    private readonly beforeDeadOwnerReclaim?: () => Promise<void>
  ) {}

  public async acquire(
    input: Parameters<RepositoryOwnershipPort["acquire"]>[0]
  ): Promise<RepositoryOwnershipAdmission> {
    fs.mkdirSync(path.dirname(this.lockPath), { recursive: true });
    const lease: RepositoryOwnershipLease & { state: "active" } = { ...input, state: "active" };
    const orphanGuardRecovery = this.recoverMissingCanonicalFromGuard();
    if (orphanGuardRecovery === "blocked") {
      return { outcome: "blocked", reason: "ownership_ambiguous", owner: ambiguousLease(input) };
    }
    try {
      writeExclusive(this.lockPath, lease);
      return { outcome: "acquired", lease };
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
    }

    const existing = readLease(this.lockPath);
    if (existing === undefined) {
      return { outcome: "blocked", reason: "ownership_ambiguous", owner: ambiguousLease(input) };
    }
    const state = this.processState(existing.owner_pid);
    if (state === "active") {
      return { outcome: "blocked", reason: "owner_active", owner: { ...existing, state: "active" } };
    }
    if (state === "ambiguous") {
      return { outcome: "blocked", reason: "ownership_ambiguous", owner: { ...existing, state: "ambiguous" } };
    }
    if ((existing.recovered_owners?.length ?? 0) >= MAX_RECOVERED_OWNER_EVIDENCE) {
      return { outcome: "blocked", reason: "ownership_ambiguous", owner: ambiguousLease(input) };
    }

    await this.beforeDeadOwnerReclaim?.();
    const reclaimPath = `${this.lockPath}.reclaim`;
    const recoveredOwners = [
      ...deadRecoveryChain(existing),
      { ...existing, recovered_owners: undefined, state: "dead" as const }
    ];
    const recoveredLease = { ...lease, recovered_owners: recoveredOwners };
    let reclaimClaimed = false;
    try {
      const existingGuard = readLease(reclaimPath);
      if (fs.existsSync(reclaimPath)) {
        if (
          existingGuard === undefined ||
          this.processState(existingGuard.owner_pid) !== "dead" ||
          !sameOwner(readLease(reclaimPath), existingGuard)
        ) {
          return { outcome: "blocked", reason: "ownership_ambiguous", owner: ambiguousLease(input) };
        }
        fs.rmSync(reclaimPath);
      }
      writeExclusive(reclaimPath, recoveredLease);
      reclaimClaimed = true;
      const current = readLease(this.lockPath);
      if (!sameOwner(current, existing) || current === undefined || this.processState(current.owner_pid) !== "dead") {
        return { outcome: "blocked", reason: "ownership_ambiguous", owner: ambiguousLease(input) };
      }
      fs.renameSync(reclaimPath, this.lockPath);
      reclaimClaimed = false;
      return {
        outcome: "acquired",
        lease: recoveredLease,
        recovered_owner: recoveredOwners[recoveredOwners.length - 1],
        recovered_owners: recoveredOwners
      };
    } catch (error) {
      if (isFileExistsError(error) || isMissingFileError(error)) {
        return { outcome: "blocked", reason: "ownership_ambiguous", owner: ambiguousLease(input) };
      }
      throw error;
    } finally {
      if (reclaimClaimed) fs.rmSync(reclaimPath, { force: true });
    }
  }

  public async release(input: { lease: RepositoryOwnershipLease & { state: "active" } }): Promise<void> {
    const existing = readLease(this.lockPath);
    if (
      existing?.owner_id === input.lease.owner_id &&
      existing.owner_generation === input.lease.owner_generation
    ) {
      const recoveredOwners = input.lease.recovered_owners ?? [];
      const recovered = recoveredOwners.at(-1);
      if (recovered !== undefined) {
        const restored = {
          ...recovered,
          recovered_owners: recoveredOwners.length > 1
            ? recoveredOwners.slice(0, -1)
            : undefined
        };
        fs.writeFileSync(this.lockPath, `${JSON.stringify(restored)}\n`);
      } else {
        fs.rmSync(this.lockPath, { force: true });
      }
    }
  }

  public async confirmRecovery(input: {
    lease: RepositoryOwnershipLease & { state: "active" };
  }): Promise<void> {
    const existing = readLease(this.lockPath);
    if (!sameOwner(existing, input.lease)) return;
    const confirmed = { ...input.lease, recovered_owners: undefined };
    fs.writeFileSync(this.lockPath, `${JSON.stringify(confirmed)}\n`);
    input.lease.recovered_owners = undefined;
  }

  private recoverMissingCanonicalFromGuard(): "ready" | "blocked" | "not_required" {
    if (fs.existsSync(this.lockPath)) return "not_required";
    const reclaimPath = `${this.lockPath}.reclaim`;
    if (!fs.existsSync(reclaimPath)) return "not_required";
    const guard = readLease(reclaimPath);
    if (
      guard === undefined ||
      this.processState(guard.owner_pid) !== "dead" ||
      !sameOwner(readLease(reclaimPath), guard)
    ) return "blocked";
    try {
      writeExclusive(this.lockPath, { ...guard, state: "dead" });
      fs.rmSync(reclaimPath);
      return "ready";
    } catch (error) {
      if (isFileExistsError(error) || isMissingFileError(error)) return "blocked";
      throw error;
    }
  }
}

export class LazyOwnershipGatedRefreshAuthority implements SnapshotRefreshControllerPort, SnapshotRefreshAdmissionFailurePort {
  private controller: SnapshotRefreshControllerPort | undefined;
  private lease: (RepositoryOwnershipLease & { state: "active" }) | undefined;
  private initialization: Promise<SnapshotRefreshControllerPort | BlockedOwnershipAdmission> | undefined;
  private readonly listeners = new Set<Parameters<SnapshotRefreshControllerPort["onTransition"]>[0]>();
  private unsubscribeController: (() => void) | undefined;
  private closePromise: Promise<void> | undefined;
  private closed = false;

  public constructor(private readonly options: {
    ownership: RepositoryOwnershipPort;
    ownership_request: Parameters<RepositoryOwnershipPort["acquire"]>[0];
    prepare_controller?: (
      admission: Extract<RepositoryOwnershipAdmission, { outcome: "acquired" }>
    ) => Promise<"ready" | "ownership_ambiguous">;
    create_controller: (
      admission: Extract<RepositoryOwnershipAdmission, { outcome: "acquired" }>
    ) => Promise<SnapshotRefreshControllerPort>;
  }) {}

  public async request(input: SnapshotRefreshRequest): Promise<SnapshotRefreshAdmission> {
    if (this.closed) {
      throw new Error("Refresh authority is closed.");
    }
    const controller = this.controller ?? await this.initialize();
    if (!("request" in controller)) {
      const owner = controller.owner;
      return controller.reason === "owner_active"
        ? {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "owner_active",
            message: "Repository refresh owner is active.",
            owner: owner as RepositoryOwnershipLease & { state: "active" }
          }
        : {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "ownership_ambiguous",
            message: "Repository refresh ownership is ambiguous.",
            owner: owner as RepositoryOwnershipLease & { state: "ambiguous" }
          };
    }
    return await controller.request(input);
  }

  public async recordAdmissionFailure(input: Parameters<SnapshotRefreshAdmissionFailurePort["recordAdmissionFailure"]>[0]): Promise<Extract<SnapshotRefreshAdmission, { outcome: "blocked" }>> {
    if (this.closed) throw new Error("Refresh authority is closed.");
    const controller = this.controller ?? await this.initialize();
    if ("reason" in controller) {
      return controller.reason === "owner_active"
        ? {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "owner_active",
            message: "Repository refresh owner is active.",
            owner: controller.owner as RepositoryOwnershipLease & { state: "active" }
          }
        : {
            outcome: "blocked",
            reused: false,
            state: "idle",
            reason: "ownership_ambiguous",
            message: "Repository refresh ownership is ambiguous.",
            owner: controller.owner as RepositoryOwnershipLease & { state: "ambiguous" }
          };
    }
    const recorder = (controller as SnapshotRefreshControllerPort &
      Partial<SnapshotRefreshAdmissionFailurePort>).recordAdmissionFailure;
    if (recorder === undefined) {
      throw new Error("Refresh admission failure authority is unavailable.");
    }
    return await recorder.call(controller, input);
  }

  public async close(): Promise<void> {
    this.closed = true;
    this.closePromise ??= this.closeOwnedAuthority();
    await this.closePromise;
  }

  private async closeOwnedAuthority(): Promise<void> {
    if (this.initialization !== undefined) {
      await this.initialization;
    }
    if (this.controller !== undefined) {
      await waitForControllerShutdownSafety(this.controller);
    }
    this.unsubscribeController?.();
    this.unsubscribeController = undefined;
    if (this.lease !== undefined) {
      await this.options.ownership.release({ lease: this.lease });
      this.lease = undefined;
    }
  }

  public getReceipt() {
    return this.controller?.getReceipt() ?? {
      repo_root: this.options.ownership_request.repo_root,
      controller_generation: this.options.ownership_request.owner_generation,
      execution_state: "idle" as const,
      started_generation: 0,
      requested_generation: 0,
      activity_lease: null,
      worker_invocations: 0,
      worker_termination_state: "not_required" as const
    };
  }

  public onTransition(listener: Parameters<SnapshotRefreshControllerPort["onTransition"]>[0]): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async initialize(): Promise<SnapshotRefreshControllerPort | BlockedOwnershipAdmission> {
    this.initialization ??= this.acquireAndCreate();
    const result = await this.initialization;
    if (!("request" in result)) {
      this.initialization = undefined;
    }
    return result;
  }

  private async acquireAndCreate(): Promise<SnapshotRefreshControllerPort | BlockedOwnershipAdmission> {
    const admission = await this.options.ownership.acquire(this.options.ownership_request);
    if (admission.outcome === "blocked") return admission;
    this.lease = admission.lease;
    try {
      const preparation = await this.options.prepare_controller?.(admission) ?? "ready";
      if (preparation === "ownership_ambiguous") {
        await this.options.ownership.release({ lease: admission.lease });
        this.lease = undefined;
        return {
          outcome: "blocked",
          reason: "ownership_ambiguous",
          owner: { ...admission.lease, state: "ambiguous" }
        };
      }
      this.controller = await this.options.create_controller(admission);
      this.unsubscribeController = this.controller.onTransition((transition) => {
        for (const listener of this.listeners) {
          try { void Promise.resolve(listener(transition)).catch(() => undefined); } catch {}
        }
      });
      return this.controller;
    } catch (error) {
      await this.options.ownership.release({ lease: admission.lease });
      this.lease = undefined;
      throw error;
    }
  }
}

function writeExclusive(lockPath: string, lease: RepositoryOwnershipLease): void {
  const fd = fs.openSync(lockPath, "wx", 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(lease)}\n`);
  } finally {
    fs.closeSync(fd);
  }
}

function readLease(lockPath: string): RepositoryOwnershipLease | undefined {
  try {
    const candidate = JSON.parse(fs.readFileSync(lockPath, "utf8")) as unknown;
    if (typeof candidate !== "object" || candidate === null) return undefined;
    const value = candidate as Partial<RepositoryOwnershipLease>;
    if (
      typeof value.repo_root !== "string" ||
      typeof value.runtime_identity !== "string" ||
      typeof value.schema_version !== "number" ||
      typeof value.owner_id !== "string" ||
      typeof value.owner_pid !== "number" ||
      typeof value.owner_generation !== "number" ||
      typeof value.heartbeat_at !== "string"
    ) return undefined;
    const recoveredOwners = parseRecoveredOwners(value.recovered_owners);
    if (value.recovered_owners !== undefined && recoveredOwners === undefined) return undefined;
    return { ...value, recovered_owners: recoveredOwners, state: "active" } as RepositoryOwnershipLease;
  } catch {
    return undefined;
  }
}

function parseRecoveredOwners(
  value: unknown
): RepositoryOwnershipLease["recovered_owners"] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_RECOVERED_OWNER_EVIDENCE) return undefined;
  const owners: NonNullable<RepositoryOwnershipLease["recovered_owners"]>[number][] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) return undefined;
    const owner = candidate as Record<string, unknown>;
    if (
      typeof owner.repo_root !== "string" ||
      typeof owner.runtime_identity !== "string" ||
      typeof owner.schema_version !== "number" ||
      typeof owner.owner_id !== "string" ||
      typeof owner.owner_pid !== "number" ||
      typeof owner.owner_generation !== "number" ||
      typeof owner.heartbeat_at !== "string" ||
      owner.state !== "dead"
    ) return undefined;
    owners.push(owner as NonNullable<RepositoryOwnershipLease["recovered_owners"]>[number]);
  }
  return owners;
}

function currentProcessState(pid: number): ProcessState {
  try {
    process.kill(pid, 0);
    return "active";
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    return code === "ESRCH" ? "dead" : "ambiguous";
  }
}

export async function waitForControllerShutdownSafety(
  controller: SnapshotRefreshControllerPort
): Promise<void> {
  if (!refreshOwnershipUnsafe(controller)) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe = (): void => undefined;
    const inspect = (): void => {
      if (settled || refreshOwnershipUnsafe(controller)) return;
      settled = true;
      unsubscribe();
      resolve();
    };
    unsubscribe = controller.onTransition(inspect);
    inspect();
  });
}

function refreshOwnershipUnsafe(controller: SnapshotRefreshControllerPort): boolean {
  const receipt = controller.getReceipt();
  return receipt.activity_lease?.state === "held" || receipt.worker_termination_state === "unconfirmed";
}

function sameOwner(
  left: RepositoryOwnershipLease | undefined,
  right: RepositoryOwnershipLease
): boolean {
  return left?.owner_id === right.owner_id &&
    left.owner_generation === right.owner_generation &&
    left.owner_pid === right.owner_pid &&
    left.heartbeat_at === right.heartbeat_at;
}

function ambiguousLease(
  input: Parameters<RepositoryOwnershipPort["acquire"]>[0]
): RepositoryOwnershipLease & { state: "ambiguous" } {
  return { ...input, owner_id: "unknown", owner_pid: 0, state: "ambiguous" };
}

function deadRecoveryChain(
  lease: RepositoryOwnershipLease
): Array<RepositoryOwnershipLease & { state: "dead" }> {
  return (lease.recovered_owners ?? []).map((owner) => ({
    ...owner,
    state: "dead"
  }));
}

function isFileExistsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === "EEXIST";
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
