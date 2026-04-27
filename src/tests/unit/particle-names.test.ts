import { describe, test, expect } from "vitest";
import {
  formatParticleName,
  getParticleFriendlyName,
  PARTICLE_NAME_OVERRIDES,
} from "$lib/config/particle-names";

describe("formatParticleName", () => {
  test("converts ALL-CAPS element names to title case", () => {
    expect(formatParticleName("HYDROGEN")).toBe("Hydrogen");
    expect(formatParticleName("HELIUM")).toBe("Helium");
    expect(formatParticleName("CARBON")).toBe("Carbon");
    expect(formatParticleName("NITROGEN")).toBe("Nitrogen");
    expect(formatParticleName("OXYGEN")).toBe("Oxygen");
  });

  test("returns empty string unchanged", () => {
    expect(formatParticleName("")).toBe("");
  });

  test("handles single-character names", () => {
    expect(formatParticleName("A")).toBe("A");
  });
});

describe("PARTICLE_NAME_OVERRIDES", () => {
  test("maps proton to ID 1", () => {
    expect(PARTICLE_NAME_OVERRIDES.get(1)).toBe("proton");
  });

  test("maps alpha particle to ID 2", () => {
    expect(PARTICLE_NAME_OVERRIDES.get(2)).toBe("alpha particle");
  });

  test("maps electron to ID 1001", () => {
    expect(PARTICLE_NAME_OVERRIDES.get(1001)).toBe("electron");
  });

  test("no override is an empty string", () => {
    for (const name of PARTICLE_NAME_OVERRIDES.values()) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("getParticleFriendlyName", () => {
  test("returns proton for ID 1, raw HYDROGEN", () => {
    expect(getParticleFriendlyName(1, "HYDROGEN")).toBe("proton");
  });

  test("returns alpha particle for ID 2, raw HELIUM", () => {
    expect(getParticleFriendlyName(2, "HELIUM")).toBe("alpha particle");
  });

  test("returns Carbon for ID 6, raw CARBON", () => {
    expect(getParticleFriendlyName(6, "CARBON")).toBe("Carbon");
  });

  test("returns electron for ID 1001 regardless of raw name", () => {
    expect(getParticleFriendlyName(1001, "")).toBe("electron");
    expect(getParticleFriendlyName(1001, "ELECTRON")).toBe("electron");
  });

  test("override takes precedence over raw name for electron", () => {
    expect(getParticleFriendlyName(1001, "ANYTHING")).toBe("electron");
  });

  test("returns alpha particle for ID 2, raw HELIUM", () => {
    expect(getParticleFriendlyName(2, "HELIUM")).toBe("alpha particle");
  });

  test("returns Carbon for ID 6, raw CARBON", () => {
    expect(getParticleFriendlyName(6, "CARBON")).toBe("Carbon");
  });

  test("returns electron for ID 1001 regardless of raw name", () => {
    expect(getParticleFriendlyName(1001, "")).toBe("electron");
    expect(getParticleFriendlyName(1001, "ELECTRON")).toBe("electron");
  });

  test("override takes precedence over raw name for electron", () => {
    expect(getParticleFriendlyName(1001, "ANYTHING")).toBe("electron");
  });

  test("falls back to formatParticleName for unknown IDs", () => {
    expect(getParticleFriendlyName(50, "TIN")).toBe("Tin");
    expect(getParticleFriendlyName(82, "LEAD")).toBe("Lead");
  });
});
