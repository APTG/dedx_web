import { describe, it, expect } from "vitest";
import { rangeUnitToCmFactor, stpToMevCm2g } from "$lib/utils/inverse-units";

describe("rangeUnitToCmFactor", () => {
  it("nm → 1e-7 cm", () => {
    expect(rangeUnitToCmFactor("nm")).toBeCloseTo(1e-7, 15);
  });

  it("um → 1e-4 cm", () => {
    expect(rangeUnitToCmFactor("um")).toBeCloseTo(1e-4, 12);
  });

  it("mm → 0.1 cm", () => {
    expect(rangeUnitToCmFactor("mm")).toBeCloseTo(0.1, 12);
  });

  it("cm → 1 cm (identity)", () => {
    expect(rangeUnitToCmFactor("cm")).toBe(1);
  });

  it("m → 100 cm", () => {
    expect(rangeUnitToCmFactor("m")).toBe(100);
  });

  it("1 um × factor gives correct cm value", () => {
    const rangeCm = 7.5 * rangeUnitToCmFactor("um");
    expect(rangeCm).toBeCloseTo(7.5e-4, 10);
  });
});

describe("stpToMevCm2g (from inverse-units)", () => {
  describe("kev-um → MeV·cm²/g", () => {
    it("1 keV/µm in water (ρ=1) → 10 MeV·cm²/g", () => {
      expect(stpToMevCm2g(1, "kev-um", 1.0)).toBeCloseTo(10, 10);
    });

    it("30 keV/µm in water → 300 MeV·cm²/g", () => {
      expect(stpToMevCm2g(30, "kev-um", 1.0)).toBeCloseTo(300, 5);
    });

    it("scales by density: 1 keV/µm at ρ=2 → 5 MeV·cm²/g", () => {
      expect(stpToMevCm2g(1, "kev-um", 2.0)).toBeCloseTo(5, 10);
    });
  });

  describe("mev-cm → MeV·cm²/g", () => {
    it("1 MeV/cm in water (ρ=1) → 1 MeV·cm²/g", () => {
      expect(stpToMevCm2g(1, "mev-cm", 1.0)).toBe(1);
    });

    it("scales by density: 4 MeV/cm at ρ=2 → 2 MeV·cm²/g", () => {
      expect(stpToMevCm2g(4, "mev-cm", 2.0)).toBe(2);
    });
  });

  describe("mev-cm2-g → MeV·cm²/g", () => {
    it("is identity regardless of density", () => {
      expect(stpToMevCm2g(7.286, "mev-cm2-g", 1.0)).toBe(7.286);
      expect(stpToMevCm2g(7.286, "mev-cm2-g", 2.0)).toBe(7.286);
    });
  });
});
