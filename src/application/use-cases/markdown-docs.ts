import path from "node:path";
import type { DocsHeading, DocsLink } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";
import type {
  DocumentationMapOwnerSignal,
  MarkdownDocFrontmatterSignals
} from "../../domain/policies/index.js";

export function parseMarkdownHeadings(content: string): DocsHeading[] {
  const slugCounts = new Map<string, number>();
  return content
    .split(/\r?\n/u)
    .map((line, index) => ({ line, index }))
    .map(({ line, index }) => {
      const match = /^(#{1,6})\s+(.+)$/u.exec(line);
      if (match === null) return undefined;
      const text = match[2] ?? "";
      const slug = slugify(text);
      const count = slugCounts.get(slug) ?? 0;
      slugCounts.set(slug, count + 1);
      return {
        id: count === 0 ? slug : `${slug}-${count + 1}`,
        text,
        depth: match[1]?.length ?? 1,
        line: index + 1
      };
    })
    .filter((heading): heading is DocsHeading => heading !== undefined);
}

export function extractMarkdownDocLinks(input: {
  fromPath: string;
  content: string;
  docs: readonly FileCatalogEntry[];
}): DocsLink[] {
  const docPaths = new Set(input.docs.map((file) => file.path));
  const links: DocsLink[] = [];
  const pattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  for (const match of input.content.matchAll(pattern)) {
    const label = match[1];
    const target = match[2];
    if (label === undefined || target === undefined || /^(?:https?:|mailto:|#)/u.test(target)) {
      continue;
    }
    const resolvedPath = path
      .normalize(path.join(path.dirname(input.fromPath), target.split("#", 1)[0] ?? ""))
      .replaceAll("\\", "/");
    links.push({
      label,
      target,
      resolved_path: resolvedPath,
      exists: docPaths.has(resolvedPath)
    });
  }
  return links.sort((left, right) => left.target.localeCompare(right.target));
}

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

export function extractDocumentationMapOwners(input: {
  mapPath: string;
  content: string;
}): DocumentationMapOwnerSignal[] {
  const owners: DocumentationMapOwnerSignal[] = [];
  for (const line of input.content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || /^(\|\s*-+)/u.test(trimmed)) {
      continue;
    }
    const cells = trimmed
      .slice(1, trimmed.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 2 || cells[0]?.toLowerCase() === "concern") {
      continue;
    }
    const owner = /\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/u.exec(cells[1] ?? "");
    if (owner?.[1] === undefined) {
      continue;
    }
    owners.push({
      concern: cells[0] ?? "",
      owner_path: path
        .normalize(path.join(path.dirname(input.mapPath), owner[1]))
        .replaceAll("\\", "/"),
      source_path: input.mapPath
    });
  }
  return owners;
}

export function findDocumentationMapOwner(input: {
  documentPath: string;
  owners: readonly DocumentationMapOwnerSignal[];
}): DocumentationMapOwnerSignal | undefined {
  return input.owners.find((owner) => owner.owner_path === input.documentPath);
}

export function markdownTitleFromPath(value: string): string {
  return path.basename(value, path.extname(value)).replace(/[-_]+/gu, " ");
}

export function selectedMarkdownText(input: { content: string; max_bytes: number }): {
  text: string;
  truncated: boolean;
} {
  if (Buffer.byteLength(input.content, "utf8") <= input.max_bytes) {
    return { text: input.content, truncated: false };
  }
  return {
    text: input.content.slice(0, input.max_bytes),
    truncated: true
  };
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  return slug.length === 0 ? "section" : slug;
}
