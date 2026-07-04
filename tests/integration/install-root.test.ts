/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs resolver imported into the TS test via esbuild.
import { resolveInstallRoot } from "../../plugins/agent-workbench/install-root.mjs";

describe("resolveInstallRoot (spec 033, P3 default-root parity)", () => {
  describe("AGENT_WORKBENCH_INSTALL_ROOT override", () => {
    it("is honored on POSIX", () => {
      const env = { HOME: "/home/u", AGENT_WORKBENCH_INSTALL_ROOT: "/opt/aw" };
      expect(resolveInstallRoot(env, "linux")).toBe("/opt/aw");
    });

    it("is honored on Windows", () => {
      const env = { USERPROFILE: "C:\\Users\\u", AGENT_WORKBENCH_INSTALL_ROOT: "D:\\aw" };
      expect(resolveInstallRoot(env, "win32")).toBe("D:\\aw");
    });

    it("takes precedence over the per-OS default", () => {
      const env = {
        HOME: "/home/u",
        LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local",
        AGENT_WORKBENCH_INSTALL_ROOT: "/custom/root"
      };
      expect(resolveInstallRoot(env, "win32")).toBe("/custom/root");
      expect(resolveInstallRoot(env, "linux")).toBe("/custom/root");
    });
  });

  describe("POSIX default", () => {
    it("resolves under $HOME/.local/share", () => {
      const env = { HOME: "/home/u" };
      expect(resolveInstallRoot(env, "linux")).toBe("/home/u/.local/share/agent-workbench");
    });

    it("uses the same default on darwin", () => {
      const env = { HOME: "/Users/u" };
      expect(resolveInstallRoot(env, "darwin")).toBe("/Users/u/.local/share/agent-workbench");
    });
  });

  describe("Windows default (Decision 3)", () => {
    it("uses %LOCALAPPDATA% when set", () => {
      const env = { USERPROFILE: "C:\\Users\\u", LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" };
      expect(resolveInstallRoot(env, "win32")).toBe("C:\\Users\\u\\AppData\\Local\\agent-workbench");
    });

    it("falls back to <home>\\AppData\\Local when LOCALAPPDATA is unset", () => {
      const env = { USERPROFILE: "C:\\Users\\u" };
      expect(resolveInstallRoot(env, "win32")).toBe("C:\\Users\\u\\AppData\\Local\\agent-workbench");
    });
  });

  describe("cross-host parity", () => {
    it("computes a win32 root with backslashes even when run on a POSIX host", () => {
      const env = { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" };
      const root = resolveInstallRoot(env, "win32");
      expect(root).toBe("C:\\Users\\u\\AppData\\Local\\agent-workbench");
      expect(root).not.toContain("/");
    });

    it("computes a POSIX root with forward slashes regardless of host", () => {
      const env = { HOME: "/home/u" };
      const root = resolveInstallRoot(env, "linux");
      expect(root).toBe("/home/u/.local/share/agent-workbench");
      expect(root).not.toContain("\\");
    });
  });
});
