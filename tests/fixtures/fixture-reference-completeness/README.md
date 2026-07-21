<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Reference Completeness Fixture

This compact fixture models the SessionStart reference-completeness boundary.
Tests place the Codex and Claude hook twins at catalog rows 1 and 2, synthesize
empty rows 3 through 100 in the catalog port, and place the TypeScript consumer
file at row 101. The hook twins contain nine target-identifier occurrences;
the integration-test consumer contains three more.

The `catalog/` files also name the file-atomic boundary cases. Tests provide
their declared size, read failure, missing-file, changed-identity, and policy
classification through deterministic ports, so the repository does not need
one hundred meaningless files or a genuinely huge fixture.
