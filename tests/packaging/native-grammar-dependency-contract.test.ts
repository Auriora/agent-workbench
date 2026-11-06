/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const root = "packaging/agent-workbench/native-grammars";
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

describe("native grammar consumer dependency identity", () => {
  it("pins one immutable project commit and lock integrity for both sealed grammars", () => {
    const lock = YAML.parse(fs.readFileSync("pnpm-lock.yaml", "utf8"));
    const commits = new Set<string>();
    for (const [name, artifact] of Object.entries(manifest.artifacts) as Array<[string, { archive: string }]>) {
      const url = new URL(packageJson.dependencies[name]);
      const match = url.pathname.match(/^\/Auriora\/agent-workbench\/([a-f0-9]{40})\/packaging\/agent-workbench\/native-grammars\/([^/]+)$/);
      expect(match, name).not.toBeNull();
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("raw.githubusercontent.com");
      expect(url.username + url.password + url.search + url.hash).toBe("");
      expect(match![2]).toBe(artifact.archive);
      commits.add(match![1]);
      const bytes = fs.readFileSync(path.join(root, artifact.archive));
      const integrity = "sha512-" + crypto.createHash("sha512").update(bytes).digest("base64");
      const entries = Object.values(lock.packages) as Array<{ resolution?: { tarball?: string; integrity?: string } }>;
      const pinned = entries.filter((entry) => entry.resolution?.tarball === url.href);
      expect(pinned, name).toHaveLength(1);
      expect(pinned[0].resolution?.integrity).toBe(integrity);
      expect(lock.importers["."].dependencies[name].specifier).toBe(url.href);
    }
    expect(commits.size).toBe(1);
  });
});
