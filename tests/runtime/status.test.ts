import { describe, expect, it } from "vitest";
import { getColdRepoStatus } from "../../src/application/use-cases/get-repo-status.js";
import {
  buildColdStatusEnvelope,
  toColdStatusPresentationPayload
} from "../../src/presentation/status-presenter.js";
import coldStatusGolden from "../golden/repo-status-cold.json" with { type: "json" };

describe("runtime status", () => {
  it("returns raw status result data without response envelope fields", () => {
    const result = getColdRepoStatus("/repo");

    expect(Object.keys(result)).toEqual(["status", "meta"]);
    expect(result).not.toHaveProperty("contract_version");
    expect(result).not.toHaveProperty("warnings");
    expect(result).not.toHaveProperty("errors");
  });

  it("maps application status result to a presentation payload", () => {
    const result = getColdRepoStatus("/repo");
    const payload = toColdStatusPresentationPayload(result);

    expect(payload).toEqual({
      status: result.status,
      meta: result.meta
    });
  });

  it("reports a cold status using the shared envelope", () => {
    const result = getColdRepoStatus("/repo");
    const status = buildColdStatusEnvelope(result);

    expect(status).toEqual(coldStatusGolden);
  });
});
