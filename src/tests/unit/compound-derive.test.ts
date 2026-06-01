import { describe, test, expect } from "vitest";
import {
  deriveMassPercents,
  deriveFormulaString,
  deriveTotalAtoms,
  deriveBraggIValue,
  rescaleTo100,
  deriveDisplayFormula,
} from "$lib/utils/compound-derive";

describe("compound-derive", () => {
  describe("deriveMassPercents", () => {
    test("computes mass % for water (H2O)", () => {
      const result = deriveMassPercents([
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ]);
      expect(result).not.toBeNull();
      // 2*1.008 = 2.016, O = 15.999, total 18.015
      expect(result![0]).toBeCloseTo(11.19, 1);
      expect(result![1]).toBeCloseTo(88.81, 1);
    });

    test("mass % sum to 100", () => {
      const result = deriveMassPercents([
        { atomicNumber: 6, atomCount: 5 },
        { atomicNumber: 1, atomCount: 8 },
        { atomicNumber: 8, atomCount: 2 },
      ]);
      const sum = result!.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 6);
    });

    test("PMMA mass fractions match spec (H 8.05, C 59.99, O 31.96)", () => {
      // PMMA C5H8O2, listed ascending Z: H, C, O
      const result = deriveMassPercents([
        { atomicNumber: 1, atomCount: 8 },
        { atomicNumber: 6, atomCount: 5 },
        { atomicNumber: 8, atomCount: 2 },
      ]);
      expect(result![0]).toBeCloseTo(8.05, 1);
      expect(result![1]).toBeCloseTo(59.99, 1);
      expect(result![2]).toBeCloseTo(31.96, 1);
    });

    test("returns null for empty composition", () => {
      expect(deriveMassPercents([])).toBeNull();
    });

    test("returns null when an element has no atomic weight", () => {
      expect(deriveMassPercents([{ atomicNumber: 999, atomCount: 1 }])).toBeNull();
    });
  });

  describe("deriveFormulaString", () => {
    test("renders subscripts only for counts > 1", () => {
      const { unicode, ascii } = deriveFormulaString([
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ]);
      expect(unicode).toBe("H₂O");
      expect(ascii).toBe("H2O");
    });

    test("renders multi-digit subscripts", () => {
      const { unicode, ascii } = deriveFormulaString([
        { atomicNumber: 1, atomCount: 52 },
        { atomicNumber: 6, atomCount: 63 },
        { atomicNumber: 7, atomCount: 3 },
        { atomicNumber: 8, atomCount: 25 },
      ]);
      expect(unicode).toBe("H₅₂C₆₃N₃O₂₅");
      expect(ascii).toBe("H52C63N3O25");
    });

    test("renders fractional counts to 2 decimals", () => {
      const { ascii } = deriveFormulaString([{ atomicNumber: 1, atomCount: 1.5 }]);
      expect(ascii).toBe("H1.50");
    });
  });

  describe("deriveDisplayFormula", () => {
    test("returns exact kind for integer compound", () => {
      const result = deriveDisplayFormula([
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ]);
      expect(result).toEqual({
        kind: "exact",
        unicode: "H₂O",
        ascii: "H2O",
        totalAtoms: 3,
      });
    });

    test("returns exact kind for FP-dirty integers", () => {
      const result = deriveDisplayFormula([
        { atomicNumber: 1, atomCount: 1.9999998 },
        { atomicNumber: 8, atomCount: 1.0000001 },
      ]);
      expect(result).toEqual({
        kind: "exact",
        unicode: "H₂O",
        ascii: "H2O",
        totalAtoms: 3,
      });
    });

    test("returns normalized kind for clean mass-fraction ratio", () => {
      const result = deriveDisplayFormula([
        { atomicNumber: 1, atomCount: 0.505 },
        { atomicNumber: 8, atomCount: 0.25 },
      ]);
      expect(result).toEqual({
        kind: "normalized",
        unicode: "H₂O",
        ascii: "H2O",
        multiplier: 1,
      });
    });

    test("returns normalized kind with multiplier > 1", () => {
      const result = deriveDisplayFormula([
        { atomicNumber: 1, atomCount: 1.505 },
        { atomicNumber: 8, atomCount: 1.0 },
      ]);
      expect(result).toEqual({
        kind: "normalized",
        unicode: "H₃O₂",
        ascii: "H3O2",
        multiplier: 2,
      });
    });

    test("returns none kind for Beer issue composition", () => {
      const result = deriveDisplayFormula([
        { atomicNumber: 1, atomCount: 35.46 },
        { atomicNumber: 6, atomCount: 0.083 },
        { atomicNumber: 8, atomCount: 1.08 },
      ]);
      expect(result).toEqual({ kind: "none" });
    });

    test("returns none for empty composition", () => {
      expect(deriveDisplayFormula([])).toEqual({ kind: "none" });
    });
  });

  describe("deriveTotalAtoms", () => {
    test("sums atom counts", () => {
      expect(
        deriveTotalAtoms([
          { atomicNumber: 1, atomCount: 52 },
          { atomicNumber: 6, atomCount: 63 },
          { atomicNumber: 7, atomCount: 3 },
          { atomicNumber: 8, atomCount: 25 },
        ]),
      ).toBe(143);
    });
  });

  describe("deriveBraggIValue", () => {
    test("computes Bragg I-value for water (H2O) ≈ 69 eV", () => {
      const i = deriveBraggIValue([
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ]);
      expect(i).not.toBeNull();
      // ln(I) = (2*1*ln19.2 + 1*8*ln95)/10 → I ≈ 68.99
      expect(i!).toBeCloseTo(68.99, 1);
    });

    test("matches hand-computed value for a single element (pure carbon)", () => {
      // A pure element's Bragg I-value is just its own I-value.
      const i = deriveBraggIValue([{ atomicNumber: 6, atomCount: 1 }]);
      expect(i!).toBeCloseTo(78.0, 5);
    });

    test("is independent of overall scaling of atom counts", () => {
      const a = deriveBraggIValue([
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ]);
      const b = deriveBraggIValue([
        { atomicNumber: 1, atomCount: 4 },
        { atomicNumber: 8, atomCount: 2 },
      ]);
      expect(a!).toBeCloseTo(b!, 6);
    });

    test("returns null when an element lacks an ICRU-37 I-value (Z > 92)", () => {
      expect(
        deriveBraggIValue([
          { atomicNumber: 1, atomCount: 1 },
          { atomicNumber: 94, atomCount: 1 },
        ]),
      ).toBeNull();
    });

    test("returns null for empty composition", () => {
      expect(deriveBraggIValue([])).toBeNull();
    });
  });

  describe("rescaleTo100", () => {
    test("scales values to sum to 100", () => {
      const result = rescaleTo100([50, 49]);
      expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
      // ratio preserved
      expect(result[0]! / result[1]!).toBeCloseTo(50 / 49, 6);
    });

    test("rescales a single value to 100", () => {
      expect(rescaleTo100([50])).toEqual([100]);
    });

    test("returns input unchanged when sum is not positive", () => {
      expect(rescaleTo100([0, 0])).toEqual([0, 0]);
    });
  });
});
