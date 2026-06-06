import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-docs-query-repo");

describe("docs query fixtures", () => {
  it("covers headings, duplicate headings, links, missing links, skipped docs, and row-cap volume", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-docs-fixture-"));
    fs.cpSync(fixtureRoot, tempRoot, { recursive: true });
    const unreadablePath = path.join(tempRoot, "docs/unreadable.md");
    fs.chmodSync(unreadablePath, 0o000);
    try {
      const markdownFiles = listMarkdownFiles(tempRoot).map((file) =>
        path.relative(tempRoot, file).replaceAll("\\", "/")
      );
      const markdownTextByPath = new Map(
        markdownFiles
          .filter((file) => file !== "docs/unreadable.md")
          .map((file) => [
            file,
            fs.readFileSync(path.join(tempRoot, file), "utf8")
          ])
      );
      const scanned = await new FileCatalogScannerAdapter().scan({
        repo_root: tempRoot,
        indexed_roots: ["."],
        skipped_roots: [],
        max_files: 2000
      });

      expect(markdownFiles).toEqual(
        expect.arrayContaining([
          "README.md",
          "docs/guide.md",
          "docs/operations/runbook.md",
          "docs/reference/api.md",
          "docs/unreadable.md",
          "dist/generated-doc.md",
          "vendor/vendor-doc.md"
        ])
      );
      expect(() => fs.readFileSync(unreadablePath, "utf8")).toThrow();
      expect(extractHeadings(markdownTextByPath.get("docs/guide.md") ?? "")).toEqual([
        { depth: 1, text: "Guide" },
        { depth: 2, text: "Install" },
        { depth: 2, text: "Configure" },
        { depth: 3, text: "Details" },
        { depth: 2, text: "Duplicate" },
        { depth: 2, text: "Duplicate" }
      ]);
      expect(duplicateHeadingTexts(markdownTextByPath)).toEqual(
        expect.arrayContaining(["Duplicate"])
      );
      expect(extractLinks(markdownTextByPath)).toEqual(
        expect.arrayContaining([
          { from: "README.md", target: "docs/guide.md", exists: true },
          { from: "README.md", target: "docs/operations/runbook.md", exists: true },
          { from: "README.md", target: "docs/missing.md", exists: false },
          { from: "docs/guide.md", target: "docs/operations/runbook.md", exists: true }
        ])
      );
      expect(markdownFiles.filter((file) => file.startsWith("docs/reference/large-set-"))).toHaveLength(10);
      expect(scanned.files.map((file) => file.path)).toEqual(
        expect.arrayContaining([
          "README.md",
          "docs/guide.md",
          "docs/operations/runbook.md",
          "docs/reference/api.md"
        ])
      );
      expect(scanned.files.map((file) => file.path)).not.toContain("dist/generated-doc.md");
      expect(scanned.files.map((file) => file.path)).not.toContain("vendor/vendor-doc.md");
      expect(scanned.skipped_paths).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "dist",
            reason: "generated_or_vendor"
          }),
          expect.objectContaining({
            path: "vendor",
            reason: "generated_or_vendor"
          })
        ])
      );
    } finally {
      fs.chmodSync(unreadablePath, 0o600);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
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

function extractHeadings(text: string): Array<{ depth: number; text: string }> {
  return text
    .split(/\r?\n/u)
    .map((line) => /^(#{1,6})\s+(.+)$/u.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      depth: match[1]?.length ?? 0,
      text: match[2] ?? ""
    }));
}

function duplicateHeadingTexts(markdownTextByPath: Map<string, string>): string[] {
  const counts = new Map<string, number>();
  for (const text of markdownTextByPath.values()) {
    for (const heading of extractHeadings(text)) {
      counts.set(heading.text, (counts.get(heading.text) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([heading]) => heading)
    .sort();
}

function extractLinks(markdownTextByPath: Map<string, string>): Array<{
  from: string;
  target: string;
  exists: boolean;
}> {
  const links: Array<{ from: string; target: string; exists: boolean }> = [];
  const pattern = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
  for (const [from, text] of markdownTextByPath.entries()) {
    for (const match of text.matchAll(pattern)) {
      const rawTarget = match[1];
      if (rawTarget === undefined || /^(?:https?:|mailto:|#)/u.test(rawTarget)) {
        continue;
      }
      const target = path
        .normalize(path.join(path.dirname(from), rawTarget.split("#", 1)[0] ?? ""))
        .replaceAll("\\", "/");
      links.push({
        from,
        target,
        exists: markdownTextByPath.has(target)
      });
    }
  }
  return links.sort((left, right) => `${left.from}:${left.target}`.localeCompare(`${right.from}:${right.target}`));
}
