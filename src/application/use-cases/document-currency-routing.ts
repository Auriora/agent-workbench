/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import type { DocumentReference, DocsDocument, DocsSearchHit } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import {
  classifyMarkdownDocCurrency,
  classifyDocumentationConcernOwner,
  parseDocumentationConcernMap,
  type DocumentationMapOwnerSignal,
  type MarkdownDocCurrencySignal
} from "../../domain/policies/index.js";
import type {
  DocumentationConcernIndexStateValue,
  DocumentationConcernOwnerWrite,
  DocumentationConcernTermWrite,
  DocumentationConcernWrite,
  WorkspaceFilePort
} from "../../ports/index.js";
import {
  extractMarkdownFrontmatterSignals,
  findDocumentationMapOwner
} from "./markdown-docs.js";

const DOCUMENTATION_MAP_PATH = "docs/reference/documentation-map.md";
const MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES = 120_000;

export type DocumentationConcernIndexEvidence = {
  state: DocumentationConcernIndexStateValue;
  source_path?: string;
  source_content_hash?: string;
  failure_reason?: string;
  concerns: DocumentationConcernWrite[];
  terms: DocumentationConcernTermWrite[];
  owners: DocumentationConcernOwnerWrite[];
  document_content_by_path: ReadonlyMap<string, string>;
};

export async function extractDocumentationConcernIndex(input: {
  workspace: WorkspaceFilePort;
  content_by_path?: ReadonlyMap<string, string>;
}): Promise<DocumentationConcernIndexEvidence> {
  let mapStat: Awaited<ReturnType<WorkspaceFilePort["stat"]>>;
  try {
    mapStat = await input.workspace.stat({ path: DOCUMENTATION_MAP_PATH });
  } catch (error) {
    return invalidConcernIndex(`Documentation map discovery failed: ${safeErrorMessage(error)}`);
  }
  if (!mapStat.exists) {
    return { state: "no_map", concerns: [], terms: [], owners: [], document_content_by_path: new Map() };
  }
  if (!mapStat.is_file) {
    return invalidConcernIndex("Documentation map path is not a file.");
  }
  if (mapStat.size_bytes > MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES) {
    return invalidConcernIndex(
      `Documentation map exceeds the ${MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES}-byte concern-index limit.`
    );
  }

  let mapContent: string;
  try {
    mapContent = input.content_by_path?.get(DOCUMENTATION_MAP_PATH) ??
      await input.workspace.readText({ path: DOCUMENTATION_MAP_PATH });
  } catch (error) {
    return invalidConcernIndex(`Documentation map read failed: ${safeErrorMessage(error)}`);
  }
  if (Buffer.byteLength(mapContent) > MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES) {
    return invalidConcernIndex(
      `Documentation map exceeds the ${MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES}-byte concern-index limit after read.`
    );
  }
  const contentHash = sha256(mapContent);
  const parsed = parseDocumentationConcernMap({ map_path: DOCUMENTATION_MAP_PATH, content: mapContent });
  if (parsed.status === "invalid") {
    return invalidConcernIndex(parsed.failure_reason, contentHash);
  }

  const ownerEvidenceByPath = new Map<string, Omit<DocumentationConcernOwnerWrite, "concern_key" | "source_line">>();
  const documentContentByPath = new Map<string, string>([[DOCUMENTATION_MAP_PATH, mapContent]]);
  for (const mappedPath of [...new Set(parsed.owners.map(({ mapped_owner_path }) => mapped_owner_path))].sort()) {
    let stat: Awaited<ReturnType<WorkspaceFilePort["stat"]>>;
    try {
      stat = await input.workspace.stat({ path: mappedPath });
    } catch (error) {
      return invalidConcernIndex(`Owner discovery failed for ${mappedPath}: ${safeErrorMessage(error)}`, contentHash);
    }
    if (!stat.exists) {
      ownerEvidenceByPath.set(mappedPath, { mapped_owner_path: mappedPath, owner_state: "missing" });
      continue;
    }
    if (!stat.is_file) return invalidConcernIndex(`Mapped owner is not a file: ${mappedPath}.`, contentHash);
    if (stat.size_bytes > MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES) {
      return invalidConcernIndex(
        `Mapped owner ${mappedPath} exceeds the ${MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES}-byte concern-index limit.`,
        contentHash
      );
    }
    let content: string;
    try {
      content = input.content_by_path?.get(mappedPath) ?? await input.workspace.readText({ path: mappedPath });
    } catch (error) {
      return invalidConcernIndex(`Owner read failed for ${mappedPath}: ${safeErrorMessage(error)}`, contentHash);
    }
    if (Buffer.byteLength(content) > MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES) {
      return invalidConcernIndex(
        `Mapped owner ${mappedPath} exceeds the ${MAX_DOCUMENTATION_CONCERN_SOURCE_BYTES}-byte concern-index limit after read.`,
        contentHash
      );
    }
    const classified = classifyDocumentationConcernOwner({ mapped_owner_path: mappedPath, content });
    if ("invalid" in classified) return invalidConcernIndex(classified.failure_reason, contentHash);
    ownerEvidenceByPath.set(mappedPath, {
      mapped_owner_path: mappedPath,
      document_id: classified.document_id,
      owner_state: classified.owner_state,
      superseded_by: classified.superseded_by,
      declared_canonical_owner: classified.declared_canonical_owner
    });
    documentContentByPath.set(mappedPath, content);
  }

  return {
    state: "complete",
    source_path: DOCUMENTATION_MAP_PATH,
    source_content_hash: contentHash,
    concerns: parsed.concerns,
    terms: parsed.terms,
    owners: parsed.owners.map((owner) => ({ ...owner, ...ownerEvidenceByPath.get(owner.mapped_owner_path)! })),
    document_content_by_path: documentContentByPath
  };
}

function invalidConcernIndex(failureReason: string, sourceContentHash?: string): DocumentationConcernIndexEvidence {
  return {
    state: "invalid",
    source_path: DOCUMENTATION_MAP_PATH,
    source_content_hash: sourceContentHash,
    failure_reason: failureReason.slice(0, 500),
    concerns: [],
    terms: [],
    owners: [],
    document_content_by_path: new Map()
  };
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export type PublicCurrencyFields = Pick<
  MarkdownDocCurrencySignal,
  | "currency_state"
  | "currency_caveats"
  | "canonical_owner"
  | "superseded_by"
  | "last_reviewed"
  | "modified_at"
  | "git_first_seen"
  | "git_last_touched"
  | "currency_priority"
>;

export type CurrencyDecoratedDocumentReference = DocumentReference & PublicCurrencyFields;
export type CurrencyDecoratedDocsDocument = DocsDocument & PublicCurrencyFields;
export type CurrencyDecoratedDocsSearchHit = DocsSearchHit & PublicCurrencyFields;

export async function loadDocumentationMapOwners(input: {
  files: readonly FileCatalogEntry[];
  workspace?: WorkspaceFilePort;
}): Promise<DocumentationMapOwnerSignal[]> {
  if (input.workspace === undefined || !input.files.some((file) => file.path === DOCUMENTATION_MAP_PATH)) {
    return [];
  }
  try {
    const parsed = parseDocumentationConcernMap({
      map_path: DOCUMENTATION_MAP_PATH,
      content: await input.workspace.readText({ path: DOCUMENTATION_MAP_PATH })
    });
    if (parsed.status === "invalid") return [];
    const labels = new Map(parsed.concerns.map((concern) => [concern.concern_key, concern.label]));
    return parsed.owners.map((owner) => ({
      concern: labels.get(owner.concern_key) ?? owner.concern_key,
      owner_path: owner.mapped_owner_path,
      source_path: DOCUMENTATION_MAP_PATH
    }));
  } catch {
    return [];
  }
}

export function classifyMarkdownEntryCurrency(input: {
  path: string;
  title: string;
  content?: string;
  mtime_ms?: number;
  owners?: readonly DocumentationMapOwnerSignal[];
}): MarkdownDocCurrencySignal {
  return classifyMarkdownDocCurrency({
    path: input.path,
    title: input.title,
    content: input.content,
    frontmatter: input.content === undefined ? undefined : extractMarkdownFrontmatterSignals(input.content),
    modified_at: input.mtime_ms === undefined ? undefined : new Date(input.mtime_ms).toISOString(),
    documentation_map_owner: findDocumentationMapOwner({
      documentPath: input.path,
      owners: input.owners ?? []
    })
  });
}

export function publicCurrency(input: MarkdownDocCurrencySignal): PublicCurrencyFields {
  return {
    currency_state: input.currency_state,
    currency_caveats: input.currency_caveats,
    canonical_owner: input.canonical_owner,
    superseded_by: input.superseded_by,
    last_reviewed: input.last_reviewed,
    modified_at: input.modified_at,
    git_first_seen: input.git_first_seen,
    git_last_touched: input.git_last_touched,
    currency_priority: input.currency_priority
  };
}

export function currencyRank(input: Pick<MarkdownDocCurrencySignal, "priority" | "currency_priority">): number {
  return input.priority + input.currency_priority;
}
