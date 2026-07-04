/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
let tempRoot: string;

function writeSkill(name: string, body: string): string {
  const skillRoot = path.join(tempRoot, name);
  fs.mkdirSync(skillRoot, { recursive: true });
  fs.writeFileSync(path.join(skillRoot, "SKILL.md"), body);
  return skillRoot;
}

function runValidator(skillRoot: string): string {
  return execFileSync("node", ["scripts/validate-agent-skills.mjs", "--owned-root", skillRoot], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

describe("Agent Skills validation script", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-skills-validation-"));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("passes a valid owned skill", () => {
    const skillRoot = writeSkill(
      "agent-workbench",
      `---
name: agent-workbench
description: Use Agent Workbench for repository status and task context.
---

# Agent Workbench

Use this skill for local repository work.
`
    );

    expect(runValidator(skillRoot)).toContain("0 error(s), 0 warning(s)");
  });

  it("reports actionable failures for invalid owned skills", () => {
    const skillRoot = writeSkill(
      "agent-workbench",
      `---
name: Agent_Workbench
description: ""
---

# Bad Skill

[shared](../shared.md)
`
    );

    expect(() => runValidator(skillRoot)).toThrow(/frontmatter\.name|frontmatter\.description|portable-reference/);
  });
});
