import { describe, it, expect } from "vitest";
import { isHeavyIonParticle } from "$lib/utils/available-units";

describe("isHeavyIonParticle", () => {
  it("returns false for null/undefined", () => {
    expect(isHeavyIonParticle(null)).toBe(false);
    expect(isHeavyIonParticle(undefined)).toBe(false);
  });

  it("returns false for a proton (massNumber 1)", () => {
    expect(isHeavyIonParticle({ id: 1, massNumber: 1 } as never)).toBe(false);
  });

  it("returns false for the electron sentinel (id 1001), even if massNumber > 1", () => {
    expect(isHeavyIonParticle({ id: 1001, massNumber: 4 } as never)).toBe(false);
  });

  it("returns true for an alpha particle (massNumber 4)", () => {
    expect(isHeavyIonParticle({ id: 2, massNumber: 4 } as never)).toBe(true);
  });

  it("returns true for a carbon ion (massNumber 12)", () => {
    expect(isHeavyIonParticle({ id: 6, massNumber: 12 } as never)).toBe(true);
  });

  it("supports external-only particles keyed by `A` instead of `massNumber`", () => {
    expect(isHeavyIonParticle({ id: "ext:1", A: 4 } as never)).toBe(true);
    expect(isHeavyIonParticle({ id: "ext:2", A: 1 } as never)).toBe(false);
  });
});
