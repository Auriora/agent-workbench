#!/usr/bin/env node
// Cross-platform Agent Workbench installer (spec 033). Pure Node port of
// scripts/install-agent-workbench-package.sh — copies the runtime into the
// install root, generates the shell-free host launcher, rebuilds native modules,
// and registers the Codex plugin, using only node:fs/path/os/child_process so it
// runs on Windows, macOS, and Linux without a POSIX shell.
//
// External tools (pnpm, corepack, codex) are resolved to a full PATH×PATHEXT
// path and spawned directly, because Windows CreateProcess does not consult
// PATHEXT for bare names — a bare `pnpm` would not find `pnpm.cmd`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveInstallRoot } from "../../plugins/agent-workbench/install-root.mjs";

export const REQUIRED_PATHS = [
  "src",
  "docs",
  "plugins/agent-workbench/.codex-plugin/plugin.json",
  "plugins/agent-workbench/.claude-plugin/marketplace.json",
  "plugins/agent-workbench/.mcp.json",
  "plugins/agent-workbench/mcp-launch.mjs",
  "plugins/agent-workbench/install-root.mjs",
  "plugins/agent-workbench/claude-plugin/.claude-plugin/plugin.json",
  "plugins/agent-workbench/claude-plugin/.mcp.json",
  "plugins/agent-workbench/claude-plugin/mcp-launch.mjs",
  "plugins/agent-workbench/claude-plugin/install-root.mjs",
  "plugins/agent-workbench/claude-plugin/hooks/hooks.json",
  "plugins/agent-workbench/claude-plugin/hooks/session-start.js",
  "plugins/agent-workbench/claude-plugin/hooks/post-edit-feedback.js",
  "plugins/agent-workbench/claude-plugin/hooks/hook-common.js",
  "plugins/agent-workbench/claude-plugin/hooks/session-start.core.js",
  "plugins/agent-workbench/claude-plugin/hooks/post-edit-feedback.core.js",
  "plugins/agent-workbench/claude-plugin/skills/agent-workbench/SKILL.md",
  "plugins/agent-workbench/hooks/hooks.json",
  "plugins/agent-workbench/hooks/session-start.js",
  "plugins/agent-workbench/hooks/post-edit-feedback.js",
  "plugins/agent-workbench/kiro-power/POWER.md",
  "plugins/agent-workbench/kiro-power/mcp.json",
  "plugins/agent-workbench/kiro-power/hooks/session-start.js",
  "plugins/agent-workbench/kiro-power/hooks/post-edit-feedback.js",
  "plugins/agent-workbench/kiro-power/skills/agent-workbench/SKILL.md",
  "plugins/agent-workbench/skills/agent-workbench/SKILL.md",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json"
];

export const COPY_COMPONENTS = [
  "src",
  "docs",
  "plugins",
  "packaging",
  "scripts",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "AGENTS.md"
];

class InstallError extends Error {}

export function parseArgs(argv) {
  const options = {
    source: undefined,
    prefix: undefined,
    codexHome: undefined,
    writeCodexConfig: true,
    dryRun: false,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--source": options.source = argv[++i]; break;
      case "--prefix": options.prefix = argv[++i]; break;
      case "--codex-home": options.codexHome = argv[++i]; break;
      case "--skip-codex-config": options.writeCodexConfig = false; break;
      case "--dry-run": options.dryRun = true; break;
      case "-h":
      case "--help": options.help = true; break;
      default:
        throw new InstallError(`Unknown option: ${arg}`);
    }
  }
  return options;
}

export const USAGE = `Usage: installer.mjs [options]

Options:
  --source <path>       Package source root. Defaults to the checkout root.
  --prefix <path>       Install prefix. Defaults to the per-OS app-data location.
  --codex-home <path>   Codex home. Defaults to $CODEX_HOME or ~/.codex.
  --skip-codex-config   Copy files and launcher without installing the Codex plugin.
  --dry-run             Print planned actions without writing files.
  -h, --help            Show this help.
`;

// Resolve a command to a full path across PATH and (on Windows) PATHEXT, so
// .cmd/.bat shims like pnpm.cmd are found and spawnable without a shell.
export function resolveOnPath(command, env = process.env) {
  if (command.includes(path.sep) || (path.win32.isAbsolute(command) && process.platform === "win32")) {
    return fs.existsSync(command) ? command : null;
  }
  const exts = process.platform === "win32"
    ? (env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").map((e) => e.trim()).filter(Boolean)
    : [""];
  for (const dir of (env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function makeLogger(dryRun) {
  const actions = [];
  return {
    actions,
    plan(message) { actions.push(message); if (dryRun) process.stdout.write(`dry-run: ${message}\n`); },
    info(message) { process.stdout.write(`${message}\n`); }
  };
}

function ensureRuntimePrerequisites() {
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isNaN(major) || major < 22) {
    throw new InstallError(`Node.js 22 or newer is required; found ${process.version}.`);
  }
}

function copyComponent(sourceRoot, installRoot, relativePath, ctx) {
  const from = path.join(sourceRoot, relativePath);
  const to = path.join(installRoot, relativePath);
  ctx.log.plan(`copy ${relativePath} -> ${to}`);
  if (ctx.dryRun) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.rmSync(to, { recursive: true, force: true });
  // verbatimSymlinks mirrors `cp -a`: preserve the pnpm symlink farm as-is.
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true });
}

function sanitizeDeployedRuntime(installRoot, ctx) {
  ctx.log.plan(`remove checkout-only ${path.join(installRoot, "src", "debug")}`);
  ctx.log.plan(`remove active specs ${path.join(installRoot, "docs", "specs")}`);
  ctx.log.plan(`strip debug:* scripts from ${path.join(installRoot, "package.json")}`);
  if (ctx.dryRun) return;
  fs.rmSync(path.join(installRoot, "src", "debug"), { recursive: true, force: true });
  fs.rmSync(path.join(installRoot, "docs", "specs"), { recursive: true, force: true });
  const packageJsonPath = path.join(installRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  for (const name of Object.keys(packageJson.scripts ?? {})) {
    if (name.startsWith("debug:")) delete packageJson.scripts[name];
  }
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

const LAUNCHER_SOURCE = `#!/usr/bin/env node
// Generated by the Agent Workbench installer (spec 033). Shell-free host
// launcher; resolves its own install root from this file's location so it works
// on Windows without a POSIX-shell shebang or executable bit.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
if (!env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT) {
  env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT = process.cwd();
}
const entry = path.join(root, "src", "mcp", "stdio.ts");
const child = spawn(process.execPath, ["--import", "tsx", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: root,
  env
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (err) => {
  process.stderr.write(\`agent-workbench: failed to launch MCP server: \${err.message}\\n\`);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
`;

function generateLauncher(installRoot, ctx) {
  const launcherPath = path.join(installRoot, "bin", "agent-workbench-mcp.mjs");
  ctx.log.plan(`write ${launcherPath}`);
  if (ctx.dryRun) return launcherPath;
  fs.mkdirSync(path.join(installRoot, "bin"), { recursive: true });
  fs.writeFileSync(launcherPath, LAUNCHER_SOURCE);
  return launcherPath;
}

function spawnTool(command, args, options, ctx, { hint } = {}) {
  const resolved = resolveOnPath(command);
  if (!resolved) {
    throw new InstallError(`Missing required dependency: ${command}.${hint ? ` ${hint}` : ""}`);
  }
  ctx.log.plan(`run ${command} ${args.join(" ")}`);
  if (ctx.dryRun) return;
  const result = spawnSync(resolved, args, { stdio: "inherit", ...options });
  if (result.error) throw new InstallError(`Failed to run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new InstallError(`${command} ${args.join(" ")} exited with status ${result.status}.`);
}

function ensurePnpm(ctx) {
  if (resolveOnPath("pnpm")) return;
  if (resolveOnPath("corepack")) {
    spawnTool("corepack", ["enable", "pnpm"], {}, ctx);
  }
  if (!ctx.dryRun && !resolveOnPath("pnpm")) {
    throw new InstallError(
      "pnpm 10.18.1 is required to install Agent Workbench dependencies. Install pnpm or enable it with corepack."
    );
  }
}

function ensureNativeBuildPrerequisites(ctx) {
  // node-gyp needs Python on every platform.
  if (!resolveOnPath("python3") && !resolveOnPath("python")) {
    throw new InstallError("Missing required dependency: python3. Install Python 3 for native Node module builds.");
  }
  if (process.platform === "win32") {
    // Windows uses MSVC, not make/g++. The actionable MSVC message is emitted by
    // the fail-loud handling around the rebuild (T005b) if node-gyp fails.
    return;
  }
  if (!resolveOnPath("make")) {
    throw new InstallError("Missing required dependency: make. Install make for native Node module builds.");
  }
  if (!resolveOnPath("c++") && !resolveOnPath("g++")) {
    throw new InstallError(
      "Missing required dependency: c++ compiler. Install g++ or another C++20-capable compiler for native Node module builds."
    );
  }
}

function rebuildNativeModulesIfNeeded(sourceRoot, installRoot, ctx) {
  const tsxInSource = fs.existsSync(path.join(sourceRoot, "node_modules", "tsx"));
  const tsxInInstall = fs.existsSync(path.join(installRoot, "node_modules", "tsx"));
  if (tsxInSource || tsxInInstall) return;
  ensurePnpm(ctx);
  ensureNativeBuildPrerequisites(ctx);
  spawnTool("pnpm", ["install", "--frozen-lockfile"], { cwd: installRoot }, ctx);
  spawnTool("pnpm", ["rebuild:native"], { cwd: installRoot }, ctx);
}

function removeLegacyCodexMcpBlock(codexHome, ctx) {
  const configPath = path.join(codexHome, "config.toml");
  ctx.log.plan(`remove legacy Agent Workbench MCP block from ${configPath}`);
  if (ctx.dryRun) return;
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(configPath, "");
    return;
  }
  const original = fs.readFileSync(configPath, "utf8");
  if (!original.includes("BEGIN Agent Workbench package install")) return;
  const lines = original.split("\n");
  const kept = [];
  let skipping = false;
  for (const line of lines) {
    if (line.includes("# BEGIN Agent Workbench package install")) { skipping = true; continue; }
    if (line.includes("# END Agent Workbench package install")) { skipping = false; continue; }
    if (!skipping) kept.push(line);
  }
  fs.writeFileSync(configPath, kept.join("\n"));
}

function installCodexPlugin(installRoot, ctx) {
  const marketplacePath = path.join(os.homedir(), ".agents", "plugins", "marketplace.json");
  const pluginRoot = path.join(os.homedir(), "plugins", "agent-workbench");
  ctx.log.plan(`copy ${path.join(installRoot, "plugins", "agent-workbench")} -> ${pluginRoot}`);
  ctx.log.plan(`ensure Agent Workbench marketplace entry in ${marketplacePath}`);
  ctx.log.plan(`cachebust plugin version in ${path.join(pluginRoot, ".codex-plugin", "plugin.json")}`);
  ctx.log.plan("codex plugin add agent-workbench@<personal-marketplace>");
  if (ctx.dryRun) return;

  fs.rmSync(pluginRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(pluginRoot), { recursive: true });
  fs.cpSync(path.join(installRoot, "plugins", "agent-workbench"), pluginRoot, {
    recursive: true,
    verbatimSymlinks: true,
    preserveTimestamps: true
  });

  let marketplace = { name: "personal", interface: { displayName: "Personal" }, plugins: [] };
  if (fs.existsSync(marketplacePath)) {
    marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
  }
  if (!Array.isArray(marketplace.plugins)) marketplace.plugins = [];
  if (!marketplace.interface || typeof marketplace.interface !== "object") {
    marketplace.interface = { displayName: marketplace.name ?? "Personal" };
  }
  const entry = {
    name: "agent-workbench",
    source: { source: "local", path: "./plugins/agent-workbench" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Developer Tools"
  };
  const existingIndex = marketplace.plugins.findIndex((plugin) => plugin.name === entry.name);
  if (existingIndex === -1) marketplace.plugins.push(entry);
  else marketplace.plugins[existingIndex] = entry;
  fs.mkdirSync(path.dirname(marketplacePath), { recursive: true });
  fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);

  const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const baseVersion = String(manifest.version ?? "0.1.0").split("+")[0];
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  manifest.version = `${baseVersion}+codex.${stamp}`;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const codexPath = resolveOnPath("codex");
  if (!codexPath) {
    // Preserve the .sh's graceful behavior: do not fail the whole install.
    ctx.log.info(`Codex CLI not found; plugin source installed at ${pluginRoot} but not added.`);
    return;
  }
  const result = spawnSync(codexPath, ["plugin", "add", `agent-workbench@${marketplace.name}`], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    ctx.log.info(`Codex plugin registration did not complete; plugin source is at ${pluginRoot}.`);
  }
}

export function install(rawOptions = {}) {
  const dryRun = Boolean(rawOptions.dryRun);
  const log = makeLogger(dryRun);
  const ctx = { dryRun, log };

  const sourceRoot = path.resolve(rawOptions.source ?? process.cwd());
  const installRoot = path.resolve(rawOptions.prefix ?? resolveInstallRoot());
  const codexHome = path.resolve(rawOptions.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"));
  const writeCodexConfig = rawOptions.writeCodexConfig !== false;

  for (const relativePath of REQUIRED_PATHS) {
    if (!fs.existsSync(path.join(sourceRoot, relativePath))) {
      throw new InstallError(`Missing package component: ${relativePath}`);
    }
  }

  ensureRuntimePrerequisites();

  log.plan(`mkdir ${installRoot}`);
  if (!dryRun) fs.mkdirSync(installRoot, { recursive: true });

  for (const component of COPY_COMPONENTS) {
    if (fs.existsSync(path.join(sourceRoot, component))) {
      copyComponent(sourceRoot, installRoot, component, ctx);
    }
  }
  sanitizeDeployedRuntime(installRoot, ctx);

  if (fs.existsSync(path.join(sourceRoot, "node_modules"))) {
    copyComponent(sourceRoot, installRoot, "node_modules", ctx);
  }

  const launcherPath = generateLauncher(installRoot, ctx);
  rebuildNativeModulesIfNeeded(sourceRoot, installRoot, ctx);

  if (writeCodexConfig) {
    removeLegacyCodexMcpBlock(codexHome, ctx);
    installCodexPlugin(installRoot, ctx);
  }

  if (!dryRun) log.info(`Agent Workbench installed at ${installRoot}`);
  return { sourceRoot, installRoot, codexHome, launcherPath, dryRun, actions: log.actions };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(USAGE);
      process.exit(0);
    }
    install(options);
  } catch (error) {
    if (error instanceof InstallError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.message.startsWith("Unknown option") ? 2 : 1);
    }
    throw error;
  }
}

export { InstallError };
