import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openGraphStore, SCHEMA_VERSION } from "../../src/graph/store.js";

describe("graph store", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-db-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates and validates the MVP schema", () => {
    const store = openGraphStore(path.join(dir, "index.sqlite"));
    try {
      expect(store.validateSchema()).toBe(true);
      const migration = store.db
        .prepare("SELECT version FROM schema_migrations WHERE version = ?")
        .get(SCHEMA_VERSION);
      expect(migration).toEqual({ version: SCHEMA_VERSION });
    } finally {
      store.close();
    }
  });
});
