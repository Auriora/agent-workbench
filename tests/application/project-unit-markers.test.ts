/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { recognizeProjectUnitMarkers } from "../../src/application/use-cases/project-unit-markers.js";
import type { FileCatalogEntry } from "../../src/domain/models/index.js";

describe("project-unit marker recognition", () => {
  it("recognizes only the explicit manifest set with provenance", () => {
    const result = recognizeProjectUnitMarkers({
      files: [entry("dotnet/App.csproj"), entry("java/pom.xml"), entry("rust/Cargo.toml"), entry("other/project.gradle")]
    });

    expect(result.candidates).toEqual([
      { root: "dotnet", kind: "dotnet", markers: [{ path: "dotnet/App.csproj", kind: "csproj", evidence_source: "manifest" }] },
      { root: "java", kind: "maven", markers: [{ path: "java/pom.xml", kind: "pom_xml", evidence_source: "manifest" }] },
      { root: "rust", kind: "cargo", markers: [{ path: "rust/Cargo.toml", kind: "cargo_toml", evidence_source: "manifest" }] }
    ]);
  });

  it("admits an extensionless script only from positive bounded guidance", () => {
    const result = recognizeProjectUnitMarkers({
      files: [entry("scripts/validate"), entry("scripts/build")],
      script_guidance: [{
        script_path: "scripts/validate",
        evidence_path: "docs/validation-protocol.md",
        evidence_source: "validation_protocol",
        purpose: "Run repository validation checks"
      }]
    });

    expect(result.candidates).toEqual([{
      root: "scripts",
      kind: "repository_script",
      markers: [{
        path: "scripts/validate",
        kind: "extensionless_script",
        evidence_source: "validation_protocol",
        evidence_path: "docs/validation-protocol.md"
      }]
    }]);
  });

  it("does not infer script markers from basename, shebang, or executable-like catalog evidence", () => {
    const result = recognizeProjectUnitMarkers({ files: [entry("build"), entry("scripts/test"), entry("scripts/check")] });
    expect(result.candidates).toEqual([]);
  });

  it.each(["unreadable", "oversized", "malformed", "conflicting"] as const)(
    "reports %s guidance without admitting a replacement marker",
    (state) => {
      const result = recognizeProjectUnitMarkers({
        files: [entry("scripts/validate")],
        script_guidance: [{
          script_path: "scripts/validate",
          evidence_path: "docs/testing.md",
          evidence_source: "repository_guidance",
          purpose: "validate the project",
          state
        }]
      });
      expect(result.candidates).toEqual([]);
      expect(result.limitations[0]?.kind).toBe(`guidance_${state === "conflicting" ? "conflict" : state}`);
    }
  );

  it("rejects missing-purpose, missing-file, and non-extensionless guidance", () => {
    const result = recognizeProjectUnitMarkers({
      files: [entry("scripts/validate"), entry("scripts/validate.sh")],
      script_guidance: [
        { script_path: "scripts/validate", evidence_path: "AGENTS.md", evidence_source: "repository_guidance", purpose: "use this helper" },
        { script_path: "scripts/missing", evidence_path: "AGENTS.md", evidence_source: "repository_guidance", purpose: "run validation" },
        { script_path: "scripts/validate.sh", evidence_path: "AGENTS.md", evidence_source: "repository_guidance", purpose: "run validation" }
      ]
    });
    expect(result.candidates).toEqual([]);
    expect(result.limitations.map((item) => item.kind)).toEqual([
      "guidance_purpose_missing",
      "script_not_found",
      "script_not_extensionless"
    ]);
  });

  it("is deterministic, bounded, and blocks contradictory positive evidence", () => {
    const files = [entry("a/A.csproj"), entry("b/B.csproj"), entry("scripts/validate")];
    const guidance = [
      { script_path: "scripts/validate", evidence_path: "AGENTS.md", evidence_source: "repository_guidance" as const, purpose: "run validation" },
      { script_path: "scripts/validate", evidence_path: "docs/testing.md", evidence_source: "validation_protocol" as const, purpose: "run tests" }
    ];
    const first = recognizeProjectUnitMarkers({ files, script_guidance: guidance, max_markers: 1 });
    const second = recognizeProjectUnitMarkers({ files: [...files].reverse(), script_guidance: [...guidance].reverse(), max_markers: 1 });
    expect(second).toEqual(first);
    expect(first.candidates).toHaveLength(1);
    expect(first.limitations.map((item) => item.kind)).toEqual(["guidance_conflict", "marker_cap_exceeded"]);
  });
});

function entry(filePath: string): FileCatalogEntry {
  return {
    path: filePath,
    indexed: true,
    file_identity: {
      path: filePath,
      language: "text",
      content_hash: `hash:${filePath}`,
      size_bytes: 1,
      mtime_ms: 1
    }
  };
}
