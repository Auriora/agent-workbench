#!/usr/bin/env bash
# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

set -euo pipefail

prefix=""
codex_home=""
skip_codex_config=false
dry_run=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)
      prefix="${2:?--prefix requires a path}"
      shift 2
      ;;
    --codex-home)
      codex_home="${2:?--codex-home requires a path}"
      shift 2
      ;;
    --skip-codex-config)
      skip_codex_config=true
      shift
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --help|-h)
      cat <<'USAGE'
Usage: scripts/install-agent-workbench-package.sh [options]

Options:
  --prefix <path>          npm global prefix override
  --codex-home <path>      CODEX_HOME override for plugin registration
  --skip-codex-config      skip Codex marketplace/plugin registration
  --dry-run                print actions without running them
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
cd "$repo_root"

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
if [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major >= 24 )) && [[ -z "${CXXFLAGS:-}" ]]; then
  export CXXFLAGS="-std=c++20"
fi

npm_install=(npm install -g)
npm_root=(npm root -g)
if [[ -n "$prefix" ]]; then
  npm_install+=(--prefix "$prefix")
  npm_root+=(--prefix "$prefix")
fi

if [[ "$dry_run" == true ]]; then
  if [[ -n "${CXXFLAGS:-}" ]]; then
    echo "dry-run: CXXFLAGS=$CXXFLAGS"
  fi
  echo "dry-run: npm_config_cache=/tmp/agent-workbench-npm-cache npm pack"
  echo "dry-run: ${npm_install[*]} ./auriora-agent-workbench-<version>.tgz"
  if [[ "$skip_codex_config" == false ]]; then
    echo "dry-run: PKG=\"\$(${npm_root[*]})/@auriora/agent-workbench\""
    echo "dry-run: LINK=\"\${XDG_DATA_HOME:-\$HOME/.local/share}/agent-workbench/codex-plugin\""
    echo "dry-run: ln -sfn \"\$PKG/plugins/agent-workbench\" \"\$LINK\""
    if [[ -n "$codex_home" ]]; then
      echo "dry-run: node scripts/install-codex-hooks.mjs --package-root \"\$PKG\" --codex-home \"$codex_home\" --dry-run"
    else
      echo "dry-run: node scripts/install-codex-hooks.mjs --package-root \"\$PKG\" --dry-run"
    fi
    if [[ -n "$codex_home" ]]; then
      echo "dry-run: CODEX_HOME=$codex_home codex plugin marketplace add \"\$LINK\""
      echo "dry-run: CODEX_HOME=$codex_home codex plugin add agent-workbench@agent-workbench-local"
    else
      echo "dry-run: codex plugin marketplace add \"\$LINK\""
      echo "dry-run: codex plugin add agent-workbench@agent-workbench-local"
    fi
  fi
  exit 0
fi

tarball="$(npm_config_cache=/tmp/agent-workbench-npm-cache npm pack --silent)"
"${npm_install[@]}" "./$tarball"

if [[ "$skip_codex_config" == false ]]; then
  pkg="$("${npm_root[@]}")/@auriora/agent-workbench"
  link="${XDG_DATA_HOME:-$HOME/.local/share}/agent-workbench/codex-plugin"
  mkdir -p "$(dirname "$link")"
  ln -sfn "$pkg/plugins/agent-workbench" "$link"
  hook_args=(node scripts/install-codex-hooks.mjs --package-root "$pkg")
  if [[ -n "$codex_home" ]]; then
    hook_args+=(--codex-home "$codex_home")
  fi
  "${hook_args[@]}"
  if [[ -n "$codex_home" ]]; then
    CODEX_HOME="$codex_home" codex plugin marketplace add "$link"
    CODEX_HOME="$codex_home" codex plugin add agent-workbench@agent-workbench-local
  else
    codex plugin marketplace add "$link"
    codex plugin add agent-workbench@agent-workbench-local
  fi
fi

echo "Installed local Agent Workbench package."
