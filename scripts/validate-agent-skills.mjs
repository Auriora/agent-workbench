#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";

const repoRoot = process.cwd();
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const includeAdvisoryCache = args.has("--advisory-cache");
const jsonOutput = args.has("--json");

function optionValues(name) {
  const values = [];
  for (let index = 0; index < rawArgs.length; index += 1) {
    if (rawArgs[index] === name && rawArgs[index + 1]) {
      values.push(rawArgs[index + 1]);
      index += 1;
    }
  }
  return values;
}

const defaultOwnedSkillRoots = [
  "plugins/agent-workbench/skills",
  "plugins/agent-workbench/claude-plugin/skills",
  "plugins/agent-workbench/kiro-power/skills"
];
const ownedSkillRoots = optionValues("--owned-root");
const selectedOwnedSkillRoots = ownedSkillRoots.length > 0 ? ownedSkillRoots : defaultOwnedSkillRoots;

function resolveRoot(root) {
  return path.isAbsolute(root) ? root : path.join(repoRoot, root);
}

function walk(directory, visit) {
  if (!fs.existsSync(directory)) {
    return;
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visit);
    } else {
      visit(fullPath);
    }
  }
}

function skillFilesUnder(root) {
  const files = [];
  walk(root, (filePath) => {
    if (path.basename(filePath) === "SKILL.md") {
      files.push(filePath);
    }
  });
  return files.sort();
}

function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { text, lines, frontmatter: null, error: "missing YAML frontmatter fence" };
  }
  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end === -1) {
    return { text, lines, frontmatter: null, error: "missing closing YAML frontmatter fence" };
  }
  try {
    return {
      text,
      lines,
      frontmatter: YAML.parse(lines.slice(1, end).join("\n")) ?? {},
      error: null
    };
  } catch (error) {
    return { text, lines, frontmatter: null, error: `invalid YAML frontmatter: ${error.message}` };
  }
}

function isPortableLocalReference(target) {
  if (
    target.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("<") ||
    target.startsWith("{")
  ) {
    return true;
  }
  return !path.isAbsolute(target) && !target.split(/[?#]/, 1)[0].startsWith("../");
}

function validateName(name, parentName) {
  const failures = [];
  if (typeof name !== "string" || name.trim() === "") {
    failures.push("frontmatter.name must be a non-empty string");
    return failures;
  }
  if (name.length > 64) {
    failures.push("frontmatter.name must be no more than 64 characters");
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    failures.push("frontmatter.name must use lowercase letters, numbers, and hyphens only");
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    failures.push("frontmatter.name must not start or end with a hyphen");
  }
  if (name.includes("--")) {
    failures.push("frontmatter.name must not contain consecutive hyphens");
  }
  if (name !== parentName) {
    failures.push(`frontmatter.name must match parent directory (${parentName})`);
  }
  return failures;
}

function validateSkill(filePath, mode) {
  const relativePath = path.relative(repoRoot, filePath);
  const skillRoot = path.dirname(filePath);
  const parentName = path.basename(skillRoot);
  const issues = [];
  const failureSeverity = mode === "owned" ? "error" : "warn";
  const parsed = parseFrontmatter(filePath);

  if (parsed.error) {
    issues.push({ severity: failureSeverity, file: relativePath, rule: "frontmatter", message: parsed.error });
    return issues;
  }

  for (const message of validateName(parsed.frontmatter.name, parentName)) {
    issues.push({ severity: failureSeverity, file: relativePath, rule: "name", message });
  }

  const description = parsed.frontmatter.description;
  if (typeof description !== "string" || description.trim() === "") {
    issues.push({
      severity: failureSeverity,
      file: relativePath,
      rule: "description",
      message: "frontmatter.description must be a non-empty string"
    });
  } else if (description.length > 1024) {
    issues.push({
      severity: failureSeverity,
      file: relativePath,
      rule: "description",
      message: "frontmatter.description must be no more than 1024 characters"
    });
  }

  if (parsed.lines.length > 500) {
    issues.push({
      severity: mode === "owned" ? "error" : "warn",
      file: relativePath,
      rule: "progressive-disclosure",
      message: `SKILL.md has ${parsed.lines.length} lines; keep owned skills under 500 lines`
    });
  }

  const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of parsed.text.matchAll(markdownLinkPattern)) {
    const target = match[1];
    if (!isPortableLocalReference(target)) {
      issues.push({
        severity: failureSeverity,
        file: relativePath,
        rule: "portable-reference",
        message: `non-portable skill reference: ${target}`
      });
      continue;
    }
    const localTarget = target.split(/[?#]/, 1)[0];
    if (localTarget && !/^[a-z][a-z0-9+.-]*:/i.test(localTarget)) {
      const resolved = path.resolve(skillRoot, localTarget);
      if (!resolved.startsWith(skillRoot + path.sep) && resolved !== skillRoot) {
        issues.push({
          severity: failureSeverity,
          file: relativePath,
          rule: "portable-reference",
          message: `skill reference escapes skill root: ${target}`
        });
      }
    }
  }

  return issues;
}

function advisoryRoots() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return [path.join(codexHome, "skills"), path.join(codexHome, "plugins", "cache")];
}

const ownedFiles = selectedOwnedSkillRoots.flatMap((root) => skillFilesUnder(resolveRoot(root)));
const advisoryFiles = includeAdvisoryCache ? advisoryRoots().flatMap(skillFilesUnder) : [];
const issues = [
  ...ownedFiles.flatMap((filePath) => validateSkill(filePath, "owned")),
  ...advisoryFiles.flatMap((filePath) => validateSkill(filePath, "advisory"))
];
const errors = issues.filter((issue) => issue.severity === "error");
const warnings = issues.filter((issue) => issue.severity === "warn");

const summary = {
  ownedSkillFiles: ownedFiles.map((filePath) => path.relative(repoRoot, filePath)),
  advisorySkillFiles: advisoryFiles.map((filePath) => path.relative(repoRoot, filePath)),
  errors: errors.length,
  warnings: warnings.length,
  issues
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  for (const issue of issues) {
    console.error(`${issue.severity.toUpperCase()} ${issue.file} [${issue.rule}]: ${issue.message}`);
  }
  console.log(
    `Agent Skills validation checked ${ownedFiles.length} owned skill file(s)` +
      (includeAdvisoryCache ? ` and ${advisoryFiles.length} advisory cache skill file(s)` : "") +
      `: ${errors.length} error(s), ${warnings.length} warning(s).`
  );
}

if (errors.length > 0) {
  process.exit(1);
}
