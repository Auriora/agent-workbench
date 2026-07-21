#!/usr/bin/env bash
# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

set -euo pipefail

codex_home=""
stage_root=""
dry_run=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --codex-home)
      codex_home="${2:?--codex-home requires a path}"
      shift 2
      ;;
    --stage-root)
      stage_root="${2:?--stage-root requires a path}"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --help|-h)
      cat <<'USAGE'
Usage: scripts/install-agent-workbench-repo-local.sh [options]

Options:
  --codex-home <path>  CODEX_HOME override for plugin registration
  --stage-root <path>  generated marketplace path override
  --dry-run            print actions without staging or registration
USAGE
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -z "$stage_root" ]]; then
  stage_root="$repo_root/.cache/agent-workbench/codex-repo-local-marketplace"
fi

run_codex() {
  if [[ -n "$codex_home" ]]; then
    CODEX_HOME="$codex_home" codex "$@"
  else
    codex "$@"
  fi
}

marketplace_root() {
  run_codex plugin marketplace list | awk '$1 == "agent-workbench-local" { print $2; exit }'
}

plugin_is_installed() {
  run_codex plugin list | awk '
    $1 == "agent-workbench@agent-workbench-local" && $2 == "installed," { found = 1 }
    END { exit found ? 0 : 1 }
  '
}

if [[ "$dry_run" == true ]]; then
  echo "dry-run: node $repo_root/scripts/materialize-codex-repo-plugin.mjs --repo-root $repo_root --stage-root $stage_root"
  if [[ -n "$codex_home" ]]; then
    echo "dry-run: node $repo_root/scripts/install-codex-hooks.mjs --package-root $repo_root --codex-home $codex_home --dry-run"
    echo "dry-run: CODEX_HOME=$codex_home codex plugin remove agent-workbench@agent-workbench-local (when installed)"
    echo "dry-run: CODEX_HOME=$codex_home codex plugin marketplace remove agent-workbench-local (when configured)"
    echo "dry-run: CODEX_HOME=$codex_home codex plugin marketplace add $stage_root"
    echo "dry-run: CODEX_HOME=$codex_home codex plugin add agent-workbench@agent-workbench-local"
  else
    echo "dry-run: node $repo_root/scripts/install-codex-hooks.mjs --package-root $repo_root --dry-run"
    echo "dry-run: codex plugin remove agent-workbench@agent-workbench-local (when installed)"
    echo "dry-run: codex plugin marketplace remove agent-workbench-local (when configured)"
    echo "dry-run: codex plugin marketplace add $stage_root"
    echo "dry-run: codex plugin add agent-workbench@agent-workbench-local"
  fi
  exit 0
fi

node "$repo_root/scripts/materialize-codex-repo-plugin.mjs" \
  --repo-root "$repo_root" \
  --stage-root "$stage_root"

hook_args=(
  node "$repo_root/scripts/install-codex-hooks.mjs"
  --package-root "$repo_root"
)
if [[ -n "$codex_home" ]]; then
  hook_args+=(--codex-home "$codex_home")
fi
"${hook_args[@]}"

if plugin_is_installed; then
  run_codex plugin remove agent-workbench@agent-workbench-local
fi

existing_root="$(marketplace_root)"
if [[ -n "$existing_root" ]]; then
  echo "Replacing Codex marketplace 'agent-workbench-local' source: $existing_root -> $stage_root"
  run_codex plugin marketplace remove agent-workbench-local
fi
run_codex plugin marketplace add "$stage_root"
run_codex plugin add agent-workbench@agent-workbench-local

echo "Installed Agent Workbench for Codex from checkout: $repo_root"
