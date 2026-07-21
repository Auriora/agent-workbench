/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  boundedDocumentationOwnerClassificationContent,
  extractDocumentationConcernIndex,
  MAX_DOCUMENTATION_OWNER_METADATA_BYTES
} from "../../src/application/use-cases/document-currency-routing.js";
import {
  normalizeDocumentationConcern,
  parseDocumentationConcernMap,
  resolveDocumentationConcerns
} from "../../src/domain/policies/index.js";
import { WorkspaceFileAdapter } from "../../src/infrastructure/filesystem/index.js";
import type { WorkspaceFilePort } from "../../src/ports/index.js";

const FIXTURE_ROOT = path.resolve("tests/fixtures/fixture-docs-authority-ranking");

type RankingOracle = {
  normalization: Array<{ input: string; normalized: string }>;
  queries: Array<{
    query: string;
    normalized_tokens: string[];
    matched_concerns: string[];
  }>;
  owner_states: Array<{
    path: string;
    state: string;
    tier: string;
    declared_canonical_owner?: string;
  }>;
  stable_document_ids: string[];
};

describe("documentation concern routing fixture", () => {
  it("locks normalization, exact-token, owner-state, and stable-id oracles", () => {
    const oracle = readJson<RankingOracle>("ranking-oracle.json");

    for (const example of oracle.normalization) {
      expect(referenceNormalize(example.input)).toBe(example.normalized);
      expect(normalizeDocumentationConcern(example.input)).toBe(example.normalized);
    }
    for (const example of oracle.queries) {
      expect(referenceNormalize(example.query).split(" ")).toEqual(example.normalized_tokens);
    }
    expect(oracle.queries.find(({ query }) => query.includes("SessionStart behavior"))?.matched_concerns)
      .toEqual(["coding-agent-integrations"]);
    expect(oracle.queries.find(({ query }) => query === "shared tie")?.matched_concerns)
      .toEqual(["tie-alpha", "tie-beta"]);
    expect(oracle.queries.find(({ query }) => query === "Session startup diagnostics")?.matched_concerns)
      .toEqual([]);
    expect(oracle.queries.find(({ query }) => query.startsWith("sessionstarter"))?.matched_concerns)
      .toEqual([]);

    expect(oracle.owner_states.map(({ state }) => state).sort()).toEqual([
      "archived",
      "conflicting",
      "draft",
      "missing",
      "superseded",
      "valid"
    ]);
    expect(oracle.owner_states.find(({ state }) => state === "conflicting")).toMatchObject({
      path: "docs/design/conflicting-owner.md",
      tier: "invalid_conflicting_owner",
      declared_canonical_owner: "docs/design/current-owner.md"
    });
    for (const stableId of oracle.stable_document_ids) {
      expect(stableId).toBe(canonicalPosixPath(stableId));
      expect(fs.existsSync(path.join(FIXTURE_ROOT, stableId))).toBe(true);
    }
  });

  it("resolves exact contiguous terms, preserves every concern, and sorts evidence deterministically", () => {
    const resolution = resolveDocumentationConcerns({
      query: "runtime contracts and graph schema shared tie",
      terms: [
        { concern_key: "tie-beta", normalized_term: "shared tie", token_count: 2 },
        { concern_key: "runtime-contracts", normalized_term: "runtime contracts", token_count: 2 },
        { concern_key: "graph-schema", normalized_term: "graph schema", token_count: 2 },
        { concern_key: "tie-alpha", normalized_term: "shared tie", token_count: 2 },
        { concern_key: "ignored-malformed-count", normalized_term: "graph schema", token_count: 1 }
      ],
      owners: [
        {
          concern_key: "tie-beta",
          mapped_owner_path: "docs/design/z.md",
          document_id: "docs/design/z.md",
          owner_state: "valid"
        },
        {
          concern_key: "tie-alpha",
          mapped_owner_path: "docs/design/a.md",
          document_id: "docs/design/a.md",
          owner_state: "valid"
        },
        {
          concern_key: "runtime-contracts",
          mapped_owner_path: "docs/reference/runtime-contracts.md",
          document_id: "docs/reference/runtime-contracts.md",
          owner_state: "valid"
        }
      ]
    });

    expect(resolution.concern_match_state).toBe("matched");
    expect(resolution.matches.map(({ concern_key }) => concern_key)).toEqual([
      "graph-schema",
      "runtime-contracts",
      "tie-alpha",
      "tie-beta"
    ]);
    expect(resolution.matches.find(({ concern_key }) => concern_key === "runtime-contracts"))
      .toMatchObject({
        normalized_term: "runtime contracts",
        query_token_start: 0,
        query_token_end_exclusive: 2,
        token_count: 2,
        owners: [{ path: "docs/reference/runtime-contracts.md", state: "valid" }]
      });
  });

  it("does not infer substrings, reordered terms, or separated multi-token phrases", () => {
    const terms = [
      { concern_key: "coding-agent-integrations", normalized_term: "sessionstart", token_count: 1 },
      { concern_key: "agent-hooks", normalized_term: "agent hooks", token_count: 2 }
    ];
    const owners = [{
      concern_key: "coding-agent-integrations",
      mapped_owner_path: "docs/design/coding-agent-integration-design.md",
      document_id: "docs/design/coding-agent-integration-design.md",
      owner_state: "valid" as const
    }];

    for (const query of ["sessionstarter behavior", "hooks agent", "agent quiet hooks"]) {
      expect(resolveDocumentationConcerns({ query, terms, owners })).toMatchObject({
        concern_match_state: "no_match",
        matches: []
      });
    }
    expect(resolveDocumentationConcerns({
      query: "SessionStart behavior and agent hooks",
      terms,
      owners
    }).matches.map(({ concern_key }) => concern_key)).toEqual([
      "agent-hooks",
      "coding-agent-integrations"
    ]);
  });

  it("orders distinct canonically equivalent owner paths independently of insertion order", () => {
    const term = [{ concern_key: "unicode-owner", normalized_term: "runtime", token_count: 1 }];
    const decomposed = {
      concern_key: "unicode-owner",
      mapped_owner_path: "docs/e\u0301.md",
      document_id: "docs/e\u0301.md",
      owner_state: "valid" as const
    };
    const composed = {
      concern_key: "unicode-owner",
      mapped_owner_path: "docs/é.md",
      document_id: "docs/é.md",
      owner_state: "valid" as const
    };

    for (const owners of [[decomposed, composed], [composed, decomposed]]) {
      expect(resolveDocumentationConcerns({ query: "runtime", terms: term, owners }).matches[0]?.owners
        .map(({ path: ownerPath }) => ownerPath)).toEqual(["docs/e\u0301.md", "docs/é.md"]);
    }
  });

  it("contains one-to-many, many-to-one, missing, and contradictory-owner evidence", () => {
    const map = readText("docs/reference/documentation-map.md");

    expect(map).toContain("| Intent terms |");
    expect(map).toContain("SessionStart; codex; kiro; agent hooks; hook parity");
    expect(map).toContain(
      "[Runtime contracts](runtime-contracts.md) and [Graph store design](../design/graph-store-design.md)"
    );
    expect(map.match(/\[Runtime contracts\]\(runtime-contracts\.md\)/gu)).toHaveLength(4);
    expect(map.match(/\| Tie (?:alpha|beta) \|/gu)).toHaveLength(2);
    expect(fs.existsSync(path.join(FIXTURE_ROOT, "docs/missing/missing-owner.md"))).toBe(false);
    expect(readText("docs/design/conflicting-owner.md")).toContain(
      "canonical_owner: docs/design/current-owner.md"
    );
  });

  it("extracts every valid owner link and deterministic implicit/explicit terms", () => {
    const parsed = parseDocumentationConcernMap({
      map_path: "docs/reference/documentation-map.md",
      content: readText("docs/reference/documentation-map.md")
    });
    expect(parsed.status).toBe("complete");
    if (parsed.status !== "complete") throw new Error(parsed.failure_reason);

    expect(parsed.owners.filter(({ concern_key }) => concern_key === "shared-governance")).toEqual([
      {
        concern_key: "shared-governance",
        mapped_owner_path: "docs/design/graph-store-design.md",
        source_line: 14
      },
      {
        concern_key: "shared-governance",
        mapped_owner_path: "docs/reference/runtime-contracts.md",
        source_line: 14
      }
    ]);
    expect(parsed.owners.filter(({ mapped_owner_path }) =>
      mapped_owner_path === "docs/reference/runtime-contracts.md")).toHaveLength(4);
    expect(parsed.terms.filter(({ concern_key }) => concern_key === "coding-agent-integrations"))
      .toEqual(expect.arrayContaining([
        { concern_key: "coding-agent-integrations", normalized_term: "coding agent integrations", token_count: 3 },
        { concern_key: "coding-agent-integrations", normalized_term: "sessionstart", token_count: 1 },
        { concern_key: "coding-agent-integrations", normalized_term: "agent hooks", token_count: 2 }
      ]));
  });

  it("classifies the complete owner-state fixture without treating multiple owners as conflict", async () => {
    const evidence = await extractDocumentationConcernIndex({
      workspace: new WorkspaceFileAdapter({ repoRoot: FIXTURE_ROOT })
    });

    expect(evidence.state).toBe("complete");
    expect(evidence.failure_reason).toBeUndefined();
    const byPath = new Map(evidence.owners.map((owner) => [owner.mapped_owner_path, owner]));
    expect(byPath.get("docs/design/coding-agent-integration-design.md")).toMatchObject({ owner_state: "valid" });
    expect(byPath.get("docs/drafts/draft-owner.md")).toMatchObject({ owner_state: "draft" });
    const missingOwner = byPath.get("docs/missing/missing-owner.md");
    expect(missingOwner).toMatchObject({ owner_state: "missing" });
    expect(missingOwner).not.toHaveProperty("document_id");
    expect(byPath.get("docs/history/archived-owner.md")).toMatchObject({ owner_state: "archived" });
    expect(byPath.get("docs/design/superseded-owner.md")).toMatchObject({
      owner_state: "superseded",
      superseded_by: "docs/design/current-owner.md"
    });
    expect(byPath.get("docs/design/conflicting-owner.md")).toMatchObject({
      owner_state: "conflicting",
      declared_canonical_owner: "docs/design/current-owner.md"
    });
    expect(evidence.owners.filter(({ concern_key }) => concern_key === "shared-governance"))
      .toHaveLength(2);
    expect(evidence.owners.filter(({ concern_key }) => concern_key === "shared-governance")
      .every(({ owner_state }) => owner_state === "valid")).toBe(true);
  });

  it("extracts the checked-in repository documentation map through the production use case", async () => {
    const evidence = await extractDocumentationConcernIndex({
      workspace: new WorkspaceFileAdapter({ repoRoot: path.resolve(".") })
    });

    expect(evidence.state).toBe("complete");
    expect(evidence.failure_reason).toBeUndefined();
    expect(evidence.owners).toContainEqual(expect.objectContaining({
      mapped_owner_path: "docs/backlog/README.md",
      owner_state: "draft"
    }));
  });

  it("invalidates empty explicit terms and repository-escaping owner links with zero rows", () => {
    const emptyTerm = parseDocumentationConcernMap({
      map_path: "docs/reference/documentation-map.md",
      content: [
        "| Concern | Canonical owner | Intent terms |",
        "| --- | --- | --- |",
        "| Runtime | [Runtime](runtime-contracts.md) | runtime;;contract |"
      ].join("\n")
    });
    const escapingOwner = parseDocumentationConcernMap({
      map_path: "docs/reference/documentation-map.md",
      content: [
        "| Concern | Canonical owner |",
        "| --- | --- |",
        "| Runtime | [Outside](../../../outside.md) |"
      ].join("\n")
    });

    expect(emptyTerm).toMatchObject({ status: "invalid", failure_reason: expect.stringContaining("empty element") });
    expect(escapingOwner).toMatchObject({ status: "invalid", failure_reason: expect.stringContaining("escapes") });
  });

  it("accepts a CommonMark angle-bracket owner destination containing spaces", () => {
    const parsed = parseDocumentationConcernMap({
      map_path: "docs/reference/documentation-map.md",
      content: [
        "| Concern | Canonical owner |",
        "| --- | --- |",
        "| Runtime | [Runtime owner](<runtime owner.md>) |"
      ].join("\n")
    });

    expect(parsed).toMatchObject({
      status: "complete",
      owners: [{ mapped_owner_path: "docs/reference/runtime owner.md" }]
    });
  });

  it("reports a safety-denied mapped owner as invalid rather than missing", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-concern-safety-"));
    const repoRoot = path.join(tempRoot, "repo");
    const outsideOwner = path.join(tempRoot, "outside-owner.md");
    try {
      fs.mkdirSync(path.join(repoRoot, "docs", "reference"), { recursive: true });
      fs.writeFileSync(outsideOwner, "# Outside owner\n");
      fs.symlinkSync(outsideOwner, path.join(repoRoot, "docs", "reference", "owner.md"));
      fs.writeFileSync(path.join(repoRoot, "docs", "reference", "documentation-map.md"), [
        "| Concern | Canonical owner |",
        "| --- | --- |",
        "| Runtime | [Owner](owner.md) |"
      ].join("\n"));

      const evidence = await extractDocumentationConcernIndex({
        workspace: new WorkspaceFileAdapter({ repoRoot })
      });

      expect(evidence).toMatchObject({
        state: "invalid",
        failure_reason: expect.stringContaining("Owner discovery failed")
      });
      expect(evidence.owners).toEqual([]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects a directory owner with the exact bounded production reason", async () => {
    const map = concernMap("owner.md");
    const workspace = boundedWorkspace({
      stat: async ({ path: requestedPath }) => ({
        exists: true,
        is_file: requestedPath === "docs/reference/documentation-map.md",
        size_bytes: requestedPath === "docs/reference/documentation-map.md" ? Buffer.byteLength(map) : 0,
        mtime_ms: 0
      }),
      readText: async () => map
    });

    await expect(extractDocumentationConcernIndex({ workspace })).resolves.toMatchObject({
      state: "invalid",
      failure_reason: "Mapped owner is not a file: docs/reference/owner.md."
    });
  });

  it("rejects an oversized documentation map before reading it", async () => {
    const readText = vi.fn<WorkspaceFilePort["readText"]>();
    const workspace = boundedWorkspace({
      stat: async () => ({ exists: true, is_file: true, size_bytes: 120_001, mtime_ms: 0 }),
      readText
    });

    await expect(extractDocumentationConcernIndex({ workspace })).resolves.toMatchObject({
      state: "invalid",
      failure_reason: expect.stringContaining("120000-byte concern-index limit")
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it("blocks owner classification when bounded workspace reads are unavailable", async () => {
    const map = concernMap("owner.md");
    const readText = vi.fn<WorkspaceFilePort["readText"]>(async () => map);
    const workspace: WorkspaceFilePort = {
      stat: async ({ path: requestedPath }) => ({
        exists: true,
        is_file: true,
        size_bytes: requestedPath === "docs/reference/documentation-map.md" ? Buffer.byteLength(map) : 10,
        mtime_ms: 0
      }),
      readText,
      readBinary: async () => new Uint8Array(),
      writeText: async () => undefined,
      writeBinary: async () => undefined,
      ensureDirectory: async () => undefined,
      deletePath: async () => undefined
    };

    await expect(extractDocumentationConcernIndex({ workspace })).resolves.toMatchObject({
      state: "invalid",
      failure_reason: expect.stringContaining("bounded workspace reads are unavailable")
    });
    expect(readText).toHaveBeenCalledExactlyOnceWith({ path: "docs/reference/documentation-map.md" });
  });

  it("classifies an owner with a body larger than 120000 bytes from bounded valid frontmatter", async () => {
    const owner = "---\nstatus: current\n---\n" + "x".repeat(120_001);
    const { evidence, readText, readTextPrefix } = await extractSingleOwner(owner);

    expect(evidence).toMatchObject({
      state: "complete",
      owners: [expect.objectContaining({ owner_state: "valid" })]
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(readTextPrefix).toHaveBeenCalledExactlyOnceWith({
      path: "docs/reference/owner.md",
      max_bytes: MAX_DOCUMENTATION_OWNER_METADATA_BYTES
    });
  });

  it("uses the production bounded reader and ignores an arbitrarily large owner tail", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-concern-bounded-owner-"));
    const ownerPrefix = "---\nstatus: current\n---\n# Owner\n";
    try {
      fs.mkdirSync(path.join(tempRoot, "docs", "reference"), { recursive: true });
      fs.writeFileSync(
        path.join(tempRoot, "docs", "reference", "documentation-map.md"),
        concernMap("owner.md")
      );
      fs.writeFileSync(
        path.join(tempRoot, "docs", "reference", "owner.md"),
        ownerPrefix + "tail-content-that-must-not-be-read\n".repeat(100_000)
      );
      const workspace = new WorkspaceFileAdapter({ repoRoot: tempRoot });
      const readText = vi.spyOn(workspace, "readText");
      const readTextPrefix = vi.spyOn(workspace, "readTextPrefix");

      await expect(extractDocumentationConcernIndex({ workspace })).resolves.toMatchObject({
        state: "complete",
        owners: [expect.objectContaining({ owner_state: "valid" })]
      });
      expect(readText).toHaveBeenCalledExactlyOnceWith({ path: "docs/reference/documentation-map.md" });
      expect(readTextPrefix).toHaveBeenCalledExactlyOnceWith({
        path: "docs/reference/owner.md",
        max_bytes: MAX_DOCUMENTATION_OWNER_METADATA_BYTES
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("classifies already-indexed large-owner content through the same bounded metadata path", async () => {
    const map = concernMap("owner.md");
    const ownerPath = "docs/reference/owner.md";
    const owner = "---\nstatus: current\n---\n" + "x".repeat(120_001);
    const readText = vi.fn<WorkspaceFilePort["readText"]>(async ({ path: requestedPath }) => {
      if (requestedPath === "docs/reference/documentation-map.md") return map;
      throw new Error(`Unexpected read: ${requestedPath}`);
    });
    const workspace = boundedWorkspace({
      stat: async ({ path: requestedPath }) => ({
        exists: true,
        is_file: true,
        size_bytes: requestedPath === "docs/reference/documentation-map.md"
          ? Buffer.byteLength(map)
          : Buffer.byteLength(owner),
        mtime_ms: 0
      }),
      readText
    });

    await expect(extractDocumentationConcernIndex({
      workspace,
      content_by_path: new Map([[ownerPath, owner]])
    })).resolves.toMatchObject({
      state: "complete",
      owners: [expect.objectContaining({ owner_state: "valid" })]
    });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("rejects map content that exceeds the byte ceiling after stat", async () => {
    const oversizedMap = "x".repeat(120_001);
    const workspace = boundedWorkspace({
      stat: async () => ({ exists: true, is_file: true, size_bytes: 1, mtime_ms: 0 }),
      readText: async () => oversizedMap
    });

    await expect(extractDocumentationConcernIndex({ workspace })).resolves.toMatchObject({
      state: "invalid",
      failure_reason: expect.stringContaining("after read")
    });
  });

  it.each([
    ["immediately before", MAX_DOCUMENTATION_OWNER_METADATA_BYTES - 1],
    ["at", MAX_DOCUMENTATION_OWNER_METADATA_BYTES]
  ])("accepts a closing frontmatter delimiter ending %s the metadata bound", async (_label, closingEnd) => {
    const { evidence } = await extractSingleOwner(frontmatterClosingAt(closingEnd));

    expect(evidence).toMatchObject({
      state: "complete",
      owners: [expect.objectContaining({ owner_state: "valid" })]
    });
  });

  it.each([
    ["crossing", MAX_DOCUMENTATION_OWNER_METADATA_BYTES + 2],
    ["after", MAX_DOCUMENTATION_OWNER_METADATA_BYTES + 64]
  ])("rejects a closing frontmatter delimiter %s the metadata bound", async (_label, closingEnd) => {
    const { evidence } = await extractSingleOwner(frontmatterClosingAt(closingEnd));

    expect(evidence).toMatchObject({
      state: "invalid",
      failure_reason: expect.stringContaining("frontmatter_metadata_too_large")
    });
  });

  it("treats a non-exact first-line delimiter as absent frontmatter", async () => {
    const { evidence } = await extractSingleOwner([
      " ---",
      "canonical_owner: docs/reference/different.md",
      "---"
    ].join("\n"));

    expect(evidence).toMatchObject({
      state: "complete",
      owners: [expect.objectContaining({ owner_state: "valid" })]
    });
    expect(evidence.owners[0]?.declared_canonical_owner).toBeUndefined();

    const bounded = boundedDocumentationOwnerClassificationContent({
      mapped_owner_path: "docs/reference/owner.md",
      content: ` ---\n${"x".repeat(20_000)}`
    });
    if ("invalid" in bounded) throw new Error(bounded.failure_reason);
    expect(Buffer.byteLength(bounded.content, "utf8")).toBeLessThanOrEqual(MAX_DOCUMENTATION_OWNER_METADATA_BYTES);
  });

  it("classifies an ordinary owner with no frontmatter as valid", async () => {
    const { evidence } = await extractSingleOwner("# Runtime owner\n\nCurrent design guidance.\n");

    expect(evidence).toMatchObject({
      state: "complete",
      owners: [expect.objectContaining({
        mapped_owner_path: "docs/reference/owner.md",
        owner_state: "valid"
      })]
    });
  });

  it("keeps short unterminated frontmatter distinct from oversized metadata", async () => {
    const { evidence } = await extractSingleOwner("---\nstatus: current");

    expect(evidence).toMatchObject({
      state: "invalid",
      failure_reason: "Malformed frontmatter in docs/reference/owner.md."
    });
  });

  it("returns a bounded typed reason for unterminated oversized frontmatter", async () => {
    const { evidence } = await extractSingleOwner("---\nstatus: current\n" + "x".repeat(20_000));

    expect(evidence).toMatchObject({
      state: "invalid",
      failure_reason: expect.stringContaining("frontmatter_metadata_too_large")
    });
    expect(Buffer.byteLength(evidence.failure_reason ?? "", "utf8")).toBeLessThanOrEqual(500);
  });

  it("does not split a multibyte code point at the admitted-prefix edge", () => {
    const beforeEdge = "x".repeat(MAX_DOCUMENTATION_OWNER_METADATA_BYTES - 1);
    const bounded = boundedDocumentationOwnerClassificationContent({
      mapped_owner_path: "docs/reference/owner.md",
      content: `${beforeEdge}éafter`
    });

    expect(bounded).toEqual({ content: beforeEdge });
    if ("invalid" in bounded) throw new Error(bounded.failure_reason);
    expect(Buffer.byteLength(bounded.content, "utf8")).toBeLessThanOrEqual(MAX_DOCUMENTATION_OWNER_METADATA_BYTES);
    expect(bounded.content).not.toContain("�");

    const completeAstral = boundedDocumentationOwnerClassificationContent({
      mapped_owner_path: "docs/reference/owner.md",
      content: `${"x".repeat(MAX_DOCUMENTATION_OWNER_METADATA_BYTES - 4)}😀tail`
    });
    expect(completeAstral).toEqual({
      content: `${"x".repeat(MAX_DOCUMENTATION_OWNER_METADATA_BYTES - 4)}😀`
    });

    const splitAstral = boundedDocumentationOwnerClassificationContent({
      mapped_owner_path: "docs/reference/owner.md",
      content: `${"x".repeat(MAX_DOCUMENTATION_OWNER_METADATA_BYTES - 3)}😀tail`
    });
    expect(splitAstral).toEqual({
      content: "x".repeat(MAX_DOCUMENTATION_OWNER_METADATA_BYTES - 3)
    });
  });

  it("bounds classification independently of an arbitrarily long owner tail", () => {
    const admitted = "x".repeat(MAX_DOCUMENTATION_OWNER_METADATA_BYTES);
    const bounded = boundedDocumentationOwnerClassificationContent({
      mapped_owner_path: "docs/reference/owner.md",
      content: admitted + "uninspected-tail".repeat(100_000)
    });

    expect(bounded).toEqual({ content: admitted });
  });
});

async function extractSingleOwner(owner: string): Promise<{
  evidence: Awaited<ReturnType<typeof extractDocumentationConcernIndex>>;
  readText: ReturnType<typeof vi.fn>;
  readTextPrefix: ReturnType<typeof vi.fn>;
}> {
  const map = concernMap("owner.md");
  const readText = vi.fn<WorkspaceFilePort["readText"]>(async ({ path: requestedPath }) => {
    if (requestedPath === "docs/reference/documentation-map.md") return map;
    throw new Error(`Unexpected read: ${requestedPath}`);
  });
  const readTextPrefix = vi.fn<NonNullable<WorkspaceFilePort["readTextPrefix"]>>(async ({ path: requestedPath, max_bytes }) => {
    if (requestedPath === "docs/reference/owner.md") {
      return Buffer.from(owner).subarray(0, max_bytes).toString("utf8");
    }
    throw new Error(`Unexpected bounded read: ${requestedPath}`);
  });
  const workspace = boundedWorkspace({
    stat: async ({ path: requestedPath }) => ({
      exists: true,
      is_file: true,
      size_bytes: requestedPath === "docs/reference/documentation-map.md"
        ? Buffer.byteLength(map)
        : Buffer.byteLength(owner),
      mtime_ms: 0
    }),
    readText,
    readTextPrefix
  });
  return { evidence: await extractDocumentationConcernIndex({ workspace }), readText, readTextPrefix };
}

function concernMap(ownerDestination: string): string {
  return [
    "| Concern | Canonical owner |",
    "| --- | --- |",
    `| Runtime | [Owner](${ownerDestination}) |`
  ].join("\n");
}

function frontmatterClosingAt(closingEndByte: number): string {
  const opening = "---\nstatus: current\n";
  const suffix = "\n---\nbody";
  const fillerLength = closingEndByte - Buffer.byteLength(opening) - Buffer.byteLength("\n---");
  if (fillerLength < 0) throw new Error("Closing delimiter offset is too small for fixture.");
  return opening + "x".repeat(fillerLength) + suffix;
}

function boundedWorkspace(input: {
  stat: WorkspaceFilePort["stat"];
  readText: WorkspaceFilePort["readText"];
  readTextPrefix?: NonNullable<WorkspaceFilePort["readTextPrefix"]>;
}): WorkspaceFilePort {
  return {
    stat: input.stat,
    readText: input.readText,
    readTextPrefix: input.readTextPrefix ?? (async ({ path: requestedPath, max_bytes }) => {
      const content = await input.readText({ path: requestedPath });
      return Buffer.from(content).subarray(0, max_bytes).toString("utf8");
    }),
    readBinary: async () => new Uint8Array(),
    writeText: async () => undefined,
    writeBinary: async () => undefined,
    ensureDirectory: async () => undefined,
    deletePath: async () => undefined
  };
}

function referenceNormalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}]+/gu, " ")
    .replace(/[\t\n\r\f\v ]+/gu, " ")
    .trim();
}

function canonicalPosixPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "");
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}
