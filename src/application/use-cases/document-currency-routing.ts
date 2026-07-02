import type { DocumentReference, DocsDocument, DocsSearchHit } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import {
  classifyMarkdownDocCurrency,
  type DocumentationMapOwnerSignal,
  type MarkdownDocCurrencySignal
} from "../../domain/policies/index.js";
import type { WorkspaceFilePort } from "../../ports/index.js";
import {
  extractDocumentationMapOwners,
  extractMarkdownFrontmatterSignals,
  findDocumentationMapOwner
} from "./markdown-docs.js";

const DOCUMENTATION_MAP_PATH = "docs/reference/documentation-map.md";

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
    return extractDocumentationMapOwners({
      mapPath: DOCUMENTATION_MAP_PATH,
      content: await input.workspace.readText({ path: DOCUMENTATION_MAP_PATH })
    });
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
