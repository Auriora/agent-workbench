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
          "Defaults omitted repo roots to the Codex session working directory.",
          "Supports explicit repo roots through arguments or AGENT_WORKBENCH_DEFAULT_REPO_ROOT for fixed-target launches.",
          "Lists configured public MCP bindings; a given Codex session may expose only the subset discovered by the active client configuration."
        ],
        constraints: [
          "No copied runtime path.",
          "Source edits in this repository are picked up on Codex restart."
        ]
      },
      {
        surface: "plugins",
        status: "available",
        artifact_path: "plugins/agent-workbench/.codex-plugin/plugin.json",
        purpose: "Codex plugin wrapper that packages skill guidance and quiet hook scripts for local and packaged installs.",
        behavior: [
          "Does not register an MCP server for local development.",
          "Relies on host-level Codex MCP configuration to launch the repository checkout runtime.",
          "The GHCR install package ships a host installer that writes MCP and hook configuration when plugin installation does not install hooks."
        ],
        constraints: [
          "Plugin artifacts must not import runtime internals.",
          "Plugin installation must not create a copied or cache-relative MCP runtime path.",
          "Packaged installs must use the installed package prefix, not a plugin cache path, as the MCP runtime source."
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
        name: "docs-overview",
        uri: "repo:///docs/overview",
        kind: "resource",
        capability_class: "read_only",
        description: "Compact documentation overview with important docs, headings, warnings, truncation, and direct-read caveats."
      },
      {
        name: "docs-map",
        uri: "repo:///docs/map",
        kind: "resource",
        capability_class: "read_only",
        description: "Bounded documentation map with repo-relative paths, headings, warnings, truncation, and direct-read caveats."
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
        description: "Configured task-context MCP workflow for status, files, docs, risks, and validation hints."
      },
      {
        name: "diagnostics_for_files",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured compact provider-backed diagnostics for repo-relative files without command execution."
      },
      {
        name: "docs_search",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded documentation search with routing caveats and direct-read follow-up guidance."
      },
      {
        name: "docs_outline",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded heading outline for one repo-relative Markdown document."
      },
      {
        name: "docs_read_section",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded direct section read for precise documentation evidence."
      },
      {
        name: "check_markdown_document",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded read-only Markdown quality check for one repo-relative document."
      },
      {
        name: "check_markdown_set",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded read-only Markdown quality check for explicit or scoped document sets."
      },
      {
        name: "symbol_search",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded indexed graph symbol search with optional source-byte snippets."
      },
      {
        name: "find_references",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded resolved and unresolved reference lookup for indexed symbols."
      },
      {
        name: "impact",
        kind: "tool",
        capability_class: "read_only",
        description: "Configured bounded graph impact traversal for indexed symbols and affected files."
      },
      {
        name: "preview_workspace_edit",
        kind: "tool",
        capability_class: "workspace_write",
        description: "Configured preview for bounded workspace edits with file hashes and no mutation."
      },
      {
        name: "apply_workspace_edit",
        kind: "tool",
        capability_class: "workspace_write",
        description: "Configured apply path for previewed workspace edits after token, hash, and safety checks."
      },
      {
        name: "verification_plan",
        kind: "tool",
        capability_class: "planning",
        description: "Configured validation planning and quiet static feedback without executing commands."
      }
    ],
    plugin: {
      name: "agent-workbench",
      manifest_path: "plugins/agent-workbench/.codex-plugin/plugin.json",
      runtime_source: "repository_checkout_or_installed_package",
      packaging_model: "skill_and_hook_wrapper_plus_ghcr_install_package",
      mcp_binding_model: "host_level_config_required",
      update_model: {
        source_changes: "For local development, restart Codex to launch the updated repository source. For packaged installs, install a new GHCR package version and restart Codex.",
        dependency_changes: "For local development, run pnpm install in the repository checkout, then restart Codex. For packaged installs, publish and install a package containing rebuilt dependencies.",
        copied_runtime_allowed: false
      }
    },
    install_package: {
      registry: "ghcr.io",
      image: "ghcr.io/bcherrington/agent-workbench",
      containerfile_path: "packaging/agent-workbench/Containerfile",
      manifest_path: "packaging/agent-workbench/package-manifest.json",
      installer_path: "scripts/install-agent-workbench-package.sh",
      release_workflow_path: ".github/workflows/release-ghcr.yml",
      installed_components: [
        "src",
        "docs",
        "plugins/agent-workbench",
        "plugins/agent-workbench/hooks",
        "plugins/agent-workbench/skills",
        "package.json",
        "pnpm-lock.yaml",
        "tsconfig.json",
        "AGENTS.md"
      ],
      dependency_install_model: "The package manifest defines Node, pnpm, runtime module, dev/test module, native tool, and native rebuild requirements; the installer runs pnpm install --frozen-lockfile and pnpm rebuild:native when dependencies are not already packaged.",
      mcp_install_model: "The installer writes a host-level mcp_servers.agent-workbench entry that launches the installed package prefix.",
      hook_install_model: "The installer appends SessionStart and PostToolUse hook entries to Codex config.toml because Codex plugin manifests do not currently declare hooks."
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
        quiet_when: ["default configuration", "invalid payload"],
        schema_mapping: "Short MCP availability guidance only; no runtime analysis is executed."
      },
      {
        name: "agent-workbench-post-edit-feedback",
        event: "PostToolUse",
        matcher: "^(apply_patch|write_file|create_file|rename_file)$",
        path: "plugins/agent-workbench/hooks/post-edit-feedback.js",
        default_mode: "silent",
        blocks_workflow: false,
        emits_when: [
          "AGENT_WORKBENCH_HOOK_FEEDBACK=basic and actionable path, conflict-marker, or syntax findings are detected"
        ],
        quiet_when: ["clean edits", "successful edits", "unsupported payload", "hook errors"],
        schema_mapping: "Cheap local actionable findings only; no runtime diagnostics or tests are run."
      }
    ],
    guardrails: [
      "MCP is the only executable runtime surface.",
      "Configured MCP bindings must not be treated as guaranteed client-discovered tools unless the active session exposes them.",
      "Plugin, skill, and hook artifacts are wrappers around MCP, not parallel implementations.",
      "Source edits require Codex restart to reload MCP source behavior.",
      "Dependency changes require pnpm install in this repository checkout for local development, or a rebuilt package for packaged installs, then restart Codex.",
      "The GHCR package must include runtime source, docs, plugin manifest, skills, hooks, installer, and release metadata.",
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
        notes: ["Wrapper manifest only; runtime code stays in the checkout and MCP is configured at host level."]
      },
      {
        target_agent: "codex",
        surface: "plugins",
        path: "packaging/agent-workbench/package-manifest.json",
        status: "supported",
        provenance: "ghcr_install_package",
        regeneration_safe: true,
        notes: ["GHCR package manifest includes runtime source, docs, plugin wrapper, skills, hooks, and installer metadata."]
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
