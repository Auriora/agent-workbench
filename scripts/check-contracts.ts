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
import type { ContractDriftFinding } from "../src/application/use-cases/check-public-contract-drift.js";

const runtimeContractsPath = "docs/reference/runtime-contracts.md";
const serverCardPath = ".well-known/mcp/server-card.json";
const packageManifestPath = "packaging/agent-workbench/package-manifest.json";
const releaseWorkflowPath = ".github/workflows/release-ghcr.yml";
const expectedImage = "ghcr.io/auriora/agent-workbench";
const findings: ContractDriftFinding[] = checkPublicContractDrift({
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

const packageManifest = JSON.parse(fs.readFileSync(packageManifestPath, "utf8")) as {
  image?: unknown;
};
if (packageManifest.image !== expectedImage) {
  findings.push({
    code: "CONTRACT_DISTRIBUTION_IMAGE_DRIFT",
    path: packageManifestPath,
    message: `Image is ${JSON.stringify(packageManifest.image)}, expected ${JSON.stringify(expectedImage)}.`
  });
}

const releaseWorkflow = fs.readFileSync(releaseWorkflowPath, "utf8");
if (!releaseWorkflow.includes(`images: ${expectedImage}`)) {
  findings.push({
    code: "CONTRACT_DISTRIBUTION_IMAGE_DRIFT",
    path: releaseWorkflowPath,
    message: `Release workflow does not publish the contracted image ${JSON.stringify(expectedImage)}.`
  });
}

if (findings.length > 0) {
  for (const finding of findings) {
    process.stderr.write(`${finding.code} ${finding.path}: ${finding.message}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Contract drift check passed.\n");
}
