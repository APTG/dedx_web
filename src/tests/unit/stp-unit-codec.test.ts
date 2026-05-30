import { describe, it, expect } from "vitest";
import {
  STP_UNITS,
  stpUnitToToken,
  tokenToStpUnit,
  tokenToStpUnitOrNull,
} from "$lib/utils/stp-unit-codec";
import { convertStpMass } from "$lib/utils/unit-conversions";
import type { StpUnit } from "$lib/wasm/types";

describe("stp-unit-codec", () => {
  it("round-trips every unit through token encode/decode", () => {
    for (const unit of STP_UNITS) {
      expect(tokenToStpUnit(stpUnitToToken(unit))).toBe(unit);
    }
  });

  it("uses the stable URL tokens", () => {
    expect(stpUnitToToken("keV/µm")).toBe("kev-um");
    expect(stpUnitToToken("MeV/cm")).toBe("mev-cm");
    expect(stpUnitToToken("MeV·cm²/g")).toBe("mev-cm2-g");
  });

  it("falls back to keV/µm for unknown or empty tokens", () => {
    expect(tokenToStpUnit("")).toBe("keV/µm");
    expect(tokenToStpUnit("bogus")).toBe("keV/µm");
    expect(tokenToStpUnit("MeV/cm")).toBe("keV/µm"); // not a token, it's a label
  });

  it("distinguishes 'no choice' from default via tokenToStpUnitOrNull", () => {
    expect(tokenToStpUnitOrNull(null)).toBeNull();
    expect(tokenToStpUnitOrNull(undefined)).toBeNull();
    expect(tokenToStpUnitOrNull("")).toBeNull();
    expect(tokenToStpUnitOrNull("bogus")).toBeNull();
    expect(tokenToStpUnitOrNull("kev-um")).toBe("keV/µm");
    expect(tokenToStpUnitOrNull("mev-cm2-g")).toBe("MeV·cm²/g");
  });
});

describe("convertStpMass", () => {
  // Bone (ρ = 1.85 g/cm³): all three units differ, so this catches sign /
  // factor mistakes a unit-density material would hide.
  const density = 1.85;
  const mass = 2.0; // MeV·cm²/g

  it("MeV·cm²/g is the identity (density-independent)", () => {
    expect(convertStpMass(mass, density, "MeV·cm²/g")).toBe(mass);
    expect(convertStpMass(mass, 1, "MeV·cm²/g")).toBe(mass);
  });

  it("MeV/cm multiplies by density", () => {
    expect(convertStpMass(mass, density, "MeV/cm")).toBeCloseTo(3.7, 10);
  });

  it("keV/µm is MeV/cm divided by 10", () => {
    const mevcm = convertStpMass(mass, density, "MeV/cm");
    expect(convertStpMass(mass, density, "keV/µm")).toBeCloseTo(mevcm / 10, 10);
    expect(convertStpMass(mass, density, "keV/µm")).toBeCloseTo(0.37, 10);
  });

  it("all three values differ for a non-unit density", () => {
    const values = STP_UNITS.map((u: StpUnit) => convertStpMass(mass, density, u));
    expect(new Set(values).size).toBe(3);
  });
});
