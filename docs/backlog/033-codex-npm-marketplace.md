---
title: Ship a package-scoped Codex marketplace so npm→Codex registration is turnkey
doc_type: backlog
status: resolved
owner: platform
source_spec: docs/specs/033-cross-platform-packaging at final spec commit 0d2cc48
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Ship a package-scoped Codex marketplace so npm→Codex registration is turnkey

## Resolution (2026-06-30)

Resolved by shipping a package-scoped Codex marketplace at
`plugins/agent-workbench/.agents/plugins/marketplace.json` (name
`agent-workbench-local`, plugin `source` `.`), mirroring the Claude
`.claude-plugin/marketplace.json` pattern. It ships automatically under the
`plugins/agent-workbench` `files` allowlist entry, and is guarded by
`required_paths` (npm-package.json), the plugin validator, and a packed-metadata
test in `tests/integration/codex-integration-profile.test.ts`. The maintainer's
checkout marketplace (`.agents/plugins/marketplace.json` at the repo root, name
`auriora-local`) is untouched — the distinct name keeps the two from colliding.

**Registration verified (turnkey, tarball-verified):** `npm pack` → extract →
with `HOME`/`USERPROFILE`/`CODEX_HOME` all overridden so the host's real
`~/.agents` cannot shadow the tarball marketplace →
`codex plugin marketplace add <pkg>/plugins/agent-workbench` →
`codex plugin add agent-workbench@agent-workbench-local` →
`codex plugin list` shows `agent-workbench@agent-workbench-local` **v0.3.0**,
`installed, enabled`, resolved from the unpacked package path (not the
personal-marketplace `0.1.0+codex...` build). Docs flipped to the two-step
turnkey flow in `plugins/agent-workbench/README.md`,
`docs/runbooks/install-agent-workbench.md`, and
`docs/runbooks/codex-agent-workbench-plugin.md`.

**Launch follow-up (revised 2026-07-05):** Codex hook commands cannot rely on
`${PLUGIN_ROOT}`, so hooks are installed by `scripts/install-codex-hooks.mjs`
into `CODEX_HOME/hooks.json` with absolute installed-package script paths. MCP
has a different authority boundary: `.mcp.json` must resolve the shim with
`${PLUGIN_ROOT}/mcp-launch.mjs` and must not set `cwd`, because Codex's session
cwd is the default repo root. The plugin validator and Codex integration tests
reject `${PLUGIN_ROOT}` in Codex hook config, keep the plugin-bundled
`hooks/hooks.json` empty, and reject MCP configs that bind `cwd` to the plugin
cache.

---

## Context

Spec 033 (v0.3.0) made the runtime a normal npm package and verified the
**Claude** plugin-registration path end to end from the packed tarball:

```bash
claude plugin marketplace add <pkg>/plugins/agent-workbench
claude plugin install agent-workbench@agent-workbench-local --scope user
# -> claude plugin list shows agent-workbench@agent-workbench-local v0.3.0, enabled
```

The Claude path works because the package ships a **package-scoped** marketplace
manifest at `plugins/agent-workbench/.claude-plugin/marketplace.json` (name
`agent-workbench-local`, plugin source `./claude-plugin`), and that file survives
`npm pack` (verified present in the tarball).

The **Codex** path is **not** turnkey from the npm package:

1. The Codex marketplace `auriora-local` is defined only in
   `.agents/plugins/marketplace.json` at the **repo root** — a checkout artifact
   that is **not** in the `files` allowlist, so it is absent from the npm tarball.
2. `auriora-local` is the maintainer's **personal** marketplace name (the home
   copy lists three plugins: agent-workbench, repo-activity-ledger,
   spec-lifecycle-manager), not a package-scoped name like the Claude side's
   `agent-workbench-local`.
3. Consequently `codex plugin add agent-workbench@auriora-local` on a clean
   machine fails: no `auriora-local` marketplace is registered and none ships.

`codex plugin marketplace add <dir>` does read `<dir>/.agents/plugins/marketplace.json`
and resolves the plugin `source` (`./plugins/agent-workbench`) relative to that
root, so the mechanism exists — the package just doesn't ship a Codex marketplace
to point at.

## Scope

Make npm→Codex registration turnkey and clone-free, symmetric with the Claude
path:

- Ship a **package-scoped** Codex marketplace inside the tarball (e.g.
  `plugins/agent-workbench/.codex-plugin/marketplace.json` or a packaged
  `.agents/plugins/marketplace.json`), named to match the package
  (`agent-workbench-local`), with a `source` path that resolves to the shipped
  `plugins/agent-workbench` from the marketplace root.
- Add the shipped path(s) to the `files` allowlist and to required-paths
  expectations / packed-contents tests.
- Document the two-step flow (`codex plugin marketplace add <pkg-root>` then
  `codex plugin add agent-workbench@<scoped-name>`), mirroring the Claude
  README/runbook steps.

## Verification (for the follow-up)

The discriminating check: run with **`HOME`/`USERPROFILE` overridden** (not just
`CODEX_HOME`) so the maintainer's real `~/.agents` auto-discovery cannot shadow
the tarball marketplace. Install from the unpacked tarball and confirm
`codex plugin list` shows **v0.3.0** resolved from the unpacked package path —
not the personal-marketplace `0.1.0+codex...` build.

## Until then

npm→Codex registration is a **known gap** (tracked here), documented like the
Kiro launcher gap: the Codex marketplace must be added from a checkout, or this
follow-up must ship a package-scoped Codex marketplace. The Claude path is the
verified clone-free flow.

## References

- `plugins/agent-workbench/README.md` (Quick Start / Codex registration).
- `docs/runbooks/codex-agent-workbench-plugin.md` (Codex install flow).
- `.agents/plugins/marketplace.json` (checkout-only `auriora-local`).
- `plugins/agent-workbench/.claude-plugin/marketplace.json` (the shipped,
  package-scoped pattern to mirror).
- Related: `docs/backlog/033-kiro-shell-free-launcher.md`.
