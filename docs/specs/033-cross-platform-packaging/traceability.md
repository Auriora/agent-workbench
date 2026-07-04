---
title: Cross-platform packaging traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-29
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- |
| T001a | R2.2, P3 | Install-root resolver | Runtime operations design | Resolver parity (P3) |
| T001b | P3 | Install-root resolver | — | Resolver parity (P3) |
| T002a | R2.1, R2.2, R2.3, P1 | MCP launch shim | Runtime operations design | MCP launch (R2) |
| T002b | P2 | MCP launch shim, Components | Runtime operations design | Single source (P2) |
| T003 | R2.1, P1 | MCP launch shim | Runtime operations design | MCP launch (R2) |
| T004 | R1.1, R1.2, R2.4, P1 | Installer, Components | Packaging README, runtime operations design | Install on Windows (R1) |
| T005a | R1.1 | Installer, npm-install wiring | Runtime operations design | Install on Windows (R1) |
| T005b | R1.4, P4 | Error handling | Runtime operations design | Fail-loud (P4) |
| T006 | R1.3, P1, P2 | Components (installer) | Packaging README | Single source (P2) |
| T007 | R3.1, R3.3, P1 | Hook entries | Hook/plugin docs | Hook execution (R3) |
| T008 | R3.2 (Decision 4) | Hook entries | Hook/plugin docs | Hook execution (R3) |
| T009 | P2 | Hook entries | — | Hook drift (P2) |
| T010a | R1 | Operational Considerations | Packaging README, runtime operations design | Single source (P2) |
| T010b | R1 (Decision 2) | Operational Considerations | Packaging README | Single source (P2) |
| T011a | R4.2 | Operational Considerations | Install/operations docs | Install on Windows (R1) |
| T011b | R4.2, R2 | Operational Considerations | Runtime operations design | MCP launch (R2) |
| T011c | R4.2, R3 | Operational Considerations | Hook/plugin docs | Hook execution (R3) |
| T012a | R4.1, R4.3, R5.2 | Resolved Decisions, Operational Considerations | Install/operations docs | Native build (R5) |
| T012b | R5.1 | Resolved Decisions | `docs/backlog/` | Native build (R5) |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| R1 Shell-free installer | T004, T005a, T005b, T006, T010a, T010b, T011a | Install on Windows, fail-loud, single-source, `npm pack` |
| R2 Shell-free MCP launcher | T001a, T002a, T002b, T003, T011b | Resolver parity + MCP launch smoke on three OSes |
| R3 Shell-free hook commands | T007, T008, T009, T011c | Hook execution smoke + byte-identical drift guard |
| R4 Verified platform matrix | T011a, T011b, T011c, T012a | CI matrix evidence + durable platform-matrix doc |
| R5 Bounded native build decision | T012a, T012b | Native-build gate + recorded decision and backlog follow-up |
| P1 Shell independence | T002a, T003, T004, T006, T007 | Install/launch/hook smoke; no shell error on any OS |
| P2 Single source of truth | T002b, T006, T009 | Drift guards green; no independent `.sh` install logic |
| P3 Default-root parity | T001a, T001b | `resolveInstallRoot` unit test for `win32` and POSIX |
| P4 Fail-loud prerequisites | T005b, T012a | Forced-missing-prerequisite actionable error, no partial install |

## Design To Implementation Matrix

| Design Area | Tasks | Notes |
| --- | --- | --- |
| Install-root resolver | T001a, T001b | One resolver shared by installer, launcher, and shim (P3) |
| MCP launch shim | T002a, T002b, T003 | Exec form; vendored Claude copy synced from source |
| Installer (`installer.mjs`) | T004, T005a, T005b, T006, T010a, T010b | One cross-platform impl; `.sh` removed or delegated |
| Hook entries | T007, T008, T009 | Exec form + in-script default + re-synced vendored copies |
| Verification / Operational | T011a, T011b, T011c, T012a | CI matrix on windows/macos/ubuntu; matrix doc promoted |
| Resolved Decisions | T012a, T012b | Native-build documented; turnkey-core follow-up routed |

## Open Decision Impact

All four open decisions were resolved in `design.md` (2026-06-29):

- **Decision 1 (native build → option a).** Bounds R5 to a documented toolchain
  prerequisite for the core `tree-sitter` binding; T012a documents it and the
  fail-loud gate (T005b/P4) covers its absence. T012b routes the turnkey-core
  follow-up (b1/b2) to `docs/backlog/`.
- **Decision 2 (npm-only distribution).** R1 and all of Phase 2 (T004, T005a,
  T005b, T006, T010a, T010b) are fully load-bearing; no marketplace path is
  assumed to sidestep the installer.
- **Decision 3 (`%LOCALAPPDATA%\agent-workbench` Windows root).** Encoded in the
  T001a resolver and asserted by the T001b parity test (P3).
- **Decision 4 (in-script hook default).** T008 makes the `basic` default the
  contract, so R3 holds even if a runtime ignores the `env` field.
