import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
      rules.concreteInfrastructure
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
  const lines: string[] = fileContents.split(/\r?\n/);
  const importLines = lines.filter((line: string) => line.trim().length > 0);
  const specifiers: string[] = [];
  const importFrom = /^\s*(?:import|export)\s+[^"']*?\s+from\s+["']([^"']+)["']/;
  const importBare = /^\s*import\s+["']([^"']+)["']/;
  const importDynamic = /^\s*import\(\s*["']([^"']+)["']\s*\)/;

  for (const line of importLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) {
      continue;
    }

    const [, fromMatch] = trimmed.match(importFrom) as RegExpMatchArray | null ?? [];
    if (fromMatch) {
      specifiers.push(fromMatch);
      continue;
    }

    const [, bareMatch] = trimmed.match(importBare) as RegExpMatchArray | null ?? [];
    if (bareMatch) {
      specifiers.push(bareMatch);
      continue;
    }

    const [, dynamicMatch] = trimmed.match(importDynamic) as RegExpMatchArray | null ?? [];
    if (dynamicMatch) {
      specifiers.push(dynamicMatch);
    }
  }

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
  for (const layer of architectureSlices) {
    it(`${layer.layerName} must not import forbidden modules`, () => {
      const violations = gatherViolations(layer);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});
