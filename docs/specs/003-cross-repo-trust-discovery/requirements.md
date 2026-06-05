---
title: Cross-repo trust and discovery requirements
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Introduction

Dogfood passes against TimeLocker, OneMount, and FreeCAD showed that Agent
Workbench has useful contracts and failure discipline, but first-call trust,
repo-shape discovery, context ranking, and project validation planning still
vary too much across repository types. Those repositories are evidence sources,
not implementation dependencies. This spec turns the findings into generic
Python-service, Go-service, and CMake/C++ repository-shape work.

## Goals

- Make first-touch resource metadata consistent across `repo:///status`,
  `repo:///scope`, and `repo:///overview`.
- Centralize freshness and trust-label presentation helpers so resource output
  stays consistent without duplicating metadata logic.
- Ensure unsupported code languages remain visible under scan budgets.
- Remove non-actionable `next_action` values such as unavailable tools.
- Improve broad and file-seeded context ranking for large mixed repositories.
- Teach validation planning to prefer repository shape over incidental tooling.
- Add first-slice Go and C/C++ identity/symbol support without overstating
  semantic confidence.

## Non-Goals

- Full Go or C/C++ semantic support in one step.
- Executing validation commands by default.
- Adding hidden parser, LSP, diagnostics, or command-execution fallbacks.
- Making external dogfood repositories required automated test dependencies.
- Reopening Spec 001 or Spec 002.

## Requirements

### Requirement 1: Consistent First-Call Trust

**User Story:** As a coding agent, I want status, scope, and overview to agree
on basic freshness, languages, and capability, so that the first resource read
does not undermine later evidence.

#### Acceptance Criteria

1. GIVEN a repository with a fresh snapshot and known language coverage, WHEN
   `repo:///status` is read, THEN it reports compatible freshness and coarse
   language/capability metadata without broad catalog enumeration.
2. GIVEN `repo:///scope` or `repo:///overview` uses snapshot-backed evidence,
   WHEN it builds response metadata, THEN freshness does not report `unknown`
   when status proves a fresh completed warmup for the same repository.
3. IF snapshot or warmup evidence is missing, THEN THE SYSTEM SHALL report a
   structured degraded state rather than unsupported success.

### Requirement 2: Bounded Scope Visibility

**User Story:** As a coding agent, I want unsupported source files to appear in
scope, so that a Go-heavy or C++-heavy repository is not mistaken for a config
repository.

#### Acceptance Criteria

1. GIVEN a repository containing `.go`, `.cpp`, `.h`, or similar source files
   before semantic adapters are mature, WHEN `repo:///scope` runs, THEN it
   reports those language categories with unsupported or partial capability.
2. GIVEN generated or cache roots such as `.gocache`, WHEN scan budgets are
   applied, THEN those roots do not consume source-file discovery budget.
3. IF a row cap truncates scanning, THEN the scope result SHALL expose the
   truncation and preserve representative unsupported source-language coverage.

### Requirement 3: Actionable MCP Workflow Guidance

**User Story:** As a coding agent, I want next actions to name visible public
tools only, so that suggested recovery paths are callable in the active Codex
session.

#### Acceptance Criteria

1. GIVEN any MVP tool response, WHEN it returns `next_actions`, THEN each action
   references a public MCP tool available in the integration profile.
2. IF graph warmup is not exposed as a public tool, THEN no response SHALL
   recommend `prewarm_graph` as an agent action.
3. WHERE Codex tool discovery is limited, THE SYSTEM SHALL either expose
   advertised tools through first-use discovery metadata or avoid recommending
   hidden tools.

### Requirement 4: Better Context Ranking

**User Story:** As a coding agent, I want broad and file-seeded context to rank
implementation evidence above noisy repository artifacts, so that I can start
large-repo work with fewer manual searches.

#### Acceptance Criteria

1. GIVEN a broad implementation task, WHEN `context_for_task` ranks files, THEN
   generated data, third-party vendored docs, installer docs, and fixture blobs
   are downranked unless named by the prompt.
2. GIVEN explicit files, WHEN `context_for_task` ranks context, THEN adjacent
   source/header files, local build files, and nearby tests rank ahead of broad
   repository matches.
3. WHERE candidates are selected by weak path-term evidence only, THE SYSTEM
   SHALL include a compact confidence reason.

### Requirement 5: Repository-Shape Validation Planning

**User Story:** As a coding agent, I want validation planning to recognize the
main project system, so that incidental `package.json` files do not dominate
Go, CMake, or Docker-backed repositories.

#### Acceptance Criteria

1. GIVEN a Go repository with `go.mod`, `Makefile`, Docker test config, or
   repository-specific test conventions, WHEN `verification_plan` runs, THEN it
   returns planned or blocked Go validation evidence instead of zero commands.
2. GIVEN a CMake/C++ repository with root or local `CMakeLists.txt`, WHEN
   `verification_plan` runs, THEN CMake/build/test evidence outranks incidental
   Node commands.
3. IF a validation command cannot be proven runnable, THEN THE SYSTEM SHALL
   return a blocked or planned entry with the evidence that informed it.

### Requirement 6: First-Slice Go Identity And Symbols

**User Story:** As a coding agent, I want Go files and basic declarations to be
visible, so that Go repositories have useful routing evidence before full
semantic support exists.

#### Acceptance Criteria

1. GIVEN `.go` files, WHEN the repo is indexed, THEN files classify as Go and
   scope reports Go coverage.
2. GIVEN package-level Go declarations, WHEN symbol extraction runs, THEN
   packages, functions, types, methods, and `main` are available as routing
   symbols with honest capability labels.
3. IF references or impact are not parser-backed, THEN THE SYSTEM SHALL keep
   reference and impact confidence low and explain missing evidence.

### Requirement 7: First-Slice C/C++ Identity And Symbols

**User Story:** As a coding agent, I want C/C++ files and basic declarations to
be visible, so that large C++ repositories are useful for routing before full
semantic support exists.

#### Acceptance Criteria

1. GIVEN C/C++ source and header extensions, WHEN the repo is indexed, THEN
   files classify as C or C++ rather than text.
2. GIVEN `.pyi` stub files, WHEN the repo is indexed, THEN they classify with
   Python-like routing evidence rather than generic text.
3. GIVEN C/C++ declarations, includes, and CMake target membership, WHEN
   context or symbol search runs, THEN those records are available as
   resource-backed or partial-semantic routing evidence.

## Correctness Properties

- No resource claims stronger freshness or capability than its evidence allows.
- Unsupported language visibility never implies semantic support.
- Next actions never reference non-public or undiscoverable tools.
- Scan-budget changes do not index generated/cache roots as source evidence.
- Project-shape validation plans separate proven commands from blocked or
  inferred evidence.
- Go and C/C++ first slices produce routing evidence only until promotion
  fixtures prove references, impact, and validation confidence.

## Success Criteria

- TimeLocker-style status/scope/overview trust labels align on fresh warmups.
- Go-service scope reports Go coverage and skips `.gocache`.
- CMake/C++ status does not look fully unsupported when scope identifies C/C++
  and Python-stub coverage.
- CMake/C++ validation planning does not prioritize incidental Node commands
  over CMake evidence.
- MCP next actions contain only callable public tool names in Codex.
