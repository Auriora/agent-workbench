import { describe, expect, it } from "vitest";
import { buildColdStatus } from "../../src/runtime/status.js";
import coldStatusGolden from "../golden/repo-status-cold.json" with { type: "json" };

describe("runtime status", () => {
  it("reports a cold status using the shared envelope", () => {
    const status = buildColdStatus("/repo");

    expect(status).toEqual(coldStatusGolden);
  });
});
