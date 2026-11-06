#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function verifyReleaseChecksum(zipPath, sidecarPath) {
  const expectedName = path.basename(zipPath);
  const sidecar = fs.readFileSync(sidecarPath, "utf8").replaceAll("\r\n", "\n");
  if (sidecar.includes("\r")) {
    throw new Error("checksum sidecar contains an unsupported carriage return");
  }

  const lines = sidecar.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length !== 1) {
    throw new Error("checksum sidecar must contain exactly one line");
  }

  const match = /^([0-9a-f]{64})[ \t]+(.+)$/.exec(lines[0]);
  if (!match || match[2] !== expectedName) {
    throw new Error("checksum sidecar must contain one SHA-256 digest and the exact ZIP filename");
  }

  const actualDigest = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
  if (match[1] !== actualDigest) {
    throw new Error(`checksum mismatch for ${expectedName}: expected ${match[1]}, actual ${actualDigest}`);
  }

  return { digest: actualDigest, filename: expectedName };
}

function main(argv) {
  if (argv.length !== 2) {
    throw new Error("usage: verify-release-checksum.mjs <zip-path> <sha256-sidecar-path>");
  }
  const result = verifyReleaseChecksum(argv[0], argv[1]);
  process.stdout.write(`verified ${result.digest}  ${result.filename}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`release checksum verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
