import { describe, test, expect } from "vitest";
import {
  isElementId,
  isExternalMaterial,
  inElements,
  inCompounds,
  compareElements,
  compareByName,
  materialSearchText,
  matchesMaterialQuery,
  formatDensity,
  isGas,
  type MaterialLike,
} from "$lib/utils/material-filters";
import type { MaterialEntity } from "$lib/wasm/types";
import type { ExternalOnlyMaterial } from "$lib/state/external-compatibility";

function builtin(id: number, name = `mat-${id}`): MaterialEntity {
  return { id, name, density: 1, isGasByDefault: false } as MaterialEntity;
}

function external(localId: string, name: string, atomicNumber?: number): ExternalOnlyMaterial {
  return {
    id: `ext:srim:${localId}`,
    name,
    label: "srim",
    localId,
    linearUnitsAvailable: false,
    ...(atomicNumber !== undefined ? { atomicNumber } : {}),
  };
}

describe("isElementId", () => {
  test("treats 1–98 as elements", () => {
    expect(isElementId(1)).toBe(true);
    expect(isElementId(98)).toBe(true);
    expect(isElementId(6)).toBe(true);
  });

  test("rejects out-of-range ids", () => {
    expect(isElementId(0)).toBe(false);
    expect(isElementId(99)).toBe(false);
    expect(isElementId(906)).toBe(false);
  });
});

describe("isExternalMaterial", () => {
  test("matches the ext: id prefix", () => {
    expect(isExternalMaterial(external("c", "Carbon"))).toBe(true);
  });

  test("rejects built-in numeric ids", () => {
    expect(isExternalMaterial(builtin(6))).toBe(false);
  });
});

describe("inElements / inCompounds", () => {
  test("built-in elements land in the elements bucket only", () => {
    const carbon = builtin(6);
    expect(inElements(carbon)).toBe(true);
    expect(inCompounds(carbon)).toBe(false);
  });

  test("built-in compounds (id > 98) land in the compounds bucket only", () => {
    const water = builtin(276, "Water");
    expect(inCompounds(water)).toBe(true);
    expect(inElements(water)).toBe(false);
  });

  test("external materials with an element atomic number are elements", () => {
    const extCarbon = external("c", "Carbon", 6);
    expect(inElements(extCarbon)).toBe(true);
    expect(inCompounds(extCarbon)).toBe(false);
  });

  test("external materials without an element atomic number are compounds", () => {
    const extWater = external("h2o", "Water");
    expect(inCompounds(extWater)).toBe(true);
    expect(inElements(extWater)).toBe(false);
  });

  test("every material falls into exactly one bucket", () => {
    const materials: MaterialLike[] = [
      builtin(1),
      builtin(98),
      builtin(99),
      builtin(906),
      external("c", "Carbon", 6),
      external("mix", "Mixture"),
    ];
    for (const m of materials) {
      expect(inElements(m)).not.toBe(inCompounds(m));
    }
  });
});

describe("compareElements", () => {
  test("orders built-ins by id and externals by atomic number", () => {
    const list: MaterialLike[] = [builtin(8), external("h", "Hydrogen", 1), builtin(2)];
    const sorted = [...list].sort(compareElements).map((m) => m.name);
    expect(sorted).toEqual(["Hydrogen", "mat-2", "mat-8"]);
  });

  test("externals missing an atomic number sort last", () => {
    const list: MaterialLike[] = [external("x", "Unknown"), builtin(50)];
    const sorted = [...list].sort(compareElements).map((m) => m.name);
    expect(sorted).toEqual(["mat-50", "Unknown"]);
  });
});

describe("compareByName", () => {
  test("orders by display name", () => {
    const list = [{ name: "Zinc" }, { name: "Argon" }, { name: "Beryllium" }];
    expect([...list].sort(compareByName).map((m) => m.name)).toEqual([
      "Argon",
      "Beryllium",
      "Zinc",
    ]);
  });
});

describe("materialSearchText", () => {
  test("includes id, name and rawName for built-ins", () => {
    const water = {
      id: 276,
      name: "Water",
      rawName: "WATER, LIQUID",
      density: 1,
    } as MaterialEntity;
    expect(materialSearchText(water)).toBe("276 Water WATER, LIQUID");
  });

  test("omits rawName when absent", () => {
    expect(materialSearchText(builtin(6, "Carbon"))).toBe("6 Carbon ");
  });

  test("exposes localId/label plus `ext external` for externals", () => {
    expect(materialSearchText(external("c", "Carbon", 6))).toBe("c Carbon srim ext external");
  });
});

describe("matchesMaterialQuery", () => {
  const water = { id: 276, name: "Water", density: 1, isGasByDefault: false } as MaterialEntity;

  test("empty query matches everything", () => {
    expect(matchesMaterialQuery(water, "")).toBe(true);
    expect(matchesMaterialQuery(water, "   ")).toBe(true);
  });

  test("plain substring match is case-insensitive", () => {
    expect(matchesMaterialQuery(water, "wat")).toBe(true);
    expect(matchesMaterialQuery(water, "WATER")).toBe(true);
    expect(matchesMaterialQuery(water, "helium")).toBe(false);
  });

  test("density operators compare against the material density", () => {
    expect(matchesMaterialQuery(water, "ρ>0.5")).toBe(true);
    expect(matchesMaterialQuery(water, "ρ<0.5")).toBe(false);
    expect(matchesMaterialQuery(water, "ρ>=1")).toBe(true);
    expect(matchesMaterialQuery(water, "ρ<=1")).toBe(true);
    expect(matchesMaterialQuery(water, "ρ=1")).toBe(true);
    expect(matchesMaterialQuery(water, "ρ=2")).toBe(false);
  });

  test("ASCII `rho` alias is accepted", () => {
    expect(matchesMaterialQuery(water, "rho>0.5")).toBe(true);
  });

  test("density operator fails when density is unknown", () => {
    expect(matchesMaterialQuery(external("mix", "Mixture"), "ρ>0")).toBe(false);
  });
});

describe("formatDensity", () => {
  test("uses 2 decimals for built-ins at or above 0.1", () => {
    expect(formatDensity(builtin(6))).toBe("1.00");
  });

  test("uses 4 decimals for built-ins below 0.1", () => {
    const gas = {
      id: 1,
      name: "Hydrogen",
      density: 0.00008,
      isGasByDefault: true,
    } as MaterialEntity;
    expect(formatDensity(gas)).toBe("0.0001");
  });

  test("uses 4 decimals for externals with a density", () => {
    const ext = { ...external("c", "Carbon", 6), density: 2.25 } as ExternalOnlyMaterial;
    expect(formatDensity(ext)).toBe("2.2500");
  });

  test("returns undefined for externals without a density", () => {
    expect(formatDensity(external("mix", "Mixture"))).toBeUndefined();
  });
});

describe("isGas", () => {
  test("true only for built-ins flagged gas by default", () => {
    const gas = {
      id: 1,
      name: "Hydrogen",
      density: 0.00008,
      isGasByDefault: true,
    } as MaterialEntity;
    expect(isGas(gas)).toBe(true);
    expect(isGas(builtin(6))).toBe(false);
  });

  test("externals are never reported as gas", () => {
    expect(isGas(external("c", "Carbon", 6))).toBe(false);
  });
});
