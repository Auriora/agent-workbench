#!/usr/bin/env bash
# Agent Workbench — one-shot installer for the downloadable archive (macOS/Linux).
# Run this from the extracted archive folder. It builds the runtime, installs it
# to a stable location, and registers the Claude Code plugin properly (no repo
# clone, no --plugin-dir). Re-running it safely refreshes the install.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

echo "==> Checking prerequisites"
command -v node   >/dev/null 2>&1 || { echo "ERROR: Node.js 22+ is required — https://nodejs.org"; exit 1; }
command -v claude >/dev/null 2>&1 || { echo "ERROR: Claude Code CLI is required (installed and logged in) — https://docs.claude.com/claude-code"; exit 1; }
if ! command -v pnpm >/dev/null 2>&1; then corepack enable pnpm 2>/dev/null || true; fi
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm is required — run: corepack enable pnpm"; exit 1; }

echo "==> Building the runtime and installing it"
echo "    (compiles native modules on first run; this can take a few minutes)"
node packaging/agent-workbench/installer.mjs --skip-codex-config

PREFIX="${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}"

echo "==> Registering the Claude Code plugin from ${PREFIX}"
claude plugin marketplace add "${PREFIX}/plugins/agent-workbench"
claude plugin install agent-workbench@agent-workbench-local --scope user

echo ""
echo "==> Done. Restart Claude Code; the 'agent-workbench' plugin (MCP + skill + hooks) will load."
