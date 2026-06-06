# Agent Workbench GHCR Package

This package definition builds an OCI image for GHCR that contains the Agent
Workbench MCP runtime, documentation, Codex plugin wrapper, skill, and hook
scripts.

The image entrypoint launches the MCP stdio server:

```bash
node --import tsx /opt/agent-workbench/src/mcp/stdio.ts
```

The host installer is `scripts/install-agent-workbench-package.sh`. It copies
the package contents to a stable local prefix, writes a launcher, installs the
Codex plugin wrapper files, and appends fallback Codex MCP and hook
configuration when the plugin system does not install hooks itself.

Build locally:

```bash
docker build -f packaging/agent-workbench/Containerfile -t agent-workbench:local .
```

GHCR release automation should publish the same containerfile as:

```text
ghcr.io/bcherrington/agent-workbench:<version>
ghcr.io/bcherrington/agent-workbench:latest
```
