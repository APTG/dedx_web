import { describe, it, expect } from "vitest";
import { parseRangeInput, parseStpInput, stpToMevCm2g } from "$lib/state/inverse-lookups.svelte";

describe("stpToMevCm2g", () => {
  describe("kev-um → MeV·cm²/g", () => {
    // 1 keV/µm = 10⁴ keV/cm = 10 MeV/cm → divide by density
    it("1 keV/µm in water (ρ=1) → 10 MeV·cm²/g", () => {
      expect(stpToMevCm2g(1, "kev-um", 1.0)).toBeCloseTo(10, 10);
    });

    it("0.7286 keV/µm in water → 7.286 MeV·cm²/g (in-range value)", () => {
      expect(stpToMevCm2g(0.7286, "kev-um", 1.0)).toBeCloseTo(7.286, 5);
    });

    it("30 keV/µm in water → 300 MeV·cm²/g", () => {
      expect(stpToMevCm2g(30, "kev-um", 1.0)).toBeCloseTo(300, 5);
    });

    it("scales correctly with density", () => {
      // ρ=2 g/cm³: halves the mass stopping power
      expect(stpToMevCm2g(1, "kev-um", 2.0)).toBeCloseTo(5, 10);
    });
  });

  describe("mev-cm → MeV·cm²/g", () => {
    it("1 MeV/cm in water (ρ=1) → 1 MeV·cm²/g", () => {
      expect(stpToMevCm2g(1, "mev-cm", 1.0)).toBe(1);
    });

    it("30 MeV/cm in water → 30 MeV·cm²/g", () => {
      expect(stpToMevCm2g(30, "mev-cm", 1.0)).toBe(30);
    });

    it("scales correctly with density", () => {
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

describe("inverse input parsing", () => {
  it("rejects malformed range exponent input", () => {
    expect(parseRangeInput("1e cm")).toBeNull();
  });

  it("rejects malformed range numeric input", () => {
    expect(parseRangeInput("1..2 cm")).toBeNull();
  });

  it("rejects malformed STP exponent input", () => {
    expect(parseStpInput("1e")).toBeNull();
  });

  it("rejects malformed STP numeric input", () => {
    expect(parseStpInput("1..2")).toBeNull();
  });
});
