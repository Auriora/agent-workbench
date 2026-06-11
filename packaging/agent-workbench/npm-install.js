#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..", "..");
const installer = path.join(packageRoot, "scripts", "install-agent-workbench-package.sh");

function usage() {
  process.stdout.write(`Usage: agent-workbench <command> [installer options]

Commands:
  install      Install or refresh the Codex plugin from this npm package.
  help         Show this help.

Examples:
  npx @auriora/agent-workbench install
  npx @auriora/agent-workbench install -- --codex-home ~/.codex
  npx @auriora/agent-workbench install -- --prefix ~/.local/share/agent-workbench
`);
}

const args = process.argv.slice(2);
const command = args.shift() || "install";

if (command === "help" || command === "--help" || command === "-h") {
  usage();
  process.exit(0);
}

if (command !== "install") {
  process.stderr.write(`Unknown command: ${command}\n\n`);
  usage();
  process.exit(2);
}

const installerArgs = args[0] === "--" ? args.slice(1) : args;
const result = spawnSync(installer, ["--source", packageRoot, ...installerArgs], {
  stdio: "inherit"
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
