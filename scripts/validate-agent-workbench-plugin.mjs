#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertPath(relativePath) {
  assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing required path: ${relativePath}`);
}

function assertArrayEquals(actual, expected, label) {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  assert(
    JSON.stringify(sortedActual) === JSON.stringify(sortedExpected),
    `${label} mismatch.\nActual: ${sortedActual.join(", ")}\nExpected: ${sortedExpected.join(", ")}`
  );
}

const packageJson = readJson("package.json");
const manifest = readJson("packaging/agent-workbench/package-manifest.json");
const codexPlugin = readJson("plugins/agent-workbench/.codex-plugin/plugin.json");
const codexMcp = readJson("plugins/agent-workbench/.mcp.json");
const codexHooks = readJson("plugins/agent-workbench/hooks/hooks.json");
const marketplace = readJson(".agents/plugins/marketplace.json");
const serverCard = readJson(".well-known/mcp/server-card.json");

const requiredPaths = [
  "plugins/agent-workbench/.codex-plugin/plugin.json",
  "plugins/agent-workbench/.agents/plugins/marketplace.json",
  "plugins/agent-workbench/.mcp.json",
  "plugins/agent-workbench/hooks/hooks.json",
  "plugins/agent-workbench/hooks/session-start.js",
  "plugins/agent-workbench/hooks/post-edit-feedback.js",
  "plugins/agent-workbench/skills/agent-workbench/SKILL.md",
  "plugins/agent-workbench/README.md",
  ".agents/plugins/marketplace.json",
  ".well-known/mcp/server-card.json",
  "packaging/agent-workbench/package-manifest.json",
  "packaging/agent-workbench/mcp-bin.mjs",
  "scripts/postinstall.mjs"
];

for (const relativePath of requiredPaths) {
  assertPath(relativePath);
}

assert(codexPlugin.name === "agent-workbench", "Codex plugin name must be agent-workbench.");
assert(codexPlugin.skills === "./skills/", "Codex plugin must reference ./skills/.");
assert(codexPlugin.mcpServers === "./.mcp.json", "Codex plugin must reference ./.mcp.json.");
assert(
  codexPlugin.interface?.category === "Developer Tools",
  "Codex plugin category must remain Developer Tools."
);

const mcpServer = codexMcp.mcpServers?.["agent-workbench"];
assert(mcpServer, "Codex .mcp.json must define mcpServers.agent-workbench.");
// Spec 033: the MCP server launches shell-free via the portable shim. The shim
// resolves the install prefix itself and spawns the server from there, so the
// .mcp.json points at the plugin-root shim (not a bash wrapper). Assert the
// shell-free shape rather than a brittle command string.
assert(mcpServer.command === "node", "Codex MCP command must be a direct node invocation (no shell).");
assert(
  Array.isArray(mcpServer.args) &&
    mcpServer.args.length === 1 &&
    mcpServer.args[0] === "${PLUGIN_ROOT}/mcp-launch.mjs",
  "Codex MCP args must invoke ${PLUGIN_ROOT}/mcp-launch.mjs."
);
const codexMcpArgs = mcpServer.args.join(" ");
assert(
  mcpServer.command !== "bash" && !codexMcpArgs.includes("-lc") && !codexMcpArgs.includes("${VAR:-"),
  "Codex MCP launch must not use bash, -lc, or POSIX ${VAR:-default} expansion."
);
assert(
  !codexMcpArgs.includes("plugins/cache"),
  "Codex MCP args must not launch runtime code from plugin cache."
);

assertArrayEquals(Object.keys(codexHooks.hooks ?? {}), ["PostToolUse", "SessionStart"], "Codex hooks");

const marketplaceEntry = marketplace.plugins?.find((plugin) => plugin.name === "agent-workbench");
assert(marketplaceEntry, "Marketplace must expose agent-workbench.");
assert(
  marketplaceEntry.source?.path === "./plugins/agent-workbench",
  "Marketplace entry must point at checked-in plugin source."
);
assert(
  marketplaceEntry.policy?.installation === "AVAILABLE" &&
    marketplaceEntry.policy?.authentication === "ON_INSTALL",
  "Marketplace entry policy must stay installable with on-install auth."
);

assert(serverCard.id === "agent-workbench", "Server card id must be agent-workbench.");
assert(serverCard.version === packageJson.version, "Server card version must match package.json.");
assert(serverCard.transport?.type === "stdio", "Server card transport must be stdio.");
assert(serverCard.privacy?.local_first === true, "Server card must advertise local-first behavior.");
assert(serverCard.privacy?.network_required === false, "Server card must not require network access.");

assert(manifest.version === packageJson.version, "Package manifest version must match package.json.");
assert(
  manifest.npm_bin === "packaging/agent-workbench/mcp-bin.mjs",
  "Package npm bin path drifted."
);
assert(
  manifest.install_command === "npm install -g @auriora/agent-workbench",
  "Package install command drifted."
);
assertArrayEquals(
  manifest.dependency_install.runtime_dependencies,
  Object.keys(packageJson.dependencies ?? {}),
  "Runtime dependencies"
);
assertArrayEquals(
  manifest.dependency_install.dev_dependencies,
  Object.keys(packageJson.devDependencies ?? {}),
  "Dev dependencies"
);
assertArrayEquals(
  manifest.dependency_install.native_build_script_dependencies,
  packageJson.pnpm?.onlyBuiltDependencies ?? [],
  "Native build dependencies"
);

for (const component of manifest.components ?? []) {
  assertPath(component);
}

console.log("Agent Workbench plugin/package validation passed.");
