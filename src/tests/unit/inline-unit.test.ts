import { describe, it, expect } from "vitest";
import {
  parseRangeInput,
  parseSTPInput,
  stpInputUnitToUrlToken,
  urlTokenToSTPInputUnit,
  rangeUnitToUrlToken,
  urlTokenToRangeUnit,
} from "$lib/parse/inline-unit";

// ─── parseRangeInput ──────────────────────────────────────────────────────────

describe("parseRangeInput", () => {
  it("returns empty for blank string", () => {
    expect(parseRangeInput("")).toEqual({ empty: true });
    expect(parseRangeInput("   ")).toEqual({ empty: true });
  });

  it("parses a bare number as cm (unit: null)", () => {
    const result = parseRangeInput("5");
    expect(result).toMatchObject({ valueCm: 5, unit: null });
  });

  it("rejects zero", () => {
    const result = parseRangeInput("0");
    expect(result).toMatchObject({ error: "must be positive" });
  });

  it("rejects negative value", () => {
    expect(parseRangeInput("-3 mm")).toMatchObject({ error: "must be positive" });
  });

  it("rejects plain text (no number)", () => {
    expect(parseRangeInput("mm")).toMatchObject({ error: "invalid number" });
  });

  it("rejects unknown unit", () => {
    const r = parseRangeInput("5 parsec");
    expect(r).toMatchObject({ error: expect.stringContaining("unknown range unit") });
  });

  it("rejects Greek µm (not ASCII-typeable)", () => {
    const r = parseRangeInput("5 µm");
    // µ is non-ASCII so the regex rejects the whole string before reaching unit lookup
    expect(r).toHaveProperty("error");
  });

  it("parses nm correctly", () => {
    const r = parseRangeInput("1 nm");
    expect(r).toMatchObject({ unit: "nm" });
    if ("valueCm" in r) expect(r.valueCm).toBeCloseTo(1e-7);
  });

  it("parses um (µm ASCII alias) correctly", () => {
    const r = parseRangeInput("1 um");
    expect(r).toMatchObject({ unit: "um" });
    if ("valueCm" in r) expect(r.valueCm).toBeCloseTo(1e-4);
  });

  it("parses mm correctly", () => {
    const r = parseRangeInput("5 mm");
    expect(r).toMatchObject({ unit: "mm" });
    if ("valueCm" in r) expect(r.valueCm).toBeCloseTo(0.5);
  });

  it("parses cm correctly", () => {
    const r = parseRangeInput("3.5 cm");
    expect(r).toMatchObject({ valueCm: 3.5, unit: "cm" });
  });

  it("parses m correctly", () => {
    const r = parseRangeInput("2 m");
    expect(r).toMatchObject({ unit: "m" });
    if ("valueCm" in r) expect(r.valueCm).toBeCloseTo(200);
  });

  it("parses km correctly", () => {
    const r = parseRangeInput("1 km");
    expect(r).toMatchObject({ unit: "km" });
    if ("valueCm" in r) expect(r.valueCm).toBeCloseTo(1e5);
  });

  it("is case-insensitive for unit suffix", () => {
    expect(parseRangeInput("1 NM")).toMatchObject({ unit: "nm" });
    expect(parseRangeInput("1 UM")).toMatchObject({ unit: "um" });
    expect(parseRangeInput("1 MM")).toMatchObject({ unit: "mm" });
    expect(parseRangeInput("1 CM")).toMatchObject({ unit: "cm" });
    expect(parseRangeInput("1 M")).toMatchObject({ unit: "m" });
    expect(parseRangeInput("1 KM")).toMatchObject({ unit: "km" });
  });

  it("accepts extra whitespace between number and unit", () => {
    const r = parseRangeInput("10   mm");
    expect(r).toMatchObject({ unit: "mm" });
    if ("valueCm" in r) expect(r.valueCm).toBeCloseTo(1);
  });

  it("parses scientific notation", () => {
    const r = parseRangeInput("1e3 nm");
    expect(r).toMatchObject({ unit: "nm" });
    if ("valueCm" in r) expect(r.valueCm).toBeCloseTo(1e-4);
  });

  it("handles decimal values", () => {
    const r = parseRangeInput("0.5 cm");
    expect(r).toMatchObject({ valueCm: 0.5, unit: "cm" });
  });
});

// ─── parseSTPInput ────────────────────────────────────────────────────────────

describe("parseSTPInput", () => {
  it("returns empty for blank string", () => {
    expect(parseSTPInput("")).toEqual({ empty: true });
    expect(parseSTPInput("   ")).toEqual({ empty: true });
  });

  it("parses a bare number (unit: null)", () => {
    expect(parseSTPInput("100")).toMatchObject({ value: 100, unit: null });
  });

  it("rejects zero", () => {
    expect(parseSTPInput("0")).toMatchObject({ error: "must be positive" });
  });

  it("rejects negative value", () => {
    expect(parseSTPInput("-5 keV/um")).toMatchObject({ error: "must be positive" });
  });

  it("rejects unknown unit", () => {
    const r = parseSTPInput("10 J/m");
    expect(r).toMatchObject({ error: expect.stringContaining("unknown STP unit") });
  });

  it("rejects Greek keV/µm (not ASCII-typeable)", () => {
    const r = parseSTPInput("10 keV/µm");
    // µ is non-ASCII so the regex rejects the whole string before reaching unit lookup
    expect(r).toHaveProperty("error");
  });

  it("rejects Unicode MeV·cm²/g", () => {
    const r = parseSTPInput("10 MeV·cm²/g");
    expect(r).toMatchObject({ error: "invalid number" });
  });

  it("parses keV/um correctly", () => {
    expect(parseSTPInput("100 keV/um")).toMatchObject({ value: 100, unit: "keV/um" });
  });

  it("parses MeV/cm correctly", () => {
    expect(parseSTPInput("1.5 MeV/cm")).toMatchObject({ value: 1.5, unit: "MeV/cm" });
  });

  it("parses MeV*cm2/g correctly", () => {
    expect(parseSTPInput("2.0 MeV*cm2/g")).toMatchObject({ value: 2.0, unit: "MeV*cm2/g" });
  });

  it("parses MeV*cm^2/g (caret alias) correctly", () => {
    expect(parseSTPInput("2.0 MeV*cm^2/g")).toMatchObject({ value: 2.0, unit: "MeV*cm2/g" });
  });

  it("is case-insensitive: kev/um", () => {
    expect(parseSTPInput("50 kev/um")).toMatchObject({ unit: "keV/um" });
  });

  it("is case-insensitive: KEV/UM", () => {
    expect(parseSTPInput("50 KEV/UM")).toMatchObject({ unit: "keV/um" });
  });

  it("is case-insensitive: mev/cm", () => {
    expect(parseSTPInput("3 mev/cm")).toMatchObject({ unit: "MeV/cm" });
  });

  it("is case-insensitive: MEV*CM2/G", () => {
    expect(parseSTPInput("1 MEV*CM2/G")).toMatchObject({ unit: "MeV*cm2/g" });
  });

  it("accepts extra whitespace between number and unit", () => {
    expect(parseSTPInput("10   keV/um")).toMatchObject({ value: 10, unit: "keV/um" });
  });

  it("parses scientific notation", () => {
    expect(parseSTPInput("1e2 keV/um")).toMatchObject({ value: 100, unit: "keV/um" });
  });
});

// ─── URL token helpers ────────────────────────────────────────────────────────

describe("stpInputUnitToUrlToken", () => {
  it("converts keV/um → kev-um", () => {
    expect(stpInputUnitToUrlToken("keV/um")).toBe("kev-um");
  });
  it("converts MeV/cm → mev-cm", () => {
    expect(stpInputUnitToUrlToken("MeV/cm")).toBe("mev-cm");
  });
  it("converts MeV*cm2/g → mev-cm2-g", () => {
    expect(stpInputUnitToUrlToken("MeV*cm2/g")).toBe("mev-cm2-g");
  });
});

describe("urlTokenToSTPInputUnit", () => {
  it("converts kev-um → keV/um", () => {
    expect(urlTokenToSTPInputUnit("kev-um")).toBe("keV/um");
  });
  it("converts mev-cm → MeV/cm", () => {
    expect(urlTokenToSTPInputUnit("mev-cm")).toBe("MeV/cm");
  });
  it("converts mev-cm2-g → MeV*cm2/g", () => {
    expect(urlTokenToSTPInputUnit("mev-cm2-g")).toBe("MeV*cm2/g");
  });
  it("returns null for unknown token", () => {
    expect(urlTokenToSTPInputUnit("unknown")).toBeNull();
  });
});

describe("rangeUnitToUrlToken / urlTokenToRangeUnit", () => {
  it("range units are already URL-safe (identity)", () => {
    expect(rangeUnitToUrlToken("mm")).toBe("mm");
    expect(rangeUnitToUrlToken("um")).toBe("um");
    expect(rangeUnitToUrlToken("nm")).toBe("nm");
  });
  it("urlTokenToRangeUnit round-trips", () => {
    expect(urlTokenToRangeUnit("mm")).toBe("mm");
    expect(urlTokenToRangeUnit("um")).toBe("um");
    expect(urlTokenToRangeUnit("CM")).toBe("cm");
  });
  it("returns null for unknown token", () => {
    expect(urlTokenToRangeUnit("parsec")).toBeNull();
  });
});
