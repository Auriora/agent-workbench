---
title: AWS Datalake Agent Workbench Comparison
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# AWS Datalake Agent Workbench Comparison

This note compares two evaluations against
`/home/bcherrington/Projects/Clients/Co-foundry/aws-datalake`, an AWS SAM,
CloudFormation, Python Lambda, Nuxt, and deployment-runner repository.

The first pass accidentally evaluated the Python Agent IDE runtime more than
the Agent Workbench runtime. It remains useful as a comparison baseline. The
second pass used the direct `mcp__agent_workbench` tools that became available
afterward.

## Evaluation Surface

### Python Agent IDE Baseline

Python Agent IDE surfaces used in the first pass:

- `repo_preflight`
- `context_for_task`
- `repo_safe_search`
- `docs_search`
- `orient_repo`
- `find_symbol`
- `dependency_lookup`
- `verification_plan`
- `diagnostics_for_files`
- `analyze_change_impact`
- resources such as execution context, repo conventions, validation surface,
  MCP surface, docs overview, service map, auth context, usage gaps, and
  capability gaps

Python Agent IDE identified the repo as `aws-iac-python-lambda`, had fresh warm
state, and indexed `config`, `infra`, `tools`, and `tests`.

### Direct Agent Workbench Pass

Direct Agent Workbench tools used in the second pass:

- `context_for_task`
- `symbol_search`
- `find_references`
- `impact`
- `verification_plan`

Agent Workbench resources attempted in the second pass:

- `repo:///status`
- `repo:///scope`
- `repo:///overview`
- `integration:///profiles/codex`

Those resource reads timed out after 120 seconds in this session, while the
direct tools responded quickly. That should be treated as a separate resource
path reliability issue, not as a failure of the direct tool path.

## Agent Workbench Findings

### What Worked

- `symbol_search` was extremely fast. Exact lookup for
  `process_ingest_request` returned the three provider functions in:
  - `infra/sam/ingest-api/src/ingest/providers/iiot_source_mqtt.py`
  - `infra/sam/ingest-api/src/ingest/providers/nimbus_push.py`
  - `infra/sam/ingest-api/src/ingest/providers/weighbridge_transactions.py`
- Generic `handler` lookup returned bounded Python handler symbols quickly,
  including `infra/sam/nimbus-poller/src/nimbus_poller/app.py:function:handler`.
  It still needs better grouping for Lambda-heavy repos, but the raw lookup was
  fast and useful.
- Searching `nimbus_poller` returned a useful mixed set of resources and
  symbols, including:
  - `infra/sam/nimbus-poller/template.yaml`
  - `infra/sam/nimbus-poller/src/nimbus_poller/app.py`
  - `tests/nimbus_poller/test_nimbus_poller_app.py`
  - `tests/infra/test_nimbus_poller_concurrency.py`
  - `tests/scripts/test_nimbus_poller_evidence.py`
  - Nimbus credential config resources
- `context_for_task` with explicit files correctly preserved the requested SAM
  template and Lambda app file, and it found relevant Nimbus tests and shared
  files. This was better than the broad no-file query.
- `find_references` on the Nimbus poller `handler` returned useful outgoing
  parser-backed references inside the Lambda, including:
  - `_parse_manual_poll_request`
  - `_load_runtime_config`
  - `_apply_manual_poll_request`
  - `_apply_runtime_settings`
  - `_safe_normalize_repository_configs`
  - `_rotate_slice`
  - `_filter_manual_repository_configs`
  - `_authenticate`
  - `_ingest_repository`
- `impact` on the Nimbus poller `handler` produced a bounded traversal almost
  instantly. It marked traversal truncation and confidence explicitly, which is
  the right failure discipline for graph-limited evidence.
- Tool outputs consistently used contract metadata, capability levels, evidence
  kinds, truncation flags, and next actions. That makes the surface predictable
  for a coding agent.

### Gaps And Failures

- Agent Workbench resource reads timed out for status, scope, overview, and the
  Codex integration profile. The skill tells agents to read these first, so
  resource reliability is a critical issue.
- The `meta.scope.languages` field in `symbol_search` responses reported only
  `json` and `text` even while returning Python symbols. That is confusing and
  weakens trust in the scope metadata.
- Broad `context_for_task` over-indexed on path terms. For an evaluation query,
  it surfaced CloudFormation files, `.idea` files, `.deploy` logs, and unrelated
  tests instead of Agent Workbench-relevant repo guidance or AWS IaC task
  surfaces.
- `context_for_task` for the Nimbus schedule task only became useful after
  explicit files were supplied. Without file hints, Agent Workbench does not yet
  appear strong enough to infer the SAM template plus handler pair reliably.
- Caller-supplied symbol matching was noisy. Supplying `NimbusPollerFunction`
  and `handler` led to ranked symbols like `AnalyticsApiHandler` and multiple
  `FixedDateTime` test helper classes. That is not useful narrowing.
- `symbol_search` could not find `NimbusPollerFunction`, even though it exists
  as a SAM logical ID in `infra/sam/nimbus-poller/template.yaml`. YAML logical
  IDs are indexed as resources, not symbols with searchable infrastructure
  semantics.
- `impact` on `infra/sam/nimbus-poller/template.yaml` found no edges and
  reported low confidence. That is honest, but it means Agent Workbench does not
  currently understand SAM template relationships such as logical ID to handler
  file, event source, environment variables, policies, or layers.
- `verification_plan` for the Nimbus template and Lambda file was incorrect. It
  suggested unrelated analytics/common pytest files, did not suggest
  `tests/nimbus_poller/test_nimbus_poller_app.py`, did not suggest
  `tests/infra/test_nimbus_poller_concurrency.py`, and did not include any SAM,
  cfn-lint, `poe stack sam validate`, or containerized SAM validation path.
- The direct Agent Workbench surface lacks the richer AWS-aware validation
  synthesis observed in Python Agent IDE. Python Agent IDE identified the
  `NimbusPollerFunction`, schedule event, schedule parameter references, cfn-lint
  path, and missing host SAM CLI. Agent Workbench did not.

## Comparison With Python Agent IDE

Python Agent IDE currently has stronger AWS IaC awareness:

- It classifies the repo as `aws-iac-python-lambda`.
- Its validation surface discovers SAM templates and Lambda counts.
- Its `verification_plan` can infer the Nimbus SAM schedule event and handler
  relationship.
- It reports host SAM CLI availability and cfn-lint options.
- It exposes service maps, auth context, docs maps, repo conventions, and usage
  gaps.

Agent Workbench currently has a simpler and faster bounded graph surface:

- `symbol_search`, `find_references`, and `impact` are fast.
- Outputs are compact enough for an agent to consume.
- Graph traversal is explicit about truncation and confidence.
- Exact Python symbol lookup is good.

The practical split is:

- Use Agent Workbench today for fast exact Python symbol lookup, bounded
  reference traversal, and preview/apply edit workflow.
- Use Python Agent IDE today for AWS-specific repo orientation, docs discovery,
  SAM/Lambda validation planning, dependency context, and runtime/service
  metadata.

For an Agent Workbench coding agent, this comparison shows where Agent
Workbench should catch up so it can become the primary runtime rather than a
thin graph/search surface.

## AWS IaC Recommendations For Agent Workbench

1. Make resource reads reliable before recommending them as first calls.

   The skill's first step depends on `repo:///status`, `repo:///scope`, and
   `repo:///overview`. Those reads timed out after 120 seconds in this session,
   while direct tools were fast. Either fix the resource path or update the
   skill to start with a cheap direct status tool.

2. Add SAM/CloudFormation semantic indexing.

   SAM template resources should expose searchable logical IDs, handler strings,
   event sources, environment references, policies, layers, and resource
   dependencies. `NimbusPollerFunction` should be searchable as an
   infrastructure symbol-like node.

3. Connect SAM templates to Python handlers.

   The graph should connect
   `infra/sam/nimbus-poller/template.yaml` to
   `infra/sam/nimbus-poller/src/nimbus_poller/app.py:function:handler`, plus
   the schedule event and parameters. Template impact should not be an isolated
   zero-edge resource for SAM stacks.

4. Improve validation planning for AWS repos.

   For this repo, Agent Workbench should prefer:
   - `poe stack sam validate`;
   - cfn-lint for touched templates;
   - the project Docker deploy container when host SAM is unavailable;
   - `poe test <family>` where documented;
   - nearest explicit tests before broad `python3 -m pytest`.

5. Fix nearest-test ranking.

   For the Nimbus poller slice, validation should rank:
   - `tests/nimbus_poller/test_nimbus_poller_app.py`
   - `tests/infra/test_nimbus_poller_concurrency.py`
   - `tests/scripts/test_nimbus_poller_evidence.py`
   before analytics API, analytics DB smoke, and unrelated common tests.

6. Add Lambda handler grouping.

   Generic `handler` search should group by SAM stack/service, handler file,
   logical ID, and event source. A flat list is fast but still too noisy for
   Lambda-heavy repos.

7. Improve caller-supplied symbol filtering.

   Supplying `NimbusPollerFunction` and `handler` should not rank unrelated
   `FixedDateTime` test classes. Symbol hints need exact-first matching and
   domain-aware fallback.

8. Correct scope metadata.

   Returning Python symbols while `meta.scope.languages` says only `json` and
   `text` undermines trust. Scope metadata should reflect the languages involved
   in the result or clearly distinguish adapter coverage from returned symbols.

9. Keep the compact graph contract.

   Agent Workbench's direct tools are pleasantly fast and bounded. Preserve
   that shape while adding AWS semantics; avoid growing them into large,
   repeated runtime-health payloads.

## Suggested Fixture Scenarios

- Nimbus poller schedule change:
  - input files: `infra/sam/nimbus-poller/template.yaml`,
    `infra/sam/nimbus-poller/src/nimbus_poller/app.py`;
  - expected graph: template resource to handler function, schedule event,
    schedule expression parameter, nearest Nimbus tests;
  - expected validation: cfn-lint, repo-approved SAM validation path, nearest
    Nimbus pytest files.
- Generic Lambda handler lookup:
  - query: `handler`;
  - expected behavior: grouped by stack/service/logical ID, with handler file
    and event source metadata.
- SAM logical ID lookup:
  - query: `NimbusPollerFunction`;
  - expected behavior: returns the SAM logical ID node and connected handler,
    schedule event, policies, and tests.
- Deployment config family change:
  - query: family-based deploy config for deploy-nimbus or deploy-ops-ui;
  - expected docs and files: deployment configuration architecture, deploy
    config contract, config README, config/ssm family files, and deployment
    test runbook.

## Bottom Line

Direct Agent Workbench is fast and promising for bounded Python graph work, but
it is not yet sufficient as the primary AWS IaC coding-agent runtime for this
repo. The main missing pieces are reliable first-read resources, SAM template
semantics, template-to-handler graph edges, repo-policy-aware validation, and
better nearest-test ranking. Python Agent IDE currently provides the stronger
AWS-aware baseline for those capabilities.
