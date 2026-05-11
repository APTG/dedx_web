import { describe, test, expect } from "vitest";
import {
  parseFormula,
  formulaFromElements,
  isValidFormula,
  extractElementSymbols,
  formulaContainsElement,
  countTotalAtoms,
  getElementCount,
} from "$lib/utils/formula-parser";

describe("formula-parser", () => {
  describe("parseFormula", () => {
    test("parses simple formula H2O", () => {
      const result = parseFormula("H2O");
      expect(result.error).toBeUndefined();
      expect(result.elements).toBeDefined();
      expect(result.elements!.length).toBe(2);

      const h = result.elements!.find((e) => e.atomicNumber === 1);
      const o = result.elements!.find((e) => e.atomicNumber === 8);

      expect(h?.atomCount).toBe(2);
      expect(o?.atomCount).toBe(1);
    });

    test("parses formula without explicit count (CO2)", () => {
      const result = parseFormula("CO2");
      expect(result.error).toBeUndefined();
      const c = result.elements!.find((e) => e.atomicNumber === 6);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      expect(c?.atomCount).toBe(1);
      expect(o?.atomCount).toBe(2);
    });

    test("parses formula with multiple elements (C6H12O6)", () => {
      const result = parseFormula("C6H12O6");
      expect(result.error).toBeUndefined();
      const c = result.elements!.find((e) => e.atomicNumber === 6);
      const h = result.elements!.find((e) => e.atomicNumber === 1);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      expect(c?.atomCount).toBe(6);
      expect(h?.atomCount).toBe(12);
      expect(o?.atomCount).toBe(6);
    });

    test("parses formula with parentheses Ca(OH)2", () => {
      const result = parseFormula("Ca(OH)2");
      expect(result.error).toBeUndefined();
      const ca = result.elements!.find((e) => e.atomicNumber === 20);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      const h = result.elements!.find((e) => e.atomicNumber === 1);
      expect(ca?.atomCount).toBe(1);
      expect(o?.atomCount).toBe(2);
      expect(h?.atomCount).toBe(2);
    });

    test("parses formula with nested groups Al2(SO4)3", () => {
      const result = parseFormula("Al2(SO4)3");
      expect(result.error).toBeUndefined();
      const al = result.elements!.find((e) => e.atomicNumber === 13);
      const s = result.elements!.find((e) => e.atomicNumber === 16);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      expect(al?.atomCount).toBe(2);
      expect(s?.atomCount).toBe(3);
      expect(o?.atomCount).toBe(12);
    });

    test("parses hydrate notation CuSO4.5H2O", () => {
      const result = parseFormula("CuSO4.5H2O");
      expect(result.error).toBeUndefined();
      const cu = result.elements!.find((e) => e.atomicNumber === 29);
      const s = result.elements!.find((e) => e.atomicNumber === 16);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      const h = result.elements!.find((e) => e.atomicNumber === 1);
      expect(cu?.atomCount).toBe(1);
      expect(s?.atomCount).toBe(1);
      // 4 from SO4 + 5 from 5H2O = 9
      expect(o?.atomCount).toBe(9);
      expect(h?.atomCount).toBe(10);
    });

    test("elements are sorted by atomic number", () => {
      const result = parseFormula("H2O");
      expect(result.elements![0].atomicNumber).toBe(1); // H
      expect(result.elements![1].atomicNumber).toBe(8); // O
    });

    test("combines duplicate elements HHO → H2O", () => {
      const result = parseFormula("HHO");
      const h = result.elements!.find((e) => e.atomicNumber === 1);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      expect(h?.atomCount).toBe(2);
      expect(o?.atomCount).toBe(1);
    });

    test("returns error for empty formula", () => {
      const result = parseFormula("");
      expect(result.error).toBe("Formula is empty");
    });

    test("returns error for whitespace-only formula", () => {
      const result = parseFormula("   ");
      expect(result.error).toBeDefined();
    });

    test("returns error for invalid element symbol", () => {
      const result = parseFormula("H2Xx");
      expect(result.error).toContain("Unknown element");
    });

    test("accepts fractional atom counts", () => {
      const result = parseFormula("H2.5O");
      expect(result.error).toBeUndefined();
      const h = result.elements!.find((e) => e.atomicNumber === 1);
      expect(h?.atomCount).toBe(2.5);
    });

    test("parses complex formula with parentheses Ca3(PO4)2", () => {
      const result = parseFormula("Ca3(PO4)2");
      expect(result.error).toBeUndefined();
      const ca = result.elements!.find((e) => e.atomicNumber === 20);
      const p = result.elements!.find((e) => e.atomicNumber === 15);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      expect(ca?.atomCount).toBe(3);
      expect(p?.atomCount).toBe(2);
      expect(o?.atomCount).toBe(8);
    });

    test("parses LiF (LiF pellets user story)", () => {
      const result = parseFormula("LiF");
      expect(result.error).toBeUndefined();
      const li = result.elements!.find((e) => e.atomicNumber === 3);
      const f = result.elements!.find((e) => e.atomicNumber === 9);
      expect(li?.atomCount).toBe(1);
      expect(f?.atomCount).toBe(1);
    });

    test("parses PMMA monomer C5H8O2", () => {
      const result = parseFormula("C5H8O2");
      expect(result.error).toBeUndefined();
      const c = result.elements!.find((e) => e.atomicNumber === 6);
      const h = result.elements!.find((e) => e.atomicNumber === 1);
      const o = result.elements!.find((e) => e.atomicNumber === 8);
      expect(c?.atomCount).toBe(5);
      expect(h?.atomCount).toBe(8);
      expect(o?.atomCount).toBe(2);
    });
  });

  describe("formulaFromElements", () => {
    test("converts H2O elements to formula", () => {
      const h2o = [
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ];
      // Note: sorted by atomic number, so H comes before O
      expect(formulaFromElements(h2o)).toBe("H2O");
    });

    test("converts CO2 elements to formula", () => {
      const co2 = [
        { atomicNumber: 6, atomCount: 1 },
        { atomicNumber: 8, atomCount: 2 },
      ];
      expect(formulaFromElements(co2)).toBe("CO2");
    });

    test("handles fractional atom counts", () => {
      const elements = [
        { atomicNumber: 1, atomCount: 2.5 },
        { atomicNumber: 8, atomCount: 1 },
      ];
      expect(formulaFromElements(elements, false)).toBe("H2.5O");
    });

    test("includes fractional atom counts below one", () => {
      const elements = [
        { atomicNumber: 1, atomCount: 0.5 },
        { atomicNumber: 8, atomCount: 1 },
      ];
      expect(formulaFromElements(elements, false)).toBe("H0.5O");
    });

    test("returns empty string for empty array", () => {
      expect(formulaFromElements([])).toBe("");
    });
  });

  describe("isValidFormula", () => {
    test("returns true for valid formula", () => {
      expect(isValidFormula("H2O")).toBe(true);
      expect(isValidFormula("C6H12O6")).toBe(true);
    });

    test("returns false for invalid formula", () => {
      expect(isValidFormula("")).toBe(false);
      expect(isValidFormula("H2Xx")).toBe(false);
    });
  });

  describe("extractElementSymbols", () => {
    test("extracts symbols from H2O", () => {
      expect(extractElementSymbols("H2O")).toEqual(["H", "O"]);
    });

    test("extracts symbols from C6H12O6", () => {
      // Elements are sorted by atomic number (H=1, C=6, O=8)
      expect(extractElementSymbols("C6H12O6")).toEqual(["H", "C", "O"]);
    });

    test("extracts symbols from LiF", () => {
      // Elements are sorted by atomic number (F=9, Li=3)
      expect(extractElementSymbols("LiF")).toEqual(["Li", "F"]);
    });

    test("returns empty array for invalid formula", () => {
      expect(extractElementSymbols("")).toEqual([]);
    });
  });

  describe("formulaContainsElement", () => {
    test("returns true when element is present", () => {
      expect(formulaContainsElement("H2O", 1)).toBe(true); // H
      expect(formulaContainsElement("H2O", 8)).toBe(true); // O
    });

    test("returns false when element is not present", () => {
      expect(formulaContainsElement("H2O", 6)).toBe(false); // C
    });

    test("returns false for invalid formula", () => {
      expect(formulaContainsElement("", 1)).toBe(false);
    });
  });

  describe("countTotalAtoms", () => {
    test("counts atoms in H2O", () => {
      expect(countTotalAtoms("H2O")).toBe(3);
    });

    test("counts atoms in C6H12O6", () => {
      expect(countTotalAtoms("C6H12O6")).toBe(24);
    });

    test("counts atoms in Ca(OH)2", () => {
      expect(countTotalAtoms("Ca(OH)2")).toBe(5);
    });

    test("returns 0 for invalid formula", () => {
      expect(countTotalAtoms("")).toBe(0);
    });
  });

  describe("getElementCount", () => {
    test("returns count for element in formula", () => {
      expect(getElementCount("H2O", 1)).toBe(2); // H
      expect(getElementCount("H2O", 8)).toBe(1); // O
    });

    test("returns 0 for element not in formula", () => {
      expect(getElementCount("H2O", 6)).toBe(0); // C
    });

    test("returns 0 for invalid formula", () => {
      expect(getElementCount("", 1)).toBe(0);
    });
  });
});
