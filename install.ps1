#Requires -Version 5.1
# Agent Workbench - one-shot installer for the downloadable archive (Windows).
# Run this from the extracted archive folder in PowerShell. It builds the runtime,
# installs it to %LOCALAPPDATA%\agent-workbench, and registers the Claude Code
# plugin properly (no repo clone, no --plugin-dir). Re-run to refresh.
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Here

function Require-Command($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Error "ERROR: '$name' is required. $hint"
    exit 1
  }
}

Write-Host "==> Checking prerequisites"
Require-Command node   "Install Node.js 22+ from https://nodejs.org"
Require-Command claude "Install the Claude Code CLI (installed and logged in) from https://docs.claude.com/claude-code"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { corepack enable pnpm }
Require-Command pnpm   "Run: corepack enable pnpm"

Write-Host "==> Building the runtime and installing it"
Write-Host "    (compiles native modules on first run; this can take a few minutes)"
Write-Host "    Requires Python 3 and the MSVC C++ build tools ('Desktop development with C++')."
node packaging/agent-workbench/installer.mjs --skip-codex-config
if ($LASTEXITCODE -ne 0) { Write-Error "Runtime install failed (see the message above)."; exit 1 }

$Prefix = if ($env:AGENT_WORKBENCH_INSTALL_ROOT) { $env:AGENT_WORKBENCH_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA "agent-workbench" }

Write-Host "==> Registering the Claude Code plugin from $Prefix"
claude plugin marketplace add (Join-Path $Prefix "plugins\agent-workbench")
claude plugin install agent-workbench@agent-workbench-local --scope user

Write-Host ""
Write-Host "==> Done. Restart Claude Code; the 'agent-workbench' plugin (MCP + skill + hooks) will load."
