/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  SnapshotValidityService,
  validateSnapshotPaths
} from "../../src/application/use-cases/validate-snapshot-paths.js";
import type { FileCatalogEntry } from "../../src/domain/models/index.js";
import type { SnapshotState } from "../../src/domain/models/runtime.js";
import type {
  FileCatalogPort,
  SnapshotPathValidationOutcome,
  SnapshotPathValidationPort
} from "../../src/ports/index.js";

describe("snapshot path validity", () => {
  it("returns valid only for complete present evidence", async () => {
    const result = await validateSnapshotPaths({
      snapshot: snapshot(),
      catalog: catalog([entry("src/app.ts")]),
      path_validation: validator([{ path: "src/app.ts", status: "present" }]),
      max_paths: 5
    });

    expect(result).toMatchObject({
      state: "valid",
      complete: true,
      checked_path_count: 1,
      observed_path_count: 1,
      refresh_required: false
    });
  });

  it("classifies missing paths as stale and refresh-required", async () => {
    const result = await validateSnapshotPaths({
      snapshot: snapshot(),
      catalog: catalog([entry("src/deleted.ts")]),
      path_validation: validator([{ path: "src/deleted.ts", status: "missing" }]),
      max_paths: 5
    });

    expect(result).toMatchObject({
      state: "stale",
      complete: true,
      missing_paths: ["src/deleted.ts"],
      refresh_required: true
    });
  });

  it("reports repository-relative evidence without exposing outside absolute paths", async () => {
    const result = await validateSnapshotPaths({
      snapshot: snapshot(),
      catalog: catalog([entry("/repo/src/deleted.ts"), entry("/outside/private.ts")]),
      path_validation: validator([
        { path: "/repo/src/deleted.ts", status: "missing" },
        { path: "/outside/private.ts", status: "missing" }
      ]),
      max_paths: 5
    });

    expect(result.missing_paths).toEqual([
      "<outside-repository-path>",
      "src/deleted.ts"
    ]);
    expect(JSON.stringify(result)).not.toContain("/outside/private.ts");
    expect(JSON.stringify(result)).not.toContain("/repo/src/deleted.ts");
  });

  it("includes docs-index-only paths in the authoritative inventory", async () => {
    const service = new SnapshotValidityService(
      catalog([]),
      validator([{ path: "docs/deleted.md", status: "missing" }]),
      { listIndexedPaths: async () => ["docs/deleted.md"] }
    );

    await expect(service.validate({ snapshot: snapshot(), max_paths: 5 })).resolves.toMatchObject({
      state: "stale",
      missing_paths: ["docs/deleted.md"],
      observed_path_count: 1,
      refresh_required: true
    });
  });

  it.each([
    {
      label: "inaccessible path",
      files: [entry("src/private.ts")],
      outcomes: [{ path: "src/private.ts", status: "inaccessible" as const }],
      maxPaths: 5
    },
    {
      label: "budget exhaustion",
      files: [entry("a.ts"), entry("b.ts")],
      outcomes: [{ path: "a.ts", status: "present" as const }],
      maxPaths: 1
    }
  ])("returns degraded rather than fresh for $label", async ({ files, outcomes, maxPaths }) => {
    const result = await validateSnapshotPaths({
      snapshot: snapshot(),
      catalog: catalog(files),
      path_validation: validator(outcomes),
      max_paths: maxPaths
    });

    expect(result.state).toBe("degraded");
    expect(result.refresh_required).toBe(false);
    expect(result.state).not.toBe("valid");
  });
});

function snapshot(): SnapshotState {
  return {
    id: "snapshot-1",
    repo_root: "/repo",
    workspace_root: "/repo",
    repo_identity: "/repo",
    config_identity: "default",
    schema_version: 1,
    freshness: "fresh",
    owner_state: "owner",
    created_at: "2026-07-19T00:00:00.000Z",
    updated_at: "2026-07-19T00:00:00.000Z"
  };
}

function entry(path: string): FileCatalogEntry {
  return {
    path,
    file_identity: {
      path,
      language: "typescript",
      content_hash: `sha256:${path}`,
      size_bytes: 1,
      mtime_ms: 1
    },
    indexed: true
  };
}

function catalog(files: readonly FileCatalogEntry[]): FileCatalogPort {
  return {
    listFiles: async ({ max_rows }) => files.slice(0, max_rows),
    getFile: async ({ path }) => files.find((file) => file.path === path) ?? null,
    upsertEntry: async () => undefined,
    removeEntry: async () => undefined
  };
}

function validator(outcomes: readonly SnapshotPathValidationOutcome[]): SnapshotPathValidationPort {
  return {
    validatePaths: async ({ paths }) => outcomes.filter((outcome) => paths.includes(outcome.path))
  };
}
