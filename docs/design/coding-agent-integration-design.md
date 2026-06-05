---
title: Coding agent integration design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Coding Agent Integration Design

## Purpose

Define how the runtime should integrate with common coding agents without
coupling core behavior to one vendor's plugin, hook, command, or memory format.

The runtime should expose one stable capability model and generate thin
agent-specific integration artifacts around it.

## Research Summary

Current coding agents share several concepts but rarely share exact file
formats or lifecycle semantics.

| Agent | Common Integration Points | Bespoke Integration Points | Design Implication |
| --- | --- | --- | --- |
| Codex | MCP, `AGENTS.md`, skills, hooks, custom agents/subagents | Codex plugins, app connectors, Codex config, hook feature flag | Treat Codex as a first-class emitter, not the core abstraction. |
| Claude Code | MCP, `CLAUDE.md`, custom slash commands, hooks, subagents, settings | Claude hook payloads, command frontmatter, project/user memory hierarchy | Generate Claude artifacts from common workflow definitions. |
| Kiro | MCP, `AGENTS.md`, steering, skills, hooks, custom agents, ACP | Kiro steering inclusion modes, powers, spec workflow | Map persistent guidance to steering and portable workflows to skills. |
| Augment/Auggie | MCP, `AGENTS.md`, `CLAUDE.md`, rules, skills, hooks, subagents, plugins, ACP | `.augment` rules/settings, Auggie plugin marketplaces, native integrations | Support Augment through rules/skills/MCP plus optional plugin packaging. |
| Gemini CLI | MCP, `GEMINI.md`, custom commands, hooks, skills, extensions, ACP | Gemini extension manifest, TOML command format, preview subagents | Support extension output later, but keep MCP and skills primary. |
| Junie | MCP, `AGENTS.md`, guidelines, ACP, IDE permissions/modes | JetBrains guideline paths, IDE-managed agent configuration | Prioritize MCP, ACP awareness, and guideline generation. |

## Standard Or Common Surfaces

### MCP

MCP is the primary runtime integration contract. It is the only integration
surface that should expose executable runtime capability in MVP.

The runtime should expose:

- tools for context, symbol search, references, impact, preview/apply, and
  validation planning
- resources for status, scope, overview, and future integration metadata
- prompts for reusable high-level workflows when client support is available

MCP remains an interface adapter. Application, domain, graph, extraction,
cache, and validation code must not know which agent is connected.

### Repository Instructions

Repository instruction files are common but not fully standardized. The runtime
should treat them as generated or maintained integration artifacts, not as
source-of-truth runtime policy.

Supported targets may include:

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.junie/AGENTS.md`
- `.kiro/steering/*.md`
- `.augment/rules/*.md`

Runtime safety, freshness, capability, and validation behavior remain governed
by runtime contracts and policies, not by generated instruction text.

### Agent Skills

Agent skills are the best portable workflow packaging format after MCP. Skills
should package reusable instructions, scripts, references, and examples for
workflows such as:

- using runtime context before broad file reads
- planning validation without silent success
- reviewing an impact report
- interpreting degraded capability metadata
- preparing bounded edit previews

Skills teach agents how to use runtime capabilities. They must not duplicate
the authoritative logic implemented by MCP tools and application use cases.

### ACP

Agent Client Protocol is an emerging editor-agent integration standard. It is
not required for MVP MCP runtime behavior, but the architecture should not
prevent an ACP adapter from being added.

ACP belongs beside MCP as an interface adapter. It may expose editor/IDE
capabilities or receive prompts from ACP-compatible clients, but it must still
call application use cases and presenters through the same boundary rules.

## Bespoke Surfaces

### Plugins And Extensions

Plugins and extensions are distribution wrappers. They are useful for
installing a bundle of instructions, skills, commands, hooks, and MCP
configuration, but each agent has different packaging rules.

The runtime must not make any plugin format the core abstraction.

For Codex local development, Agent Workbench uses host-level MCP configuration
as the single executable runtime path. The Codex plugin is skill/hook-only: it
does not register an MCP server, does not launch copied runtime code, and does
not point Codex at a cache-relative checkout. This keeps runtime updates tied to
this repository checkout: source changes require a Codex restart, while
dependency changes require `pnpm install` in this checkout followed by restart.
Operational setup lives in
[Codex Agent Workbench plugin and MCP setup](../runbooks/codex-agent-workbench-plugin.md).

### Hooks

Hooks are conceptually common but operationally vendor-specific. Event names,
payloads, blocking behavior, concurrency, timeouts, and config precedence vary.

The runtime should model hook intent internally and emit agent-specific hook
configuration only at the integration boundary.

Hook output should be quiet by default. Successful checks, optional backend
errors, and no-finding file edits should not print agent-visible messages.
Actionable findings should use repo-relative paths and the shortest message
that lets the agent continue. Operational failures belong in telemetry or
logger output unless the failure blocks the current user-visible workflow.

Example hook intents:

- `before_tool_use_policy_check`
- `after_file_write_validation_hint`
- `on_session_start_context_hint`
- `on_turn_stop_validation_summary`
- `on_prompt_submit_secret_check`

### Slash Commands

Slash commands are user-facing shortcuts, not runtime contracts. Agent-specific
command files should invoke MCP tools, prompts, or skills rather than reimplement
logic.

### Subagents And Custom Agents

Subagents and custom agents are useful for workflow decomposition, but manifests
and orchestration differ by agent. The runtime should provide guidance and
capabilities that subagents can use; it should not require subagents for core
MVP behavior.

## Integration Architecture

Add a neutral agent-integration area outside core runtime behavior:

```text
src/
  integration/
    common/
      AgentCapability.ts
      IntegrationManifest.ts
      IntegrationArtifact.ts
      InstructionPack.ts
      SkillPack.ts
      HookIntent.ts
      CommandSpec.ts
      McpBindingSpec.ts
    emitters/
      codex/
      claude-code/
      kiro/
      augment/
      gemini/
      junie/
    registry/
      IntegrationProfileRegistry.ts
```

The common integration model depends on runtime contracts and MCP definitions.
Agent-specific emitters depend on the common model. Core application/domain code
does not depend on emitters.

## Boundary Rules

- MCP tools/resources/prompts are the authoritative executable integration
  surface.
- Skills and instruction files explain how to use the runtime; they do not own
  runtime behavior.
- Agent-specific hooks, commands, plugins, extensions, rules, or guideline files
  are generated from common integration specs.
- Vendor-specific emitters must not call SQLite, tree-sitter, filesystem
  watchers, command execution, or application use cases directly.
- Generated artifacts must identify provenance, target agent, source runtime
  version, and regeneration safety.
- Integration artifacts must avoid hidden fallbacks. If a target agent lacks a
  surface, the emitter should omit that artifact and report unsupported
  capability.

## Recommended MVP Stance

MVP should implement the runtime MCP surface and define integration contracts,
but it does not need to generate every agent-specific artifact.

Required from the start:

- common integration model
- integration profile registry
- `McpBindingSpec`
- `InstructionPack` model
- `SkillPack` model
- `HookIntent` model
- no dependency from runtime core to vendor emitters

First useful emitters:

- Codex instruction/skill/MCP config guidance
- Claude Code instruction/skill/MCP config guidance
- Kiro steering/skill/MCP config guidance

Deferred emitters:

- Augment plugin marketplace packaging
- Gemini extension packaging
- Junie ACP/editor packaging
- agent-specific hook file generation

## Sources

- Codex plugins: <https://developers.openai.com/codex/plugins>
- Codex skills: <https://developers.openai.com/codex/skills>
- Codex hooks: <https://developers.openai.com/codex/hooks>
- Codex subagents: <https://developers.openai.com/codex/subagents>
- Codex config reference: <https://developers.openai.com/codex/config-reference>
- Claude Code MCP: <https://docs.anthropic.com/en/docs/claude-code/mcp>
- Claude Code hooks: <https://docs.anthropic.com/en/docs/claude-code/hooks>
- Claude Code memory: <https://docs.anthropic.com/en/docs/claude-code/memory>
- Claude Code slash commands: <https://docs.anthropic.com/en/docs/claude-code/slash-commands>
- Claude Code subagents: <https://docs.anthropic.com/en/docs/claude-code/sub-agents>
- Kiro steering: <https://kiro.dev/docs/steering/>
- Kiro skills: <https://kiro.dev/docs/skills/>
- Kiro hooks: <https://kiro.dev/docs/hooks/>
- Kiro MCP: <https://kiro.dev/docs/mcp/>
- Kiro ACP: <https://kiro.dev/docs/cli/acp/>
- Augment MCP: <https://docs.augmentcode.com/setup-augment/mcp>
- Augment rules and guidelines: <https://docs.augmentcode.com/setup-augment/guidelines>
- Auggie plugins: <https://docs.augmentcode.com/cli/plugins>
- Auggie integrations and MCP: <https://docs.augmentcode.com/cli/integrations>
- Gemini CLI extensions: <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/index.md>
- Gemini CLI extension reference: <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md>
- Gemini CLI custom commands: <https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md>
- Gemini CLI MCP: <https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md>
- Gemini CLI ACP mode: <https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md>
- Junie MCP settings: <https://www.jetbrains.com/help/junie/mcp-settings.html>
- Junie guidelines: <https://www.jetbrains.com/help/junie/customize-guidelines.html>
- JetBrains AI Assistant ACP: <https://www.jetbrains.com/help/ai-assistant/acp.html>
- Junie ACP CLI: <https://junie.jetbrains.com/docs/junie-cli-acp.html>
