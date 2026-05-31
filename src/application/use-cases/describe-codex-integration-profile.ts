import type { CodexIntegrationProfile } from "../../contracts/index.js";

export function describeCodexIntegrationProfile(): CodexIntegrationProfile {
  return {
    target_agent: "codex",
    profile_name: "Agent Workbench Codex Integration",
    runtime_version: "0.1.0",
    mcp_server_id: "agent-workbench",
    runtime_source: "repository_checkout",
    active_surfaces: [
      {
        surface: "instructions",
        status: "active",
        artifact_path: "AGENTS.md",
        purpose: "Repository-scoped implementation guidance for agents working inside this checkout.",
        behavior: [
          "Defines architecture, validation, tree-sitter, and single-path failure rules."
        ],
        constraints: [
          "Instructions do not own runtime behavior.",
          "Runtime contracts and MCP schemas remain authoritative."
        ]
      },
      {
        surface: "mcp",
        status: "active",
        artifact_path: "src/mcp/stdio.ts",
        purpose: "Executable runtime surface for Codex through stdio MCP.",
        behavior: [
          "Launches the production MCP server from this repository checkout.",
          "Supports explicit repo roots through arguments or AGENT_WORKBENCH_DEFAULT_REPO_ROOT."
        ],
        constraints: [
          "No copied runtime path.",
          "No plugin reinstall is required for source changes."
        ]
      },
      {
        surface: "plugins",
        status: "available",
        artifact_path: "plugins/agent-workbench/.codex-plugin/plugin.json",
        purpose: "Codex plugin wrapper that packages MCP config, skill guidance, and hook scripts.",
        behavior: [
          "Points Codex at the repository checkout runtime instead of duplicating implementation code."
        ],
        constraints: [
          "Plugin artifacts must not import runtime internals except through MCP launch metadata."
        ]
      },
      {
        surface: "commands",
        status: "active",
        artifact_path: "src/debug/mcp-status.ts",
        purpose: "Repo-local debug command for exercising MCP-adjacent status behavior during development.",
        behavior: [
          "Runs from this project checkout for local MCP debugging and profiling support."
        ],
        constraints: [
          "Debug commands are not registered as public MCP surfaces.",
          "Debug commands are not available to target repositories as plugin runtime behavior."
        ]
      }
    ],
    wrapper_surfaces: [
      {
        surface: "skills",
        status: "available",
        artifact_path: "plugins/agent-workbench/skills/agent-workbench/SKILL.md",
        purpose: "Workflow guidance for using the MCP runtime during coding tasks.",
        behavior: [
          "Teaches status, context, targeted navigation, edit preview, and verification planning order."
        ],
        constraints: [
          "Skill text must not restate schemas or reimplement runtime logic."
        ]
      },
      {
        surface: "hooks",
        status: "available",
        artifact_path: "plugins/agent-workbench/hooks/hooks.json",
        purpose: "Optional quiet Codex lifecycle wrappers for session start and post-edit feedback.",
        behavior: [
          "Default to silent mode.",
          "Basic mode emits concise MCP follow-up guidance only."
        ],
        constraints: [
          "Hooks do not run analysis.",
          "Hooks do not return partial results for timeouts or failures.",
          "Hooks exit successfully on unsupported payloads without user-facing noise."
        ]
      }
    ],
    mcp_bindings: [
      {
        name: "status",
        uri: "repo:///status",
        kind: "resource",
        capability_class: "read_only",
        description: "Compact repository status, scope, freshness, and adapter coverage."
      },
      {
        name: "scope",
        uri: "repo:///scope",
        kind: "resource",
        capability_class: "read_only",
        description: "Indexed roots, skipped roots, language counts, capability counts, and generated/vendor scope."
      },
      {
        name: "overview",
        uri: "repo:///overview",
        kind: "resource",
        capability_class: "read_only",
        description: "Compact repository overview with platforms, key files, key docs, validation hints, and first-call guidance."
      },
      {
        name: "codex-integration-profile",
        uri: "integration:///profiles/codex",
        kind: "resource",
        capability_class: "read_only",
        description: "Codex feature, plugin, skill, hook, and update-path profile."
      },
      {
        name: "context_for_task",
        kind: "tool",
        capability_class: "read_only",
        description: "Task-context MCP workflow for status, files, docs, risks, and validation hints."
      },
      {
        name: "verification_plan",
        kind: "tool",
        capability_class: "planning",
        description: "Plans validation commands and quiet static feedback without executing commands."
      }
    ],
    plugin: {
      name: "agent-workbench",
      manifest_path: "plugins/agent-workbench/.codex-plugin/plugin.json",
      mcp_config_path: "plugins/agent-workbench/.mcp.json",
      runtime_source: "repository_checkout",
      packaging_model: "wrapper_only",
      update_model: {
        source_changes: "Restart Codex to launch the updated repository source.",
        dependency_changes: "Run pnpm install in the repository checkout, then restart Codex.",
        copied_runtime_allowed: false
      }
    },
    skills: [
      {
        name: "agent-workbench",
        path: "plugins/agent-workbench/skills/agent-workbench/SKILL.md",
        purpose: "Use Agent Workbench as the MCP-backed IDE runtime for coding tasks.",
        workflow: [
          "Read repo status, scope, and overview before trusting runtime results.",
          "Gather task context before broad file reads.",
          "Use targeted symbol, reference, impact, edit, and verification surfaces for implementation work."
        ],
        constraints: [
          "Do not bypass MCP schemas.",
          "Do not add fallback routes or alternate analyzers without spec-backed tests."
        ]
      }
    ],
    hooks: [
      {
        name: "agent-workbench-session-start",
        event: "SessionStart",
        path: "plugins/agent-workbench/hooks/session-start.js",
        default_mode: "silent",
        blocks_workflow: false,
        emits_when: ["AGENT_WORKBENCH_HOOK_FEEDBACK=basic"],
        quiet_when: ["default configuration", "invalid payload", "missing cwd"],
        schema_mapping: "MCP status/resource guidance only; no runtime analysis is executed."
      },
      {
        name: "agent-workbench-post-edit-feedback",
        event: "PostToolUse",
        matcher: "^(apply_patch|write_file|create_file|rename_file)$",
        path: "plugins/agent-workbench/hooks/post-edit-feedback.js",
        default_mode: "silent",
        blocks_workflow: false,
        emits_when: ["AGENT_WORKBENCH_HOOK_FEEDBACK=basic and changed files are detected"],
        quiet_when: ["default configuration", "no changed files", "unsupported payload", "hook errors"],
        schema_mapping: "verification_plan.static_feedback follow-up guidance only; no diagnostics are run."
      }
    ],
    guardrails: [
      "MCP is the only executable runtime surface.",
      "Plugin, skill, and hook artifacts are wrappers around MCP, not parallel implementations.",
      "No primary-plus-fallback routes are allowed unless the spec and fixture-backed tests require them.",
      "Timeouts and failures must not produce partial-success evidence.",
      "Root causes must be fixed or reported as structured degraded/blocked state with missing evidence."
    ],
    artifacts: [
      {
        target_agent: "codex",
        surface: "instructions",
        path: "AGENTS.md",
        status: "supported",
        provenance: "repository_guidance",
        regeneration_safe: false,
        notes: ["Human-maintained repository instructions."]
      },
      {
        target_agent: "codex",
        surface: "mcp",
        path: "src/mcp/stdio.ts",
        status: "supported",
        provenance: "runtime_source",
        regeneration_safe: false,
        notes: ["Canonical executable MCP entrypoint."]
      },
      {
        target_agent: "codex",
        surface: "plugins",
        path: "plugins/agent-workbench/.codex-plugin/plugin.json",
        status: "supported",
        provenance: "codex_wrapper",
        regeneration_safe: true,
        notes: ["Wrapper manifest only; runtime code stays in the checkout."]
      },
      {
        target_agent: "codex",
        surface: "commands",
        path: "src/debug/mcp-status.ts",
        status: "supported",
        provenance: "repo_local_debug",
        regeneration_safe: false,
        notes: ["Development-only debug command; not a target-repo MCP surface."]
      },
      {
        target_agent: "codex",
        surface: "skills",
        path: "plugins/agent-workbench/skills/agent-workbench/SKILL.md",
        status: "supported",
        provenance: "codex_wrapper",
        regeneration_safe: true,
        notes: ["Workflow guidance; no runtime logic."]
      },
      {
        target_agent: "codex",
        surface: "hooks",
        path: "plugins/agent-workbench/hooks/hooks.json",
        status: "supported",
        provenance: "codex_wrapper",
        regeneration_safe: true,
        notes: ["Quiet optional guidance hooks; no analysis execution."]
      }
    ]
  };
}
