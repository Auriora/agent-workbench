export type MarkdownDocStatus =
  | "current"
  | "draft"
  | "historical"
  | "legacy"
  | "archived"
  | "template"
  | "sample"
  | "unknown";

export type MarkdownDocAuthority = "canonical" | "supporting" | "non_authoritative";
export type MarkdownDocCurrencyState = "current" | "stale" | "superseded" | "historical" | "unknown";

export type MarkdownDocFrontmatterSignals = {
  status?: string;
  doc_type?: string;
  last_reviewed?: string;
  authority?: string;
  canonical_owner?: string;
  superseded_by?: string;
  review_after?: string;
  applies_to?: string;
};

export type DocumentationMapOwnerSignal = {
  concern: string;
  owner_path: string;
  source_path: string;
};

export type GitFileHistorySignal = {
  latest_touch?: {
    commit: string;
    committed_at: string;
  };
  first_seen?: {
    commit: string;
    committed_at: string;
  };
  status?: "available" | "unavailable";
  unavailable_reason?: string;
};

export function extractMarkdownFrontmatterSignals(content: string): MarkdownDocFrontmatterSignals {
  const lines = content.split(/\r?\n/u);
  if ((lines[0] ?? "").trim() !== "---") {
    return {};
  }
  const signals: Record<string, string> = {};
  const supported = new Set([
    "status",
    "doc_type",
    "last_reviewed",
    "authority",
    "canonical_owner",
    "superseded_by",
    "review_after",
    "applies_to"
  ]);
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "---") {
      return signals;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (!supported.has(key)) {
      continue;
    }
    signals[key] = line.slice(separator + 1).trim().replace(/^["']|["']$/gu, "");
  }
  return {};
}

export type MarkdownDocAuthoritySignal = {
  doc_status: MarkdownDocStatus;
  authority: MarkdownDocAuthority;
  authority_caveat: string;
  priority: number;
};

export type MarkdownDocCurrencySignal = MarkdownDocAuthoritySignal & {
  currency_state: MarkdownDocCurrencyState;
  currency_caveats: string[];
  canonical_owner?: string;
  superseded_by?: string;
  last_reviewed?: string;
  modified_at?: string;
  git_first_seen?: string;
  git_last_touched?: string;
  currency_priority: number;
};

export function classifyMarkdownDoc(input: {
  path: string;
  title?: string;
  content?: string;
  frontmatter?: MarkdownDocFrontmatterSignals;
}): MarkdownDocAuthoritySignal {
  const lowerPath = input.path.toLowerCase();
  const lowerTitle = (input.title ?? "").toLowerCase();
  const lowerContent = (input.content ?? "").slice(0, 4000).toLowerCase();
  const frontmatterStatus = input.frontmatter?.status ?? frontmatterValue(lowerContent, "status");
  const status = frontmatterStatus === undefined
    ? statusFromPathAndText({ lowerPath, lowerTitle, lowerContent })
    : statusFromFrontmatter(frontmatterStatus) ?? statusFromPathAndText({ lowerPath, lowerTitle, lowerContent });
  const authority = authorityFromStatus(status, lowerPath);

  return {
    doc_status: status,
    authority,
    authority_caveat: authorityCaveat(status, authority),
    priority: priorityForStatus(status, authority)
  };
}

export function classifyMarkdownDocCurrency(input: {
  path: string;
  title?: string;
  content?: string;
  frontmatter?: MarkdownDocFrontmatterSignals;
  modified_at?: string;
  documentation_map_owner?: DocumentationMapOwnerSignal;
  git_history?: GitFileHistorySignal;
  now_iso8601?: string;
}): MarkdownDocCurrencySignal {
  const authority = classifyMarkdownDoc(input);
  const frontmatter = input.frontmatter ?? {};
  const currencyCaveats: string[] = [];
  const canonicalOwner = normalizedOptional(frontmatter.canonical_owner) ?? input.documentation_map_owner?.owner_path;
  const supersededBy = normalizedOptional(frontmatter.superseded_by);
  const lastReviewed = normalizedOptional(frontmatter.last_reviewed);
  const reviewAfter = normalizedOptional(frontmatter.review_after);
  let currencyState = currencyStateFromAuthority(authority.doc_status);
  let currencyPriority = priorityForCurrency(currencyState);

  if (supersededBy !== undefined) {
    currencyState = "superseded";
    currencyPriority = priorityForCurrency(currencyState);
    currencyCaveats.push(`Document declares superseded_by: ${supersededBy}.`);
  }

  if (canonicalOwner !== undefined && canonicalOwner !== input.path) {
    currencyCaveats.push(`Current source should be corroborated with ${canonicalOwner}.`);
    if (authority.authority !== "canonical" && currencyState === "current") {
      currencyState = "unknown";
      currencyPriority = priorityForCurrency(currencyState);
    }
  }

  if (input.documentation_map_owner?.owner_path === input.path) {
    currencyState = authority.doc_status === "legacy" || authority.doc_status === "archived"
      ? currencyState
      : "current";
    currencyPriority += 4;
    currencyCaveats.push(`Documentation map lists this document as owner for ${input.documentation_map_owner.concern}.`);
  }

  if (lastReviewed !== undefined) {
    currencyCaveats.push(`last_reviewed: ${lastReviewed}.`);
  }
  if (reviewAfter !== undefined && isPastDate(reviewAfter, input.now_iso8601 ?? new Date().toISOString())) {
    currencyState = currencyState === "superseded" ? currencyState : "stale";
    currencyPriority = priorityForCurrency(currencyState);
    currencyCaveats.push(`review_after has passed: ${reviewAfter}.`);
  }
  if (input.modified_at !== undefined) {
    currencyCaveats.push(`modified_at: ${input.modified_at}.`);
  }
  if (input.git_history?.latest_touch !== undefined) {
    currencyCaveats.push(`git_last_touched: ${input.git_history.latest_touch.committed_at}.`);
  } else if (input.git_history?.status === "unavailable") {
    currencyCaveats.push(`Git recency evidence unavailable: ${input.git_history.unavailable_reason ?? "unknown"}.`);
  }

  if (currencyCaveats.length === 0 && currencyState === "unknown") {
    currencyCaveats.push("Document currency is unclear; corroborate with a current source before implementation.");
  }

  return {
    ...authority,
    currency_state: currencyState,
    currency_caveats: currencyCaveats,
    canonical_owner: canonicalOwner,
    superseded_by: supersededBy,
    last_reviewed: lastReviewed,
    modified_at: input.modified_at,
    git_first_seen: input.git_history?.first_seen?.committed_at,
    git_last_touched: input.git_history?.latest_touch?.committed_at,
    currency_priority: currencyPriority
  };
}

function statusFromFrontmatter(value: string): MarkdownDocStatus | undefined {
  const normalized = value.trim().replace(/^["']|["']$/gu, "").toLowerCase();
  if (["current", "accepted", "active", "published"].includes(normalized)) return "current";
  if (["draft", "proposed", "proposal", "review"].includes(normalized)) return "draft";
  if (["historical", "historic", "history"].includes(normalized)) return "historical";
  if (["legacy", "deprecated", "obsolete", "superseded", "retired"].includes(normalized)) return "legacy";
  if (["archived", "archive", "closed"].includes(normalized)) return "archived";
  if (["template"].includes(normalized)) return "template";
  if (["sample", "example", "fixture"].includes(normalized)) return "sample";
  return undefined;
}

function statusFromPathAndText(input: {
  lowerPath: string;
  lowerTitle: string;
  lowerContent: string;
}): MarkdownDocStatus {
  const joined = `${input.lowerPath}\n${input.lowerTitle}\n${input.lowerContent.slice(0, 1000)}`;
  if (/(^|\/)(archive|archived)(\/|$)/u.test(input.lowerPath)) return "archived";
  if (/(^|\/)(history|historical|updates|changelog|evaluations?)(\/|$)/u.test(input.lowerPath)) return "historical";
  if (/(^|[-_/])(legacy|deprecated|obsolete|superseded|retired)([-_/]|$)/u.test(joined)) return "legacy";
  if (/(^|\/)(templates?|boilerplate)(\/|$)/u.test(input.lowerPath) || /(^|\s)template($|\s)/u.test(input.lowerTitle)) {
    return "template";
  }
  if (/(^|\/)(samples?|examples?|fixtures?)(\/|$)/u.test(input.lowerPath)) return "sample";
  if (/(^|\n)status:\s*(draft|proposed|proposal|review)\b/u.test(input.lowerContent)) return "draft";
  if (input.lowerPath === "readme.md" || input.lowerPath === "agents.md") return "current";
  if (input.lowerPath.startsWith("skills/") || input.lowerPath.includes("/skills/")) return "current";
  if (input.lowerPath.startsWith("docs/specs/")) return "draft";
  if (/^docs\/(architecture|design|requirements|security|runbook|guide)\.md$/u.test(input.lowerPath)) return "current";
  if (/^docs\/(adr|api|architecture|checklists|data-flow|design|guides|requirements|runbooks|security)\//u.test(input.lowerPath)) {
    return "current";
  }
  return "unknown";
}

function authorityFromStatus(status: MarkdownDocStatus, lowerPath: string): MarkdownDocAuthority {
  if (status === "current") return "canonical";
  if (status === "unknown" && /^docs\/(reference|design|runbooks|requirements)\//u.test(lowerPath)) {
    return "supporting";
  }
  if (status === "draft" || status === "unknown" || status === "historical") return "supporting";
  return "non_authoritative";
}

function authorityCaveat(status: MarkdownDocStatus, authority: MarkdownDocAuthority): string {
  if (authority === "canonical") {
    return "Document is classified as current canonical or governing repository guidance.";
  }
  if (status === "draft") {
    return "Document is draft evidence; verify accepted direction before treating it as canonical.";
  }
  if (status === "historical") {
    return "Document is historical evidence; use it for background, not as current canonical behavior without corroboration.";
  }
  if (status === "legacy" || status === "archived") {
    return "Document is legacy or archived evidence; do not treat it as canonical without a current source.";
  }
  if (status === "template" || status === "sample") {
    return "Document is template or sample evidence; do not treat it as repository-specific canonical behavior.";
  }
  return "Document authority is unclear; corroborate with current source, AGENTS.md, README, or accepted docs before making canonical claims.";
}

function priorityForStatus(status: MarkdownDocStatus, authority: MarkdownDocAuthority): number {
  if (authority === "canonical") return 6;
  if (status === "unknown") return 0;
  if (status === "draft") return -3;
  if (status === "historical") return -5;
  if (status === "template" || status === "sample") return -8;
  if (status === "legacy" || status === "archived") return -10;
  return 0;
}

function currencyStateFromAuthority(status: MarkdownDocStatus): MarkdownDocCurrencyState {
  if (status === "current") return "current";
  if (status === "historical" || status === "archived" || status === "legacy") return "historical";
  return "unknown";
}

function priorityForCurrency(status: MarkdownDocCurrencyState): number {
  if (status === "current") return 6;
  if (status === "unknown") return 0;
  if (status === "stale") return -3;
  if (status === "historical") return -6;
  if (status === "superseded") return -12;
  return 0;
}

function normalizedOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^["']|["']$/gu, "");
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function isPastDate(value: string, nowIso8601: string): boolean {
  const target = Date.parse(value);
  const now = Date.parse(nowIso8601);
  return !Number.isNaN(target) && !Number.isNaN(now) && target < now;
}

function frontmatterValue(content: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*([^\\n]+)$`, "imu").exec(content);
  return match?.[1]?.trim();
}
