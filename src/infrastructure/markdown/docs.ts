import path from "node:path";
import type { DocsHeading, DocsLink } from "../../contracts/index.js";
import type { FileCatalogEntry } from "../../domain/models/index.js";

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
