---
title: Agent Workbench cross-repo smoke - 2026-06-06
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-06
---

# Agent Workbench Cross-Repo Smoke - 2026-06-06

## Scope

The smoke pass exercised Agent Workbench first-pass context and validation
planning across eight local repositories:

- `/home/bcherrington/Projects/Auriora/TimeLocker`
- `/home/bcherrington/Projects/Clients/Co-foundry/aws-datalake`
- `/home/bcherrington/Projects/CLion/FreeCAD`
- `/home/bcherrington/Projects/Webstorm/LibreChat`
- `/home/bcherrington/Projects/Auriora/OneMount`
- `/home/bcherrington/Projects/Clients/Modena AEC/One-Register-Web-Application`
- `/home/bcherrington/Projects/Clients/Modena AEC/XRPPOC`
- `/home/bcherrington/Projects/CLion/CrealityPrint`

The first pass used `pnpm debug:sample-smoke -- --context` to run `status`,
`scope`, `overview`, and `context` for each repository. A second pass ran
`verification` for each repository with a 20-second timeout.

## Results

All eight repositories returned valid `status`, `scope`, `overview`, and
`context` envelopes. The saved raw report is local generated evidence under
`.tmp/sample-smoke/`.

All eight `verification` runs returned inside the 20-second timeout:

| Repository | Result | Planned validation |
| --- | --- | --- |
| TimeLocker | planned | `python3 -m pytest`, docs/config review |
| aws-datalake | planned | `cfn-lint`, `sam validate`, infra pytest |
| FreeCAD | planned | CMake configure/build, CTest, docs/config review |
| LibreChat | planned | package-local npm tests/typecheck plus root lint |
| OneMount | blocked | Docker-required repo guidance blocks generic host Go commands |
| One-Register-Web-Application | planned | .NET project and solution builds, docs/config review |
| XRPPOC | planned | .NET project and solution builds, docs/config review |
| CrealityPrint | planned | CMake configure/build, CTest, docs/config review |

The hosted MCP `mcp__agent_workbench.verification_plan` surface was also
spot-checked against LibreChat. It returned in 0.43s and produced the same
package-manager-aware validation plan shape.

## Notes

- The earlier LibreChat unreadable `data-node` failure was not reproduced.
  `data-node` is now reported as a `gitignore` skipped path.
- Large CMake/C++ repositories returned truncated metadata because of the
  2,000-row catalog budget, but still produced bounded planned validation.
- OneMount correctly returned a blocked validation state because local
  `AGENTS.md` guidance requires Docker-based validation.
- No verification command was executed by Agent Workbench; all commands were
  planned only.

## Follow-Up

- Add a reusable summary output mode for the smoke harness so future runs do
  not require manually extracting compact results from large envelopes.
- Keep watching first-call `verification_plan` latency on cold or large repos;
  this run did not reproduce a timeout.
