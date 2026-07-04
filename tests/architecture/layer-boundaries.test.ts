/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type ForbiddenRule = {
  name: string;
  check: (specifier: string) => boolean;
};

type LayerSpec = {
  layerName: string;
  directory: string;
  forbidden: ForbiddenRule[];
};

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDir, "..", "..");

const rules = {
  mcpSdk: {
    name: "MCP SDK",
    check: (specifier: string) => specifier.startsWith("@modelcontextprotocol/sdk/")
  },
  betterSqlite3: {
    name: "better-sqlite3",
    check: (specifier: string) => specifier.startsWith("better-sqlite3")
  },
  treeSitter: {
    name: "tree-sitter",
    check: (specifier: string) => specifier.startsWith("tree-sitter")
  },
  nodeFs: {
    name: "node:fs",
    check: (specifier: string) => specifier.startsWith("node:fs")
  },
  nodePath: {
    name: "node:path",
    check: (specifier: string) => specifier.startsWith("node:path")
  },
  nodeChildProcess: {
    name: "node:child_process",
    check: (specifier: string) => specifier.startsWith("node:child_process")
  },
  interfaceAdapterInfrastructure: {
    name: "src/infrastructure/interface-adapters",
    check: (specifier: string) => specifier.includes("infrastructure/interface-adapters")
  },
  concreteInfrastructure: {
    name: "src/infrastructure",
    check: (specifier: string) => /^\.+\//.test(specifier) && /\/infrastructure\//.test(specifier)
  },
  presentation: {
    name: "src/presentation",
    check: (specifier: string) => /^\.+\//.test(specifier) && /\/presentation\//.test(specifier)
  },
  sqliteInfrastructure: {
    name: "src/infrastructure/sqlite",
    check: (specifier: string) => specifier.includes("infrastructure/sqlite")
  },
  treeSitterInfrastructure: {
    name: "src/infrastructure/tree-sitter",
    check: (specifier: string) => specifier.includes("infrastructure/tree-sitter")
  },
  filesystemInfrastructure: {
    name: "src/infrastructure/filesystem",
    check: (specifier: string) => specifier.includes("infrastructure/filesystem")
  }
};

const architectureSlices: LayerSpec[] = [
  {
    layerName: "src/domain",
    directory: "src/domain",
    forbidden: [
      rules.mcpSdk,
      rules.betterSqlite3,
      rules.treeSitter,
      rules.nodeFs,
      rules.nodePath,
      rules.nodeChildProcess,
      rules.interfaceAdapterInfrastructure
    ]
  },
  {
    layerName: "src/ports",
    directory: "src/ports",
    forbidden: [
      rules.mcpSdk,
      rules.betterSqlite3,
      rules.treeSitter,
      rules.nodeFs,
      rules.nodePath,
      rules.nodeChildProcess,
      rules.interfaceAdapterInfrastructure
    ]
  },
  {
    layerName: "src/application",
    directory: "src/application",
    forbidden: [
      rules.mcpSdk,
      rules.betterSqlite3,
      rules.treeSitter,
      rules.nodeFs,
      rules.nodeChildProcess,
      rules.concreteInfrastructure,
      rules.presentation
    ]
  },
  {
    layerName: "src/presentation",
    directory: "src/presentation",
    forbidden: [
      rules.mcpSdk,
      rules.betterSqlite3,
      rules.treeSitter,
      rules.nodeFs,
      rules.nodeChildProcess,
      rules.concreteInfrastructure
    ]
  },
  {
    layerName: "src/interface-adapters/mcp",
    directory: "src/interface-adapters/mcp",
    forbidden: [
      rules.betterSqlite3,
      rules.concreteInfrastructure,
      rules.sqliteInfrastructure,
      rules.treeSitterInfrastructure,
      rules.filesystemInfrastructure
    ]
  }
];

type Violation = {
  file: string;
  specifier: string;
  rule: string;
};

function listTypeScriptFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function extractModuleSpecifiers(fileContents: string): string[] {
  const specifiers: string[] = [];
  const source = ts.createSourceFile("layer-boundary-input.ts", fileContents, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
      return;
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
      return;
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  return specifiers;
}

function gatherViolations(layer: LayerSpec): Violation[] {
  const layerDir = path.join(repositoryRoot, layer.directory);
  const violations: Violation[] = [];

  for (const file of listTypeScriptFiles(layerDir)) {
    const contents = fs.readFileSync(file, "utf8");
    const imports = extractModuleSpecifiers(contents);

    for (const specifier of imports) {
      for (const rule of layer.forbidden) {
        if (rule.check(specifier)) {
          violations.push({
            file: path.relative(repositoryRoot, file),
            specifier,
            rule: rule.name
          });
        }
      }
    }
  }

  return violations;
}

describe("architecture boundaries", () => {
  it("extracts module specifiers from imports and exports", () => {
    expect(extractModuleSpecifiers(`
      import fs from "node:fs";
      import {
        parseMarkdownHeadings,
        selectedMarkdownText
      } from "../../src/application/use-cases/markdown-docs.js";
      import type {
        FileCatalogEntry
      } from "../../src/domain/models/index.js";
      export {
        createTelemetryAdapter
      } from "../../src/infrastructure/telemetry/index.js";
      export type {
        GraphStore
      } from "../../src/infrastructure/sqlite/index.js";
      const lazy = import("../../src/infrastructure/tree-sitter/index.js");
    `)).toEqual([
      "node:fs",
      "../../src/application/use-cases/markdown-docs.js",
      "../../src/domain/models/index.js",
      "../../src/infrastructure/telemetry/index.js",
      "../../src/infrastructure/sqlite/index.js",
      "../../src/infrastructure/tree-sitter/index.js"
    ]);
  });

  for (const layer of architectureSlices) {
    it(`${layer.layerName} must not import forbidden modules`, () => {
      const violations = gatherViolations(layer);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});
