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

export type MarkdownDocAuthoritySignal = {
  doc_status: MarkdownDocStatus;
  authority: MarkdownDocAuthority;
  authority_caveat: string;
  priority: number;
};

export function classifyMarkdownDoc(input: {
  path: string;
  title?: string;
  content?: string;
}): MarkdownDocAuthoritySignal {
  const lowerPath = input.path.toLowerCase();
  const lowerTitle = (input.title ?? "").toLowerCase();
  const lowerContent = (input.content ?? "").slice(0, 4000).toLowerCase();
  const frontmatterStatus = frontmatterValue(lowerContent, "status");
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

function statusFromFrontmatter(value: string): MarkdownDocStatus | undefined {
  const normalized = value.trim().replace(/^["']|["']$/gu, "");
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

function frontmatterValue(content: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*([^\\n]+)$`, "imu").exec(content);
  return match?.[1]?.trim();
}
