#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";

import {
  emitAdditionalContext,
  feedbackMode,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";

const KEY_ROOT_CANDIDATES = [
  "src",
  "tests",
  "docs",
  "infra",
  "app",
  "apps",
  "packages",
  "plugins",
  "scripts",
  ".github"
];

const CONFIG_CANDIDATES = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Dockerfile",
  "docker-compose.yml",
  "compose.yml",
  "Makefile"
];

const DOC_CANDIDATES = [
  "AGENTS.md",
  "README.md",
  "docs/README.md",
  "docs/design",
  "docs/requirements",
  "docs/runbooks",
  "docs/specs"
];

function compactList(values, limit = 8) {
  if (values.length <= limit) {
    return values.join(", ");
  }
  return `${values.slice(0, limit).join(", ")} (+${values.length - limit} more)`;
}

function existingPaths(root, candidates) {
  return candidates.filter((candidate) => {
    try {
      return fs.existsSync(path.join(root, candidate));
    } catch {
      return false;
    }
  });
}

function getPayloadCwd(payload) {
  return typeof payload?.cwd === "string" && payload.cwd.trim() ? payload.cwd : process.cwd();
}

function readGitBranch(root) {
  try {
    const head = fs.readFileSync(path.join(root, ".git", "HEAD"), "utf8").trim();
    const match = /^ref: refs\/heads\/(.+)$/.exec(head);
    return match ? match[1] : head.slice(0, 12);
  } catch {
    return undefined;
  }
}

function describeSpecs(root) {
  const specsRoot = path.join(root, "docs", "specs");
  try {
    const entries = fs
      .readdirSync(specsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    if (entries.length === 0) {
      return "docs/specs present; no numbered packages found";
    }
    return `${entries.length} package(s): ${compactList(entries, 5)}`;
  } catch {
    return "not present";
  }
}

export function buildSessionStartContext(payload, env = process.env) {
  if (feedbackMode(env) !== "basic") {
    return undefined;
  }

  const cwd = getPayloadCwd(payload);
  const roots = existingPaths(cwd, KEY_ROOT_CANDIDATES);
  const configs = existingPaths(cwd, CONFIG_CANDIDATES);
  const docs = existingPaths(cwd, DOC_CANDIDATES);
  const branch = readGitBranch(cwd);
  const specSummary = describeSpecs(cwd);

  return [
    "Agent Workbench MCP is available.",
    "Repo orientation:",
    `- root: ${cwd}`,
    `- roots: ${roots.length ? compactList(roots) : "none detected by hook"}`,
    `- config: ${configs.length ? compactList(configs) : "none detected by hook"}`,
    `- docs: ${docs.length ? compactList(docs) : "none detected by hook"}`,
    `- specs: ${specSummary}`,
    `- git: ${branch ? `branch ${branch}` : "not detected"}; dirty state not inspected`,
    "- first calls: repo:///status, repo:///scope, repo:///overview; use context_for_task once task is known; run git status --short before edits.",
    "- if mcp__agent_workbench tools are not visible, call tool_search for: agent-workbench context_for_task verification_plan diagnostics_for_files docs_search."
  ].join("\n");
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildSessionStartContext(payload);
  if (context) {
    emitAdditionalContext("SessionStart", context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
