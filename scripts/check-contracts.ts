/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import {
  capabilityLevelSchema,
  toolCapabilityClassSchema,
  verificationStatusSchema
} from "../src/contracts/index.js";
import { checkPublicContractDrift } from "../src/application/use-cases/check-public-contract-drift.js";
import { mcpTools } from "../src/interface-adapters/mcp/registries/index.js";

const runtimeContractsPath = "docs/reference/runtime-contracts.md";
const serverCardPath = ".well-known/mcp/server-card.json";
const findings = checkPublicContractDrift({
  runtime_contracts_path: runtimeContractsPath,
  runtime_contracts_markdown: fs.readFileSync(runtimeContractsPath, "utf8"),
  server_card_path: serverCardPath,
  server_card_json: fs.readFileSync(serverCardPath, "utf8"),
  enums: {
    capability_level: capabilityLevelSchema.options,
    verification_status: verificationStatusSchema.options,
    tool_capability_class: toolCapabilityClassSchema.options
  },
  tools: mcpTools.map((tool) => ({
    name: tool.name,
    capability_class: tool.metadata.capability_class,
    mutation_class: tool.metadata.mutation_class,
    mutation_applied: tool.metadata.trust_policy?.mutation_applied === true
  }))
});

if (findings.length > 0) {
  for (const finding of findings) {
    process.stderr.write(`${finding.code} ${finding.path}: ${finding.message}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Contract drift check passed.\n");
}
