import { describe, test, expect } from "vitest";
import {
  RANGE_ANCHOR_OPTIONS,
  ENERGY_UNIT_TOOLTIPS,
  buildEnergyAnchorOptions,
  inputClass,
  cellClass,
  rangeUnitLabel,
  splitPasteLines,
} from "$lib/components/results/table-advanced-helpers";

describe("RANGE_ANCHOR_OPTIONS", () => {
  test("covers nm…m with µm display for um", () => {
    expect(RANGE_ANCHOR_OPTIONS.map((o) => o.value)).toEqual(["nm", "um", "mm", "cm", "m"]);
    expect(RANGE_ANCHOR_OPTIONS.find((o) => o.value === "um")?.label).toBe("µm");
  });
});

describe("buildEnergyAnchorOptions", () => {
  test("maps available units to {value,label,tooltip}", () => {
    // A heavy ion (A>1) offers MeV, MeV/nucl, MeV/u in advanced mode.
    const opts = buildEnergyAnchorOptions({ id: 6, A: 12 });
    expect(opts.map((o) => o.value)).toEqual(["MeV", "MeV/nucl", "MeV/u"]);
    expect(opts[0]).toEqual({ value: "MeV", label: "MeV", tooltip: ENERGY_UNIT_TOOLTIPS.MeV });
  });

  test("electron offers only MeV", () => {
    const opts = buildEnergyAnchorOptions({ id: 1001, A: 0 });
    expect(opts.map((o) => o.value)).toEqual(["MeV"]);
  });

  test("null particle yields MeV only", () => {
    expect(buildEnergyAnchorOptions(null).map((o) => o.value)).toEqual(["MeV"]);
  });
});

describe("inputClass / cellClass", () => {
  test("error-like statuses flag the destructive border", () => {
    for (const s of ["invalid", "out-of-range", "error"]) {
      expect(inputClass(s)).toContain("border-destructive");
    }
    expect(inputClass("valid")).toContain("border-input");
    expect(inputClass("valid")).not.toContain("border-destructive");
  });

  test("cellClass reddens only out-of-range", () => {
    expect(cellClass("out-of-range")).toBe("text-destructive");
    expect(cellClass("valid")).toBe("");
  });
});

describe("rangeUnitLabel", () => {
  test("per-row suffix unit wins, with µm display", () => {
    expect(rangeUnitLabel({ unitFromSuffix: true, unit: "um" }, "cm")).toBe("µm");
    expect(rangeUnitLabel({ unitFromSuffix: true, unit: "mm" }, "cm")).toBe("mm");
  });

  test("falls back to master unit when no suffix", () => {
    expect(rangeUnitLabel({ unitFromSuffix: false, unit: "um" }, "mm")).toBe("mm");
    expect(rangeUnitLabel({ unitFromSuffix: false, unit: "um" })).toBe("cm");
  });
});

describe("splitPasteLines", () => {
  test("splits on any newline style, trimming and dropping blanks", () => {
    expect(splitPasteLines("100 keV\r\n 1 MeV \n\n10 MeV\r")).toEqual([
      "100 keV",
      "1 MeV",
      "10 MeV",
    ]);
    expect(splitPasteLines("   ")).toEqual([]);
  });
});
