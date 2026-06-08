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
  --skip-codex-config   Copy files and launcher without installing the Codex plugin.
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
  "plugins/agent-workbench/.mcp.json"
  "plugins/agent-workbench/hooks/hooks.json"
  "plugins/agent-workbench/hooks/session-start.js"
  "plugins/agent-workbench/hooks/post-edit-feedback.js"
  "plugins/agent-workbench/kiro-power/POWER.md"
  "plugins/agent-workbench/kiro-power/mcp.json"
  "plugins/agent-workbench/kiro-power/hooks/session-start.js"
  "plugins/agent-workbench/kiro-power/hooks/post-edit-feedback.js"
  "plugins/agent-workbench/kiro-power/skills/agent-workbench/SKILL.md"
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

remove_legacy_agent_workbench_mcp_block() {
  local codex_config="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: remove legacy Agent Workbench MCP config block from $codex_config"
    return
  fi

  touch "$codex_config"
  if grep -q "BEGIN Agent Workbench package install" "$codex_config"; then
    temp_config="$(mktemp)"
    awk '
      /# BEGIN Agent Workbench package install/ { skipping = 1; next }
      /# END Agent Workbench package install/ { skipping = 0; next }
      !skipping { print }
    ' "$codex_config" > "$temp_config"
    mv "$temp_config" "$codex_config"
  fi
}

install_codex_plugin() {
  local marketplace_path="$HOME/.agents/plugins/marketplace.json"
  local plugin_root="$HOME/plugins/agent-workbench"

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: copy $INSTALL_ROOT/plugins/agent-workbench to $plugin_root"
    echo "dry-run: ensure Agent Workbench marketplace entry in $marketplace_path"
    echo "dry-run: cachebust plugin version in $plugin_root/.codex-plugin/plugin.json"
    echo "dry-run: codex plugin add agent-workbench@<personal-marketplace-name>"
    return
  fi

  rm -rf "$plugin_root"
  mkdir -p "$(dirname "$plugin_root")"
  cp -a "$INSTALL_ROOT/plugins/agent-workbench" "$plugin_root"

  MARKETPLACE_PATH="$marketplace_path" PLUGIN_ROOT="$plugin_root" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const marketplacePath = process.env.MARKETPLACE_PATH;
const pluginRoot = process.env.PLUGIN_ROOT;

let marketplace = {
  name: "personal",
  interface: { displayName: "Personal" },
  plugins: []
};
if (fs.existsSync(marketplacePath)) {
  marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
}
if (!Array.isArray(marketplace.plugins)) {
  marketplace.plugins = [];
}
if (!marketplace.interface || typeof marketplace.interface !== "object") {
  marketplace.interface = { displayName: marketplace.name ?? "Personal" };
}

const entry = {
  name: "agent-workbench",
  source: {
    source: "local",
    path: "./plugins/agent-workbench"
  },
  policy: {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL"
  },
  category: "Developer Tools"
};

const existingIndex = marketplace.plugins.findIndex((plugin) => plugin.name === entry.name);
if (existingIndex === -1) {
  marketplace.plugins.push(entry);
} else {
  marketplace.plugins[existingIndex] = entry;
}

fs.mkdirSync(path.dirname(marketplacePath), { recursive: true });
fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);

const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const baseVersion = String(manifest.version ?? "0.1.0").split("+")[0];
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
manifest.version = `${baseVersion}+codex.${stamp}`;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

  if command -v codex >/dev/null 2>&1; then
    local marketplace_name
    marketplace_name="$(MARKETPLACE_PATH="$marketplace_path" node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.env.MARKETPLACE_PATH, "utf8")); process.stdout.write(data.name);')"
    codex plugin add "agent-workbench@$marketplace_name"
  else
    echo "Codex CLI not found; plugin source installed at $plugin_root but not added." >&2
  fi
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
if [ -z "\${AGENT_WORKBENCH_DEFAULT_REPO_ROOT:-}" ]; then
  export AGENT_WORKBENCH_DEFAULT_REPO_ROOT="\$PWD"
fi
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
  remove_legacy_agent_workbench_mcp_block "$CODEX_HOME/config.toml"
  install_codex_plugin
fi

echo "Agent Workbench installed at $INSTALL_ROOT"
