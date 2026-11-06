---
title: Refresh-safe daemon shutdown verification
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

| Gate | Reproducible check | Result |
| --- | --- | --- |
| V001 | pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/repository-ownership-shutdown.test.ts | 66 focused cases passed after the controller race fixes |
| V002 | pnpm exec vitest run tests/mcp/daemon-draining-client.test.ts | 9 passed, including deterministic failed/successful probe rechecks and unchanged-ready rejection |
| V002 | Focused daemon/coordinator/receipt/startup-lock tests | Passed; exact cancellation, draining publication, held-authority failure and known-contention classification covered |
| V003 | pnpm test --maxWorkers=1 | 142 files passed; 1491 passed and 1 conditional installed-only case skipped; 162.37 seconds |
| V003 | Installed package: pnpm exec vitest run tests/mcp/daemon-entrypoint-integration.test.ts --maxWorkers=1 | 23 passed, no skips; 56.94 seconds; includes the conditional concurrent two-build handoff |
| V003 | pnpm typecheck | Passed |
| V003 | pnpm validate:plugin; pnpm check:contracts | Passed |
| V003 | npm pack prepack build; pnpm build-runtime:check | Compiled runtime built and receipt checked |
| V003 | node scripts/ci/mcp-launch-smoke.mjs | Compiled MCP launcher smoke passed |
| V003 | git diff --check | Passed |
| V003 | Independent correctness, requirements/QA and security/operations reviews | Source blockers resolved; deterministic probe-test warning closed; review.md records dispositions |

The one source-suite skip is intentional: it needs two installed entrypoints.
The separate 23/23 installed run executes it and still requires both concurrent
successor clients to connect to the same new PID/build. It does not replace that
assertion with accepting a failed client. Only the old daemon outcome may be
settled/exit 0 or the exact startup-exclusion blocked/exit 1 permitted by R2 AC4.

## Evidence Log

Executed on 2026-11-06 against the worktree based on 84ea8ca. Spec 067 was
committed first after its 138-file/1445-test validation. Validation preceded this slice's implementation commit; its hash is reported in
the delivery handoff. No host installation or release is claimed.

Final source log: /tmp/awb068-full-final.log. Final installed log:
/tmp/awb068-installed-corrected.log. Deterministic probe tests and their assertions
are committed-path artifacts in tests/mcp/daemon-draining-client.test.ts. Temporary
logs are navigation aids; commands, actual outcomes and fixture preparation below
are the durable evidence.

### Installed fixture preparation

1. Build through `npm pack --json --pack-destination <private-temp>/pack`.
   Use an immutable tarball filename containing its digest for repeated fixture
   updates, so the package manager cannot reuse an earlier same-version payload.
2. In a private temporary install root, provision a private manifest using this
   repository's production dependencies, packageManager and approved
   pnpm.onlyBuiltDependencies policy. Install the tarball with
   `pnpm add --ignore-scripts <tarball>`.
3. With `CXXFLAGS=-std=c++20` on this Linux/Node 24 host, explicitly run
   `pnpm rebuild better-sqlite3 tree-sitter tree-sitter-go tree-sitter-javascript
   tree-sitter-python tree-sitter-ruby tree-sitter-typescript` in that install root.
   Verify native bindings load from the installed dependency tree.
4. Resolve the installed package.json declared bin target and prove its real path
   is inside the installed package, outside the checkout. Verify installed and
   checkout compiled build receipts are byte-identical.
5. Copy that installed payload into a private synthetic variant, link its
   dependency directory to the installed dependency tree, and append one newline
   to its build receipt. JSON content and version stay identical; the raw receipt
   fingerprint differs. This is a labelled same-version identity fixture, not a
   historical release or a second claimed pristine tarball.
6. Set AGENT_WORKBENCH_TEST_INSTALLED_ENTRYPOINT and
   AGENT_WORKBENCH_TEST_INSTALLED_VARIANT_ENTRYPOINT to those two declared bin
   targets, disable fixture analytics/OTEL, and execute the installed command above
   from this checkout. Invalid explicit targets fail; there is no source fallback.

Validated tarball SHA-256:
`1163f9d41667bb2ef3406d986c662ac99f24c4634cf8e1079b03bc6b0d1075e4`.

Automatic package install scripts were deliberately disabled to avoid changing the
host runtime pointer; only approved native dependencies were rebuilt explicitly.
HOME was not overridden. Fixture installation used the repository-prescribed pnpm
manager. A preliminary npm install failed ERESOLVE on Ruby grammar peer metadata;
B007 owns that separate distribution contract. No peer-bypass flags were used and
this does not claim successful ordinary npm installation or plugin setup.

### Failed checkpoints and corrections

The initial two-worker full run had five timeout failures across two existing
stdio/provider-smoke files. Those same two files passed all 53 cases serially
without changing test timeouts. The final complete suite passed serially as above;
shared-host contention is an inference, not a proven incident cause.

Early installed handoff runs passed 22/23 and exposed real availability defects:
valid live/disappearing lock contention was classified ambiguous, then a closed
endpoint still advertised ready during drain caused ambiguous_process. The fix
classifies only proven contention/absence as wait-only and adds canonical D002
ready-to-draining publication plus strict canonical probe rechecks. Tests retained
the both-successor requirement; final installed acceptance passed all 23 cases.

Independent review also found allocation/registration/delayed-termination races.
Their regressions now pass. A controlled publication fake incorrectly persisted a
build on ID allocation; it now creates builds only at worker invocation, matching
the real store. No production discard fallback was retained.

## Promotion

Durable truth is promoted to runtime operations, runtime contracts, observability
and the Codex operator runbook. The canonical owner map already routes these
concerns to those documents. B002 is delivered in source after the gates above.
The package is retained for audit and later commit/closure reconciliation.

## Residual Risks

Uncatchable death or unavailable storage may lose terminal observations. The
one-second budget is a failure fence, not a hard real-time guarantee during
blocking native work. Linux installed-fixture proof does not establish Windows ACL
privacy or compatibility with every historical launcher.

B006 owns aggregate budgets; B007 owns ordinary npm peer-resolution acceptance;
B008 owns safe abandoned reclaim-guard recovery, currently explicitly blocked;
B009 owns the diagnostic invocation counter boundary. Exact executor assertions
and real child barriers, rather than that counter alone, prove current worker
safety. Spec 065 location/migration remains separate and its files were untouched.

Package lint has no errors. Its canonical-context advisory was reviewed: the
explicit durable baseline, named owners and fixture/source boundaries resolve the
imported-context risk, so no duplicate canonical-context document was created.

Markdown checks covered all 11 task-owned documents with no structural, link or
metadata errors; remaining findings are table-readability style advisories.
The final docs-links-metadata test passed both cases. No unrelated style cleanup
or additional canonical-context artifact was introduced.
