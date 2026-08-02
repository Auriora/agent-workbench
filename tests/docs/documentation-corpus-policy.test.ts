/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import {
  classifyDocumentationCorpusPath,
  DOCUMENTATION_CORPUS_POLICY_VERSION,
  partitionDocumentationCorpusPaths
} from "../../src/domain/policies/index.js";

describe("documentation corpus policy", () => {
  it("accepts canonical root-relative production documentation paths", () => {
    expect(classifyDocumentationCorpusPath("README.md")).toEqual({
      relativePath: "README.md",
      status: "eligible"
    });
    expect(classifyDocumentationCorpusPath("docs/design/runtime-architecture.md")).toEqual({
      relativePath: "docs/design/runtime-architecture.md",
      status: "eligible"
    });
    expect(classifyDocumentationCorpusPath("tests/fixtures/README.md")).toEqual({
      relativePath: "tests/fixtures/README.md",
      status: "eligible"
    });
  });

  it("excludes markdown below embedded fixture roots by structural segments", () => {
    expect(classifyDocumentationCorpusPath("tests/fixtures/fixture-docs-repo/README.md")).toEqual({
      relativePath: "tests/fixtures/fixture-docs-repo/README.md",
      reason: "embedded_fixture",
      status: "excluded"
    });
    expect(classifyDocumentationCorpusPath("tests/fixtures/fixture-docs-repo/docs/guide.md")).toEqual({
      relativePath: "tests/fixtures/fixture-docs-repo/docs/guide.md",
      reason: "embedded_fixture",
      status: "excluded"
    });
    expect(classifyDocumentationCorpusPath("tests/fixtures/fixture-docs-repo/README.MD")).toEqual({
      relativePath: "tests/fixtures/fixture-docs-repo/README.MD",
      reason: "embedded_fixture",
      status: "excluded"
    });
    expect(classifyDocumentationCorpusPath("README.md")).toEqual({
      relativePath: "README.md",
      status: "eligible"
    });
    expect(classifyDocumentationCorpusPath("docs/guide.md")).toEqual({
      relativePath: "docs/guide.md",
      status: "eligible"
    });
  });

  it("rejects non-canonical repo-relative paths", () => {
    for (const relativePath of [
      "",
      ".",
      "..",
      "/absolute.md",
      "C:/repo/docs/guide.md",
      "docs\\\\guide.md",
      "docs//guide.md",
      "./docs/guide.md",
      "docs/./guide.md",
      "docs/../guide.md"
    ]) {
      expect(() => classifyDocumentationCorpusPath(relativePath)).toThrowError(
        /Invalid documentation-corpus path/
      );
    }
  });

  it("returns a deterministic markdown receipt and sorted partitions", () => {
    const partition = partitionDocumentationCorpusPaths([
      "src/runtime.ts",
      "tests/fixtures/fixture-docs-repo/docs/b.md",
      "docs/z-guide.md",
      "README.md",
      "tests/fixtures/README.md",
      "tests/fixtures/fixture-docs-repo/README.md",
      "docs/a-guide.md"
    ]);

    expect(partition).toEqual({
      policy_version: DOCUMENTATION_CORPUS_POLICY_VERSION,
      discovered_markdown_files: 6,
      eligible_markdown_files: 4,
      excluded_markdown_files: 2,
      exclusions: [
        {
          reason: "embedded_fixture",
          count: 2
        }
      ],
      decisions: [
        { relativePath: "README.md", status: "eligible" },
        { relativePath: "docs/a-guide.md", status: "eligible" },
        { relativePath: "docs/z-guide.md", status: "eligible" },
        { relativePath: "src/runtime.ts", status: "eligible" },
        { relativePath: "tests/fixtures/README.md", status: "eligible" },
        {
          relativePath: "tests/fixtures/fixture-docs-repo/README.md",
          reason: "embedded_fixture",
          status: "excluded"
        },
        {
          relativePath: "tests/fixtures/fixture-docs-repo/docs/b.md",
          reason: "embedded_fixture",
          status: "excluded"
        }
      ],
      eligible_markdown_paths: [
        "README.md",
        "docs/a-guide.md",
        "docs/z-guide.md",
        "tests/fixtures/README.md"
      ],
      excluded_markdown_paths: [
        "tests/fixtures/fixture-docs-repo/README.md",
        "tests/fixtures/fixture-docs-repo/docs/b.md"
      ]
    });
  });
});
