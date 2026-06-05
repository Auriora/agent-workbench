import path from "node:path";
import { describe, expect, it } from "vitest";
import { diagnoseChangedFiles } from "../../src/application/use-cases/diagnose-changed-files.js";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";
import type { DiagnosticsProviderPort } from "../../src/ports/index.js";
import {
  buildDiagnosticsForFilesEnvelope,
  buildInvalidDiagnosticsForFilesInputEnvelope
} from "../../src/presentation/diagnostics-presenter.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-diagnostics-feedback");

const jsonDiagnosticsProvider: DiagnosticsProviderPort = {
  provider_id: "json-syntax",
  supports(input) {
    return input.language === "json";
  },
  async diagnose(input) {
    if (input.file.path === "bad.json") {
      return {
        statuses: [
          {
            provider_id: "json-syntax",
            path: input.file.path,
            status: "checked",
            capability_level: "resource_backed",
            evidence_kinds: ["config"]
          }
        ],
        findings: [
          {
            path: input.file.path,
            severity: "blocker",
            message: "JSON syntax is incomplete.",
            category: "syntax",
            provider_id: "json-syntax",
            capability_level: "resource_backed",
            evidence_kinds: ["config"],
            blocking: true,
            fix_hint: "Complete the JSON value."
          }
        ]
      };
    }
    return {
      statuses: [
        {
          provider_id: "json-syntax",
          path: input.file.path,
          status: "clean",
          capability_level: "resource_backed",
          evidence_kinds: ["config"]
        }
      ],
      findings: []
    };
  }
};

const markdownDiagnosticsProvider: DiagnosticsProviderPort = {
  provider_id: "markdown-structure",
  supports(input) {
    return input.language === "markdown";
  },
  async diagnose(input) {
    return {
      statuses: [
        {
          provider_id: "markdown-structure",
          path: input.file.path,
          status: "clean",
          capability_level: "resource_backed",
          evidence_kinds: ["docs"]
        }
      ],
      findings: []
    };
  }
};

describe("diagnoseChangedFiles", () => {
  it("returns normalized actionable findings from provider-backed diagnostics", async () => {
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: fixtureRoot,
        files: ["bad.json"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [jsonDiagnosticsProvider],
      default_repo_root: "."
    });

    expect(result.diagnostics.status).toBe("blocked");
    expect(result.diagnostics.findings).toEqual([
      expect.objectContaining({
        path: "bad.json",
        severity: "blocker",
        category: "syntax",
        provider_id: "json-syntax",
        blocking: true
      })
    ]);
    expect(result.diagnostics.findings[0]?.path).not.toContain(fixtureRoot);
    expect(result.meta.verification_status).toBe("blocked");
  });

  it("keeps clean diagnostics quiet while retaining minimal checked-file metadata", async () => {
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: fixtureRoot,
        files: ["README.md"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [markdownDiagnosticsProvider],
      default_repo_root: "."
    });

    const envelope = buildDiagnosticsForFilesEnvelope(result);

    expect(envelope.data.status).toBe("not_applicable");
    expect(envelope.data.summary).toBe("Diagnostics completed with no actionable findings.");
    expect(envelope.data.checked_files).toEqual(["README.md"]);
    expect(envelope.data.findings).toEqual([]);
    expect(envelope.warnings).toEqual([]);
    expect(envelope.errors).toEqual([]);
  });

  it("reports unsupported files without pretending diagnostics are complete", async () => {
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: fixtureRoot,
        files: ["src/Legacy.java"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [jsonDiagnosticsProvider, markdownDiagnosticsProvider],
      default_repo_root: "."
    });

    expect(result.diagnostics.status).toBe("not_applicable");
    expect(result.diagnostics.provider_statuses).toEqual([
      expect.objectContaining({
        path: "src/Legacy.java",
        status: "not_applicable",
        capability_level: "unsupported"
      })
    ]);
    expect(result.diagnostics.findings).toEqual([]);
  });

  it("records optional provider failures without visible findings", async () => {
    const failingProvider: DiagnosticsProviderPort = {
      provider_id: "optional-json",
      supports(input) {
        return input.language === "json";
      },
      async diagnose() {
        throw new Error("tool unavailable");
      }
    };

    const result = await diagnoseChangedFiles({
      request: {
        repo_root: fixtureRoot,
        files: ["bad.json"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [failingProvider],
      default_repo_root: "."
    });

    const envelope = buildDiagnosticsForFilesEnvelope(result);

    expect(envelope.data.findings).toEqual([]);
    expect(envelope.data.provider_statuses).toEqual([
      expect.objectContaining({
        provider_id: "optional-json",
        path: "bad.json",
        status: "failed"
      })
    ]);
    expect(envelope.warnings).toEqual([]);
    expect(envelope.errors).toEqual([]);
  });

  it("builds a structured invalid-input envelope for empty diagnostics requests", () => {
    const envelope = buildInvalidDiagnosticsForFilesInputEnvelope({
      repoRoot: fixtureRoot,
      message: "At least one file is required."
    });

    expect(envelope.data.status).toBe("blocked");
    expect(envelope.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        message: "At least one file is required.",
        next_action: expect.objectContaining({
          tool: "verification_plan"
        })
      })
    ]);
  });

  it("refuses unsafe diagnostics targets without echoing absolute paths", async () => {
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: fixtureRoot,
        files: [path.join(fixtureRoot, "bad.json")],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [jsonDiagnosticsProvider],
      default_repo_root: "."
    });

    expect(result.diagnostics.status).toBe("blocked");
    expect(result.diagnostics.findings).toEqual([
      expect.objectContaining({
        path: "bad.json",
        message: "Diagnostics target path was refused.",
        blocking: true
      })
    ]);
    expect(result.diagnostics.findings[0]?.path).not.toContain(fixtureRoot);
  });
});
