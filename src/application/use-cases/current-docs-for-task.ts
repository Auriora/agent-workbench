import path from "node:path";
import type {
  DocsCurrentForTaskRequest,
  DocsCurrentForTaskResult,
  DocsWarning,
  ResponseMetadata
} from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  FileCatalogScanPort,
  WorkspaceFilePort
} from "../../ports/index.js";
import {
  classifyMarkdownEntryCurrency,
  currencyRank,
  loadDocumentationMapOwners,
  publicCurrency
} from "./document-currency-routing.js";
import { markdownTitleFromPath, parseMarkdownHeadings } from "./markdown-docs.js";
import { getCatalogRepoStatus } from "./get-repo-status.js";
import { capNextActions } from "./response-metadata.js";

const DOC_ROW_LIMIT = 15000;

export type CurrentDocsForTaskUseCaseResult = {
  current_docs: DocsCurrentForTaskResult;
  meta: ResponseMetadata;
};

export async function getCurrentDocsForTask(input: {
  request: DocsCurrentForTaskRequest;
  scanner: FileCatalogScanPort;
  workspace: WorkspaceFilePort;
  default_repo_root: string;
}): Promise<CurrentDocsForTaskUseCaseResult> {
  const repoRoot = path.resolve(input.request.repo_root ?? input.default_repo_root);
  const scanned = await input.scanner.scan({
    repo_root: repoRoot,
    indexed_roots: ["."],
    skipped_roots: [],
    max_files: DOC_ROW_LIMIT
  });
  const requestFiles = input.request.files ?? [];
  const terms = tokenSet([input.request.task, ...requestFiles]);
  const explicit = new Set(requestFiles.map(normalizeRepoPath));
  const docs = scanned.files
    .filter((file) => file.file_identity.language === "markdown")
    .filter((file) => isInScope(file.path, input.request.scope_path))
    .map((file) => ({
      file,
      score: explicit.has(file.path) ? 100 : scoreDocPath(file.path, terms)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path))
    .slice(0, Math.max(input.request.max_docs * 4, input.request.max_docs));
  const owners = await loadDocumentationMapOwners({
    files: scanned.files,
    workspace: input.workspace
  });
  const warnings: DocsWarning[] = [];
  const refs = [];
  for (const candidate of docs) {
    try {
      const content = await input.workspace.readText({ path: candidate.file.path });
      const headings = parseMarkdownHeadings(content);
      const title = headings[0]?.text ?? markdownTitleFromPath(candidate.file.path);
      const currency = classifyMarkdownEntryCurrency({
        path: candidate.file.path,
        title,
        content,
        mtime_ms: candidate.file.file_identity.mtime_ms,
        owners
      });
      refs.push({
        score: candidate.score + currencyRank(currency),
        ref: {
          path: candidate.file.path,
          title,
          reason: [
            "Matched task terms, explicit files, or documentation priority.",
            currency.authority_caveat,
            currency.currency_caveats[0]
          ].filter((part) => part !== undefined && part.length > 0).join(" "),
          evidence_kinds: ["docs" as const],
          doc_status: currency.doc_status,
          authority: currency.authority,
          authority_caveat: currency.authority_caveat,
          ...publicCurrency(currency)
        }
      });
    } catch {
      warnings.push({
        path: candidate.file.path,
        reason: "permission_denied",
        message: `Documentation file ${candidate.file.path} could not be read.`
      });
    }
  }

  const sortedRefs = refs
    .sort((left, right) => right.score - left.score || left.ref.path.localeCompare(right.ref.path))
    .map((candidate) => candidate.ref);
  const canonicalDocs = sortedRefs.filter((doc) => doc.authority === "canonical" && doc.currency_state === "current");
  const supportingDocs = sortedRefs.filter((doc) => doc.authority === "supporting" && doc.currency_state === "current");
  const nonAuthoritativeDocs = sortedRefs.filter((doc) =>
    doc.authority === "non_authoritative" ||
    doc.currency_state === "historical" ||
    doc.currency_state === "superseded"
  );
  const known = new Set([...canonicalDocs, ...supportingDocs, ...nonAuthoritativeDocs].map((doc) => doc.path));
  const unknownDocs = sortedRefs.filter((doc) => !known.has(doc.path));
  const status = warnings.length > 0 || (canonicalDocs.length === 0 && supportingDocs.length === 0)
    ? "needed"
    : "done";
  const selected = [...canonicalDocs, ...supportingDocs, ...unknownDocs, ...nonAuthoritativeDocs].slice(0, input.request.max_docs);
  const catalogStatus = getCatalogRepoStatus({
    repo_root: scanned.repo_root,
    indexed_roots: scanned.indexed_roots,
    skipped_roots: scanned.skipped_roots,
    files: scanned.files,
    freshness: "unknown",
    truncated: scanned.truncated,
    row_limit: DOC_ROW_LIMIT
  });

  return {
    current_docs: {
      repo_root: scanned.repo_root,
      task: input.request.task,
      status,
      canonical_docs: canonicalDocs.slice(0, input.request.max_docs),
      supporting_docs: supportingDocs.slice(0, input.request.max_docs),
      non_authoritative_docs: nonAuthoritativeDocs.slice(0, input.request.max_docs),
      unknown_docs: unknownDocs.slice(0, input.request.max_docs),
      warnings,
      next_actions: capNextActions(selected.flatMap((doc) => [
        {
          tool: "docs_outline",
          args: {
            repo_root: scanned.repo_root,
            path: doc.path
          }
        },
        ...(doc.canonical_owner === undefined || doc.canonical_owner === doc.path
          ? []
          : [{
              tool: "docs_outline",
              args: {
                repo_root: scanned.repo_root,
                path: doc.canonical_owner
              }
            }])
      ]))
    },
    meta: {
      ...catalogStatus.meta,
      capability_level: "resource_backed",
      evidence_kinds: ["docs"],
      verification_status: status,
      truncated: scanned.truncated,
      budget: {
        row_limit: DOC_ROW_LIMIT
      }
    }
  };
}

function scoreDocPath(filePath: string, terms: Set<string>): number {
  const lower = filePath.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (term.length > 2 && lower.includes(term)) {
      score += 8;
    }
  }
  if (lower === "readme.md") score += 20;
  if (lower.includes("documentation-map")) score += 18;
  if (lower.includes("runtime-contract") || lower.includes("mcp-surface")) score += 16;
  if (lower.includes("design") || lower.includes("architecture")) score += 12;
  if (lower.includes("reference") || lower.includes("runbook")) score += 10;
  return score;
}

function tokenSet(values: readonly string[]): Set<string> {
  return new Set(values.flatMap((value) => value.toLowerCase().match(/[a-z0-9_/-]+/gu) ?? []));
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function isInScope(filePath: string, scopePath: string | undefined): boolean {
  if (scopePath === undefined) {
    return true;
  }
  const normalized = normalizeRepoPath(scopePath).replace(/\/+$/u, "");
  return filePath === normalized || filePath.startsWith(`${normalized}/`);
}
