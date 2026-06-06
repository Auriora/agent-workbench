import { describe, expect, it } from "vitest";
import type {
  IntegrationHealth,
  ResponseMetadata
} from "../../src/contracts/index.js";
import type { DocsSearchUseCaseResult } from "../../src/application/use-cases/query-docs.js";
import type { GetTaskContextResult } from "../../src/application/use-cases/get-task-context.js";
import type { PlanVerificationResult } from "../../src/application/use-cases/plan-verification.js";
import { buildDocsSearchEnvelope } from "../../src/presentation/docs-presenter.js";
import { buildTaskContextEnvelope } from "../../src/presentation/task-context-presenter.js";
import { buildVerificationPlanEnvelope } from "../../src/presentation/verification-plan-presenter.js";

describe("session-aware public presenters", () => {
  it("filters unavailable next actions from task context, docs, and verification envelopes", () => {
    const contextEnvelope = buildTaskContextEnvelope(taskContextResult(), {
      integrationHealth: healthWithOnly("context_for_task")
    });
    const docsEnvelope = buildDocsSearchEnvelope(docsSearchResult(), {
      integrationHealth: healthWithOnly("docs_search")
    });
    const verificationEnvelope = buildVerificationPlanEnvelope(verificationPlanResult(), {
      integrationHealth: healthWithOnly("verification_plan")
    });

    expect(contextEnvelope.data.next_actions).toEqual([
      { tool: "context_for_task", args: { task: "Inspect repo" } }
    ]);
    expect(docsEnvelope.data.next_actions).toEqual([
      { tool: "docs_search", args: { query: "guide" } }
    ]);
    expect(verificationEnvelope.data.next_actions).toEqual([
      { tool: "verification_plan", args: { changed_files: ["src/app.ts"] } }
    ]);
  });

  it("preserves public next actions when session discovery is unknown", () => {
    const envelope = buildDocsSearchEnvelope(docsSearchResult(), {
      integrationHealth: unknownHealth(["docs_search", "docs_read_section"])
    });

    expect(envelope.data.next_actions).toEqual([
      { tool: "docs_search", args: { query: "guide" } },
      { tool: "docs_read_section", args: { path: "README.md", heading_id: "intro" } }
    ]);
  });
});

function taskContextResult(): GetTaskContextResult {
  return {
    context: {
      task: "Inspect repo",
      repo_root: "/repo",
      summary: "Task context found local evidence.",
      requested_files: [],
      related_files: [],
      ranked_symbols: [],
      governing_docs: [],
      validation_hints: [],
      skipped_work: [],
      completeness: {
        complete_enough: true,
        markers: [],
        caveats: []
      },
      risks: [],
      next_actions: [
        { tool: "context_for_task", args: { task: "Inspect repo" } },
        { tool: "impact", args: { node_id: "node-1" } }
      ]
    },
    meta: meta()
  };
}

function docsSearchResult(): DocsSearchUseCaseResult {
  return {
    search: {
      repo_root: "/repo",
      query: "guide",
      status: "planned",
      hits: [],
      warnings: [],
      truncated: false,
      next_actions: [
        { tool: "docs_search", args: { query: "guide" } },
        { tool: "docs_read_section", args: { path: "README.md", heading_id: "intro" } }
      ]
    },
    meta: meta()
  };
}

function verificationPlanResult(): PlanVerificationResult {
  return {
    plan: {
      repo_root: "/repo",
      status: "planned",
      summary: "Validation is planned.",
      planned_commands: [],
      risks: [],
      next_actions: [
        { tool: "verification_plan", args: { changed_files: ["src/app.ts"] } },
        { tool: "symbol_search", args: { query: "Runner" } }
      ]
    },
    meta: meta()
  };
}

function healthWithOnly(tool: string): IntegrationHealth {
  return {
    repo_root: "/repo",
    runtime_version: "0.1.0",
    profile: "codex",
    session: {
      discovery_state: "provided",
      discovered_tools: [tool],
      discovered_resources: [],
      discovered_prompts: []
    },
    surfaces: [
      surface(tool, "discovered", "callable", "available"),
      surface("impact", "not_discovered", "not_callable", "unavailable"),
      surface("symbol_search", "not_discovered", "not_callable", "unavailable"),
      surface("docs_read_section", "not_discovered", "not_callable", "unavailable")
    ],
    counts: {
      available: 1,
      unavailable: 3,
      blocked: 0,
      hidden: 0,
      unknown: 0
    },
    next_actions: []
  };
}

function unknownHealth(tools: string[]): IntegrationHealth {
  return {
    repo_root: "/repo",
    runtime_version: "0.1.0",
    profile: "codex",
    session: {
      discovery_state: "unknown",
      discovered_tools: [],
      discovered_resources: [],
      discovered_prompts: []
    },
    surfaces: tools.map((tool) => surface(tool, "unknown", "unknown", "unknown")),
    counts: {
      available: 0,
      unavailable: 0,
      blocked: 0,
      hidden: 0,
      unknown: tools.length
    },
    next_actions: []
  };
}

function surface(
  name: string,
  callerDiscovery: "discovered" | "not_discovered" | "unknown",
  callable: "callable" | "not_callable" | "unknown",
  status: "available" | "unavailable" | "blocked" | "hidden" | "unknown"
): IntegrationHealth["surfaces"][number] {
  return {
    name,
    kind: "tool",
    configured: true,
    registered: true,
    advertised: true,
    caller_discovery: callerDiscovery,
    callable,
    status,
    reason: status === "available"
      ? "The active client session discovered this registered MCP surface."
      : "The MCP surface was not callable in this session.",
    evidence_kinds: ["config"],
    capability_class: "read_only"
  };
}

function meta(): ResponseMetadata {
  return {
    analysis_validity: "valid",
    freshness: "fresh",
    scope: {
      repo_root: "/repo",
      indexed_roots: ["."],
      skipped_roots: [],
      languages: []
    },
    capability_level: "resource_backed",
    evidence_kinds: ["config"],
    verification_status: "planned",
    truncated: false
  };
}
