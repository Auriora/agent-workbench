/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  DocsConcernMatchEvidence,
  DocumentationConcernOwnerEvidence,
  DocumentationConcernOwnerState
} from "../../contracts/index.js";
import {
  classifyMarkdownDoc,
  extractMarkdownFrontmatterSignals,
  type MarkdownDocFrontmatterSignals
} from "./document-authority.js";

export type ParsedDocumentationConcern = {
  concern_key: string;
  label: string;
  normalized_label: string;
};

export type ParsedDocumentationConcernTerm = {
  concern_key: string;
  normalized_term: string;
  token_count: number;
};

export type ParsedDocumentationConcernOwner = {
  concern_key: string;
  mapped_owner_path: string;
  source_line: number;
};

export type ParsedDocumentationConcernMap =
  | {
      status: "complete";
      concerns: ParsedDocumentationConcern[];
      terms: ParsedDocumentationConcernTerm[];
      owners: ParsedDocumentationConcernOwner[];
    }
  | { status: "invalid"; failure_reason: string };

export type ClassifiedDocumentationConcernOwner = {
  document_id: string;
  owner_state: Exclude<DocumentationConcernOwnerState, "missing">;
  superseded_by?: string;
  declared_canonical_owner?: string;
};

export type DocumentationConcernResolution = {
  normalized_query: string;
  query_tokens: string[];
  concern_match_state: "matched" | "no_match";
  matches: DocsConcernMatchEvidence[];
};

export type DocumentationConcernResolutionTerm = {
  concern_key: string;
  normalized_term: string;
  token_count: number;
};

export type DocumentationConcernResolutionOwner = {
  concern_key: string;
  mapped_owner_path: string;
  document_id?: string;
  owner_state: DocumentationConcernOwnerState;
  superseded_by?: string;
  declared_canonical_owner?: string;
};

export function normalizeDocumentationConcern(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}]+/gu, " ")
    .replace(/[\t\n\r\f\v ]+/gu, " ")
    .trim();
}

export function documentationConcernKey(label: string): string {
  return normalizeDocumentationConcern(label).split(" ").filter(Boolean).join("-");
}

export function resolveDocumentationConcerns(input: {
  query: string;
  terms: readonly DocumentationConcernResolutionTerm[];
  owners: readonly DocumentationConcernResolutionOwner[];
}): DocumentationConcernResolution {
  const normalizedQuery = normalizeDocumentationConcern(input.query);
  const queryTokens = normalizedQuery.length === 0 ? [] : normalizedQuery.split(" ");
  const ownersByConcern = new Map<string, DocumentationConcernOwnerEvidence[]>();
  for (const owner of input.owners) {
    const evidence: DocumentationConcernOwnerEvidence = {
      path: owner.mapped_owner_path,
      state: owner.owner_state,
      ...(owner.document_id === undefined ? {} : { document_id: owner.document_id }),
      ...(owner.superseded_by === undefined ? {} : { superseded_by: owner.superseded_by }),
      ...(owner.declared_canonical_owner === undefined
        ? {}
        : { declared_canonical_owner: owner.declared_canonical_owner })
    };
    const current = ownersByConcern.get(owner.concern_key) ?? [];
    const identity = ownerEvidenceIdentity(evidence);
    if (!current.some((candidate) => ownerEvidenceIdentity(candidate) === identity)) {
      current.push(evidence);
      current.sort(compareOwnerEvidence);
      ownersByConcern.set(owner.concern_key, current);
    }
  }

  const matches = new Map<string, DocsConcernMatchEvidence>();
  for (const term of input.terms) {
    const normalizedTerm = normalizeDocumentationConcern(term.normalized_term);
    if (normalizedTerm.length === 0) continue;
    const termTokens = normalizedTerm.split(" ");
    if (term.token_count !== termTokens.length) continue;
    for (let start = 0; start <= queryTokens.length - termTokens.length; start += 1) {
      if (!termTokens.every((token, offset) => queryTokens[start + offset] === token)) continue;
      const key = `${term.concern_key}\u0000${normalizedTerm}\u0000${start}`;
      matches.set(key, {
        concern_key: term.concern_key,
        normalized_term: normalizedTerm,
        query_token_start: start,
        query_token_end_exclusive: start + termTokens.length,
        token_count: termTokens.length,
        owners: [...(ownersByConcern.get(term.concern_key) ?? [])]
      });
    }
  }

  const orderedMatches = [...matches.values()].sort((left, right) =>
    right.token_count - left.token_count ||
    compareOrdinal(left.concern_key, right.concern_key) ||
    compareOrdinal(firstOwnerPath(left), firstOwnerPath(right)) ||
    compareOrdinal(left.normalized_term, right.normalized_term) ||
    left.query_token_start - right.query_token_start
  );
  return {
    normalized_query: normalizedQuery,
    query_tokens: queryTokens,
    concern_match_state: orderedMatches.length === 0 ? "no_match" : "matched",
    matches: orderedMatches
  };
}

function ownerEvidenceIdentity(owner: DocumentationConcernOwnerEvidence): string {
  return [
    owner.path,
    owner.state,
    owner.document_id ?? "",
    owner.superseded_by ?? "",
    owner.declared_canonical_owner ?? ""
  ].join("\u0000");
}

function compareOwnerEvidence(
  left: DocumentationConcernOwnerEvidence,
  right: DocumentationConcernOwnerEvidence
): number {
  return compareOrdinal(left.path, right.path) ||
    compareOrdinal(left.state, right.state) ||
    compareOrdinal(left.document_id ?? "", right.document_id ?? "") ||
    compareOrdinal(left.superseded_by ?? "", right.superseded_by ?? "") ||
    compareOrdinal(left.declared_canonical_owner ?? "", right.declared_canonical_owner ?? "");
}

function firstOwnerPath(match: DocsConcernMatchEvidence): string {
  return match.owners[0]?.path ?? "";
}

function compareOrdinal(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function parseDocumentationConcernMap(input: {
  map_path: string;
  content: string;
}): ParsedDocumentationConcernMap {
  const lines = input.content.split(/\r?\n/u);
  let header: { concern: number; owners: number; terms?: number } | undefined;
  let inRegistry = false;
  const concerns = new Map<string, ParsedDocumentationConcern & { source_line: number }>();
  const terms = new Map<string, ParsedDocumentationConcernTerm>();
  const owners = new Map<string, ParsedDocumentationConcernOwner>();

  for (const [lineIndex, line] of lines.entries()) {
    if (!line.trim().startsWith("|")) {
      if (inRegistry && line.trim().length > 0) break;
      continue;
    }
    const cells = tableCells(line);
    if (header === undefined) {
      const normalized = cells.map((cell) => normalizeDocumentationConcern(cell));
      const concern = normalized.indexOf("concern");
      const owner = normalized.indexOf("canonical owner");
      if (concern < 0 || owner < 0) continue;
      const termsIndex = normalized.indexOf("intent terms");
      header = { concern, owners: owner, terms: termsIndex < 0 ? undefined : termsIndex };
      inRegistry = true;
      continue;
    }
    if (isSeparatorRow(cells)) continue;
    const sourceLine = lineIndex + 1;
    const label = cells[header.concern]?.trim() ?? "";
    const normalizedLabel = normalizeDocumentationConcern(label);
    if (normalizedLabel.length === 0) {
      return { status: "invalid", failure_reason: `Documentation concern label is empty at line ${sourceLine}.` };
    }
    const concernKey = documentationConcernKey(label);
    const existingConcern = concerns.get(concernKey);
    if (existingConcern === undefined || sourceLine < existingConcern.source_line) {
      concerns.set(concernKey, {
        concern_key: concernKey,
        label,
        normalized_label: normalizedLabel,
        source_line: sourceLine
      });
    }
    addTerm(terms, concernKey, normalizedLabel);

    const intentCell = header.terms === undefined ? undefined : cells[header.terms];
    if (intentCell !== undefined && intentCell.trim().length > 0) {
      const aliases = intentCell.split(";");
      if (aliases.some((alias) => alias.trim().length === 0)) {
        return { status: "invalid", failure_reason: `Intent terms contain an empty element at line ${sourceLine}.` };
      }
      for (const alias of aliases) {
        const normalized = normalizeDocumentationConcern(alias);
        if (normalized.length === 0) {
          return { status: "invalid", failure_reason: `Intent term is empty after normalization at line ${sourceLine}.` };
        }
        addTerm(terms, concernKey, normalized);
      }
    }

    const ownerCell = cells[header.owners] ?? "";
    const targets = [...ownerCell.matchAll(
      /\[[^\]]+\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+"[^"]*")?\s*\)/gu
    )].map((match) => match[1] ?? match[2]);
    if (targets.length === 0) {
      return { status: "invalid", failure_reason: `Documentation concern has no owner link at line ${sourceLine}.` };
    }
    for (const target of targets) {
      const mappedPath = canonicalRepositoryPath(
        target?.split("#", 1)[0] ?? "",
        repositoryDirectory(input.map_path)
      );
      if (mappedPath === undefined) {
        return { status: "invalid", failure_reason: `Documentation owner path escapes the repository at line ${sourceLine}.` };
      }
      const key = `${concernKey}\u0000${mappedPath}`;
      const existing = owners.get(key);
      if (existing === undefined || sourceLine < existing.source_line) {
        owners.set(key, { concern_key: concernKey, mapped_owner_path: mappedPath, source_line: sourceLine });
      }
    }
  }

  if (header === undefined) {
    return { status: "invalid", failure_reason: "Documentation map has no Concern and Canonical owner registry columns." };
  }
  return {
    status: "complete",
    concerns: [...concerns.values()]
      .sort((left, right) => compareOrdinal(left.concern_key, right.concern_key))
      .map(({ source_line: _sourceLine, ...concern }) => concern),
    terms: [...terms.values()].sort((left, right) =>
      compareOrdinal(left.concern_key, right.concern_key) || compareOrdinal(left.normalized_term, right.normalized_term)
    ),
    owners: [...owners.values()].sort((left, right) =>
      compareOrdinal(left.concern_key, right.concern_key) ||
      compareOrdinal(left.mapped_owner_path, right.mapped_owner_path) ||
      left.source_line - right.source_line
    )
  };
}

export function classifyDocumentationConcernOwner(input: {
  mapped_owner_path: string;
  content: string;
}): ClassifiedDocumentationConcernOwner | { invalid: true; failure_reason: string } {
  if (hasMalformedFrontmatter(input.content)) {
    return { invalid: true, failure_reason: `Malformed frontmatter in ${input.mapped_owner_path}.` };
  }
  const frontmatter = extractMarkdownFrontmatterSignals(input.content);
  const canonicalOwner = normalizedFrontmatterPath(frontmatter.canonical_owner);
  if (frontmatter.canonical_owner !== undefined && canonicalOwner === undefined) {
    return { invalid: true, failure_reason: `Invalid canonical_owner path in ${input.mapped_owner_path}.` };
  }
  const supersededBy = normalizedFrontmatterPath(frontmatter.superseded_by);
  if (frontmatter.superseded_by !== undefined && supersededBy === undefined) {
    return { invalid: true, failure_reason: `Invalid superseded_by path in ${input.mapped_owner_path}.` };
  }
  const document = classifyMarkdownDoc({
    path: input.mapped_owner_path,
    content: input.content,
    frontmatter
  });
  if (canonicalOwner !== undefined && canonicalOwner !== input.mapped_owner_path) {
    return {
      document_id: input.mapped_owner_path,
      owner_state: "conflicting",
      declared_canonical_owner: canonicalOwner
    };
  }
  if (supersededBy !== undefined) {
    return {
      document_id: input.mapped_owner_path,
      owner_state: "superseded",
      superseded_by: supersededBy
    };
  }
  if (["archived", "historical", "legacy", "template", "sample"].includes(document.doc_status)) {
    return { document_id: input.mapped_owner_path, owner_state: "archived" };
  }
  if (document.doc_status === "draft") {
    return { document_id: input.mapped_owner_path, owner_state: "draft" };
  }
  return { document_id: input.mapped_owner_path, owner_state: "valid" };
}

function addTerm(
  terms: Map<string, ParsedDocumentationConcernTerm>,
  concernKey: string,
  normalizedTerm: string
): void {
  terms.set(`${concernKey}\u0000${normalizedTerm}`, {
    concern_key: concernKey,
    normalized_term: normalizedTerm,
    token_count: normalizedTerm.split(" ").length
  });
}

function tableCells(line: string): string[] {
  const trimmed = line.trim();
  return trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim());
}

function isSeparatorRow(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
}

function canonicalRepositoryPath(value: string, base = ""): string | undefined {
  const portable = value.trim().replaceAll("\\", "/");
  if (portable.length === 0 || portable.startsWith("/") || /^[a-z][a-z0-9+.-]*:/iu.test(portable)) return undefined;
  const segments: string[] = [];
  for (const segment of `${base}/${portable}`.split("/")) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length === 0 ? undefined : segments.join("/");
}

function repositoryDirectory(filePath: string): string {
  const portable = filePath.replaceAll("\\", "/");
  const separator = portable.lastIndexOf("/");
  return separator < 0 ? "" : portable.slice(0, separator);
}

function normalizedFrontmatterPath(value: string | undefined): string | undefined {
  return value === undefined ? undefined : canonicalRepositoryPath(value);
}

function hasMalformedFrontmatter(content: string): boolean {
  const lines = content.split(/\r?\n/u);
  return lines[0]?.trim() === "---" && !lines.slice(1).some((line) => line.trim() === "---");
}

export function documentationConcernFrontmatter(content: string): MarkdownDocFrontmatterSignals {
  return extractMarkdownFrontmatterSignals(content);
}
