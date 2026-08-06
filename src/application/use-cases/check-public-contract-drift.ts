/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ContractEnumAuthorities = Readonly<Record<string, readonly string[]>>;

export type ContractToolAuthority = {
  name: string;
  capability_class: string;
  mutation_class: string;
  mutation_applied: boolean;
};

export type ContractDriftFinding = {
  code: string;
  path: string;
  message: string;
};

export type ContractDriftInput = {
  runtime_contracts_path: string;
  runtime_contracts_markdown: string;
  server_card_path: string;
  server_card_json: string;
  enums: ContractEnumAuthorities;
  tools: readonly ContractToolAuthority[];
};

const SNAPSHOT_PATTERN = /<!-- contract-drift:begin -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- contract-drift:end -->/;
const JSON_FENCE_PATTERN = /```json\s*([\s\S]*?)\s*```/g;

export function checkPublicContractDrift(input: ContractDriftInput): ContractDriftFinding[] {
  const findings: ContractDriftFinding[] = [];
  const toolNames = new Set(input.tools.map((tool) => tool.name));
  const snapshotMatch = SNAPSHOT_PATTERN.exec(input.runtime_contracts_markdown);
  if (snapshotMatch === null) {
    findings.push(finding("CONTRACT_ENUM_SNAPSHOT_MISSING", input.runtime_contracts_path,
      "The managed contract enum snapshot is missing."));
  } else {
    const snapshot = parseObject(snapshotMatch[1] ?? "");
    if (snapshot === undefined) {
      findings.push(finding("CONTRACT_ENUM_SNAPSHOT_INVALID", input.runtime_contracts_path,
        "The managed contract enum snapshot is not valid JSON."));
    } else {
      for (const [name, sourceValues] of Object.entries(input.enums)) {
        const documented = snapshot[name];
        if (!isStringArray(documented) || !sameValues(documented, sourceValues)) {
          findings.push(finding("CONTRACT_ENUM_DRIFT", input.runtime_contracts_path,
            `Documented enum ${name} does not match source values.`));
        }
      }
      for (const name of Object.keys(snapshot)) {
        if (!(name in input.enums)) {
          findings.push(finding("CONTRACT_ENUM_DRIFT", input.runtime_contracts_path,
            `Documented enum ${name} has no source authority.`));
        }
      }
    }
  }

  inspectJsonExamples(input.runtime_contracts_markdown, input.runtime_contracts_path,
    input.enums, toolNames, findings);
  inspectServerCard(input.server_card_json, input.server_card_path, input.tools, findings);
  inspectMutationSafety(input.tools, findings);

  return findings.sort((left, right) =>
    left.code.localeCompare(right.code) || left.path.localeCompare(right.path) || left.message.localeCompare(right.message));
}

function inspectJsonExamples(
  markdown: string,
  sourcePath: string,
  enums: ContractEnumAuthorities,
  toolNames: ReadonlySet<string>,
  findings: ContractDriftFinding[]
): void {
  for (const match of markdown.matchAll(JSON_FENCE_PATTERN)) {
    let value: unknown;
    try {
      value = JSON.parse(match[1] ?? "");
    } catch {
      continue;
    }
    visit(value, (key, child) => {
      const enumName = key === "capability_level"
        ? "capability_level"
        : key === "verification_status" || key === "validation_status"
          ? "verification_status"
          : undefined;
      if (enumName !== undefined && typeof child === "string" && !(enums[enumName] ?? []).includes(child)) {
        findings.push(finding("CONTRACT_EXAMPLE_ENUM_INVALID", sourcePath,
          `JSON example uses invalid ${key} value ${JSON.stringify(child)}.`));
      }
      if (key === "next_actions" && Array.isArray(child)) {
        for (const action of child) {
          if (!isRecord(action) || typeof action.tool !== "string") {
            findings.push(finding("CONTRACT_NEXT_ACTION_TOOL_MISSING", sourcePath,
              "JSON example next action does not name a string tool."));
          } else if (!toolNames.has(action.tool)) {
            findings.push(finding("CONTRACT_NEXT_ACTION_TOOL_MISSING", sourcePath,
              `JSON example next action names unregistered tool ${JSON.stringify(action.tool)}.`));
          }
        }
      }
    });
  }
}

function inspectServerCard(
  json: string,
  sourcePath: string,
  authorities: readonly ContractToolAuthority[],
  findings: ContractDriftFinding[]
): void {
  const card = parseObject(json);
  if (card === undefined || !Array.isArray(card.tools)) {
    findings.push(finding("CONTRACT_SERVER_CARD_INVALID", sourcePath,
      "The MCP server card must contain a tools array."));
    return;
  }
  const documented = card.tools.filter(isRecord);
  const documentedNames = documented.map((tool) => tool.name).filter((name): name is string => typeof name === "string");
  const sourceNames = authorities.map((tool) => tool.name);
  if (!sameValues(documentedNames, sourceNames)) {
    findings.push(finding("CONTRACT_TOOL_REGISTRY_DRIFT", sourcePath,
      "Documented MCP tool names do not match the public registry."));
  }
  const documentedByName = new Map(documented
    .filter((tool): tool is Record<string, unknown> & { name: string } => typeof tool.name === "string")
    .map((tool) => [tool.name, tool]));
  for (const authority of authorities) {
    const tool = documentedByName.get(authority.name);
    if (tool !== undefined && (tool.capability_class !== authority.capability_class || tool.mutation_class !== authority.mutation_class)) {
      findings.push(finding("CONTRACT_TOOL_METADATA_DRIFT", sourcePath,
        `Documented MCP metadata for ${authority.name} does not match the registry.`));
    }
  }
}

function inspectMutationSafety(tools: readonly ContractToolAuthority[], findings: ContractDriftFinding[]): void {
  for (const tool of tools) {
    if (tool.mutation_class === "workspace_write" &&
      (tool.capability_class !== "workspace_write" || !tool.mutation_applied)) {
      findings.push(finding("CONTRACT_MUTATION_POLICY_INVALID", "src/interface-adapters/mcp/registries/index.ts",
        `Mutating tool ${tool.name} lacks workspace-write capability or applied-mutation trust policy.`));
    }
    if (tool.mutation_class !== "workspace_write" && tool.mutation_applied) {
      findings.push(finding("CONTRACT_MUTATION_POLICY_INVALID", "src/interface-adapters/mcp/registries/index.ts",
        `Non-mutating tool ${tool.name} claims applied mutation.`));
    }
  }
}

function visit(value: unknown, inspect: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    for (const child of value) visit(child, inspect);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    inspect(key, child);
    visit(child, inspect);
  }
}

function parseObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join("\0") === [...right].sort().join("\0");
}

function finding(code: string, path: string, message: string): ContractDriftFinding {
  return { code, path, message };
}
