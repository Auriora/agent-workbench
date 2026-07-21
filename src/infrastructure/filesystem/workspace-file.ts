/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import type { WorkspaceFilePort } from "../../ports/index.js";
import type { PathDecision } from "./workspace-safety.js";
import { WorkspaceSafetyAdapter, type WorkspaceSafetyPolicy } from "./workspace-safety.js";

function normalizeDecisionError(message: string): Error {
  return new Error(message);
}

function assertAllowedDecision(decision: PathDecision): asserts decision is Extract<PathDecision, { allowed: true }> {
  if (!decision.allowed) {
    throw normalizeDecisionError(decision.message);
  }
}

export class WorkspaceFileAdapter implements WorkspaceFilePort {
  private readonly safety: WorkspaceSafetyAdapter;
  private readonly allowGeneratedWrites: boolean;

  constructor(policy: WorkspaceSafetyPolicy) {
    this.safety = new WorkspaceSafetyAdapter(policy);
    this.allowGeneratedWrites = policy.allowGeneratedWrites ?? false;
  }

  public async readText(input: { path: string }): Promise<string> {
    const decision = this.safety.resolveWorkspacePath(input.path);
    assertAllowedDecision(decision);
    return fs.promises.readFile(decision.absolutePath, "utf8");
  }

  public async readTextPrefix(input: { path: string; max_bytes: number }): Promise<string> {
    if (!Number.isSafeInteger(input.max_bytes) || input.max_bytes <= 0) {
      throw new Error("Bounded text reads require a positive safe-integer max_bytes value.");
    }
    const decision = this.safety.resolveWorkspacePath(input.path);
    assertAllowedDecision(decision);
    const handle = await fs.promises.open(decision.absolutePath, "r");
    try {
      const buffer = Buffer.alloc(input.max_bytes);
      const { bytesRead } = await handle.read(buffer, 0, input.max_bytes, 0);
      return utf8Prefix(buffer.subarray(0, bytesRead).toString("utf8"), input.max_bytes);
    } finally {
      await handle.close();
    }
  }

  public async readBinary(input: { path: string }): Promise<Uint8Array> {
    const decision = this.safety.resolveWorkspacePath(input.path);
    assertAllowedDecision(decision);
    return new Uint8Array(await fs.promises.readFile(decision.absolutePath));
  }

  public async writeText(input: { path: string; content: string; overwrite?: boolean }): Promise<void> {
    await this.assertWritable(input.path);
    const decision = this.safety.resolveWorkspacePath(input.path, { write: true });
    assertAllowedDecision(decision);
    const flag = input.overwrite === false ? "wx" : "w";
    const mode = "utf8";

    await fs.promises.writeFile(decision.absolutePath, input.content, { flag, encoding: mode });
  }

  public async writeBinary(input: { path: string; content: Uint8Array; overwrite?: boolean }): Promise<void> {
    await this.assertWritable(input.path);
    const decision = this.safety.resolveWorkspacePath(input.path, { write: true });
    assertAllowedDecision(decision);
    const flag = input.overwrite === false ? "wx" : "w";

    await fs.promises.writeFile(decision.absolutePath, Buffer.from(input.content), { flag });
  }

  public async stat(input: { path: string }): Promise<{
    exists: boolean;
    is_file: boolean;
    size_bytes: number;
    mtime_ms: number;
  }> {
    const decision = this.safety.resolveWorkspacePath(input.path);
    assertAllowedDecision(decision);

    try {
      const stat = await fs.promises.stat(decision.absolutePath);
      return {
        exists: true,
        is_file: stat.isFile(),
        size_bytes: stat.size,
        mtime_ms: stat.mtimeMs
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          exists: false,
          is_file: false,
          size_bytes: 0,
          mtime_ms: 0
        };
      }

      throw error;
    }
  }

  public async deletePath(input: { path: string }): Promise<void> {
    await this.assertWritable(input.path);
    const decision = this.safety.resolveWorkspacePath(input.path, { write: true });
    assertAllowedDecision(decision);
    await fs.promises.rm(decision.absolutePath, { recursive: true, force: true });
  }

  public async ensureDirectory(input: { path: string }): Promise<void> {
    const decision = this.safety.resolveWorkspacePath(input.path, { write: true });
    assertAllowedDecision(decision);
    if (decision.readOnly && !this.allowGeneratedWrites) {
      throw normalizeDecisionError("Generated or vendor paths are read-only by default.");
    }
    await fs.promises.mkdir(decision.absolutePath, { recursive: true });
  }

  private async assertWritable(requestedPath: string): Promise<void> {
    const decision = this.safety.resolveWorkspacePath(requestedPath, { write: true });
    assertAllowedDecision(decision);
    if (decision.readOnly && !this.allowGeneratedWrites) {
      throw normalizeDecisionError("Generated or vendor paths are read-only by default.");
    }
  }
}

function utf8Prefix(value: string, maxBytes: number): string {
  let bytes = 0;
  let end = 0;
  while (end < value.length) {
    const codePoint = value.codePointAt(end);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    bytes += characterBytes;
    end += character.length;
  }
  return value.slice(0, end);
}
