/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import type { DiagnoseChangedFilesResult } from "../../src/application/use-cases/diagnose-changed-files.js";
import type { DiagnosticsForFilesRequest } from "../../src/contracts/index.js";
import { createRootAuthorityPolicy } from "../../src/interface-adapters/mcp/registries/root-authority.js";
import { diagnosticsForFilesTool } from "../../src/interface-adapters/mcp/registries/tools/diagnostics-for-files.js";
import {
  type RegisteredMcpTool,
  registerMcpTool
} from "../helpers/mcp-harness.js";

describe("diagnostics_for_files MCP tool", () => {
  it("uses the injected diagnostics provider and defaults the repo root", async () => {
    let parsedRepoRoot: string | undefined;
    const registered = registerDiagnosticsTool({
      diagnoseChangedFiles: ({ request }: { request: DiagnosticsForFilesRequest }) => {
        parsedRepoRoot = request.repo_root;
        return {
          diagnostics: {
            repo_root: "/repo",
            status: "needed",
            summary: "Injected diagnostics.",
            checked_files: request.files,
            findings: [
              {
                path: "package.json",
                severity: "blocker",
                message: "Fixture finding.",
                category: "syntax",
                provider_id: "fixture",
                capability_level: "resource_backed",
                evidence_kinds: ["config"],
                blocking: true
              }
            ],
            provider_statuses: [
              {
                provider_id: "fixture",
                path: "package.json",
                status: "checked",
                capability_level: "resource_backed",
                evidence_kinds: ["config"]
              }
            ],
            next_actions: []
          },
          meta: meta()
        } satisfies DiagnoseChangedFilesResult;
      }
    });

    expect(registered).toMatchObject({
      name: "diagnostics_for_files",
      description: expect.stringContaining("Use this for cheap static diagnostics")
    });

    const response = await registered.handler({
      files: ["package.json"]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: DiagnoseChangedFilesResult["diagnostics"];
    };

    expect(parsedRepoRoot).toBe("/repo");
    expect(parsed.data.summary).toBe("Injected diagnostics.");
    expect(parsed.data.findings).toEqual([
      expect.objectContaining({
        path: "package.json",
        provider_id: "fixture"
      })
    ]);
  });

  it("returns a structured invalid-input envelope before provider execution", async () => {
    let providerCalled = false;
    const registered = registerDiagnosticsTool({
      diagnoseChangedFiles: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({
      max_files: 100
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked",
      trust: {
        safe_to_use_for: expect.arrayContaining(["navigation"]),
        not_safe_to_use_for: expect.arrayContaining(["passed_validation_claim"])
      }
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });

  it("rejects more priority paths than the diagnostics receipt budget", async () => {
    let providerCalled = false;
    const registered = registerDiagnosticsTool({
      diagnoseChangedFiles: () => {
        providerCalled = true;
        throw new Error("provider should not run");
      }
    });

    const response = await registered.handler({
      files: Array.from({ length: 51 }, (_, index) => `ignored/file-${index}.json`),
      max_files: 50
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string }>;
    };

    expect(providerCalled).toBe(false);
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors[0]?.code).toBe("invalid_input");
  });

  it("returns a provider-unavailable envelope when no diagnostics provider is configured", async () => {
    const registered = registerDiagnosticsTool({});
    const response = await registered.handler({
      files: ["package.json"]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: {
        repo_root: string;
        status: string;
        summary: string;
        checked_files: unknown[];
        findings: unknown[];
        provider_statuses: unknown[];
        next_actions: unknown[];
      };
      meta: {
        analysis_validity: string;
        freshness: string;
        verification_status: string;
      };
      errors: Array<{ code: string; retryable: boolean; message: string }>;
    };

    expect(parsed.data).toMatchObject({
      repo_root: "/repo",
      status: "blocked",
      summary: "Diagnostics are unavailable because the provider is not configured.",
      checked_files: [],
      findings: [],
      provider_statuses: [],
      next_actions: []
    });
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid_due_to_environment",
      freshness: "unknown",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "provider_unavailable",
        retryable: false,
        message: "diagnostics_for_files provider is not configured."
      })
    ]);
  });

  it("uses the resolved request root in provider-unavailable envelopes", async () => {
    const registered = registerDiagnosticsTool({
      rootAuthorityPolicy: createRootAuthorityPolicy({
        launchRoot: "/repo",
        debugRepoRootOverride: true
      })
    });
    const response = await registered.handler({
      repo_root: "/tmp/debug-root",
      files: ["package.json"]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { repo_root: string };
      errors: Array<{ code: string }>;
    };

    expect(parsed.data.repo_root).toBe("/tmp/debug-root");
    expect(parsed.errors[0]?.code).toBe("provider_unavailable");
  });

  it("presents workspace-safety diagnostics refusals as typed non-retryable errors", async () => {
    const registered = registerDiagnosticsTool({
      diagnoseChangedFiles: ({ request }: { request: DiagnosticsForFilesRequest }) => ({
        diagnostics: {
          repo_root: "/repo",
          status: "blocked",
          summary: "One diagnostics finding needs attention.",
          checked_files: request.files,
          findings: [
            {
              path: ".env",
              severity: "blocker",
              message: "Diagnostics target was refused by workspace safety policy (secret).",
              category: "unsupported",
              provider_id: "workspace",
              capability_level: "unsupported",
              evidence_kinds: [],
              blocking: true
            }
          ],
          provider_statuses: [],
          next_actions: []
        },
        meta: {
          ...meta(),
          analysis_validity: "invalid",
          verification_status: "blocked"
        },
        errors: [
          {
            code: "workspace_safety_blocked",
            message: "One or more diagnostics targets were refused by workspace safety policy.",
            retryable: false
          }
        ]
      } satisfies DiagnoseChangedFilesResult)
    });

    const response = await registered.handler({ files: [".env"] });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { next_actions: unknown[]; findings: Array<{ message: string }> };
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean; message: string }>;
    };

    expect(parsed.data.next_actions).toEqual([]);
    expect(parsed.data.findings[0]?.message).not.toContain("not found");
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      {
        code: "workspace_safety_blocked",
        message: "One or more diagnostics targets were refused by workspace safety policy.",
        retryable: false
      }
    ]);
  });

  it("returns an internal-error envelope for unexpected provider failures", async () => {
    const registered = registerDiagnosticsTool({
      diagnoseChangedFiles: () => {
        throw new Error(
          "Retry diagnostics after fixing the provider. /home/example/diagnostics.log ../outside TOKEN=abc123"
        );
      }
    });

    const response = await registered.handler({ files: ["package.json"] });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: {
        repo_root: string;
        status: string;
        summary: string;
        checked_files: unknown[];
        findings: unknown[];
        provider_statuses: unknown[];
        next_actions: unknown[];
      };
      meta: { analysis_validity: string; verification_status: string };
      errors: Array<{ code: string; retryable: boolean; message: string }>;
    };

    expect(parsed.data).toMatchObject({
      repo_root: "/repo",
      status: "blocked",
      checked_files: [],
      findings: [],
      provider_statuses: [],
      next_actions: []
    });
    expect(parsed.meta).toMatchObject({
      analysis_validity: "invalid_due_to_environment",
      freshness: "unknown",
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "internal_error",
        retryable: true,
        message: expect.stringContaining("Retry diagnostics after fixing the provider.")
      })
    ]);
    expect(parsed.data.summary).toBe(parsed.errors[0]?.message);
    expect(JSON.stringify(parsed)).not.toContain("/home/example");
    expect(JSON.stringify(parsed)).not.toContain("../outside");
    expect(JSON.stringify(parsed)).not.toContain("abc123");
  });
});

function registerDiagnosticsTool(context: Record<string, unknown>): RegisteredMcpTool {
  return registerMcpTool(diagnosticsForFilesTool, context);
}

function meta(): DiagnoseChangedFilesResult["meta"] {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      languages: ["json"]
    },
    capability_level: "resource_backed",
    evidence_kinds: ["config"],
    verification_status: "needed",
    truncated: false
  };
}
