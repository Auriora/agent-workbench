# Agent Workbench GHCR Package

This package definition builds an OCI image for GHCR that contains the Agent
Workbench MCP runtime, documentation, Codex plugin wrapper, skill, and hook
scripts.

The image entrypoint launches the MCP stdio server:

```bash
node --import tsx /opt/agent-workbench/src/mcp/stdio.ts
```

Dependency installation is defined in `package-manifest.json`. The package
requires Node.js 22 or newer and pnpm 10.18.1. When `node_modules` is not
already packaged, the host installer runs:

```bash
pnpm install --frozen-lockfile
pnpm rebuild:native
```

Native runtime modules require Python 3, `make`, and a C++20-capable compiler.
The runtime dependency set includes `tsx` because the installed MCP launcher
uses the TypeScript stdio entrypoint directly.

The host installer is `scripts/install-agent-workbench-package.sh`. It copies
the package contents to a stable local prefix, writes a launcher, installs the
Codex plugin wrapper files, appends fallback Codex MCP configuration to
`config.toml`, and merges hook configuration into `hooks.json` when the plugin
system does not install hooks itself.

Build locally:

```bash
docker build -f packaging/agent-workbench/Containerfile -t agent-workbench:local .
```

GHCR release automation should publish the same containerfile as:

```text
ghcr.io/bcherrington/agent-workbench:<version>
ghcr.io/bcherrington/agent-workbench:latest
```
