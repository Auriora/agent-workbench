import { describe, expect, it } from "vitest";
import { planCommand } from "../../src/domain/policies/command-safety.js";

describe("command planning safety", () => {
  it("keeps validation commands as structured argv", () => {
    expect(
      planCommand({
        command: "pytest",
        args: ["tests/fixtures/fixture-basic-python/tests"],
        source: "discovered"
      })
    ).toMatchObject({
      allowed: true
    });
  });

  it("refuses shell-looking command strings", () => {
    expect(
      planCommand({
        command: "pytest; rm -rf /",
        args: ["tests"],
        source: "user_requested"
      })
    ).toMatchObject({
      allowed: false,
      reason: "command_refused"
    });
  });
});
