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
  test("maps Electron to ID 1001", () => {
    expect(PARTICLE_NAME_OVERRIDES.get(1001)).toBe("Electron");
  });

  test("no override is an empty string", () => {
    for (const name of PARTICLE_NAME_OVERRIDES.values()) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("getParticleFriendlyName", () => {
  test("returns Hydrogen for ID 1, raw HYDROGEN", () => {
    expect(getParticleFriendlyName(1, "HYDROGEN")).toBe("Hydrogen");
  });

  test("returns Helium for ID 2, raw HELIUM", () => {
    expect(getParticleFriendlyName(2, "HELIUM")).toBe("Helium");
  });

  test("returns Carbon for ID 6, raw CARBON", () => {
    expect(getParticleFriendlyName(6, "CARBON")).toBe("Carbon");
  });

  test("returns Electron for ID 1001 regardless of raw name", () => {
    expect(getParticleFriendlyName(1001, "")).toBe("Electron");
    expect(getParticleFriendlyName(1001, "ELECTRON")).toBe("Electron");
  });

  test("override takes precedence over raw name for electron", () => {
    expect(getParticleFriendlyName(1001, "ANYTHING")).toBe("Electron");
  });

  test("falls back to formatParticleName for unknown IDs", () => {
    expect(getParticleFriendlyName(50, "TIN")).toBe("Tin");
    expect(getParticleFriendlyName(82, "LEAD")).toBe("Lead");
  });
});
