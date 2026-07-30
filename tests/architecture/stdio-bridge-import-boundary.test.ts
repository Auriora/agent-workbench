/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, "..", "..");

type RuntimeImport = {
  importer: string;
  specifier: string;
  resolved?: string;
};

function runtimeSpecifiers(filePath: string): string[] {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      !node.importClause?.isTypeOnly &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return specifiers;
}

function resolveRepoImport(importer: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return;
  const candidate = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    candidate,
    candidate.endsWith(".js") ? `${candidate.slice(0, -3)}.ts` : undefined,
    candidate.endsWith(".mjs") ? candidate : undefined,
    `${candidate}.ts`,
    `${candidate}.mjs`,
    path.join(candidate, "index.ts")
  ].filter((entry): entry is string => entry !== undefined);
  return candidates.find((entry) => fs.existsSync(entry) && fs.statSync(entry).isFile());
}

function transitiveRuntimeImports(roots: string[]): RuntimeImport[] {
  const pending = roots.map((root) => path.resolve(repositoryRoot, root));
  const visited = new Set<string>();
  const imports: RuntimeImport[] = [];

  while (pending.length > 0) {
    const importer = pending.pop()!;
    if (visited.has(importer)) continue;
    visited.add(importer);

    for (const specifier of runtimeSpecifiers(importer)) {
      const resolved = resolveRepoImport(importer, specifier);
      imports.push({
        importer: path.relative(repositoryRoot, importer),
        specifier,
        resolved: resolved === undefined ? undefined : path.relative(repositoryRoot, resolved)
      });
      if (resolved !== undefined && !visited.has(resolved)) pending.push(resolved);
    }
  }

  return imports;
}

describe("stdio bridge runtime import boundary", () => {
  it("cannot reach daemon-owned server, SQLite, parser, or MCP registry modules", () => {
    const imports = transitiveRuntimeImports([
      "src/mcp/stdio-entrypoint.mjs",
      "src/mcp/stdio.ts"
    ]);
    const violations = imports.filter(({ specifier, resolved }) => {
      if (
        specifier === "better-sqlite3" ||
        specifier === "tree-sitter" ||
        specifier.startsWith("tree-sitter-") ||
        specifier === "@modelcontextprotocol/sdk" ||
        specifier.startsWith("@modelcontextprotocol/sdk/")
      ) {
        return true;
      }
      return resolved === "src/mcp/daemon.ts" ||
        resolved === "src/server.ts" ||
        resolved?.startsWith("src/infrastructure/sqlite/") === true ||
        resolved?.startsWith("src/infrastructure/tree-sitter/") === true ||
        resolved === "src/interface-adapters/mcp/server.ts" ||
        resolved?.startsWith("src/interface-adapters/mcp/registries/") === true;
    });

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    expect(imports.some(({ resolved }) => resolved === "src/mcp/daemon-client.ts")).toBe(true);
  });

  it("keeps every compiled runtime input independent of the tsx loader", () => {
    const imports = transitiveRuntimeImports([
      "src/mcp/stdio.ts",
      "src/mcp/daemon-main.ts",
      "src/infrastructure/workers/startup-graph-warmup-worker.ts"
    ]);

    const loaderImports = imports.filter(({ specifier }) =>
      specifier === "tsx" || specifier.startsWith("tsx/")
    );
    expect(loaderImports, JSON.stringify(loaderImports, null, 2)).toEqual([]);
  });

  it("delegates daemon startup through the daemon main entrypoint module", () => {
    const daemonEntryPath = path.resolve(repositoryRoot, "src/mcp/daemon-entrypoint.mjs");
    const directImports = runtimeSpecifiers(daemonEntryPath)
      .map((specifier) => resolveRepoImport(daemonEntryPath, specifier))
      .filter((resolved): resolved is string => resolved !== undefined)
      .map((resolved) => path.relative(repositoryRoot, resolved));

    expect(directImports).toContain("src/mcp/daemon-main.ts");
    expect(directImports).not.toContain("src/mcp/daemon.ts");

    const daemonEntryPoint = fs.readFileSync(
      path.resolve(repositoryRoot, "src/mcp/daemon-entrypoint.mjs"),
      "utf8"
    );
    expect(daemonEntryPoint).toContain(`await import("./daemon-main.ts");`);
    expect(daemonEntryPoint).not.toContain("runDaemonFromEnv");
  });
});
