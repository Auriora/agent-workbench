---
title: Daemon lifetime evidence verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Quality Gates

| Gate | Evidence | Result |
| --- | --- | --- |
| V001 | pnpm exec vitest run tests/infrastructure/daemon-lifetime-evidence.test.ts | 11 tests passed, including malformed lifecycle facts, stale writer, held-lock fatal/exit updates and lock replacement during dead-owner probing |
| V002 | pnpm exec vitest run tests/infrastructure/daemon-lifetime-process-evidence.test.ts | 9 real-process tests passed |
| V002 | Focused process-hook, daemon admission and integration-health tests | Passed; independent lifetime evidence survives refresh diagnostics failure |
| V003 | pnpm test --maxWorkers=2 | 138 files, 1445 tests passed; 170.06 seconds |
| V003 | pnpm typecheck; pnpm validate:plugin; pnpm check:contracts | All passed |
| V003 | pnpm build-runtime; pnpm build-runtime:check | Build and receipt check passed |
| V003 | node scripts/ci/mcp-launch-smoke.mjs | Compiled MCP smoke passed on Linux |
| V003 | git diff --check | Passed |
| V003 | Independent QA and security/operations source review | No remaining blockers, warnings or suggestions; review.md records dispositions |

## Evidence Log

Executed on 2026-11-06 against the worktree based on 8aa5094. Validation preceded the implementation commit. Full test log: /tmp/awb067-full.log; storage regressions:
/tmp/awb067-final-storage.log; child process evidence: /tmp/awb067-process-tests.log.
Temporary logs are navigation aids; reproducible commands and outcomes above
are the durable evidence. No installation or release acceptance is claimed.

Spec 066 T004 completed first with 133 files and 1417 tests passing, after the
frontmatter fix. The subsequent full run above includes the Spec 067 additions.

Durable promotion completed in runtime-operations-design.md,
observability-debugging-design.md, runtime-contracts.md and the Codex operator
runbook; documentation-map.md identifies the observability owner. B001 is done
in source. B002 and B006 remain accepted follow-up work; Spec 065 is untouched.

Package structural lint has no errors. The canonical-context advisory was
reviewed: requirements' durable baseline and named owners have no competing
source of truth, so no duplicate canonical-context artifact was created.
Markdown checks found no issues in the new requirements/design or updated
runbook; bounded results for the other durable owners reported existing table
readability advisories. Direct path/anchor checks and diff checks cover this edit.

## Residual Risks

Uncatchable deaths and pre-ready bootstrap/import failures may have no terminal
observation. Failed filesystem operations report unavailable evidence while the
sink is inaccessible; a later readable nonterminal receipt can establish only
unknown prior-owner loss, not the missing cause. B002 shutdown and B006 aggregate
budgets remain accepted follow-up work. Spec 065 endpoint decisions are separate.
