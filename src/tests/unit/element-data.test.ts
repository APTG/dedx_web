import { describe, test, expect } from "vitest";
import {
  ELEMENTS,
  resolveElement,
  getAtomicWeight,
  getElementSymbol,
  getElementName,
  isValidAtomicNumber,
  computeMolecularWeight,
  computeWeightFractions,
  computeAtomCounts,
  normalizeAtomCounts,
} from "$lib/utils/element-data";

describe("element-data", () => {
  describe("ELEMENTS array", () => {
    test("contains all 118 elements", () => {
      expect(ELEMENTS.length).toBe(118);
    });

    test("first element is Hydrogen (Z=1)", () => {
      expect(ELEMENTS[0]).toEqual({
        atomicNumber: 1,
        symbol: "H",
        name: "Hydrogen",
        atomicWeight: 1.008,
        meanExcitationEnergy: 19.2,
      });
    });

    test("last element is Oganesson (Z=118)", () => {
      expect(ELEMENTS[117]).toEqual({
        atomicNumber: 118,
        symbol: "Og",
        name: "Oganesson",
        atomicWeight: 294,
        // Oganesson does not have a meanExcitationEnergy in ICRU 37
      });
    });

    test("elements are sorted by atomic number", () => {
      for (let i = 1; i < ELEMENTS.length; i++) {
        expect(ELEMENTS[i]!.atomicNumber).toBeGreaterThan(ELEMENTS[i - 1]!.atomicNumber);
      }
    });
  });

  describe("resolveElement", () => {
    test("resolves element by atomic number (string)", () => {
      expect(resolveElement("1")).toEqual({
        atomicNumber: 1,
        symbol: "H",
        name: "Hydrogen",
        atomicWeight: 1.008,
        meanExcitationEnergy: 19.2,
      });
    });

    test("resolves element by atomic number (number as string)", () => {
      expect(resolveElement("26")).toEqual({
        atomicNumber: 26,
        symbol: "Fe",
        name: "Iron",
        atomicWeight: 55.845,
        meanExcitationEnergy: 286,
      });
    });

    test("resolves element by symbol (uppercase)", () => {
      expect(resolveElement("Fe")).toEqual({
        atomicNumber: 26,
        symbol: "Fe",
        name: "Iron",
        atomicWeight: 55.845,
        meanExcitationEnergy: 286,
      });
    });

    test("resolves element by symbol (lowercase - case insensitive)", () => {
      expect(resolveElement("fe")).toEqual({
        atomicNumber: 26,
        symbol: "Fe",
        name: "Iron",
        atomicWeight: 55.845,
        meanExcitationEnergy: 286,
      });
    });

    test("resolves element by symbol (mixed case)", () => {
      expect(resolveElement("FE")).toEqual({
        atomicNumber: 26,
        symbol: "Fe",
        name: "Iron",
        atomicWeight: 55.845,
        meanExcitationEnergy: 286,
      });
    });

    test("resolves element by full name (lowercase)", () => {
      expect(resolveElement("hydrogen")).toEqual({
        atomicNumber: 1,
        symbol: "H",
        name: "Hydrogen",
        atomicWeight: 1.008,
        meanExcitationEnergy: 19.2,
      });
    });

    test("resolves element by full name (uppercase)", () => {
      expect(resolveElement("HYDROGEN")).toEqual({
        atomicNumber: 1,
        symbol: "H",
        name: "Hydrogen",
        atomicWeight: 1.008,
        meanExcitationEnergy: 19.2,
      });
    });

    test("resolves element by full name (proper case)", () => {
      expect(resolveElement("Hydrogen")).toEqual({
        atomicNumber: 1,
        symbol: "H",
        name: "Hydrogen",
        atomicWeight: 1.008,
        meanExcitationEnergy: 19.2,
      });
    });

    test("returns undefined for invalid atomic number (0)", () => {
      expect(resolveElement("0")).toBeUndefined();
    });

    test("returns undefined for invalid atomic number (119)", () => {
      expect(resolveElement("119")).toBeUndefined();
    });

    test("does not parse partial numeric prefixes as atomic numbers", () => {
      expect(resolveElement("1abc")).toBeUndefined();
      expect(resolveElement("26.5")).toBeUndefined();
    });

    test("returns undefined for unknown symbol", () => {
      expect(resolveElement("Xx")).toBeUndefined();
    });

    test("returns undefined for unknown name", () => {
      expect(resolveElement("unobtainium")).toBeUndefined();
    });

    test("returns undefined for empty string", () => {
      expect(resolveElement("")).toBeUndefined();
    });

    test("returns undefined for whitespace-only string", () => {
      expect(resolveElement("  ")).toBeUndefined();
    });

    test("handles whitespace around input", () => {
      expect(resolveElement("  Fe  ")).toEqual({
        atomicNumber: 26,
        symbol: "Fe",
        name: "Iron",
        atomicWeight: 55.845,
        meanExcitationEnergy: 286,
      });
    });
  });

  describe("getAtomicWeight", () => {
    test("returns atomic weight for valid Z", () => {
      expect(getAtomicWeight(1)).toBe(1.008);
      expect(getAtomicWeight(6)).toBe(12.011);
      expect(getAtomicWeight(8)).toBe(15.999);
    });

    test("returns undefined for invalid Z", () => {
      expect(getAtomicWeight(0)).toBeUndefined();
      expect(getAtomicWeight(119)).toBeUndefined();
      expect(getAtomicWeight(-1)).toBeUndefined();
    });
  });

  describe("getElementSymbol", () => {
    test("returns symbol for valid Z", () => {
      expect(getElementSymbol(1)).toBe("H");
      expect(getElementSymbol(26)).toBe("Fe");
      expect(getElementSymbol(118)).toBe("Og");
    });

    test("returns undefined for invalid Z", () => {
      expect(getElementSymbol(0)).toBeUndefined();
      expect(getElementSymbol(119)).toBeUndefined();
    });
  });

  describe("getElementName", () => {
    test("returns name for valid Z", () => {
      expect(getElementName(1)).toBe("Hydrogen");
      expect(getElementName(26)).toBe("Iron");
      expect(getElementName(118)).toBe("Oganesson");
    });

    test("returns undefined for invalid Z", () => {
      expect(getElementName(0)).toBeUndefined();
      expect(getElementName(119)).toBeUndefined();
    });
  });

  describe("isValidAtomicNumber", () => {
    test("returns true for valid atomic numbers", () => {
      expect(isValidAtomicNumber(1)).toBe(true);
      expect(isValidAtomicNumber(118)).toBe(true);
      expect(isValidAtomicNumber(50)).toBe(true);
    });

    test("returns false for Z < 1", () => {
      expect(isValidAtomicNumber(0)).toBe(false);
      expect(isValidAtomicNumber(-1)).toBe(false);
    });

    test("returns false for Z > 118", () => {
      expect(isValidAtomicNumber(119)).toBe(false);
      expect(isValidAtomicNumber(200)).toBe(false);
    });

    test("returns false for non-integers", () => {
      expect(isValidAtomicNumber(1.5)).toBe(false);
      expect(isValidAtomicNumber(10.5)).toBe(false);
    });
  });

  describe("computeMolecularWeight", () => {
    test("computes molecular weight for H2O", () => {
      const h2o = [
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ];
      // 2*1.008 + 15.999 = 18.015
      expect(computeMolecularWeight(h2o)).toBeCloseTo(18.015, 2);
    });

    test("computes molecular weight for CO2", () => {
      const co2 = [
        { atomicNumber: 6, atomCount: 1 },
        { atomicNumber: 8, atomCount: 2 },
      ];
      // 12.011 + 2*15.999 = 44.009
      expect(computeMolecularWeight(co2)).toBeCloseTo(44.009, 2);
    });

    test("computes molecular weight for C6H12O6 (glucose)", () => {
      const glucose = [
        { atomicNumber: 6, atomCount: 6 },
        { atomicNumber: 1, atomCount: 12 },
        { atomicNumber: 8, atomCount: 6 },
      ];
      // 6*12.011 + 12*1.008 + 6*15.999 = 180.156
      expect(computeMolecularWeight(glucose)).toBeCloseTo(180.156, 1);
    });

    test("returns undefined for invalid atomic number", () => {
      const invalid = [
        { atomicNumber: 999, atomCount: 1 },
        { atomicNumber: 1, atomCount: 2 },
      ];
      expect(computeMolecularWeight(invalid)).toBeUndefined();
    });

    test("handles empty array", () => {
      expect(computeMolecularWeight([])).toBe(0);
    });
  });

  describe("computeWeightFractions", () => {
    test("computes weight fractions for H2O", () => {
      const h2o = [
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ];
      const result = computeWeightFractions(h2o);
      expect(result).toBeDefined();
      expect(result!.length).toBe(2);

      const h = result!.find((e) => e.atomicNumber === 1);
      const o = result!.find((e) => e.atomicNumber === 8);

      // H: 2*1.008 / 18.015 ≈ 0.1119
      expect(h?.weightFraction).toBeCloseTo(0.1119, 3);
      // O: 15.999 / 18.015 ≈ 0.8881
      expect(o?.weightFraction).toBeCloseTo(0.8881, 3);
    });

    test("weight fractions sum to 1", () => {
      const co2 = [
        { atomicNumber: 6, atomCount: 1 },
        { atomicNumber: 8, atomCount: 2 },
      ];
      const result = computeWeightFractions(co2);
      const sum = result!.reduce((acc, e) => acc + e.weightFraction, 0);
      expect(sum).toBeCloseTo(1, 10);
    });

    test("returns undefined for invalid atomic number", () => {
      const invalid = [{ atomicNumber: 999, atomCount: 1 }];
      expect(computeWeightFractions(invalid)).toBeUndefined();
    });
  });

  describe("computeAtomCounts", () => {
    test("computes atom counts from weight fractions for H2O", () => {
      const h2oWeights = [
        { atomicNumber: 1, weightFraction: 0.1119 },
        { atomicNumber: 8, weightFraction: 0.8881 },
      ];
      const result = computeAtomCounts(h2oWeights);
      expect(result).toBeDefined();
      expect(result!.length).toBe(2);

      const h = result!.find((e) => e.atomicNumber === 1);
      const o = result!.find((e) => e.atomicNumber === 8);

      // n_H = 0.1119 / 1.008 ≈ 0.111
      expect(h?.atomCount).toBeCloseTo(0.111, 2);
      // n_O = 0.8881 / 15.999 ≈ 0.0555
      expect(o?.atomCount).toBeCloseTo(0.0555, 3);
    });

    test("atom count ratio H:O in water is ~2:1", () => {
      const h2oWeights = [
        { atomicNumber: 1, weightFraction: 0.1119 },
        { atomicNumber: 8, weightFraction: 0.8881 },
      ];
      const result = computeAtomCounts(h2oWeights);
      const h = result!.find((e) => e.atomicNumber === 1)!;
      const o = result!.find((e) => e.atomicNumber === 8)!;

      expect(h.atomCount / o.atomCount).toBeCloseTo(2, 1);
    });

    test("returns undefined for invalid atomic number", () => {
      const invalid = [{ atomicNumber: 999, weightFraction: 1 }];
      expect(computeAtomCounts(invalid)).toBeUndefined();
    });
  });

  describe("normalizeAtomCounts", () => {
    test("normalizes to smallest integer ratio", () => {
      const glucose = [
        { atomicNumber: 6, atomCount: 6 },
        { atomicNumber: 1, atomCount: 12 },
        { atomicNumber: 8, atomCount: 6 },
      ];
      const normalized = normalizeAtomCounts(glucose);

      expect(normalized.find((e) => e.atomicNumber === 6)?.atomCount).toBe(1);
      expect(normalized.find((e) => e.atomicNumber === 1)?.atomCount).toBe(2);
      expect(normalized.find((e) => e.atomicNumber === 8)?.atomCount).toBe(1);
    });

    test("handles fractional counts", () => {
      const fractional = [
        { atomicNumber: 1, atomCount: 2.5 },
        { atomicNumber: 8, atomCount: 1.25 },
      ];
      const normalized = normalizeAtomCounts(fractional);

      expect(normalized.find((e) => e.atomicNumber === 1)?.atomCount).toBe(2);
      expect(normalized.find((e) => e.atomicNumber === 8)?.atomCount).toBe(1);
    });

    test("handles empty array", () => {
      expect(normalizeAtomCounts([])).toEqual([]);
    });
  });
});
