import { describe, expect, test } from "vitest";
import { computeDelta } from "$lib/utils/delta.js";

describe("computeDelta", () => {
  test("positive delta: correct delta, pct, and label with unit", () => {
    const r = computeDelta(45.76 + 0.84, 45.76, "keV/µm", "ICRU 90");
    expect(r).not.toBeNull();
    expect(r!.delta).toBeCloseTo(0.84, 3);
    expect(r!.pct).toBeCloseTo(1.836, 2);
    expect(r!.label).toMatch(/^Δ = \+/);
    expect(r!.label).toContain("keV/µm");
    expect(r!.label).toContain("ICRU 90");
    expect(r!.label).toContain("%");
  });

  test("negative delta uses U+2212 minus sign (not ASCII hyphen)", () => {
    const r = computeDelta(44.92, 45.76, "keV/µm", "ICRU 90");
    expect(r).not.toBeNull();
    expect(r!.delta).toBeCloseTo(-0.84, 3);
    expect(r!.pct).toBeCloseTo(-1.836, 2);
    expect(r!.label).toMatch(/^Δ = −/); // U+2212, not "-"
    expect(r!.label).toContain("keV/µm");
    expect(r!.label).toContain("ICRU 90");
  });

  test("null displayValue returns null", () => {
    expect(computeDelta(null, 45.76, "keV/µm", "ICRU 90")).toBeNull();
  });

  test("null defaultDisplayValue returns null", () => {
    expect(computeDelta(44.92, null, "keV/µm", "ICRU 90")).toBeNull();
  });

  test("zero default returns null (avoid divide-by-zero)", () => {
    expect(computeDelta(1.0, 0, "keV/µm", "ICRU 90")).toBeNull();
  });

  test("zero delta label preserves fixed significant figures", () => {
    const r = computeDelta(45.76, 45.76, "keV/µm", "ICRU 90");
    expect(r).not.toBeNull();
    expect(r!.delta).toBe(0);
    expect(r!.pct).toBe(0);
    expect(r!.label).toContain("+0.00 keV/µm");
    expect(r!.label).toContain("+0.0%");
  });

  test("label precision: 3 sig-figs for delta, 1dp for pct", () => {
    const r = computeDelta(44.92, 45.76, "keV/µm", "ICRU 90");
    // formatSigFigsFixed(0.84, 3) = "0.840"; toFixed(1) of 1.836... = "1.8"
    expect(r!.label).toContain("0.840");
    expect(r!.label).toContain("1.8%");
  });

  test("unit is included in label for non-STP units", () => {
    const r = computeDelta(0.95, 1.0, "cm", "ICRU 90");
    expect(r).not.toBeNull();
    expect(r!.label).toContain("cm");
  });
});
