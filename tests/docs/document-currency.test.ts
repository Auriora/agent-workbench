import { describe, expect, it } from "vitest";
import {
  classifyMarkdownDocCurrency
} from "../../src/domain/policies/document-authority.js";
import {
  extractDocumentationMapOwners,
  extractMarkdownFrontmatterSignals,
  findDocumentationMapOwner
} from "../../src/application/use-cases/markdown-docs.js";

describe("document currency routing", () => {
  it("extracts only supported first-block frontmatter signals", () => {
    expect(extractMarkdownFrontmatterSignals([
      "---",
      "title: Example",
      "status: archived",
      "canonical_owner: docs/design/current.md",
      "superseded_by: docs/design/new.md",
      "unrelated: ignored",
      "---",
      "# Body"
    ].join("\n"))).toEqual({
      status: "archived",
      canonical_owner: "docs/design/current.md",
      superseded_by: "docs/design/new.md"
    });
  });

  it("classifies superseded documents without treating frontmatter as authority", () => {
    const currency = classifyMarkdownDocCurrency({
      path: "docs/design/old-plan.md",
      title: "Old Plan",
      frontmatter: {
        status: "current",
        superseded_by: "docs/design/current-plan.md"
      }
    });

    expect(currency).toMatchObject({
      doc_status: "current",
      currency_state: "superseded",
      superseded_by: "docs/design/current-plan.md"
    });
    expect(currency.currency_priority).toBeLessThan(0);
  });

  it("uses documentation-map ownership as current-source evidence", () => {
    const owners = extractDocumentationMapOwners({
      mapPath: "docs/reference/documentation-map.md",
      content: [
        "| Concern | Canonical owner | Notes |",
        "| --- | --- | --- |",
        "| Runtime contracts | [Runtime contracts](runtime-contracts.md) | Owns vocabulary. |"
      ].join("\n")
    });
    const owner = findDocumentationMapOwner({
      documentPath: "docs/reference/runtime-contracts.md",
      owners
    });

    expect(owner).toMatchObject({
      concern: "Runtime contracts",
      owner_path: "docs/reference/runtime-contracts.md"
    });
    expect(classifyMarkdownDocCurrency({
      path: "docs/reference/runtime-contracts.md",
      title: "Runtime Contracts",
      documentation_map_owner: owner
    })).toMatchObject({
      currency_state: "current"
    });
  });

  it("classifies expired review windows as stale without filesystem metadata evidence", () => {
    expect(classifyMarkdownDocCurrency({
      path: "docs/runbooks/current.md",
      title: "Current",
      frontmatter: {
        status: "current",
        review_after: "2026-01-01"
      },
      now_iso8601: "2026-07-02T00:00:00.000Z"
    })).toMatchObject({
      doc_status: "current",
      currency_state: "stale"
    });
  });
});
