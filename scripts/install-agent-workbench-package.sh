#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_ROOT="${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
WRITE_CODEX_CONFIG=1
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: install-agent-workbench-package.sh [options]

Options:
  --source <path>       Package source root. Defaults to the checkout root.
  --prefix <path>       Install prefix. Defaults to ~/.local/share/agent-workbench.
  --codex-home <path>   Codex home. Defaults to $CODEX_HOME or ~/.codex.
  --skip-codex-config   Copy files and launcher without editing Codex config.toml.
  --dry-run             Print planned actions without writing files.
  -h, --help            Show this help.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      SOURCE_ROOT="$2"
      shift 2
      ;;
    --prefix)
      INSTALL_ROOT="$2"
      shift 2
      ;;
    --codex-home)
      CODEX_HOME="$2"
      shift 2
      ;;
    --skip-codex-config)
      WRITE_CODEX_CONFIG=0
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd)"
INSTALL_ROOT="$(mkdir -p "$(dirname "$INSTALL_ROOT")" && cd "$(dirname "$INSTALL_ROOT")" && pwd)/$(basename "$INSTALL_ROOT")"
CODEX_HOME="$(mkdir -p "$CODEX_HOME" && cd "$CODEX_HOME" && pwd)"

required_paths=(
  "src"
  "docs"
  "plugins/agent-workbench/.codex-plugin/plugin.json"
  "plugins/agent-workbench/hooks/session-start.js"
  "plugins/agent-workbench/hooks/post-edit-feedback.js"
  "plugins/agent-workbench/skills/agent-workbench/SKILL.md"
  "package.json"
  "pnpm-lock.yaml"
  "tsconfig.json"
)

for relative_path in "${required_paths[@]}"; do
  if [ ! -e "$SOURCE_ROOT/$relative_path" ]; then
    echo "Missing package component: $relative_path" >&2
    exit 1
  fi
done

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf 'dry-run:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

copy_component() {
  local relative_path="$1"
  run mkdir -p "$INSTALL_ROOT/$(dirname "$relative_path")"
  run rm -rf "$INSTALL_ROOT/$relative_path"
  run cp -a "$SOURCE_ROOT/$relative_path" "$INSTALL_ROOT/$relative_path"
}

run mkdir -p "$INSTALL_ROOT"
for component in src docs plugins packaging scripts package.json pnpm-lock.yaml tsconfig.json AGENTS.md; do
  if [ -e "$SOURCE_ROOT/$component" ]; then
    copy_component "$component"
  fi
done

if [ -d "$SOURCE_ROOT/node_modules" ]; then
  copy_component node_modules
fi

run mkdir -p "$INSTALL_ROOT/bin"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "dry-run: write $INSTALL_ROOT/bin/agent-workbench-mcp"
else
  cat > "$INSTALL_ROOT/bin/agent-workbench-mcp" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$INSTALL_ROOT"
exec node --import tsx "$INSTALL_ROOT/src/mcp/stdio.ts" "\$@"
EOF
  chmod +x "$INSTALL_ROOT/bin/agent-workbench-mcp"
fi

if [ ! -d "$SOURCE_ROOT/node_modules/tsx" ] && [ ! -d "$INSTALL_ROOT/node_modules/tsx" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "dry-run: cd $INSTALL_ROOT && pnpm install --frozen-lockfile && pnpm rebuild:native"
    else
      (cd "$INSTALL_ROOT" && pnpm install --frozen-lockfile && pnpm rebuild:native)
    fi
  else
    echo "pnpm is required to install runtime dependencies because node_modules was not packaged." >&2
    exit 1
  fi
fi

if [ "$WRITE_CODEX_CONFIG" -eq 1 ]; then
  run mkdir -p "$CODEX_HOME"
  CODEX_CONFIG="$CODEX_HOME/config.toml"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: append Agent Workbench MCP and hook config to $CODEX_CONFIG if marker is absent"
  else
    touch "$CODEX_CONFIG"
    if ! grep -q "BEGIN Agent Workbench package install" "$CODEX_CONFIG"; then
      cat >> "$CODEX_CONFIG" <<EOF

# BEGIN Agent Workbench package install
[mcp_servers.agent-workbench]
enabled = true
command = "$INSTALL_ROOT/bin/agent-workbench-mcp"
args = []

[[hooks.SessionStart]]
matcher = "startup|resume|clear|compact"

[[hooks.SessionStart.hooks]]
type = "command"
command = 'AGENT_WORKBENCH_HOOK_FEEDBACK=basic node "$INSTALL_ROOT/plugins/agent-workbench/hooks/session-start.js"'
timeout = 10
statusMessage = "Loading Agent Workbench context"

[[hooks.PostToolUse]]
matcher = "^(apply_patch|Edit|Write|write_file|create_file|rename_file)$"

[[hooks.PostToolUse.hooks]]
type = "command"
command = 'AGENT_WORKBENCH_HOOK_FEEDBACK=basic node "$INSTALL_ROOT/plugins/agent-workbench/hooks/post-edit-feedback.js"'
timeout = 10
statusMessage = "Checking Agent Workbench edit feedback"
# END Agent Workbench package install
EOF
    fi
  fi
fi

echo "Agent Workbench installed at $INSTALL_ROOT"
