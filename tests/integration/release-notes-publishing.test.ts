/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error -- ESM .mjs helper imported into the TS test via esbuild.
import { renderGitHubReleaseNotes } from "../../scripts/ci/render-github-release-notes.mjs";

describe("GitHub release-note publishing", () => {
  it("removes only leading YAML frontmatter and preserves the Markdown body", () => {
    const body = "# Agent Workbench v0.6.2\n\n---\n\nBody with `code`.\n";
    const source = [
      "---",
      "title: Agent Workbench v0.6.2 release notes",
      "status: published",
      "---",
      body
    ].join("\n");

    expect(renderGitHubReleaseNotes(source)).toBe(body);
  });

  it("leaves a document without leading frontmatter byte-for-byte unchanged", () => {
    const source = "# Release\r\n\r\nBody\r\n---\r\nFooter\r\n";

    expect(renderGitHubReleaseNotes(source)).toBe(source);
  });

  it.each([
    ["unclosed", "---\ntitle: Release\n# Body", /not closed/],
    ["invalid YAML", "---\ntitle: [release\n---\n# Body\n", /malformed/],
    ["non-mapping YAML", "---\nrelease\n---\n# Body\n", /YAML mapping/]
  ])("rejects %s leading frontmatter", (_case, source, expected) => {
    expect(() => renderGitHubReleaseNotes(source)).toThrow(expected);
  });

  it("renders a temporary body before both GitHub release create and edit paths", () => {
    const workflow = fs.readFileSync(path.resolve(".github/workflows/release.yml"), "utf8");

    expect(workflow).toContain(
      'node scripts/ci/render-github-release-notes.mjs "${NOTES}" "${GITHUB_RELEASE_NOTES}"'
    );
    expect(workflow).toContain(
      'gh release edit "${TAG}" --title "${TAG}" --notes-file "${GITHUB_RELEASE_NOTES}"'
    );
    expect(workflow).toContain(
      'gh release create "${TAG}" "${TARBALL}" --title "${TAG}" --notes-file "${GITHUB_RELEASE_NOTES}"'
    );
    expect(workflow).not.toContain('--notes-file "${NOTES}"');
  });
});
