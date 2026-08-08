#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { materializeCodexMcpConfig } from "../plugins/agent-workbench/codex-mcp-config.mjs";
import { runtimePointerPath, writeRuntimeRoot } from "../plugins/agent-workbench/install-root.mjs";

const scriptPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function defaultCodexHome(env = process.env) {
  return path.resolve(env.CODEX_HOME || path.join(os.homedir(), ".codex"));
}

export function configurePortableBundle({
  bundleRoot,
  env = process.env,
  codexHome,
  platform = process.platform
}) {
  const layout = resolvePortableLayout(bundleRoot);
  const resolvedCodexHome = path.resolve(codexHome ?? defaultCodexHome(env));
  const targets = mutableArtifactPaths(layout.packageRoot, resolvedCodexHome, env, platform);

  withRollback(targets, () => {
    writeRuntimeRoot(layout.packageRoot, env, platform);
    materializeCodexMcpConfig(layout.packageRoot, { nodeCommand: layout.bundledNodePath });
    materializeClaudePortableConfig(layout.packageRoot, layout.bundledNodePath);
    installCodexHooksWithBundledNode(
      layout.packageRoot,
      layout.bundledNodePath,
      resolvedCodexHome,
      env
    );
  });

  return {
    bundleRoot: layout.bundleRoot,
    bundledNodePath: layout.bundledNodePath,
    packageRoot: layout.packageRoot,
    codexHome: resolvedCodexHome
  };
}

function resolvePortableLayout(bundleRoot) {
  const resolvedBundleRoot = path.resolve(bundleRoot);
  assertDirectory(resolvedBundleRoot, "bundle root");

  const bundleRealRoot = fs.realpathSync(resolvedBundleRoot);
  const bundledNodePath = path.join(resolvedBundleRoot, "node.exe");
  const packageRoot = path.join(
    resolvedBundleRoot,
    "runtime",
    "node_modules",
    "@auriora",
    "agent-workbench"
  );

  assertFile(bundledNodePath, "bundled Node executable");
  assertDirectory(packageRoot, "portable package root");
  assertContainedPath(bundleRealRoot, bundledNodePath, "bundled Node executable");
  assertContainedPath(bundleRealRoot, packageRoot, "portable package root");

  const requiredFiles = [
    path.join(packageRoot, "package.json"),
    path.join(packageRoot, "scripts", "install-codex-hooks.mjs"),
    path.join(packageRoot, "plugins", "agent-workbench", "mcp-launch.mjs"),
    path.join(packageRoot, "plugins", "agent-workbench", "install-root.mjs"),
    path.join(packageRoot, "plugins", "agent-workbench", "hooks", "session-start.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "hooks", "session-start.core.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "hooks", "hook-common.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "hooks", "post-edit-feedback.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "mcp-launch.mjs"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "install-root.mjs"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "session-start.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "session-start.core.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "hook-common.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "post-edit-feedback.js"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "post-edit-feedback.core.js")
  ];
  for (const requiredFile of requiredFiles) {
    assertFile(requiredFile, `required portable artifact ${path.relative(resolvedBundleRoot, requiredFile)}`);
    assertContainedPath(bundleRealRoot, requiredFile, `required portable artifact ${path.relative(resolvedBundleRoot, requiredFile)}`);
  }

  return {
    bundleRoot: resolvedBundleRoot,
    bundledNodePath,
    packageRoot
  };
}

function materializeClaudePortableConfig(packageRoot, bundledNodePath) {
  const pluginRoot = path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin");
  const configPath = path.join(pluginRoot, ".mcp.json");
  const hooksPath = path.join(pluginRoot, "hooks", "hooks.json");
  const version = packageVersion(packageRoot);
  const config = {
    mcpServers: {
      "agent-workbench": {
        command: bundledNodePath,
        args: [path.join(pluginRoot, "mcp-launch.mjs")],
        env: {
          AGENT_WORKBENCH_PROVIDER: "claude_code",
          AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
          AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: version
        }
      }
    }
  };
  const hooks = {
    hooks: {
      SessionStart: [
        {
          matcher: "startup",
          hooks: [
            {
              type: "command",
              command: bundledNodePath,
              args: [path.join(pluginRoot, "hooks", "session-start.js")],
              timeout: 10
            }
          ]
        }
      ],
      PostToolUse: [
        {
          matcher: "Write|Edit|MultiEdit|NotebookEdit",
          hooks: [
            {
              type: "command",
              command: bundledNodePath,
              args: [path.join(pluginRoot, "hooks", "post-edit-feedback.js")],
              timeout: 10
            }
          ]
        }
      ]
    }
  };

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  fs.writeFileSync(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`, "utf8");
}

function installCodexHooksWithBundledNode(packageRoot, bundledNodePath, codexHome, env) {
  const installerPath = path.join(packageRoot, "scripts", "install-codex-hooks.mjs");
  execFileSync(
    bundledNodePath,
    [installerPath, "--package-root", packageRoot, "--codex-home", path.resolve(codexHome)],
    {
      encoding: "utf8",
      env: { ...env },
      stdio: "pipe"
    }
  );
}

function mutableArtifactPaths(packageRoot, codexHome, env, platform) {
  return [
    runtimePointerPath(env, platform),
    path.join(packageRoot, "plugins", "agent-workbench", ".mcp.json"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", ".mcp.json"),
    path.join(packageRoot, "plugins", "agent-workbench", "claude-plugin", "hooks", "hooks.json"),
    path.join(path.resolve(codexHome), "hooks.json")
  ];
}

function withRollback(targets, work) {
  const snapshots = targets.map(snapshotFile);
  try {
    work();
  } catch (error) {
    for (const snapshot of snapshots) {
      restoreSnapshot(snapshot);
    }
    throw error;
  }
}

function snapshotFile(target) {
  if (!fs.existsSync(target)) {
    return { target, exists: false };
  }
  return {
    target,
    exists: true,
    content: fs.readFileSync(target)
  };
}

function restoreSnapshot(snapshot) {
  if (!snapshot.exists) {
    if (fs.existsSync(snapshot.target)) {
      fs.unlinkSync(snapshot.target);
    }
    return;
  }
  fs.mkdirSync(path.dirname(snapshot.target), { recursive: true });
  fs.writeFileSync(snapshot.target, snapshot.content);
}

function packageVersion(packageRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
    throw new Error("Portable package version is missing from package.json.");
  }
  return manifest.version;
}

function assertContainedPath(parent, target, label) {
  const parentRealPath = fs.realpathSync(parent);
  const targetRealPath = fs.realpathSync(target);
  const relative = path.relative(parentRealPath, targetRealPath);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} escapes the portable bundle root: ${target}`);
}

function assertDirectory(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`${label} is missing: ${target}`);
  }
}

function assertFile(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`${label} is missing: ${target}`);
  }
}

function parseArgs(argv) {
  let bundleRoot = path.resolve(scriptPackageRoot, "..", "..", "..", "..");
  let codexHome = defaultCodexHome(process.env);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--bundle-root") {
      bundleRoot = path.resolve(requireValue(argv, ++index, argument));
      continue;
    }
    if (argument === "--codex-home") {
      codexHome = path.resolve(requireValue(argv, ++index, argument));
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(
        "Usage: node scripts/configure-portable.mjs [--bundle-root <path>] [--codex-home <path>]\n"
      );
      process.exit(0);
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  return { bundleRoot, codexHome };
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value) {
    throw new Error(`${option} requires a path`);
  }
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = configurePortableBundle(parseArgs(process.argv.slice(2)));
    process.stdout.write(`Configured portable Agent Workbench bundle at ${result.bundleRoot}\n`);
  } catch (error) {
    process.stderr.write(`configure-portable: ${error.message}\n`);
    process.exitCode = 1;
  }
}
