#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  appendHookLog,
  emitAdditionalContext,
  feedbackMode,
  isMain,
  parsePayload,
  readStdin,
  runQuietHook
} from "./hook-common.js";

const PATH_KEYS = ["path", "file_path", "filename"];
const READ_ONLY_ROOTS = [
  ".cache",
  ".claude",
  ".codex",
  ".devenv",
  ".direnv",
  ".git",
  ".gocache",
  ".gradle",
  ".home",
  ".local",
  ".m2",
  ".mypy_cache",
  ".nox",
  ".npm",
  ".nuxt",
  ".pixi",
  ".pnpm-store",
  ".pytest_cache",
  ".ruff_cache",
  ".sandbox",
  ".terraform",
  ".tox",
  ".venv",
  ".yarn",
  "__pycache__",
  "3rdparty",
  "artifacts",
  "bin",
  "build",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "obj",
  "publish",
  "target",
  "test-artifacts",
  "testresults",
  "third_party",
  "thirdparty",
  "vendor",
  "venv"
];
const SECRET_ENV_PATTERN = /(^|\/)\.env(?:$|\.(?!example$|sample$|template$)[^/]+$)/u;
const SECRET_BASENAME_PATTERN =
  /^(?:\.envrc|credentials(?:\.[^/]+)?|secrets(?:\.[^/]+)?|.+\.(?:key|pem|p12|pfx))$/iu;
const MAX_INLINE_CHECK_FILES = 5;
const MAX_FILE_BYTES = 512 * 1024;
const CHECK_TIMEOUT_MS = 3000;
const PYTHON_SUFFIXES = new Set([".py"]);
const JSON_SUFFIXES = new Set([".json"]);
const TOML_SUFFIXES = new Set([".toml"]);
const JAVASCRIPT_SUFFIXES = new Set([".cjs", ".js", ".mjs"]);
const SHELL_SUFFIXES = new Set([".bash", ".ksh", ".sh", ".zsh"]);
const TEXT_CHECK_SUFFIXES = new Set([
  ".c",
  ".cc",
  ".cfg",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mdx",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

export function extractChangedFiles(payload) {
  const files = new Set();
  const toolInput = objectValue(payload.tool_input);
  for (const key of PATH_KEYS) {
    const value = toolInput[key];
    if (typeof value === "string") {
      files.add(value);
    }
  }

  const oldPath = toolInput.old_path;
  const newPath = toolInput.new_path;
  if (typeof oldPath === "string") {
    files.add(oldPath);
  }
  if (typeof newPath === "string") {
    files.add(newPath);
  }

  for (const file of extractFilesFromToolResponse(payload.tool_response)) {
    files.add(file);
  }

  return [...files].filter((file) => looksLikePath(file));
}

export function buildPostEditFindings(payload) {
  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
  const findings = [];
  const checkable = [];

  if (!toolSucceeded(payload)) {
    appendHookLog("agent-workbench-post-edit", { status: "tool_failed_or_unknown", cwd });
    return findings;
  }

  for (const file of extractChangedFiles(payload)) {
    const normalized = normalizeRepoRelativePath(file, cwd);
    if (normalized.status === "outside") {
      findings.push(`Workspace escape path reported: ${normalized.displayPath}.`);
      continue;
    }

    const policyReason = hookPathPolicyReason(normalized.relativePath);
    if (policyReason) {
      findings.push(`${hookPolicyFindingLabel(policyReason)} changed: ${normalized.relativePath}.`);
    }

    checkable.push(normalized.relativePath);
  }

  const limited = checkable.slice(0, MAX_INLINE_CHECK_FILES);
  if (checkable.length > MAX_INLINE_CHECK_FILES) {
    appendHookLog("agent-workbench-post-edit", {
      status: "checks_deferred",
      reason: "too_many_files",
      file_count: checkable.length,
      cwd
    });
  }

  for (const relativePath of limited) {
    const finding = checkChangedFile(cwd, relativePath);
    if (finding) {
      findings.push(finding);
    }
  }

  return findings;
}

export function buildPostEditContext(payload, env = process.env) {
  if (feedbackMode(env) !== "basic") {
    return undefined;
  }

  return buildPostEditFeedback(payload).visible_message;
}

export function buildPostEditFeedback(payload) {
  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
  const changedFiles = extractChangedFiles(payload)
    .map((file) => normalizeRepoRelativePath(file, cwd))
    .filter((file) => file.status === "inside")
    .map((file) => file.relativePath);
  const checkedFiles = Array.from(new Set(changedFiles)).sort();
  const deferredChecks = buildHookDeferredChecks({
    cwd,
    checkedFiles,
    toolSucceeded: toolSucceeded(payload)
  });
  const findings = buildPostEditFindings(payload).map((message) => ({
    severity: message.startsWith("Workspace escape") ? "blocker" : "warning",
    message,
    category: message.includes(" changed: ") ? "edit_risk" : "diagnostic",
    blocking: message.startsWith("Workspace escape")
  }));

  return {
    status: findings.some((finding) => finding.blocking)
      ? "blocked"
      : findings.length > 0
        ? "needed"
        : "done",
    outcome: classifyHookOutcome({ checkedFiles, findings, deferredChecks }),
    checked_files: checkedFiles,
    findings,
    deferred_checks: deferredChecks,
    visible_message: findings.length === 0 ? undefined : findings.slice(0, 3).map((finding) => finding.message).join(" "),
    next_actions: findings.length === 0 && deferredChecks.length === 0
      ? []
      : [
          {
            tool: "diagnostics_for_files",
            args: {
              repo_root: cwd,
              files: checkedFiles
            }
          },
          {
            tool: "verification_plan",
            args: {
              repo_root: cwd,
              changed_files: checkedFiles
            }
          }
        ]
  };
}

function buildHookDeferredChecks(input) {
  const deferredChecks = [];
  if (!input.toolSucceeded) {
    deferredChecks.push({
      reason: "diagnostics_error",
      outcome: "errored",
      count: 1,
      message: "Post-edit feedback skipped diagnostics because the triggering tool did not report success.",
      follow_up_tool: "verification_plan"
    });
  }

  if (input.checkedFiles.length > MAX_INLINE_CHECK_FILES) {
    deferredChecks.push({
      reason: "too_many_files",
      outcome: "queued",
      count: input.checkedFiles.length - MAX_INLINE_CHECK_FILES,
      paths: input.checkedFiles.slice(MAX_INLINE_CHECK_FILES),
      message: "Changed file count exceeds the inline post-edit diagnostics budget.",
      follow_up_tool: "diagnostics_for_files"
    });
  }

  const limited = input.checkedFiles.slice(0, MAX_INLINE_CHECK_FILES);
  const skippedPaths = limited.filter((relativePath) => shouldReportSkippedInlineCheck(input.cwd, relativePath));
  if (skippedPaths.length > 0) {
    deferredChecks.push({
      reason: "diagnostics_skipped",
      outcome: "skipped",
      count: skippedPaths.length,
      paths: skippedPaths,
      message: "One or more changed files were not checked inline by the hook.",
      follow_up_tool: "diagnostics_for_files"
    });
  }

  return deferredChecks;
}

function shouldReportSkippedInlineCheck(cwd, relativePath) {
  const suffix = path.extname(relativePath).toLowerCase();
  if (!TEXT_CHECK_SUFFIXES.has(suffix)) {
    return true;
  }
  const absolutePath = path.resolve(cwd, relativePath);
  try {
    if (!absolutePath.startsWith(path.resolve(cwd) + path.sep)) {
      return true;
    }
    const stat = fs.statSync(absolutePath);
    return !stat.isFile() || stat.size > MAX_FILE_BYTES;
  } catch {
    return true;
  }
}

function classifyHookOutcome(input) {
  if (input.findings.length > 0) {
    return "actionable";
  }
  if (input.deferredChecks.some((check) => check.outcome === "queued")) {
    return "queued";
  }
  if (input.deferredChecks.some((check) => check.outcome === "errored")) {
    return "errored";
  }
  if (input.deferredChecks.some((check) => check.outcome === "unavailable")) {
    return "unavailable";
  }
  if (input.deferredChecks.some((check) => check.outcome === "skipped")) {
    return "skipped";
  }
  if (input.checkedFiles.length > 0) {
    return "checked";
  }
  return "silent";
}

function objectValue(value) {
  return typeof value === "object" && value !== null ? value : {};
}

function toolSucceeded(payload) {
  const response = payload.tool_response;
  if (response === undefined || response === null) {
    return true;
  }
  if (typeof response === "object") {
    const code = response.code ?? response.exit_code ?? response.exitCode;
    return typeof code === "number" ? code === 0 : true;
  }
  return true;
}

function extractFilesFromToolResponse(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const matches = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[AMDR]|[A-Z][a-z]+)\s+(.+)$/);
    if (match?.[1]) {
      matches.push(match[1].trim());
    }
  }
  return matches;
}

function looksLikePath(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.includes("\0") &&
    !trimmed.includes("\n") &&
    !trimmed.includes("\r") &&
    !trimmed.includes(",") &&
    !trimmed.startsWith("code:")
  );
}

function normalizeRepoRelativePath(file, cwd) {
  const normalizedFile = file.replaceAll("\\", "/");
  const candidate = path.isAbsolute(normalizedFile)
    ? path.relative(cwd, normalizedFile)
    : normalizedFile;
  const relativePath = path.posix.normalize(candidate.replaceAll("\\", "/")).replace(/^\.\//, "");

  if (
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    path.isAbsolute(relativePath)
  ) {
    return { status: "outside", displayPath: relativePath };
  }

  return { status: "inside", relativePath };
}

export function hookPathPolicyReason(file) {
  const normalized = file.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (isSecretPath(normalized)) {
    return "secret";
  }
  return READ_ONLY_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}/`))
    ? "generated_or_vendor"
    : undefined;
}

function hookPolicyFindingLabel(reason) {
  switch (reason) {
    case "secret":
      return "Secret-bearing path";
    case "generated_or_vendor":
    default:
      return "Generated/local artifact";
  }
}

function isSecretPath(file) {
  const basename = file.slice(file.lastIndexOf("/") + 1);
  return (
    file === ".env" ||
    file.endsWith("/.env") ||
    SECRET_ENV_PATTERN.test(file) ||
    SECRET_BASENAME_PATTERN.test(basename)
  );
}

function checkChangedFile(cwd, relativePath) {
  const absolutePath = path.resolve(cwd, relativePath);
  if (!absolutePath.startsWith(path.resolve(cwd) + path.sep)) {
    return undefined;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return undefined;
  }

  const suffix = path.extname(relativePath).toLowerCase();
  const content = readSmallTextFile(absolutePath);
  if (content === undefined) {
    appendHookLog("agent-workbench-post-edit", {
      status: "check_skipped",
      reason: "large_or_unreadable_file",
      path: relativePath
    });
    return undefined;
  }

  if (TEXT_CHECK_SUFFIXES.has(suffix) && hasConflictMarkers(content)) {
    return `Merge conflict marker in ${relativePath}.`;
  }

  if (JSON_SUFFIXES.has(suffix)) {
    try {
      JSON.parse(content);
    } catch (error) {
      return `JSON syntax error in ${relativePath}: ${compactErrorMessage(error)}.`;
    }
  }

  if (PYTHON_SUFFIXES.has(suffix)) {
    return commandSyntaxFinding("python3", ["-m", "py_compile", absolutePath], "Python syntax error", relativePath);
  }

  if (TOML_SUFFIXES.has(suffix)) {
    return commandSyntaxFinding(
      "python3",
      ["-c", "import pathlib, sys, tomllib; tomllib.loads(pathlib.Path(sys.argv[1]).read_text())", absolutePath],
      "TOML syntax error",
      relativePath
    );
  }

  if (JAVASCRIPT_SUFFIXES.has(suffix)) {
    return commandSyntaxFinding("node", ["--check", absolutePath], "JavaScript syntax error", relativePath);
  }

  if (SHELL_SUFFIXES.has(suffix)) {
    return commandSyntaxFinding("bash", ["-n", absolutePath], "Shell syntax error", relativePath);
  }

  return undefined;
}

function readSmallTextFile(file) {
  try {
    const stat = fs.statSync(file);
    if (stat.size > MAX_FILE_BYTES) {
      return undefined;
    }
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function hasConflictMarkers(content) {
  return /^(<<<<<<< .+|=======|>>>>>>> .+)$/m.test(content);
}

function commandSyntaxFinding(command, args, label, relativePath) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: CHECK_TIMEOUT_MS,
    windowsHide: true
  });

  if (result.signal || result.status === null) {
    appendHookLog("agent-workbench-post-edit", {
      status: "check_unavailable",
      command,
      path: relativePath,
      error: result.error?.code ?? result.signal ?? "unknown"
    });
    return undefined;
  }

  if (result.status === 0) {
    return undefined;
  }

  const message = compactCommandMessage(result.stderr || result.stdout, relativePath);
  return `${label} in ${relativePath}${message ? `: ${message}` : ""}.`;
}

function compactCommandMessage(output, relativePath) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replaceAll(process.cwd(), "").replaceAll(relativePath, "").trim())
    .filter((line) => line && !line.startsWith("File \""));
  return lines.at(-1)?.slice(0, 120) ?? "";
}

function compactErrorMessage(error) {
  return error instanceof Error ? error.message.split("\n")[0].slice(0, 120) : "invalid syntax";
}

async function main() {
  const payload = parsePayload(await readStdin());
  const context = buildPostEditContext(payload);
  if (context) {
    emitAdditionalContext("PostToolUse", context);
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = await runQuietHook(main);
}
