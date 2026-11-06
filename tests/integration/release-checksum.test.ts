/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs helper imported into the TS test via esbuild.
import { verifyReleaseChecksum } from "../../scripts/ci/verify-release-checksum.mjs";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("release checksum verification", () => {
  it.each(["\n", "\r\n"])("accepts a single %j-terminated checksum record", (lineEnding) => {
    const { zipPath, sidecarPath, digest } = fixture();
    fs.writeFileSync(sidecarPath, `${digest}  ${path.basename(zipPath)}${lineEnding}`);

    expect(verifyReleaseChecksum(zipPath, sidecarPath)).toEqual({
      digest,
      filename: path.basename(zipPath)
    });
  });

  it.each([
    ["extra record", (digest: string, name: string) => `${digest}  ${name}\r\nextra\r\n`],
    ["wrong filename", (digest: string) => `${digest}  other.zip\r\n`],
    ["wrong digest", (_digest: string, name: string) => `${"0".repeat(64)}  ${name}\r\n`],
    ["lone carriage return", (digest: string, name: string) => `${digest}  ${name}\r`]
  ] as const)("rejects %s", (_label, buildSidecar) => {
    const { zipPath, sidecarPath, digest } = fixture();
    fs.writeFileSync(sidecarPath, buildSidecar(digest, path.basename(zipPath)));

    expect(() => verifyReleaseChecksum(zipPath, sidecarPath)).toThrow();
  });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-release-checksum-"));
  roots.push(root);
  const zipPath = path.join(root, "agent-workbench-v0.6.11-windows-x64.zip");
  const sidecarPath = `${zipPath}.sha256`;
  fs.writeFileSync(zipPath, "immutable Windows portable fixture\n");
  const digest = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
  return { zipPath, sidecarPath, digest };
}
