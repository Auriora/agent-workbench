#!/usr/bin/env bash
# Thin delegator (spec 033, T006). All install logic lives in the single shell-free
# source of truth, packaging/agent-workbench/installer.mjs, so this POSIX entry
# point cannot diverge from it (Property P2). This wrapper still requires bash;
# the shell-free install path is npm -> packaging/agent-workbench/npm-install.mjs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Inject the repo-root source first so a user-supplied --source in "$@" overrides it
# (installer.mjs parseArgs is last-wins). exec propagates the installer's exit code.
exec node "${REPO_ROOT}/packaging/agent-workbench/installer.mjs" --source "${REPO_ROOT}" "$@"
