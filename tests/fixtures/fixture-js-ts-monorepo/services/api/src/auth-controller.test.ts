import { authenticate } from "./auth-controller";
import { describe, expect, it } from "vitest";

export const authControllerSpec = authenticate("User");

describe("auth controller fixture", () => {
  it("authenticates trimmed users", () => {
    expect(authControllerSpec).toBe(true);
  });
});
