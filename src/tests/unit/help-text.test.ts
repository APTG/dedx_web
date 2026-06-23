import { describe, it, expect } from "vitest";
import { HELP_TEXT, STP_UNIT_HELP, ENERGY_UNIT_HELP, type HelpEntry } from "$lib/config/help-text";
import { STP_UNITS } from "$lib/utils/stp-unit-codec";
import { ENERGY_UNIT_TOOLTIPS } from "$lib/utils/energy-anchor-options";
import type { EnergyUnit } from "$lib/wasm/types";

// Every energy unit the UI can expose (the full `EnergyUnit` union). The
// per-particle `getAvailableEnergyUnits` only ever returns a subset of these.
const ALL_ENERGY_UNITS: EnergyUnit[] = ["MeV", "MeV/nucl", "MeV/u"];

function assertWellFormed(entry: HelpEntry) {
  expect(entry.text.trim().length).toBeGreaterThan(0);
  // Glossary-sourced copy is trimmed to ≤150 chars (contextual-help.md).
  expect(entry.text.length).toBeLessThanOrEqual(150);
  if (entry.href !== undefined) {
    expect(entry.href).toMatch(/^\/docs\//);
  }
}

describe("help-text registry", () => {
  it("keeps every concept gloss non-empty, ≤150 chars, with a base-relative href", () => {
    for (const entry of Object.values(HELP_TEXT)) assertWellFormed(entry);
  });

  it("covers the contextual-help PR 2 concepts (stopping power + CSDA range parity)", () => {
    expect(HELP_TEXT.stoppingPower.text).toMatch(/electronic/i);
    expect(HELP_TEXT.stoppingPower.text).toMatch(/nuclear/i);
    expect(HELP_TEXT.csdaRange.text).toMatch(/Bragg/);
  });

  it("covers the PR 3 advanced-mode controls and workflow affordances", () => {
    for (const key of [
      "aggregateState",
      "densityOverride",
      "iValueOverride",
      "mstarMode",
      "interpolation",
      "inverseRange",
      "inverseStp",
      "braggPeak",
      "advancedMode",
      "shareExport",
      "customCompound",
      "compoundComposition",
      "compoundIValue",
      "externalData",
    ] as const) {
      expect(HELP_TEXT[key]).toBeDefined();
      assertWellFormed(HELP_TEXT[key]);
    }
  });

  it("explains both inverse-lookup branches with Bragg-peak parity", () => {
    // STP→ has two solutions; Range→ is one-to-one. Both must be covered.
    expect(HELP_TEXT.inverseStp.text).toMatch(/stopping power/i);
    expect(HELP_TEXT.inverseStp.text).toMatch(/two|both|branch/i);
    expect(HELP_TEXT.inverseRange.text).toMatch(/range/i);
    expect(HELP_TEXT.braggPeak.text).toMatch(/Bragg|peak|maximum/i);
  });

  // Consistency test: every unit option exposed in the UI has a registry entry.
  it("has a stopping-power help entry for each STP unit shown in the picker", () => {
    for (const unit of STP_UNITS) {
      expect(STP_UNIT_HELP[unit]).toBeDefined();
      assertWellFormed(STP_UNIT_HELP[unit]);
    }
    expect(Object.keys(STP_UNIT_HELP).sort()).toEqual([...STP_UNITS].sort());
  });

  it("has an energy help entry for every selectable energy unit", () => {
    for (const unit of ALL_ENERGY_UNITS) {
      expect(ENERGY_UNIT_HELP[unit]).toBeDefined();
      assertWellFormed(ENERGY_UNIT_HELP[unit]);
    }
    expect(Object.keys(ENERGY_UNIT_HELP).sort()).toEqual([...ALL_ENERGY_UNITS].sort());
  });

  it("addresses the MeV/nucl vs MeV/u confusion called out in the glossary", () => {
    expect(ENERGY_UNIT_HELP["MeV/nucl"].text).toMatch(/mass number|nucleon/i);
    expect(ENERGY_UNIT_HELP["MeV/u"].text).toMatch(/atomic mass/i);
  });

  it("sources the energy strip tooltips from the registry so copy stays in sync", () => {
    for (const unit of ALL_ENERGY_UNITS) {
      expect(ENERGY_UNIT_TOOLTIPS[unit]).toBe(ENERGY_UNIT_HELP[unit].text);
    }
  });
});
