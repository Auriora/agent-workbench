---
title: Repo-root authority design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Introduce a root-authority policy at the MCP registry boundary. The policy
resolves each request to the launched root by default and blocks caller-supplied
`repo_root` unless an explicit debug root override gate is enabled. Registries
should not advertise `repo_root` in normal mode.

## High-Level Design

### Root Authority Policy

Add a small policy module owned by the MCP/interface layer:

```text
RootAuthorityPolicy
  launch_root
  mode: normal | debug_override
  allowed_debug_roots: launch_root | any_accessible | explicit_list
```

Normal mode ignores no data silently: if a request includes `repo_root`, the
policy returns a blocked decision. Debug mode validates the override and returns
the effective root.

### Metadata Filtering

Tool/resource declarations should expose `repo_root` only when the server is in
debug override mode. The same policy should drive JSON schema metadata and
session/integration health claims so normal agents do not see a parameter they
should not use.

### Debug Gate

Use one explicit gate, for example:

```text
AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1
```

If a hidden CLI flag is added later, it should set the same internal policy.
Avoid multiple parallel flags.

## Low-Level Design

- Add a `resolveRequestRepoRoot` helper that takes launch root, raw request
  root, and policy.
- Replace direct `request.repo_root` adapter construction in `src/server.ts`
  with the policy helper.
- Update registries to route argument schemas through a declaration helper that
  can omit or mark debug-only `repo_root`.
- Add blocked-envelope builders or reuse the shared error-envelope spec once
  available; this spec may initially use existing invalid-input envelopes with
  a distinct root-authority message.
- Update integration health to report root policy and debug mode only in
  diagnostic fields.

## Operational Considerations

- Default installs must run in normal mode.
- Debug mode is local, explicit, and not part of generated agent guidance.
- Existing tests that intentionally target fixture repositories should enable
  debug mode or call use cases directly.

## Open Questions

- Should debug override accept any accessible root or only an explicit
  allowlist?
- Should debug root policy appear only in doctor output or also in integration
  health when debug mode is enabled?
