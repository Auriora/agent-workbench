---
title: Rails routing concern identity research
doc_type: spec
artifact_type: research
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Research

## Question

Which Rails routing-concern forms can Agent Workbench support without booting
Rails or adding another Ruby parser path?

## Official behavior

- Rails documents `concern :name do ... end` as a reusable route declaration.
- Rails permits reuse through `concerns :name`, including inside `resources`,
  `scope`, and `namespace`, and permits multiple names.
- `resource` and `resources` accept a `concerns:` option containing one or more
  concern names.
- Rails also accepts callable concern declarations and passes options during
  reuse. Those behaviors depend on Ruby execution and are outside this slice.
- Rails raises for a missing concern at runtime. Agent Workbench does not model
  that runtime failure; it retains an unresolved static reference.

Primary sources:

- Rails routing guide: <https://guides.rubyonrails.org/routing.html>
- Rails API: <https://api.rubyonrails.org/classes/ActionDispatch/Routing/Mapper/Concerns.html>

## Repository cross-check

The current Ruby adapter already represents parser-backed declarations and
references, routes contained in nested call blocks, scoped Rails metadata,
unique resolution, unresolved ambiguity, reference lookup, and bounded impact.
It does not recognize `concern`, `concerns`, or the `concerns:` resource option.

## Accepted slice

- Add a `rails_route_concern` declaration kind with a file-and-source-qualified
  identity and metadata carrying its plain concern name.
- Recognize symbol literals in block declarations, direct reuse calls, literal
  arrays, and resource option values.
- Source contained route references from the concern declaration node.
- Resolve a reuse only when one matching first-party concern node exists.
- Preserve scope metadata but do not evaluate options or clone a route set at
  each reuse site.

## Rejected alternatives

- Rails boot or route-set inspection: executable and environment-dependent.
- Text or regex fallback: conflicts with the single tree-sitter evidence path.
- Reusing documentation-concern storage: that subsystem models document
  quality concerns, not Ruby graph declarations.
- Route cloning at reuse sites: risks false scope composition and is not needed
  for existing graph traversal to explain declaration, reuse, and contained
  route relationships.
