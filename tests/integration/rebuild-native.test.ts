/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error -- Focused test imports the runnable script module directly.
import { buildRebuildEnv, resolveOnPath } from "../../scripts/rebuild-native.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("rebuild-native", () => {
  it("uses _CL_ on Windows without replacing existing compiler flags", () => {
    const env = buildRebuildEnv({
      CL: "/std:c++17 /W3",
      _CL_: "/Zc:__cplusplus"
    }, "win32");

    expect(env.CL).toBe("/std:c++17 /W3");
    expect(env._CL_).toBe("/Zc:__cplusplus /std:c++20");
  });

  it("appends the C++20 flag to CXXFLAGS on POSIX toolchains", () => {
    const env = buildRebuildEnv({
      CXXFLAGS: "-O2"
    }, "linux");

    expect(env.CXXFLAGS).toBe("-O2 -std=c++20");
  });

  it("resolves pnpm.cmd through PATHEXT on Windows without a shell", () => {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-rebuild-native-"));
    tempDirs.push(binDir);
    const pnpmCmd = path.join(binDir, "pnpm.CMD");
    fs.writeFileSync(pnpmCmd, "@echo off\r\n", "utf8");

    const resolved = resolveOnPath("pnpm", {
      PATH: binDir,
      PATHEXT: ".EXE;.CMD"
    }, "win32");

    expect(resolved).toBe(pnpmCmd);
  });
});
