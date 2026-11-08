/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PYTHON_FILES = 320;
const CALLS_PER_FILE = 24;
const FORMAT_PREFIX_BYTES = 16_384;
const FIXTURE_TIMESTAMP = "2001-01-01T00:00:00Z";

export type RefreshBaselineFixture = {
  repo_root: string;
  revision: string;
  content_fingerprint: string;
  source_timestamp: string;
  manifest: Array<{ path: string; bytes: number; sha256: string }>;
  counts: { python_files: number; python_call_references: number; files: number };
  expected_positive_qt_paths: string[];
  expected_inconclusive_qt_paths: string[];
  expected_typescript_paths: string[];
  expected_ignored_paths: string[];
};

/** Creates only a newly claimed owned directory; never updates a caller's repo. */
export function createRefreshBaselineFixture(input: {
  parent_root: string;
  python_files?: number;
}): RefreshBaselineFixture {
  const owningCheckout = fs.realpathSync.native(path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "../../.."
  ));
  if (fs.realpathSync.native(process.cwd()) !== owningCheckout) {
    throw new Error("Refresh baseline fixture must be run from the owning Agent Workbench checkout.");
  }
  const pythonFiles = input.python_files ?? DEFAULT_PYTHON_FILES;
  if (!Number.isSafeInteger(pythonFiles) || pythonFiles < 1 || pythonFiles > 10_000) {
    throw new Error("python_files must be an integer from 1 to 10000.");
  }
  const requestedParent = path.resolve(input.parent_root);
  const parentStats = fs.lstatSync(requestedParent);
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) {
    throw new Error("Fixture parent must be an existing non-symlink directory.");
  }
  const parentRoot = fs.realpathSync.native(requestedParent);
  const repoRoot = fs.mkdtempSync(path.join(parentRoot, "awb-refresh-baseline-"));
  fs.chmodSync(repoRoot, 0o700);
  const manifest: RefreshBaselineFixture["manifest"] = [];
  const sourceTimestamp = new Date(FIXTURE_TIMESTAMP);
  const write = (relativePath: string, content: string): void => {
    const absolutePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(absolutePath, content, { flag: "wx", mode: 0o600 });
    fs.utimesSync(absolutePath, sourceTimestamp, sourceTimestamp);
    manifest.push({ path: relativePath, bytes: Buffer.byteLength(content), sha256: sha256(content) });
  };

  write("AGENTS.md", "# Generated baseline fixture\n\nRead-only profiling input. No project commands are required.\n");
  write("README.md", "# Refresh profile baseline\n\nSynthetic CMake/Python workload with ordered cross-slice references.\n");
  write("CMakeLists.txt", "cmake_minimum_required(VERSION 3.20)\nproject(RefreshBaseline LANGUAGES CXX)\n");
  write(".gitignore", [
    "ignored-*.py", "!ignored-kept.py", "/ignored-root/", "*.generated", "artifact-*/",
    ...Array.from({ length: 24 }, (_, i) => `unused-${String(i).padStart(2, "0")}*.tmp`), ""
  ].join("\n"));
  write("docs/reference/baseline.md", "# Baseline contract\n\nEvery generated Python caller references the final helper twenty-four times.\n");
  for (let i = 0; i < pythonFiles; i += 1) {
    const name = String(i).padStart(5, "0");
    write(`src/callers/caller_${name}.py`, [
      `def invoke_${name}():`,
      ...Array.from({ length: CALLS_PER_FILE }, (_, call) => `    result_${call} = final_helper()`),
      `    return result_${CALLS_PER_FILE - 1}`, ""
    ].join("\n"));
  }
  write("z_final_helper.py", "def final_helper():\n    return 7\n");
  write("ignored-kept.py", "def admitted_by_negation():\n    return True\n");
  const expectedIgnoredPaths = ["ignored-discard.py", "ignored-root/deep.py", "src/skip.generated", "artifact-build/cache.py"];
  for (const p of expectedIgnoredPaths) write(p, "def excluded_fixture():\n    return False\n");

  const expectedPositiveQtPaths = ["src/translations/standard.ts", "src/translations/prolog.ts"];
  write(expectedPositiveQtPaths[0], '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE TS>\n<TS version="2.1" language="af"><context><name>Fixture</name><message><source>Hello</source><translation>Hallo</translation></message></context></TS>\n');
  write(expectedPositiveQtPaths[1], '\uFEFF<?xml version="1.0" encoding="utf-8"?>\n<!-- complete prolog -->\n<?fixture stable?>\n<TS version="2.1"><context><name>Fixture</name></context></TS>\n');
  const expectedInconclusiveQtPaths = ["src/translations/root-beyond-bound.ts"];
  write(expectedInconclusiveQtPaths[0], '<?xml version="1.0"?>\n' + " ".repeat(FORMAT_PREFIX_BYTES) + '<TS version="2.1"></TS>\n');
  const expectedTypescriptPaths = ["src/translations/actual-code.ts", "src/translations/long-comment.ts"];
  write(expectedTypescriptPaths[0], 'export function realCode(): string {\n  const xml = \'<?xml version="1.0"?><TS version="2.1"></TS>\';\n  return xml;\n}\n');
  write(expectedTypescriptPaths[1], "/*" + "x".repeat(FORMAT_PREFIX_BYTES + 32) + "*/\nexport const afterLongComment = 7;\n");

  manifest.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const contentFingerprint = sha256(JSON.stringify(manifest));
  const gitEnvironment: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))
  );
  Object.assign(gitEnvironment, {
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull,
    GIT_AUTHOR_NAME: "Agent Workbench fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Agent Workbench fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    GIT_AUTHOR_DATE: FIXTURE_TIMESTAMP, GIT_COMMITTER_DATE: FIXTURE_TIMESTAMP
  });
  const git = (...args: string[]): string => execFileSync("git", args, {
    cwd: repoRoot, env: gitEnvironment, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  git("init", "--quiet", "--initial-branch=main", "--object-format=sha1", "--template=");
  const hooksRoot = path.join(repoRoot, ".git", "disabled-hooks");
  fs.mkdirSync(hooksRoot, { mode: 0o700 });
  git("-c", "core.autocrlf=false", "add", "--all", "--force", "--", ".");
  git("-c", "commit.gpgsign=false", "-c", `core.hooksPath=${hooksRoot}`, "commit", "--quiet", "--no-verify", "-m", "Freeze refresh baseline fixture v1");
  const revision = git("rev-parse", "HEAD");
  // Git reads can update atime; restore only newly generated source files once
  // preparation finishes. Intentional scenario edits remain outside this helper.
  for (const file of manifest) {
    fs.utimesSync(path.join(repoRoot, file.path), sourceTimestamp, sourceTimestamp);
  }
  return {
    repo_root: repoRoot,
    revision,
    content_fingerprint: contentFingerprint,
    source_timestamp: FIXTURE_TIMESTAMP,
    manifest,
    counts: { python_files: pythonFiles + 2, python_call_references: pythonFiles * CALLS_PER_FILE, files: manifest.length },
    expected_positive_qt_paths: expectedPositiveQtPaths,
    expected_inconclusive_qt_paths: expectedInconclusiveQtPaths,
    expected_typescript_paths: expectedTypescriptPaths,
    expected_ignored_paths: expectedIgnoredPaths
  };
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function refreshBaselineFixtureMain(argv = process.argv.slice(2)): void {
  let parent: string | undefined;
  let count: number | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--parent" && argv[i + 1] !== undefined) parent = argv[++i];
    else if (option === "--python-files" && argv[i + 1] !== undefined) count = Number(argv[++i]);
    else throw new Error("Usage: refresh-baseline-fixture --parent <existing-directory> [--python-files <1..10000>]");
  }
  if (parent === undefined) throw new Error("--parent is required.");
  process.stdout.write(`${JSON.stringify(createRefreshBaselineFixture({ parent_root: parent, python_files: count }), null, 2)}\n`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  refreshBaselineFixtureMain();
}
