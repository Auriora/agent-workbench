import { describe, expect, it } from "vitest";
import type { DiagnoseChangedFilesResult } from "../../src/application/use-cases/diagnose-changed-files.js";
import type { DiagnosticsForFilesRequest } from "../../src/contracts/index.js";
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
      description: "Run compact provider-backed diagnostics for repo-relative files without executing validation commands."
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
      verification_status: "blocked"
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        code: "invalid_input",
        retryable: false
      })
    ]);
  });

  it("returns a structured envelope when no diagnostics provider is configured", async () => {
    const registered = registerDiagnosticsTool({});
    const response = await registered.handler({
      files: ["package.json"]
    });
    const parsed = JSON.parse(response.content[0]?.text ?? "{}") as {
      data: { status: string; summary: string };
      errors: Array<{ message: string }>;
    };

    expect(parsed.data).toMatchObject({
      status: "blocked",
      summary: "Diagnostics input was invalid."
    });
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        message: "diagnostics_for_files provider is not configured."
      })
    ]);
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
