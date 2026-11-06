---
title: Sealed native grammar artifacts
doc_type: reference
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Sealed native grammar artifacts

These archives preserve the official npm payloads for `tree-sitter-ruby`
0.23.1 and `tree-sitter-typescript` 0.23.2. The only changed bytes are the
package manifests:

- Ruby is versioned `0.23.1-awb.1` and declares the runtime peer
  `tree-sitter: ^0.25.0`.
- TypeScript is versioned `0.23.2-awb.1`, declares the same runtime peer, and
  requires `tree-sitter-javascript: ^0.25.0`.

The upstream archives, SHA-512 integrity values, member hashes, modes, and
allowed metadata changes are recorded in `manifest.json`. Run
`python3 scripts/native-grammar-artifacts.py --check` before packaging. The
checker rejects changed native/source/license members, unsafe archive paths,
duplicate members, and unrecorded metadata.

Release consumers receive these two project-owned `.tgz` files through
immutable GitHub commit URLs recorded by the release dependency metadata. The
transport is intentionally limited to the two sealed archives; no expanded
grammar payload is vendored and no alternate download or runtime fallback is
supported.

This is a packaging correction owned by platform. The root cause is the
published upstream peer metadata, which still targets the 0.21 runtime while
Agent Workbench uses the 0.25 parser core. No parser implementation or runtime
fallback is introduced. Remove these artifacts when official Ruby and
TypeScript releases publish compatible peer and dependency ranges and the
ordinary npm/native/extraction gates pass without them.

The original packages are MIT-licensed; their license and notice files remain
unchanged inside each archive. These artifacts do not bypass npm peer
resolution, and consumers must install them through ordinary npm semantics.
