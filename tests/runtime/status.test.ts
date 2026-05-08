import { describe, expect, it } from "vitest";
import { getColdRepoStatus } from "../../src/application/use-cases/get-repo-status.js";
import { buildColdStatusEnvelope } from "../../src/presentation/status-presenter.js";
import coldStatusGolden from "../golden/repo-status-cold.json" with { type: "json" };

describe("runtime status", () => {
  it("reports a cold status using the shared envelope", () => {
    const result = getColdRepoStatus("/repo");
    const status = buildColdStatusEnvelope(result);

    expect(status).toEqual(coldStatusGolden);
  });
});
