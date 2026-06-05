import type { IntegrationProfile } from "../../contracts/index.js";

const TARGET_AGENTS = [
  "codex",
  "claude_code",
  "kiro",
  "augment",
  "gemini",
  "junie"
] as const;

const MCP_BINDINGS: IntegrationProfile["mcp_bindings"] = [
  { name: "status", kind: "resource", capability_class: "read_only" },
  { name: "scope", kind: "resource", capability_class: "read_only" },
  { name: "overview", kind: "resource", capability_class: "read_only" },
  { name: "context_for_task", kind: "tool", capability_class: "read_only" },
  { name: "symbol_search", kind: "tool", capability_class: "read_only" },
  { name: "find_references", kind: "tool", capability_class: "read_only" },
  { name: "impact", kind: "tool", capability_class: "read_only" },
  { name: "preview_workspace_edit", kind: "tool", capability_class: "workspace_write" },
  { name: "apply_workspace_edit", kind: "tool", capability_class: "workspace_write" },
  { name: "verification_plan", kind: "tool", capability_class: "planning" }
];

export function buildCommonIntegrationProfile(): IntegrationProfile {
  return {
    runtime_version: "0.1.0",
    target_agents: [...TARGET_AGENTS],
    mcp_bindings: MCP_BINDINGS,
    artifacts: [
      {
        target_agent: "codex",
        surface: "mcp",
        path: "src/mcp/stdio.ts",
        status: "supported",
        provenance: "runtime_source",
        regeneration_safe: true,
        notes: ["Codex host-level configuration launches the repository checkout MCP runtime."]
      },
      {
        target_agent: "claude_code",
        surface: "mcp",
        status: "supported",
        provenance: "mcp_binding_metadata",
        regeneration_safe: true,
        notes: ["Claude Code can consume the common MCP binding set."]
      },
      {
        target_agent: "kiro",
        surface: "mcp",
        status: "supported",
        provenance: "mcp_binding_metadata",
        regeneration_safe: true,
        notes: ["Kiro can consume the common MCP binding set."]
      },
      {
        target_agent: "augment",
        surface: "mcp",
        status: "supported",
        provenance: "mcp_binding_metadata",
        regeneration_safe: true,
        notes: ["Augment/Auggie can consume the common MCP binding set."]
      },
      {
        target_agent: "gemini",
        surface: "mcp",
        status: "supported",
        provenance: "mcp_binding_metadata",
        regeneration_safe: true,
        notes: ["Gemini CLI can consume the common MCP binding set."]
      },
      {
        target_agent: "junie",
        surface: "mcp",
        status: "supported",
        provenance: "mcp_binding_metadata",
        regeneration_safe: true,
        notes: ["Junie can consume the common MCP binding set."]
      }
    ],
    unsupported_surfaces: [
      {
        target_agent: "augment",
        surface: "plugins",
        reason: "Marketplace/plugin packaging is deferred; common MCP metadata remains supported."
      },
      {
        target_agent: "gemini",
        surface: "extensions",
        reason: "Native extension packaging is deferred; common MCP metadata remains supported."
      },
      {
        target_agent: "junie",
        surface: "acp",
        reason: "ACP packaging is deferred; common MCP metadata remains supported."
      }
    ]
  };
}
