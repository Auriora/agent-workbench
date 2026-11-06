#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load the installed native parser set and SQLite binding, then parse one
 * representative source for every registered language route. The caller owns
 * dependency identity/path checks; this function only proves load and parse.
 */
export function runNativeParserFixtures(packageRequire) {
  const Parser = packageRequire("tree-sitter");
  const BetterSqlite3 = packageRequire("better-sqlite3");
  const sqlite = new BetterSqlite3(":memory:");
  sqlite.prepare("select 1 as value").get();
  sqlite.close();

  const grammars = {
    javascript: [packageRequire("tree-sitter-javascript"), "function f() { return 1; }"],
    typescript: [packageRequire("tree-sitter-typescript").typescript, "const value: number = 1;"],
    tsx: [packageRequire("tree-sitter-typescript").tsx, "const view = <Widget value={1} />;"],
    python: [packageRequire("tree-sitter-python"), "def f() -> int:\n    return 1\n"],
    ruby: [packageRequire("tree-sitter-ruby"), "def f\n  1\nend\n"],
    go: [packageRequire("tree-sitter-go"), "package main\nfunc main() {}\n"]
  };
  const expectedRoots = {
    javascript: "program",
    typescript: "program",
    tsx: "program",
    python: "module",
    ruby: "program",
    go: "source_file"
  };
  const parsedRoots = {};
  for (const [name, [language, source]] of Object.entries(grammars)) {
    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(source);
    assert(tree.rootNode.type === expectedRoots[name], `${name} root type is ${expectedRoots[name]}`);
    assert(tree.rootNode.hasError === false, `${name} fixture has no syntax errors`);
    parsedRoots[name] = tree.rootNode.type;
  }

  return {
    runtime_core: packageVersion(packageRequire, "tree-sitter"),
    parsed_roots: parsedRoots,
    native_sqlite_smoke: true
  };
}

function packageVersion(packageRequire, name) {
  const packageJsonPath = packageRequire.resolve(`${name}/package.json`);
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Native parser fixture failed: ${message}`);
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === modulePath) {
  const repoRoot = path.resolve(path.dirname(modulePath), "../..");
  const packageRequire = createRequire(path.join(repoRoot, "package.json"));
  try {
    const result = runNativeParserFixtures(packageRequire);
    process.stdout.write(`native-parser-fixtures OK ${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`native-parser-fixtures FAIL ${String(error instanceof Error ? error.message : error)}\n`);
    process.exitCode = 1;
  }
}
