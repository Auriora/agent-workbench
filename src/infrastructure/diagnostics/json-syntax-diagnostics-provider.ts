/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  DiagnosticFinding,
  DiagnosticsProviderStatus
} from "../../contracts/index.js";
import type {
  DiagnosticsProviderPort,
  DiagnosticsProviderResult
} from "../../ports/index.js";
import { WorkspaceFileAdapter } from "../filesystem/index.js";

export class JsonSyntaxDiagnosticsProviderAdapter implements DiagnosticsProviderPort {
  public readonly provider_id = "json-syntax";

  public supports(input: {
    path: string;
    language: string;
  }): boolean {
    return input.language === "json" || input.path.endsWith(".json");
  }

  public async diagnose(input: Parameters<DiagnosticsProviderPort["diagnose"]>[0]): Promise<DiagnosticsProviderResult> {
    const statusBase = {
      provider_id: this.provider_id,
      path: input.file.path,
      capability_level: "resource_backed" as const,
      evidence_kinds: ["config" as const]
    };

    try {
      const workspace = new WorkspaceFileAdapter({ repoRoot: input.repo_root });
      const text = await workspace.readText({ path: input.file.path });
      JSON.parse(text);
      return {
        statuses: [
          {
            ...statusBase,
            status: "clean",
            message: "JSON syntax parsed successfully."
          } satisfies DiagnosticsProviderStatus
        ],
        findings: []
      };
    } catch (error) {
      return {
        statuses: [
          {
            ...statusBase,
            status: "checked",
            message: "JSON syntax diagnostics found an actionable issue."
          } satisfies DiagnosticsProviderStatus
        ],
        findings: [
          {
            path: input.file.path,
            severity: "blocker",
            message: `JSON syntax error: ${error instanceof Error ? error.message : String(error)}`,
            category: "syntax",
            provider_id: this.provider_id,
            capability_level: "resource_backed",
            evidence_kinds: ["config"],
            blocking: true,
            fix_hint: "Fix the JSON syntax before relying on validation or runtime behavior."
          } satisfies DiagnosticFinding
        ]
      };
    }
  }
}
