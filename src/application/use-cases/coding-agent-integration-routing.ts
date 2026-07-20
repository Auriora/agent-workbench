/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type NamedIntegrationScope = "claude" | "codex" | "kiro";

export interface CodingAgentIntegrationIntent {
  scopes: readonly NamedIntegrationScope[];
  provider_integration_intent: boolean;
  hook_intent: boolean;
  consistency_intent: boolean;
}

export interface IntegrationPathEvidence {
  score: number;
  scopes: readonly NamedIntegrationScope[];
  kind: "provider_hook" | "source_sync";
  reason: string;
}

const PROVIDER_PATTERNS: ReadonlyArray<{
  scope: NamedIntegrationScope;
  pattern: RegExp;
}> = [
  { scope: "claude", pattern: /\bclaude(?:\s+code)?\b/iu },
  { scope: "codex", pattern: /\bcodex\b/iu },
  { scope: "kiro", pattern: /\bkiro\b/iu }
];

const HOOK_INTENT_TERMS = new Set([
  "hook",
  "hooks",
  "sessionstart"
]);

const PROVIDER_INTEGRATION_TERMS = new Set([
  "integration",
  "integrations"
]);

const CONSISTENCY_INTENT_TERMS = new Set([
  "align",
  "aligned",
  "consistent",
  "consistency",
  "keeping",
  "parity",
  "same",
  "sync",
  "synchronize",
  "synchronized"
]);

export function detectCodingAgentIntegrationIntent(task: string): CodingAgentIntegrationIntent {
  const scopes = PROVIDER_PATTERNS
    .map(({ scope, pattern }) => ({ scope, index: task.search(pattern) }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => left.index - right.index)
    .map((match) => match.scope);
  const terms = taskTerms(task);
  const sessionStartIntent = normalizedArtifact(task.toLowerCase()).includes("sessionstart");
  return {
    scopes,
    provider_integration_intent: scopes.length > 0 &&
      [...terms].some((term) => PROVIDER_INTEGRATION_TERMS.has(term)),
    hook_intent: scopes.length > 0 && (
      sessionStartIntent || [...terms].some((term) => HOOK_INTENT_TERMS.has(term))
    ),
    consistency_intent: [...terms].some((term) => CONSISTENCY_INTENT_TERMS.has(term))
  };
}

export function integrationPathEvidence(
  filePath: string,
  intent: CodingAgentIntegrationIntent
): IntegrationPathEvidence | undefined {
  if (!intent.hook_intent || intent.scopes.length === 0) {
    return undefined;
  }

  const normalizedPath = filePath.replaceAll("\\", "/").toLowerCase();
  const scopes = intent.scopes.filter((scope) => matchesProviderHookPath(normalizedPath, scope));
  if (scopes.length > 0) {
    const sessionStart = normalizedArtifact(normalizedPath).includes("sessionstart");
    return {
      score: 35 + (sessionStart ? 30 : 0),
      scopes,
      kind: "provider_hook",
      reason: sessionStart
        ? `Matched the explicitly named ${scopes.map(scopeLabel).join("/")} SessionStart hook area.`
        : `Matched the explicitly named ${scopes.map(scopeLabel).join("/")} hook area.`
    };
  }

  if (
    intent.consistency_intent &&
    intent.scopes.length > 1 &&
    intent.scopes.includes("claude") &&
    isExecutableHookSyncSource(normalizedPath)
  ) {
    return {
      score: 55,
      scopes: [],
      kind: "source_sync",
      reason: "Matched the executable source-sync relationship between explicitly named integration hook areas."
    };
  }

  return undefined;
}

export function prioritizeIntegrationSymbolTerms(input: {
  task: string;
  symbols: readonly string[];
  intent: CodingAgentIntegrationIntent;
  limit: number;
}): string[] {
  const explicit = input.symbols.map((symbol) => symbol.trim()).filter((symbol) => symbol.length > 0);
  if (explicit.length > 0) {
    return unique(explicit).slice(0, input.limit);
  }

  const terms = [...taskTerms(input.task)].filter((term) => term.length >= 3);
  if (!input.intent.hook_intent) {
    return terms.slice(0, input.limit);
  }
  const artifactTerms: string[] = [
    ...(normalizedArtifact(input.task.toLowerCase()).includes("sessionstart") ? ["sessionstart"] : []),
    ...(terms.includes("hook") || terms.includes("hooks") ? ["hook"] : [])
  ];
  const providerTerms: string[] = input.intent.scopes.map((scope) => scope === "claude" ? "claude" : scope);
  const genericTerms = terms.filter((term) =>
    !artifactTerms.includes(term) &&
    !providerTerms.includes(term) &&
    term !== "plugin" &&
    term !== "plugins"
  );
  return unique([...artifactTerms, ...providerTerms, ...genericTerms]).slice(0, input.limit);
}

export function namedScopeLabel(scope: NamedIntegrationScope): string {
  return scopeLabel(scope);
}

function matchesProviderHookPath(filePath: string, scope: NamedIntegrationScope): boolean {
  switch (scope) {
    case "claude":
      return filePath.startsWith("plugins/agent-workbench/claude-plugin/hooks/");
    case "codex":
      return filePath.startsWith("plugins/agent-workbench/hooks/");
    case "kiro":
      return filePath.startsWith("plugins/agent-workbench/kiro-power/hooks/");
  }
}

function isExecutableHookSyncSource(filePath: string): boolean {
  return filePath === "scripts/sync-claude-plugin-hooks.mjs";
}

function normalizedArtifact(value: string): string {
  return value.replace(/[^a-z0-9]+/gu, "");
}

function taskTerms(value: string): Set<string> {
  return new Set(
    value
      .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9_]+/u)
      .filter((term) => term.length >= 2)
  );
}

function scopeLabel(scope: NamedIntegrationScope): string {
  switch (scope) {
    case "claude":
      return "Claude Code";
    case "codex":
      return "Codex/shared";
    case "kiro":
      return "Kiro";
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
