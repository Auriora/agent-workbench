/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import type { StartupGuardOwnerScope } from "../../contracts/startup-guard-recovery-contracts.js";

const LINUX_BOOT_ID_PATH = "/proc/sys/kernel/random/boot_id";
const LINUX_PID_NAMESPACE_PATH = "/proc/self/ns/pid";

export function currentStartupGuardOwnerScope(): StartupGuardOwnerScope | undefined {
  if (process.platform !== "linux") return undefined;
  try {
    const bootId = fs.readFileSync(LINUX_BOOT_ID_PATH, "utf8").trim();
    const namespace = fs.readlinkSync(LINUX_PID_NAMESPACE_PATH);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(bootId)) {
      return undefined;
    }
    if (!/^pid:\[[0-9]+\]$/u.test(namespace)) return undefined;
    return {
      kind: "linux-pid-namespace-v1",
      fingerprint: crypto.createHash("sha256")
        .update(`${bootId}\0${namespace}`, "utf8")
        .digest("hex")
    };
  } catch {
    return undefined;
  }
}
