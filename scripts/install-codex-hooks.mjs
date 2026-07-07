#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const parsed = {
    codexHome: path.join(os.homedir(), ".codex"),
    packageRoot: "",
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--codex-home") {
      parsed.codexHome = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--package-root") {
      parsed.packageRoot = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!parsed.packageRoot) {
    throw new Error("--package-root is required");
  }
  return parsed;
}

function readHooksConfig(hooksPath) {
  if (!fs.existsSync(hooksPath)) {
    return { hooks: {} };
  }
  const parsed = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    return { hooks: {} };
  }
  const hooks = typeof parsed.hooks === "object" && parsed.hooks !== null ? parsed.hooks : {};
  return { ...parsed, hooks };
}

function isAgentWorkbenchCommand(hook) {
  if (typeof hook !== "object" || hook === null) {
    return false;
  }
  const command = typeof hook.command === "string" ? hook.command : "";
  const args = Array.isArray(hook.args) ? hook.args.filter((arg) => typeof arg === "string") : [];
  const haystack = [command, ...args].join("\n");
  return (
    haystack.includes("agent-workbench") ||
    haystack.includes("hooks/session-start.js") ||
    haystack.includes("hooks/post-edit-feedback.js")
  );
}

function withoutAgentWorkbenchHooks(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups
    .map((group) => {
      if (typeof group !== "object" || group === null) {
        return group;
      }
      const hooks = Array.isArray(group.hooks)
        ? group.hooks.filter((hook) => !isAgentWorkbenchCommand(hook))
        : group.hooks;
      return { ...group, hooks };
    })
    .filter((group) => !Array.isArray(group?.hooks) || group.hooks.length > 0);
}

function shellQuote(value) {
  if (value.length === 0) {
    return "''";
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function hookCommand(packageRoot, scriptName) {
  const scriptPath = path.join(packageRoot, "plugins", "agent-workbench", "hooks", scriptName);
  return `${shellQuote(process.execPath)} ${shellQuote(scriptPath)}`;
}

function installHooks(config, packageRoot) {
  const hooks = { ...config.hooks };
  hooks.SessionStart = withoutAgentWorkbenchHooks(hooks.SessionStart);
  hooks.PostToolUse = withoutAgentWorkbenchHooks(hooks.PostToolUse);

  hooks.SessionStart.push({
    matcher: "startup",
    hooks: [
      {
        type: "command",
        command: hookCommand(packageRoot, "session-start.js"),
        timeout: 10,
        statusMessage: "Loading Agent Workbench context"
      }
    ]
  });
  hooks.PostToolUse.push({
    matcher: "^(apply_patch|Edit|Write|write_file|create_file|rename_file)$",
    hooks: [
      {
        type: "command",
        command: hookCommand(packageRoot, "post-edit-feedback.js"),
        timeout: 10,
        statusMessage: "Checking Agent Workbench edit feedback"
      }
    ]
  });

  return { ...config, hooks };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const hooksPath = path.join(args.codexHome, "hooks.json");
  const current = readHooksConfig(hooksPath);
  const next = installHooks(current, path.resolve(args.packageRoot));
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (args.dryRun) {
    process.stdout.write(`dry-run: merge Agent Workbench hooks into ${hooksPath}\n`);
    process.stdout.write(serialized);
    return;
  }
  fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
  fs.writeFileSync(hooksPath, serialized, "utf8");
  process.stdout.write(`Merged Agent Workbench hooks into ${hooksPath}\n`);
}

main();
