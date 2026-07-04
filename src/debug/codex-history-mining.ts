/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Format = "markdown" | "json";

type Config = {
  codexHome: string;
  repoRoot?: string;
  output?: string;
  format: Format;
  limit: number;
  since?: string;
};

type Category = {
  id: string;
  title: string;
  patterns: RegExp[];
  backlogSignal: string;
};

type CategorySummary = {
  count: number;
  examples: string[];
};

type HookSummary = {
  files_seen: number;
  records_seen: number;
  statuses: Record<string, number>;
  reasons: Record<string, number>;
};

type ScanReport = {
  generated_at: string;
  codex_home: string;
  repo_root?: string;
  files_scanned: number;
  records_seen: number;
  records_matched: number;
  categories: Record<string, CategorySummary>;
  hooks: HookSummary;
};

const CATEGORIES: Category[] = [
  {
    id: "tool_discovery",
    title: "Tool Discovery And Integration Drift",
    patterns: [
      /mcp startup|startup incomplete|failed to start|unknown mcp server/i,
      /tools? (not exposed|not callable|not available|available|visible|visibility)/i,
      /advertis(?:e|ed)|integration profile|callable|tool surface/i
    ],
    backlogSignal: "Add integration health checks for advertised versus callable MCP surfaces."
  },
  {
    id: "latency_timeout",
    title: "Latency, Timeout, And First-Call Reliability",
    patterns: [
      /timeout|timed out|taking a long time|slow|hang|hung|pre[- ]?warm|first[- ]?call/i,
      /return (timeously|quickly)|bounded time/i
    ],
    backlogSignal: "Keep first-read and repair-loop tools bounded with structured degraded or blocked output."
  },
  {
    id: "validation_friction",
    title: "Validation And Command Friction",
    patterns: [
      /verification_plan|validation|test command|wrong command|missing .*client|pytest|typecheck|lint/i,
      /docker.*validation|host command|blocked validation|compile|build failed/i
    ],
    backlogSignal: "Make validation planning policy-aware and repo-script-first."
  },
  {
    id: "post_edit_feedback",
    title: "Post-Edit Feedback And Diagnostics",
    patterns: [
      /post_edit_feedback|diagnostics_for_files|post[- ]?edit|hook feedback|checks_deferred/i,
      /too_many_files|diagnostics_deferred|clean feedback|actionable findings/i
    ],
    backlogSignal: "Promote quiet multi-file diagnostics and post-edit feedback."
  },
  {
    id: "broad_routing",
    title: "Broad Routing Drift",
    patterns: [
      /context_for_task|orient_repo|broad|noisy|wrong language|over[- ]?indexed|fallback to (rg|shell|direct)/i,
      /manual .*inspection|command-surface inspection|direct file reads/i
    ],
    backlogSignal: "Improve context routing and treat broad fallback as product telemetry."
  },
  {
    id: "workspace_safety",
    title: "Workspace Safety And Generated Artifacts",
    patterns: [
      /wrong repo|dirty worktree|do not edit|generated artifact|\\.cache|temp(?:orary)? docs|revert/i,
      /don't .*change|made no edits|untracked/i
    ],
    backlogSignal: "Add pre-final workspace hygiene and wrong-repo artifact checks."
  },
  {
    id: "spec_traceability",
    title: "Spec And Task Traceability",
    patterns: [
      /spec[-_ ]?lifecycle|traceability|design sections|task id|closure check/i,
      /docs\/specs\/\d+|T\d{3}|requirements.*design.*tasks/i,
      /review packet|promotion plan|archive/i
    ],
    backlogSignal: "Add spec/task context lookup backed by the spec-lifecycle workflow."
  },
  {
    id: "domain_mcp",
    title: "Domain MCP Opportunities",
    patterns: [
      /ActivityWatch MCP|GitHub MCP|Figma MCP|Context7|memory mcp|sequentialthinking|domain MCP/i,
      /calendar.*MCP|meeting context|pull request.*MCP|tools\/list/i
    ],
    backlogSignal: "Surface relevant domain MCP availability and repo-specific MCP server smoke guidance."
  }
];

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const config = parseArgs(argv);
  const report = scan(config);
  const rendered = config.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (config.output !== undefined) {
    fs.mkdirSync(path.dirname(config.output), { recursive: true });
    fs.writeFileSync(config.output, rendered);
    return;
  }
  process.stdout.write(rendered);
}

function parseArgs(argv: readonly string[]): Config {
  const codexHome = path.resolve(readOption(argv, "--codex-home") ?? path.join(os.homedir(), ".codex"));
  const repoRootOption = readOption(argv, "--repo-root");
  const format = readOption(argv, "--format") ?? "markdown";
  if (format !== "markdown" && format !== "json") {
    throw new Error("--format must be markdown or json");
  }
  return {
    codexHome,
    repoRoot: repoRootOption === undefined ? undefined : path.resolve(repoRootOption),
    output: readOption(argv, "--output"),
    format,
    limit: Number.parseInt(readOption(argv, "--limit") ?? "3", 10),
    since: readOption(argv, "--since")
  };
}

function scan(config: Config): ScanReport {
  const report: ScanReport = {
    generated_at: new Date().toISOString(),
    codex_home: config.codexHome,
    ...(config.repoRoot === undefined ? {} : { repo_root: config.repoRoot }),
    files_scanned: 0,
    records_seen: 0,
    records_matched: 0,
    categories: Object.fromEntries(CATEGORIES.map((category) => [category.id, { count: 0, examples: [] }])),
    hooks: {
      files_seen: 0,
      records_seen: 0,
      statuses: {},
      reasons: {}
    }
  };

  for (const filePath of historyFiles(config.codexHome)) {
    report.files_scanned += 1;
    scanJsonlFile(filePath, config, (record) => scanTextRecord(record, config, report));
  }

  for (const filePath of hookFiles(config.codexHome)) {
    report.hooks.files_seen += 1;
    scanJsonlFile(filePath, config, (record) => scanHookRecord(record, config, report));
  }

  return report;
}

function scanTextRecord(record: unknown, config: Config, report: ScanReport): void {
  if (!isRecord(record) || isBeforeSince(record, config.since)) {
    return;
  }
  const text = extractText(record);
  if (text.length === 0 || !matchesRepoFilter(record, text, config.repoRoot)) {
    return;
  }
  report.records_seen += 1;
  let matched = false;
  for (const category of CATEGORIES) {
    if (category.patterns.some((pattern) => pattern.test(text))) {
      const summary = report.categories[category.id];
      if (summary === undefined) {
        continue;
      }
      summary.count += 1;
      matched = true;
      if (summary.examples.length < config.limit) {
        summary.examples.push(compact(text));
      }
    }
  }
  if (matched) {
    report.records_matched += 1;
  }
}

function scanHookRecord(record: unknown, config: Config, report: ScanReport): void {
  if (!isRecord(record) || isBeforeSince(record, config.since)) {
    return;
  }
  const text = JSON.stringify(record);
  if (!matchesRepoFilter(record, text, config.repoRoot)) {
    return;
  }
  report.hooks.records_seen += 1;
  increment(report.hooks.statuses, stringField(record, "status") ?? "<none>");
  const reason = stringField(record, "reason");
  if (reason !== undefined) {
    increment(report.hooks.reasons, reason);
  }
  scanTextRecord(record, config, report);
}

function historyFiles(codexHome: string): string[] {
  return [
    path.join(codexHome, "history.jsonl"),
    path.join(codexHome, "session_index.jsonl"),
    ...walk(path.join(codexHome, "sessions")).filter((filePath) => filePath.endsWith(".jsonl"))
  ].filter((filePath) => fs.existsSync(filePath));
}

function hookFiles(codexHome: string): string[] {
  const hooksDir = path.join(codexHome, "hooks");
  return walk(hooksDir).filter((filePath) => filePath.endsWith(".jsonl"));
}

function walk(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  const found: string[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    for (const entry of safeReadDir(current)) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
      } else if (entry.isFile()) {
        found.push(entryPath);
      }
    }
  }
  return found.sort();
}

function safeReadDir(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch (_error) {
    return [];
  }
}

function scanJsonlFile(filePath: string, config: Config, onRecord: (record: unknown) => void): void {
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/u)) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      onRecord(JSON.parse(line));
    } catch (_error) {
      continue;
    }
  }
}

function extractText(value: unknown): string {
  const parts: string[] = [];
  collectText(value, parts, 0);
  return parts.join("\n");
}

function collectText(value: unknown, parts: string[], depth: number): void {
  if (depth > 6 || value === null || value === undefined) {
    return;
  }
  if (typeof value === "string") {
    parts.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, parts, depth + 1);
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["text", "content", "message", "arguments", "output", "input", "cmd", "cwd", "workdir"]) {
    collectText(record[key], parts, depth + 1);
  }
  collectText(record.payload, parts, depth + 1);
}

function matchesRepoFilter(record: Record<string, unknown>, text: string, repoRoot: string | undefined): boolean {
  if (repoRoot === undefined) {
    return true;
  }
  const normalizedRoot = normalize(repoRoot);
  if (text.replaceAll("\\", "/").includes(normalizedRoot)) {
    return true;
  }
  return pathCandidates(record)
    .map(normalize)
    .some((candidate) => candidate === normalizedRoot || candidate.startsWith(`${normalizedRoot}/`));
}

function isBeforeSince(record: Record<string, unknown>, since: string | undefined): boolean {
  if (since === undefined) {
    return false;
  }
  const timestamp = stringField(record, "timestamp");
  return timestamp !== undefined && timestamp < since;
}

function renderMarkdown(report: ScanReport): string {
  const lines = [
    `# Codex History Mining Report`,
    "",
    `Generated: ${report.generated_at}`,
    "",
    `Codex home: \`${report.codex_home}\``,
    ...(report.repo_root === undefined ? [] : [`Repo filter: \`${report.repo_root}\``]),
    "",
    `Files scanned: ${report.files_scanned}`,
    `Records seen after filtering: ${report.records_seen}`,
    `Records matched: ${report.records_matched}`,
    "",
    "## Categories",
    ""
  ];

  for (const category of CATEGORIES) {
    const summary = report.categories[category.id];
    lines.push(`### ${category.title}`, "");
    lines.push(`Count: ${summary?.count ?? 0}`, "");
    lines.push(`Backlog signal: ${category.backlogSignal}`, "");
    for (const example of summary?.examples ?? []) {
      lines.push(`- ${example}`);
    }
    lines.push("");
  }

  lines.push("## Hook Summary", "");
  lines.push(`Hook files seen: ${report.hooks.files_seen}`);
  lines.push(`Hook records seen after filtering: ${report.hooks.records_seen}`, "");
  lines.push("### Statuses", "");
  for (const [status, count] of sortedEntries(report.hooks.statuses)) {
    lines.push(`- \`${status}\`: ${count}`);
  }
  lines.push("", "### Reasons", "");
  for (const [reason, count] of sortedEntries(report.hooks.reasons)) {
    lines.push(`- \`${reason}\`: ${count}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function readOption(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function pathCandidates(value: unknown): string[] {
  const candidates: string[] = [];
  collectPathCandidates(value, candidates, 0);
  return candidates;
}

function collectPathCandidates(value: unknown, candidates: string[], depth: number): void {
  if (depth > 6 || value === null || value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPathCandidates(item, candidates, depth + 1);
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["cwd", "workdir", "repo_root"]) {
    const valueForKey = record[key];
    if (typeof valueForKey === "string") {
      candidates.push(valueForKey);
    }
  }
  collectPathCandidates(record.payload, candidates, depth + 1);
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function sortedEntries(record: Record<string, number>): Array<[string, number]> {
  return Object.entries(record).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function compact(text: string): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return normalized.length > 300 ? `${normalized.slice(0, 297)}...` : normalized;
}

function normalize(value: string): string {
  return path.resolve(value).replaceAll("\\", "/");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
