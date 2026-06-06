import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileCatalogScannerAdapter } from "../../src/infrastructure/filesystem/index.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-fts-docs-search-repo");

describe("FTS docs search fixtures", () => {
  it("covers ranking, pagination, skipped docs, and degraded index state cases", async () => {
    const markdownFiles = listMarkdownFiles(fixtureRoot).map((file) =>
      path.relative(fixtureRoot, file).replaceAll("\\", "/")
    );
    const textByPath = new Map(
      markdownFiles.map((file) => [file, fs.readFileSync(path.join(fixtureRoot, file), "utf8")])
    );
    const scanned = await new FileCatalogScannerAdapter().scan({
      repo_root: fixtureRoot,
      indexed_roots: ["."],
      skipped_roots: [],
      max_files: 2000
    });
    const indexStates = JSON.parse(
      fs.readFileSync(path.join(fixtureRoot, "docs-index-states.json"), "utf8")
    ) as {
      states: Array<{ state: string; expected_status: string; reason: string }>;
    };

    expect(markdownFiles).toEqual(
      expect.arrayContaining([
        "README.md",
        "docs/reference/docs-query-read-surfaces.md",
        "docs/evaluations/agent-workbench-python-agent-ide.md",
        "docs/guides/ai-agent/template.md",
        "docs/guides/ai-agent/general.md",
        "docs/reference/heading-match.md",
        "dist/generated-doc.md",
        "vendor/vendor-doc.md"
      ])
    );
    expect(textByPath.get("docs/reference/docs-query-read-surfaces.md")?.toLowerCase()).toContain(
      "docs query read surfaces"
    );
    expect(extractHeadings(textByPath.get("docs/reference/heading-match.md") ?? "")).toContain(
      "Requirement 2 Docs Search"
    );
    expect(textByPath.get("docs/evaluations/agent-workbench-python-agent-ide.md")).toContain(
      "RepositoryResolver"
    );
    expect(textByPath.get("docs/guides/ai-agent/template.md")).toContain(
      "common terms such as agent, guide, workbench"
    );
    expect(markdownFiles.filter((file) => file.startsWith("docs/pagination/page-"))).toHaveLength(6);
    expect(scanned.files.map((file) => file.path)).not.toContain("dist/generated-doc.md");
    expect(scanned.files.map((file) => file.path)).not.toContain("vendor/vendor-doc.md");
    expect(scanned.skipped_paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "dist", reason: "generated_or_vendor" }),
        expect.objectContaining({ path: "vendor", reason: "generated_or_vendor" })
      ])
    );
    expect(indexStates.states.map((state) => state.state).sort()).toEqual([
      "cold",
      "invalid",
      "stale",
      "unavailable"
    ]);
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

function extractHeadings(text: string): string[] {
  return text
    .split(/\r?\n/u)
    .map((line) => /^(#{1,6})\s+(.+)$/u.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[2] ?? "");
}
