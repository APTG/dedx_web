import { describe, it, expect } from "vitest";
import { HIGH_E_SIDE, LOW_E_SIDE } from "$lib/utils/inverse-stp";

describe("inverse-stp branch constants", () => {
  it("LOW_E_SIDE is 0 (ascending branch, below Bragg peak)", () => {
    expect(LOW_E_SIDE).toBe(0);
  });

  it("HIGH_E_SIDE is 1 (descending branch, above Bragg peak)", () => {
    expect(HIGH_E_SIDE).toBe(1);
  });

  it("HIGH_E_SIDE > LOW_E_SIDE (high-E branch is the primary column)", () => {
    expect(HIGH_E_SIDE).toBeGreaterThan(LOW_E_SIDE);
  });
});
