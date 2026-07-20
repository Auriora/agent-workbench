/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import Database from "better-sqlite3";

// Contract fixture pinned to tag v0.5.2, commit
// 36c3a45cf7eb7501d9cf1a2102d96db5cc020b54. The canonical path comes from
// server.ts blob 10b701ba8a1e2823551f56d85892237e3cb6d10f and the unguarded SQLite open
// sequence comes from graph-store.ts blob 696dc58faf2c9052cba4171e5af11657f69e462c.
export const LEGACY_V052_GRAPH_STORE_FILE_NAME = "graph.sqlite";

export class LegacyV052GraphStoreFixture {
  public readonly db: Database.Database;

  public constructor(repoRoot: string) {
    this.db = new Database(path.join(
      repoRoot,
      ".cache",
      "agent-workbench",
      LEGACY_V052_GRAPH_STORE_FILE_NAME
    ));
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
  }

  public close(): void {
    this.db.close();
  }

}
