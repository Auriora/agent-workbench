import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  applicationContracts,
  domainContracts,
  presentationContracts,
  adapterEvidenceSchema,
  capabilityLevelSchema,
  CONTRACT_VERSION,
  makeEnvelope,
  responseEnvelopeSchema,
  taskContextRequestSchema,
  taskContextSchema
} from "../../src/contracts/index.js";
import { capabilityLevelSchema as domainCapabilityLevelSchema } from "../../src/contracts/domain-contracts.js";

describe("runtime contract categories", () => {
  it("re-export canonical contracts by category", () => {
    expect(applicationContracts.responseMetadataSchema).toBeDefined();
    expect(domainContracts.capabilityLevelSchema).toBeDefined();
    expect(domainContracts.capabilityLevelSchema).toBe(capabilityLevelSchema);
    expect(presentationContracts.attentionItemSchema).toBeDefined();
  });

  it("keeps capability levels canonical in the domain contracts", () => {
    expect(domainContracts.capabilityLevelSchema.parse("partial_semantic")).toBe(
      "partial_semantic"
    );
    expect(domainContracts.capabilityLevelSchema.parse("unsupported")).toBe("unsupported");
    expect(() => domainCapabilityLevelSchema.parse("resource_only")).toThrow();
    expect(() => domainCapabilityLevelSchema.parse("routing_evidence")).toThrow();
  });
});

describe("runtime contracts", () => {
  it("accepts only canonical capability levels", () => {
    expect(capabilityLevelSchema.parse("partial_semantic")).toBe("partial_semantic");
    expect(() => capabilityLevelSchema.parse("resource_only")).toThrow();
    expect(() => capabilityLevelSchema.parse("routing_evidence")).toThrow();
  });

  it("models adapter evidence without language-specific contract fields", () => {
    const parsed = adapterEvidenceSchema.parse({
      domain: "language",
      name: "typescript",
      capability_level: "unsupported",
      evidence_kinds: [],
      paths: ["src/app.ts"],
      provenance: "file_identity",
      confidence: "high",
      metadata: {
        adapter: "future-typescript"
      }
    });

    expect(parsed).toEqual({
      domain: "language",
      name: "typescript",
      capability_level: "unsupported",
      evidence_kinds: [],
      paths: ["src/app.ts"],
      provenance: "file_identity",
      confidence: "high",
      metadata: {
        adapter: "future-typescript"
      }
    });
    expect(() =>
      adapterEvidenceSchema.parse({
        ...parsed,
        python_module: "src.app"
      })
    ).toThrow();
  });

  it("builds the shared response envelope", () => {
    const envelope = makeEnvelope({
      data: { ok: true },
      meta: {
        analysis_validity: "valid",
        freshness: "fresh",
        scope: {
          repo_root: "/repo",
          indexed_roots: ["src"],
          skipped_roots: ["node_modules"],
          languages: ["python"]
        },
        capability_level: "partial_semantic",
        evidence_kinds: ["parser", "sqlite"],
        verification_status: "planned",
        truncated: false,
        budget: {
          time_ms: 100,
          row_limit: 100
        }
      }
    });

    expect(envelope.contract_version).toBe(CONTRACT_VERSION);
    expect(responseEnvelopeSchema(z.object({ ok: z.literal(true) })).parse(envelope)).toEqual(
      envelope
    );
  });

  it("models bounded task context requests and responses", () => {
    const request = taskContextRequestSchema.parse({
      task: "Update the Codex MCP profile",
      files: ["src/server.ts"]
    });

    expect(request).toEqual({
      task: "Update the Codex MCP profile",
      files: ["src/server.ts"],
      symbols: [],
      max_files: 10,
      max_docs: 5
    });
    expect(() =>
      taskContextRequestSchema.parse({
        task: "too broad",
        max_files: 500
      })
    ).toThrow();

    expect(
      taskContextSchema.parse({
        task: request.task,
        repo_root: "/repo",
        summary: "Task context found local evidence.",
        requested_files: [
          {
            path: "src/server.ts",
            language: "typescript",
            exists: true,
            capability_level: "unsupported",
            evidence_kinds: [],
            reason: "Requested explicitly by the caller."
          }
        ],
        related_files: [],
        governing_docs: [],
        validation_hints: [
          {
            command: "pnpm test",
            reason: "package.json indicates a testable TypeScript/JavaScript project.",
            status: "needed"
          }
        ],
        risks: [],
        next_actions: [
          {
            tool: "verification_plan",
            args: {
              files: ["src/server.ts"]
            }
          }
        ]
      })
    ).toMatchObject({
      task: "Update the Codex MCP profile",
      requested_files: [expect.objectContaining({ path: "src/server.ts" })]
    });
  });
});
