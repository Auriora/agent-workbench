#!/usr/bin/env node
// npm package entry point (spec 033). Runs the shell-free installer in-process —
// no .sh spawn. The .mjs extension keeps this ESM in both the type:module
// checkout and the published CommonJS-default package.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, install, InstallError } from "./installer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..", "..");

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

let options;
try {
  options = parseArgs(installerArgs);
} catch (error) {
  process.stderr.write(`${error.message}\n\n`);
  usage();
  process.exit(2);
}

if (options.help) {
  usage();
  process.exit(0);
}

if (!options.source) options.source = packageRoot;

try {
  install(options);
} catch (error) {
  if (error instanceof InstallError) {
    process.stderr.write(`Agent Workbench install failed: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
