/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace change queue graph guard", () => {
  it("does not introduce a parallel per-file graph, docs, or catalog mutation path", () => {
    const source = fs.readFileSync(
      path.resolve("src/application/use-cases/process-workspace-change-queue.ts"),
      "utf8"
    );

    expect(source).not.toContain("GraphWritePort");
    expect(source).not.toContain("DocsIndexPort");
    expect(source).not.toContain("FileCatalogPort");
    expect(source).not.toContain("clearFile(");
    expect(source).not.toContain("removeEntry(");
    expect(source).not.toContain("replaceSnapshotExtraction(");
    expect(source).not.toContain("insertEdges(");
    expect(source).not.toContain("replaceSnapshotDocs(");
  });
});
