import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const docsRoot = path.resolve("docs");
const requiredFrontmatterFields = ["title", "doc_type", "status", "owner", "last_reviewed"];

describe("documentation links and metadata", () => {
  const docs = listMarkdownFiles(docsRoot);

  it("keeps required frontmatter on every docs markdown file", () => {
    expect(docs.length).toBeGreaterThan(0);

    for (const doc of docs) {
      const text = fs.readFileSync(doc, "utf8");
      const frontmatter = parseFrontmatter(text);
      expect(frontmatter, path.relative(process.cwd(), doc)).not.toBeNull();
      for (const field of requiredFrontmatterFields) {
        expect(frontmatter, `${path.relative(process.cwd(), doc)} missing ${field}`).toContain(
          `${field}:`
        );
      }
    }
  });

  it("resolves local markdown links to files or directories", () => {
    const failures: string[] = [];

    for (const doc of docs) {
      const text = fs.readFileSync(doc, "utf8");
      for (const link of extractMarkdownLinks(text)) {
        if (isExternalOrSpecialLink(link)) {
          continue;
        }
        const target = link.split("#", 1)[0];
        if (target === "") {
          continue;
        }

        const resolved = path.resolve(path.dirname(doc), decodeURI(target));
        if (!fs.existsSync(resolved)) {
          failures.push(`${path.relative(process.cwd(), doc)} -> ${link}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

function listMarkdownFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listMarkdownFiles(entryPath);
    }
    return entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

function parseFrontmatter(text: string): string | null {
  if (!text.startsWith("---\n")) {
    return null;
  }
  const end = text.indexOf("\n---\n", 4);
  return end === -1 ? null : text.slice(4, end);
}

function extractMarkdownLinks(text: string): string[] {
  const links: string[] = [];
  const pattern = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  for (const match of text.matchAll(pattern)) {
    if (match[1] !== undefined) {
      links.push(match[1]);
    }
  }
  return links;
}

function isExternalOrSpecialLink(link: string): boolean {
  return /^(?:https?:|mailto:|#)/u.test(link);
}
