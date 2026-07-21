/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
const workspaceSafetyFixtureRoot = path.resolve("tests/fixtures/fixture-workspace-safety");

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

    expect(result.diagnostics.status).toBe("needed");
    expect(result.diagnostics.summary).toBe("Diagnostics provider evidence was limited for 1 file(s).");
    expect(result.meta).toMatchObject({
      analysis_validity: "partial",
      verification_status: "needed"
    });
    expect(envelope.data.findings).toEqual([]);
    expect(envelope.data.provider_statuses).toEqual([
      expect.objectContaining({
        provider_id: "optional-json",
        path: "bad.json",
        status: "failed"
      })
    ]);
    expect(envelope.meta.trust).toMatchObject({
      not_safe_to_use_for: expect.arrayContaining(["passed_validation_claim", "task_completion_claim"]),
      must_verify_by: expect.arrayContaining(["review_diagnostics_output", "run_planned_validation"])
    });
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

  it("reports an existing secret path as a workspace-safety refusal without invoking providers", async () => {
    let providerCalled = false;
    const provider: DiagnosticsProviderPort = {
      provider_id: "must-not-run",
      supports() {
        providerCalled = true;
        return true;
      },
      async diagnose() {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    };

    const result = await diagnoseChangedFiles({
      request: {
        repo_root: workspaceSafetyFixtureRoot,
        files: [".env"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [provider],
      default_repo_root: "."
    });

    expect(providerCalled).toBe(false);
    expect(result.diagnostics).toMatchObject({
      status: "blocked",
      next_actions: []
    });
    expect(result.diagnostics.findings).toEqual([
      expect.objectContaining({
        path: ".env",
        message: expect.stringContaining("workspace safety policy (secret)"),
        blocking: true
      })
    ]);
    expect(result.diagnostics.findings[0]?.message).not.toContain("not found");
    expect(result.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(result.errors).toEqual([
      {
        code: "workspace_safety_blocked",
        message: "One or more diagnostics targets were refused by workspace safety policy.",
        retryable: false
      }
    ]);
  });

  it("lets leaf secret policy override a non-safety ancestor exclusion", async () => {
    let providerCalled = false;
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: workspaceSafetyFixtureRoot,
        files: ["build/.env"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [{
        provider_id: "must-not-run",
        supports() {
          providerCalled = true;
          return true;
        },
        async diagnose() {
          providerCalled = true;
          return { statuses: [], findings: [] };
        }
      }],
      default_repo_root: "."
    });

    expect(providerCalled).toBe(false);
    expect(result.diagnostics).toMatchObject({ status: "blocked", next_actions: [] });
    expect(result.diagnostics.findings).toEqual([
      expect.objectContaining({
        path: "build/.env",
        message: expect.stringContaining("workspace safety policy (secret)"),
        blocking: true
      })
    ]);
    expect(result.errors?.[0]?.code).toBe("workspace_safety_blocked");
  });

  it("suppresses all providers when any target is refused by workspace safety", async () => {
    let providerCalled = false;
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: workspaceSafetyFixtureRoot,
        files: [".env", "src/app.py"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [{
        provider_id: "must-not-run",
        supports() {
          providerCalled = true;
          return true;
        },
        async diagnose() {
          providerCalled = true;
          return { statuses: [], findings: [] };
        }
      }],
      default_repo_root: "."
    });

    expect(providerCalled).toBe(false);
    expect(result.diagnostics.status).toBe("blocked");
    expect(result.diagnostics.provider_statuses).toEqual([]);
    expect(result.diagnostics.next_actions).toEqual([]);
  });

  it("preserves scanner-only exclusion detail for a requested path", async () => {
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: workspaceSafetyFixtureRoot,
        files: ["reports/private.log"],
        max_files: 20
      },
      scanner: {
        async scan() {
          return {
            repo_root: workspaceSafetyFixtureRoot,
            indexed_roots: ["."],
            skipped_roots: [],
            skipped_paths: [{
              path: "reports/private.log",
              reason: "gitignore" as const,
              detail: "Exact requested path matched the repository ignore policy."
            }],
            files: [],
            truncated: false
          };
        }
      },
      providers: [],
      default_repo_root: "."
    });

    expect(result.diagnostics.findings).toEqual([
      expect.objectContaining({
        path: "reports/private.log",
        message: expect.stringContaining("Exact requested path matched the repository ignore policy."),
        blocking: false
      })
    ]);
  });

  it("preserves bounded scanner exclusion reasons instead of reporting excluded paths as missing", async () => {
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: workspaceSafetyFixtureRoot,
        files: ["build/out.txt"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [],
      default_repo_root: "."
    });

    expect(result.diagnostics.findings).toEqual([
      expect.objectContaining({
        path: "build/out.txt",
        message: expect.stringContaining("generated_or_vendor"),
        blocking: false
      })
    ]);
    expect(result.diagnostics.findings[0]?.message).not.toContain("not found");
  });

  it("retains non-blocking missing-path behavior for a genuinely absent safe path", async () => {
    const result = await diagnoseChangedFiles({
      request: {
        repo_root: workspaceSafetyFixtureRoot,
        files: ["src/absent.py"],
        max_files: 20
      },
      scanner: new FileCatalogScannerAdapter(),
      providers: [],
      default_repo_root: "."
    });

    expect(result.diagnostics).toMatchObject({ status: "needed" });
    expect(result.diagnostics.findings).toEqual([
      expect.objectContaining({
        path: "src/absent.py",
        message: "Requested diagnostics file was not found in the scanned repository.",
        blocking: false
      })
    ]);
    expect(result.meta.analysis_validity).toBe("valid");
    expect(result.errors).toBeUndefined();
  });
});
