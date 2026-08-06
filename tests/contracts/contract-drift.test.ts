/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkPublicContractDrift,
  type ContractDriftInput
} from "../../src/application/use-cases/check-public-contract-drift.js";

const fixtureRoot = path.resolve("tests/fixtures/fixture-contract-drift");

function cleanInput(): ContractDriftInput {
  return {
    runtime_contracts_path: "runtime-contracts.md",
    runtime_contracts_markdown: fs.readFileSync(path.join(fixtureRoot, "runtime-contracts.md"), "utf8"),
    server_card_path: "server-card.json",
    server_card_json: fs.readFileSync(path.join(fixtureRoot, "server-card.json"), "utf8"),
    enums: {
      capability_level: ["resource_backed", "unsupported"],
      verification_status: ["done", "planned"],
      tool_capability_class: ["read_only", "workspace_write"]
    },
    tools: [
      { name: "inspect", capability_class: "read_only", mutation_class: "none", mutation_applied: false },
      { name: "apply", capability_class: "workspace_write", mutation_class: "workspace_write", mutation_applied: true }
    ]
  };
}

describe("public contract drift checker", () => {
  it("accepts aligned fixture documentation and source authorities", () => {
    expect(checkPublicContractDrift(cleanInput())).toEqual([]);
  });

  it("reports stable enum, example, next-action, tool, metadata, and safety drift", () => {
    const input = cleanInput();
    input.runtime_contracts_markdown = input.runtime_contracts_markdown
      .replace('"unsupported"', '"stale_documented_value"')
      .replace('"verification_status": "planned"', '"verification_status": "passed"')
      .replace('"tool": "inspect"', '"tool": "missing_tool"');
    input.server_card_json = input.server_card_json
      .replace('"name": "inspect"', '"name": "documented_only"')
      .replace('"capability_class": "workspace_write"', '"capability_class": "read_only"');
    input.tools = input.tools.map((tool) => tool.name === "apply"
      ? { ...tool, mutation_applied: false }
      : tool);

    expect(checkPublicContractDrift(input).map((finding) => finding.code)).toEqual([
      "CONTRACT_ENUM_DRIFT",
      "CONTRACT_EXAMPLE_ENUM_INVALID",
      "CONTRACT_MUTATION_POLICY_INVALID",
      "CONTRACT_NEXT_ACTION_TOOL_MISSING",
      "CONTRACT_TOOL_METADATA_DRIFT",
      "CONTRACT_TOOL_REGISTRY_DRIFT"
    ]);
  });

  it("fails closed for missing or malformed managed documents", () => {
    const input = cleanInput();
    input.runtime_contracts_markdown = "# no snapshot";
    input.server_card_json = "{}";
    expect(checkPublicContractDrift(input).map((finding) => finding.code)).toEqual([
      "CONTRACT_ENUM_SNAPSHOT_MISSING",
      "CONTRACT_SERVER_CARD_INVALID"
    ]);
  });

  it("rejects obsolete documented enums not backed by source", () => {
    const input = cleanInput();
    input.runtime_contracts_markdown = input.runtime_contracts_markdown.replace(
      '"tool_capability_class": ["read_only", "workspace_write"]',
      '"tool_capability_class": ["read_only", "workspace_write"], "obsolete_enum": ["old"]'
    );
    expect(checkPublicContractDrift(input)).toContainEqual(expect.objectContaining({
      code: "CONTRACT_ENUM_DRIFT",
      message: "Documented enum obsolete_enum has no source authority."
    }));
  });

  it("rejects example next actions without a string tool", () => {
    const input = cleanInput();
    input.runtime_contracts_markdown = input.runtime_contracts_markdown.replace(
      '{"tool": "inspect", "args": {}}',
      '{"args": {}}'
    );
    expect(checkPublicContractDrift(input)).toContainEqual(expect.objectContaining({
      code: "CONTRACT_NEXT_ACTION_TOOL_MISSING",
      message: "JSON example next action does not name a string tool."
    }));
  });
});
