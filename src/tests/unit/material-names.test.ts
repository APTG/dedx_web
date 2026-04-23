import { describe, test, expect } from "vitest";
import {
  formatMaterialName,
  getMaterialFriendlyName,
  MATERIAL_NAME_OVERRIDES,
} from "$lib/config/material-names";

describe("formatMaterialName", () => {
  test("converts a single ALL-CAPS word to title case", () => {
    expect(formatMaterialName("WATER")).toBe("Water");
  });

  test("converts underscore-separated words to space-separated title case", () => {
    expect(formatMaterialName("TISSUE_EQUIVALENT_GAS")).toBe("Tissue Equivalent Gas");
  });

  test("handles single-word element names", () => {
    expect(formatMaterialName("HYDROGEN")).toBe("Hydrogen");
    expect(formatMaterialName("SILICON")).toBe("Silicon");
    expect(formatMaterialName("GRAPHITE")).toBe("Graphite");
  });

  test("handles multi-segment underscore names", () => {
    expect(formatMaterialName("A150_TISSUE_EQUIVALENT_PLASTIC")).toBe(
      "A150 Tissue Equivalent Plastic",
    );
  });

  test("returns empty string unchanged", () => {
    expect(formatMaterialName("")).toBe("");
  });

  test("trims leading/trailing whitespace from result", () => {
    expect(formatMaterialName("WATER")).not.toMatch(/^\s|\s$/);
  });
});

describe("MATERIAL_NAME_OVERRIDES", () => {
  test("contains an entry for Water (liquid) at ID 276", () => {
    expect(MATERIAL_NAME_OVERRIDES.get(276)).toBe("Water (liquid)");
  });

  test("contains an entry for Water Vapor at ID 277", () => {
    expect(MATERIAL_NAME_OVERRIDES.get(277)).toBe("Water Vapor");
  });

  test("contains an entry for Air at ID 104", () => {
    expect(MATERIAL_NAME_OVERRIDES.get(104)).toMatch(/^Air/);
  });

  test("contains an entry for Graphite at ID 906", () => {
    expect(MATERIAL_NAME_OVERRIDES.get(906)).toBe("Graphite");
  });

  test("no override contains raw ALL-CAPS words of 5+ characters (abbreviations like ICRP/PVC are allowed)", () => {
    for (const name of MATERIAL_NAME_OVERRIDES.values()) {
      // 5+ consecutive uppercase letters indicates an unprocessed C API name.
      // Short abbreviations like ICRP (4), PVC (3), PMMA (4) are intentional.
      expect(name).not.toMatch(/\b[A-Z]{5,}\b/);
    }
  });

  test("no override is an empty string", () => {
    for (const name of MATERIAL_NAME_OVERRIDES.values()) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("getMaterialFriendlyName", () => {
  test("returns 'Water (liquid)' for ID 276, raw 'WATER'", () => {
    expect(getMaterialFriendlyName(276, "WATER")).toBe("Water (liquid)");
  });

  test("returns 'Water Vapor' for ID 277, raw 'WATERVAPOR'", () => {
    expect(getMaterialFriendlyName(277, "WATERVAPOR")).toBe("Water Vapor");
  });

  test("override takes precedence over raw name for compound materials", () => {
    expect(getMaterialFriendlyName(134, "CARBONDIOXIDE")).toBe("Carbon Dioxide");
  });

  test("falls back to title-case for element IDs without override (e.g., Hydrogen)", () => {
    expect(getMaterialFriendlyName(1, "HYDROGEN")).toBe("Hydrogen");
  });

  test("falls back to title-case for element IDs without override (e.g., Silicon)", () => {
    expect(getMaterialFriendlyName(14, "SILICON")).toBe("Silicon");
  });

  test("falls back to formatted underscore name for unknown compound ID", () => {
    expect(getMaterialFriendlyName(9999, "SOME_COMPOUND_NAME")).toBe("Some Compound Name");
  });

  test("returns Graphite for ID 906", () => {
    expect(getMaterialFriendlyName(906, "GRAPHITE")).toBe("Graphite");
  });

  test("ICRP tissue entries have proper parenthetical suffix", () => {
    expect(getMaterialFriendlyName(118, "BLOOD_ICRP")).toBe("Blood (ICRP)");
    expect(getMaterialFriendlyName(190, "LUNG_ICRP")).toBe("Lung (ICRP)");
  });

  test("tissue-equivalent gas entries include phase qualifier", () => {
    const methane = getMaterialFriendlyName(263, "TISSUE_EQUIVALENTGAS_METHANEBASED");
    expect(methane).toMatch(/methane/i);
    const propane = getMaterialFriendlyName(264, "TISSUE_EQUIVALENTGAS_PROPANEBASED");
    expect(propane).toMatch(/propane/i);
  });

  test("result never has raw ALL-CAPS words of 5+ chars for any override entry (abbreviations like ICRP/PVC are allowed)", () => {
    for (const [id] of MATERIAL_NAME_OVERRIDES) {
      const name = getMaterialFriendlyName(id, "DUMMY");
      expect(name).not.toMatch(/\b[A-Z]{5,}\b/);
    }
  });
});
