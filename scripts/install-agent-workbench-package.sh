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

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required dependency: $command_name. $install_hint" >&2
    exit 1
  fi
}

node_major_version() {
  node -e 'const major = Number(process.versions.node.split(".")[0]); process.stdout.write(String(major));'
}

ensure_runtime_prerequisites() {
  require_command node "Install Node.js 22 or newer before installing Agent Workbench."
  local major
  major="$(node_major_version)"
  if [ "$major" -lt 22 ]; then
    echo "Node.js 22 or newer is required; found $(node --version)." >&2
    exit 1
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return
  fi
  if command -v corepack >/dev/null 2>&1; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "dry-run: corepack enable pnpm"
    else
      corepack enable pnpm
    fi
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm 10.18.1 is required to install Agent Workbench dependencies. Install pnpm or enable it with corepack." >&2
    exit 1
  fi
}

ensure_native_build_prerequisites() {
  require_command python3 "Install Python 3 for native Node module builds."
  require_command make "Install make for native Node module builds."
  if ! command -v c++ >/dev/null 2>&1 && ! command -v g++ >/dev/null 2>&1; then
    echo "Missing required dependency: c++ compiler. Install g++ or another C++20-capable compiler for native Node module builds." >&2
    exit 1
  fi
}

write_user_hooks_json() {
  local hooks_json="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: merge Agent Workbench hooks into $hooks_json"
    return
  fi

  HOOKS_JSON="$hooks_json" INSTALL_ROOT="$INSTALL_ROOT" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const hooksJson = process.env.HOOKS_JSON;
const installRoot = process.env.INSTALL_ROOT;

let data = { hooks: {} };
if (fs.existsSync(hooksJson)) {
  data = JSON.parse(fs.readFileSync(hooksJson, "utf8"));
}
if (!data || typeof data !== "object" || Array.isArray(data)) {
  data = { hooks: {} };
}
if (!data.hooks || typeof data.hooks !== "object" || Array.isArray(data.hooks)) {
  data.hooks = {};
}

const sessionCommand = `AGENT_WORKBENCH_HOOK_FEEDBACK=basic node "${path.join(
  installRoot,
  "plugins/agent-workbench/hooks/session-start.js"
)}"`;
const postEditCommand = `AGENT_WORKBENCH_HOOK_FEEDBACK=basic node "${path.join(
  installRoot,
  "plugins/agent-workbench/hooks/post-edit-feedback.js"
)}"`;

function withoutAgentWorkbench(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const hooks = (Array.isArray(entry.hooks) ? entry.hooks : []).filter(
        (hook) => !String(hook.command ?? "").includes("/plugins/agent-workbench/hooks/")
      );
      return { ...entry, hooks };
    })
    .filter((entry) => entry.hooks.length > 0);
}

data.hooks.SessionStart = withoutAgentWorkbench(data.hooks.SessionStart);
data.hooks.SessionStart.push({
  matcher: "startup|resume|clear|compact",
  hooks: [
    {
      type: "command",
      command: sessionCommand,
      timeout: 10,
      statusMessage: "Loading Agent Workbench context"
    }
  ]
});

data.hooks.PostToolUse = withoutAgentWorkbench(data.hooks.PostToolUse);
data.hooks.PostToolUse.push({
  matcher: "^(apply_patch|Edit|Write|write_file|create_file|rename_file)$",
  hooks: [
    {
      type: "command",
      command: postEditCommand,
      timeout: 10,
      statusMessage: "Checking Agent Workbench edit feedback"
    }
  ]
});

fs.mkdirSync(path.dirname(hooksJson), { recursive: true });
fs.writeFileSync(hooksJson, `${JSON.stringify(data, null, 2)}\n`);
NODE
}

copy_component() {
  local relative_path="$1"
  run mkdir -p "$INSTALL_ROOT/$(dirname "$relative_path")"
  run rm -rf "$INSTALL_ROOT/$relative_path"
  run cp -a "$SOURCE_ROOT/$relative_path" "$INSTALL_ROOT/$relative_path"
}

ensure_runtime_prerequisites
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
  ensure_pnpm
  ensure_native_build_prerequisites
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: cd $INSTALL_ROOT && pnpm install --frozen-lockfile && pnpm rebuild:native"
  else
    (cd "$INSTALL_ROOT" && pnpm install --frozen-lockfile && pnpm rebuild:native)
  fi
fi

if [ "$WRITE_CODEX_CONFIG" -eq 1 ]; then
  run mkdir -p "$CODEX_HOME"
  CODEX_CONFIG="$CODEX_HOME/config.toml"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: rewrite Agent Workbench MCP config block in $CODEX_CONFIG"
  else
    touch "$CODEX_CONFIG"
    if grep -q "BEGIN Agent Workbench package install" "$CODEX_CONFIG"; then
      temp_config="$(mktemp)"
      awk '
        /# BEGIN Agent Workbench package install/ { skipping = 1; next }
        /# END Agent Workbench package install/ { skipping = 0; next }
        !skipping { print }
      ' "$CODEX_CONFIG" > "$temp_config"
      mv "$temp_config" "$CODEX_CONFIG"
    fi
    cat >> "$CODEX_CONFIG" <<EOF

# BEGIN Agent Workbench package install
[mcp_servers.agent-workbench]
enabled = true
command = "$INSTALL_ROOT/bin/agent-workbench-mcp"
args = []
# END Agent Workbench package install
EOF
  fi
  write_user_hooks_json "$CODEX_HOME/hooks.json"
fi

echo "Agent Workbench installed at $INSTALL_ROOT"
