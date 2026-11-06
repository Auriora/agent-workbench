---
title: MCP transport failure containment verification
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

| ID | Check | Required evidence |
| --- | --- | --- |
| V001 | Bridge lifecycle regressions | EPIPE, stdout close, stderr failure, terminal races and listener cleanup |
| V002 | Frame boundary regressions | Handshake/MCP exact bounds, split/coalesced frames, CRLF, UTF-8 and initial remainder |
| V003 | Send settlement regressions | Drain, error, close, local close and repeated-send listener counts |
| V004 | Integration and build | pnpm typecheck; pnpm test; pnpm validate:plugin; built-runtime fixture smoke |
| V005 | Governance and review | Lifecycle lint, Markdown/link checks, diff check and independent review |

## Evidence Log

Executed on 2026-11-06:

- V001: `pnpm exec vitest run tests/mcp/stdio-bridge-session.test.ts` passed
  16 tests, including pending stdout EPIPE after manual session completion,
  delayed stderr failure, caller-stream preservation and quiet late errors.
- V002/V003: `pnpm exec vitest run tests/mcp/socket-transport.test.ts
  tests/mcp/daemon-launch.test.ts` passed 65 tests. Coverage includes exact/+1
  handshake/MCP limits, CRLF, UTF-8 splits, coalesced/remainder admission,
  healthy client after rejection, throwing callbacks and send settlement.
- V001/V003 architecture regression: the combined bridge, socket and stdio
  import-boundary run passed 26 tests before the final additional stdout race
  test (which separately passed). No unhandled errors remained.
- V004: `pnpm typecheck`, `pnpm validate:plugin`, `pnpm check:contracts`,
  `pnpm build-runtime` and `pnpm build-runtime:check` passed.
- V004: `node scripts/ci/mcp-launch-smoke.mjs` passed on Linux using the
  compiled checkout runtime and an isolated fixture, including initialize
  and daemon health. It did not update a live/global installation.
- V004: implementation full run `pnpm test --maxWorkers=2` executed all 133 test files:
  132 files / 1414 tests passed; one documentation metadata test failed solely
  on the pre-existing untracked release-note draft named below. All transport,
  daemon integration and newly added regressions passed. This is not a green
  full-suite result; T004 remains partial until the unrelated metadata failure
  is resolved by that draft's owner.
- V005: manual reviewer `/root/transport_review` reviewed
  `src/mcp/stdio-launch.ts`, `src/mcp/socket-transport.ts`, daemon handshake
  changes and their tests on 2026-11-06; no correctness blockers remained. Its last
  suggested regression (stdout failure after completion) was added and passes.
  Earlier review findings about diagnostic races, callback containment,
  fragment overhead and send listeners were resolved and revalidated.
- V005: lifecycle lint reports zero errors and one canonical-context advisory.
  Direct local authorities were reviewed; design.md records why importing
  duplicate canonical context is unnecessary. Markdown checks examined all
  nine new/changed docs; findings were table readability/style advisories,
  with no structural/link errors in new spec files. Seven new Markdown link
  targets were checked directly and exist. Backlog MCP reports all five new
  records with planning_state valid. `git diff --check` passed.

The first full run found two transport-test expectations/races, which were
fixed, plus the unrelated untracked
`docs/release-notes/v0.1.1-agent-instructions.md` lacking required frontmatter.
That draft predates this task and was preserved. Initial passing unit counts
alone were not treated as full validation. No installed-runtime update is
claimed.

## Residual Risks

B001/B002 remain accepted backlog work. Spec 065 remains separately active.
No incident cause, package publication, install or closure commit is claimed.

## Delivery state

Source implementation, durable promotion, backlog routing and independent
review are complete. The package remains active: T004's full-suite gate is
partial because the existing untracked release-note draft lacks frontmatter.
No closure/archive or commit metadata is fabricated; no global runtime was
installed or published.

## Mixture of experts review

Reviewed on 2026-11-06 before the scoped commit. Evidence window: unstaged
tracked changes against HEAD plus the named new Spec 066 package, transport
contract and socket tests. It covers the three MCP source modules, two contract
modules, four MCP test files, four durable documents and this five-artifact
package. Untracked release-note drafts and Spec 065 are excluded from commit
and review except for the recorded validation limitation and ownership route.
No history, deployment or live-endpoint audit was performed.

Three fresh, independent read-only experts reviewed code architecture,
requirements/specification and QA, and security/operations. The parent
separately checked documentation authority, lifecycle state and commit scope.
Reviewers received raw paths/diffs rather than one another's conclusions.

- Source commit gate: **Ready with warnings** after the dispositions below.
- Full-suite and spec closure gates: **Not ready**; T004 remains partial.
- Release/install gate: **Not ready for a release claim**; the full-suite gate
  is not green and checkout smoke is not installed-runtime acceptance.
- No unresolved blocker or material reviewer disagreement was identified for
  the scoped source commit.

### W1: Aggregate daemon admission remains unbounded (warning, routed)

Observed: `src/mcp/daemon.ts:199` retains admitted sockets, while the 64-client
limit at `src/mcp/daemon.ts:352` applies to pending sockets. Each transport can
retain up to one near-limit partial frame in
`src/mcp/socket-transport.ts:151`. The threat model treats MCP clients as
potentially adversarial (`docs/security/threat-model.md:38`).

Inference/consequence: per-frame bounds do not establish an aggregate memory
or request-work budget across sessions; saturation could affect other clients.
No resource-exhaustion experiment was conducted, so no particular OOM or latency
threshold is claimed. Confidence is high on the missing admission bound and
medium on environment-specific impact.

Remedy/disposition: accepted P1 follow-up B006 in `docs/backlog/README.md` owns
session, retained-input and in-flight request/work budgets, partial-frame
inactivity design and saturation fixtures with an already-connected healthy
client. It is explicitly deferred from this repair and must be assessed before
release; it is not represented as implemented or as an incident root cause.

### S1/S2: Strengthen byte and cleanup proof (suggestions, resolved)

Observed: earlier UTF-8 tests asserted only method names, and the overflow
cleanup test rejected input before retaining blocks. Requirement 2 requires
byte-exact parsing and retained-fragment cleanup. A regression corrupting text
or leaving a partial block could therefore have escaped those assertions.

The scoped test update now asserts decoded euro text in initial/split frames,
exact/+1 UTF-8/CRLF byte limits including CR, and clearing of an already-filled
64 KiB block plus a partial block. `pnpm exec vitest run
tests/mcp/socket-transport.test.ts` passed 10 tests and `pnpm typecheck` passed.
No production-source change was needed for these suggestions.

Post-review validation: `pnpm exec vitest run
 tests/mcp/stdio-bridge-session.test.ts tests/mcp/socket-transport.test.ts
 tests/mcp/daemon-launch.test.ts
 tests/architecture/stdio-bridge-import-boundary.test.ts` passed all 86 tests
across four files with no unhandled errors. The latest `pnpm typecheck` passed.
The earlier full-suite result remains separately recorded; these focused
checks do not relabel that run as green.

### Documentation and evidence dispositions

- Relabeled the spec table as the pre-repair intake baseline so old defects are
  not presented as current source behavior.
- Removed the new backlog hyperlink to excluded, untracked Spec 065; its plain
  ownership reference remains. Six added local link targets resolve within
  the intended commit scope.
- Traceability now explicitly records complete delivery for Requirements 1-3
  and partial-blocking coverage for Requirement 4 at T004. This clarification
  does not waive the failing full-suite gate.
- The pre-existing untracked release-note draft's missing frontmatter remains
  outside this slice. It is not counted as a transport regression or silently
  repaired, and no green full-suite, installed-runtime or closure claim is made.
