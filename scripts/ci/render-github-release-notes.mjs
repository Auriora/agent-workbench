#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export function renderGitHubReleaseNotes(source) {
  const firstLineEnd = source.indexOf("\n");
  const firstLine = (firstLineEnd === -1 ? source : source.slice(0, firstLineEnd)).replace(/\r$/, "");
  if (firstLine !== "---") return source;

  let lineStart = firstLineEnd === -1 ? source.length : firstLineEnd + 1;
  let closingStart = -1;
  let bodyStart = source.length;
  while (lineStart < source.length) {
    const lineEnd = source.indexOf("\n", lineStart);
    const contentEnd = lineEnd === -1 ? source.length : lineEnd;
    const line = source.slice(lineStart, contentEnd).replace(/\r$/, "");
    if (line === "---") {
      closingStart = lineStart;
      bodyStart = lineEnd === -1 ? source.length : lineEnd + 1;
      break;
    }
    lineStart = lineEnd === -1 ? source.length : lineEnd + 1;
  }

  if (closingStart === -1) {
    throw new Error("Leading YAML frontmatter is not closed with an exact '---' delimiter.");
  }

  const metadataStart = firstLineEnd + 1;
  const metadata = source.slice(metadataStart, closingStart);
  let parsed;
  try {
    parsed = YAML.parse(metadata);
  } catch (error) {
    throw new Error(`Leading YAML frontmatter is malformed: ${error.message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Leading YAML frontmatter must be a YAML mapping.");
  }

  return source.slice(bodyStart);
}

function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (inputPath === undefined || outputPath === undefined || process.argv.length !== 4) {
    throw new Error("Usage: render-github-release-notes.mjs <input-markdown> <output-markdown>");
  }
  const source = fs.readFileSync(inputPath, "utf8");
  const rendered = renderGitHubReleaseNotes(source);
  fs.writeFileSync(outputPath, rendered, "utf8");
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Unable to render GitHub release notes: ${error.message}`);
    process.exitCode = 1;
  }
}
