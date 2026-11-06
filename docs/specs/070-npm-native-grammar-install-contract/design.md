---
title: Native grammar npm installation design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Correct packaging at the dependency boundary, then use existing release tools.
A bounded design exploration compares canonical packaging of exact upstream
native grammars with reviewed metadata corrections against alternatives. No
implementation or public release proceeds from an unverified resolution plan.

## High-Level Design

One native parser core remains authoritative. The failure is published optional
peer metadata, not a parser-load failure. Current npm registry releases remain
Ruby0.23.1/TypeScript0.23.2 with 0.21 peers, while Python/Go/JavaScript require0.25.
No downgrade, peer bypass, hidden fallback or unreviewed replacement grammar.
The chosen correction, exact delta and removal criteria must be recorded here
before production edits; scratch fixtures may establish feasibility first.

## Low-Level Design

### D001: Governed metadata-only native grammar artifacts

Use two deterministic sealed source tarballs under
packaging/agent-workbench/native-grammars. Preserve every exact upstream npm
payload member and its bytes except package.json. Label corrected versions
0.23.1-awb.1 (Ruby) and 0.23.2-awb.1 (TypeScript). Ruby's runtime peer becomes
^0.25.0; TypeScript's runtime peer and JavaScript dependency become ^0.25.0.
The latter removes the transitive old JavaScript peer conflict. Native binding
builds consume checked-in generated C/C++ and never regenerate grammar source;
no parser/source/query/native binary or extraction implementation is changed.

A provenance manifest pins official npm URLs and source SHA-512, original member
hashes, exact allowed JSON field changes and final archive identity. A deterministic
standard-library Python rebuild/check command rejects unlisted members, changed
native/source/license bytes, non-regular unsafe archive entries and unauthorized
manifest changes. Root package dependencies use D002 immutable commit URLs for these exact artifacts;
the npm files allowlist also includes their provenance copies. Consumers install through ordinary npm,
with npm ls clean and no resolution flags, patches or overrides required.

Why temporary: the official current Ruby/TypeScript releases retain 0.21 peer
metadata despite the accepted 0.25 runtime path. There is no corrected official
release. Source/native fixture proof and an isolated scratch ordinary npm/native
experiment support this exact correction. Root cause remains upstream published
metadata; platform owns these sealed artifacts, not a new grammar implementation.
Remove the correction when official releases declare compatible runtime and
JavaScript dependencies and ordinary npm/native/extraction gates pass without
local artifacts. Do not add a registry-plus-local fallback path.

Rejected alternatives: runtime downgrade conflicts with accepted 0.25 grammars;
peer bypass/consumer overrides hide the failed contract; an independently
maintained parser fork introduces unnecessary source divergence; a nested unused
old runtime adds unnecessary native execution dependencies. The first consumer fixture disproved transitive file-tarball references inside
the outer package: npm resolved them relative to the consumer prefix and failed.
A directory-reference prototype installed but npm ls rejected its link metadata.
Neither local-reference route is an accepted consumer contract.

### D002: Immutable project-owned artifact transport

Publish the reviewed sealed artifacts in a preparation source commit A on the
existing public Auriora/agent-workbench repository's release/v0.6.10 branch.
Point both root dependency declarations at anonymous HTTPS URLs of the form
https://raw.githubusercontent.com/Auriora/agent-workbench/<full-40-hex-A>/packaging/agent-workbench/native-grammars/<sealed-name>.tgz.
The final release commit B must descend from A. Lockfile integrity and the offline
checker bind the exact artifact bytes; an anonymous fetch must match sealed SHA.
Use this one URL route in development and consumer installs, without registry or
local fallbacks, consumer overrides, dependency patch hooks, a new external fork,
or mutation of generated grammar/native code. Copying the archives into the
outer payload provides provenance, not an alternate dependency transport.

This source-preparation push is not a public release or asset publication. Do
not tag or publish until ordinary anonymous npm installation, clean npm ls,
exact native fixtures, installed entrypoint and platform gates pass. The final
published application manifest must preserve the exact full-SHA URLs. GitHub
availability/HTTPS are part of dependency delivery, as with existing release
asset download; the commit pins content rather than a movable branch/tag.

### Validation

Ordinary isolated npm install and npm ls must succeed. Verify canonical core0.25
parses Ruby, TypeScript, TSX, JavaScript, Python and Go and load better-sqlite3.
Run actual extraction/semantic fixtures to guard accepted grammar behavior.
Inspect and tamper provenance fixtures; package payload checks require both local
archives. Rebuild lockfile with pnpm using approved native build scripts.

## Operational Considerations

Release metadata uses awb release bump-version; the final candidate is v0.6.11. Reviewed notes derive
from v0.6.9..HEAD evidence, including final dependency fix. Build and publish via the existing
annotated tag workflow after exact commit preflight. D003 governs resumption
of its final creation step when verified artifacts already exist. Preserve unrelated
untracked files using an isolated clean release worktree, not force/dirty-tag
bypasses. Verify Windows portable preflight before publication; then verify
GitHub asset hashes and install from the published source tarball. Retain B008's
fail-closed limitation in release/operator guidance. No destructive guard cleanup.

### D003: Resume final publication of retained verified artifacts

The v0.6.11 run passed package, portable, GHCR and ZIP attestation gates, but
final release creation rejected a CRLF sidecar filename because Bash retained
its carriage return. Artifact bytes, tag and published image are valid. Repair
the canonical checksum validator with LF/CRLF and malformed-input fixtures.
Complete only the final creation step using the same run's exact retained assets
and rendered notes after source/compiled hashes, signed provenance, filename,
digest, immutable tag and GHCR revision are independently verified. Confirm the
public release is absent and use gh release create --verify-tag once. Verify
all public asset hashes afterward. This resumes the governed publication step;
there is no new build or alternate installed runtime path. Durable procedure:
packaging/agent-workbench/README.md, Windows portable artifact section.

## Open Questions

D001 is fixed after a scratch ordinary npm install/npm ls and native grammar
experiment passed. Production artifact generation and final acceptance remain
T001 evidence obligations. No blocking product decision remains.
