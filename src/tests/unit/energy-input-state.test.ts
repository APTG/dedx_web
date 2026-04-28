import { describe, test, expect } from "vitest";
import { createEnergyInputState } from "$lib/state/energy-rows.svelte";
import type { ParseResult } from "$lib/utils/energy-parser";

function getValue(result: ParseResult): { value: number; unit: string | null } | null {
  if ("value" in result && result.unit !== null) {
    return { value: result.value, unit: result.unit };
  }
  if ("value" in result && result.unit === null) {
    return { value: result.value, unit: null };
  }
  return null;
}

function hasError(result: ParseResult): boolean {
  return "error" in result;
}

function isEmpty(result: ParseResult): boolean {
  return "empty" in result;
}

describe("createEnergyInputState", () => {
  test("initializes with default energy value", () => {
    const state = createEnergyInputState();
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].text).toBe("100");
  });

  test("master unit defaults to MeV", () => {
    const state = createEnergyInputState();
    expect(state.masterUnit).toBe("MeV");
  });

  test("addRow appends new row", () => {
    const state = createEnergyInputState();
    const initialLength = state.rows.length;
    state.addRow();
    expect(state.rows).toHaveLength(initialLength + 1);
    expect(state.rows[state.rows.length - 1].text).toBe("");
  });

  test("removeRow removes row by index", () => {
    const state = createEnergyInputState();
    state.addRow();
    const secondRowText = state.rows[1].text;
    state.removeRow(1);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].text).not.toBe(secondRowText);
  });

  test("cannot remove last row", () => {
    const state = createEnergyInputState();
    state.removeRow(0);
    state.removeRow(0);
    expect(state.rows).toHaveLength(1);
    state.removeRow(0);
    expect(state.rows).toHaveLength(1);
  });

  test("updateRowText updates row text", () => {
    const state = createEnergyInputState();
    state.updateRowText(0, "5.0");
    expect(state.rows[0].text).toBe("5.0");
  });

  test("setMasterUnit changes master unit", () => {
    const state = createEnergyInputState();
    state.setMasterUnit("MeV/nucl");
    expect(state.masterUnit).toBe("MeV/nucl");
  });

  test("isPerRowMode is false by default", () => {
    const state = createEnergyInputState();
    expect(state.isPerRowMode).toBe(false);
  });

  test("parsed energies for valid input", () => {
    const state = createEnergyInputState();
    state.updateRowText(0, "100 keV");
    const parsed = state.getParsedEnergies();
    const val = getValue(parsed[0]);
    expect(val).not.toBeNull();
    if (val == null) throw new Error("Value should not be null");
    expect(val.value).toBe(100);
    expect(val.unit).toBe("keV");
  });

  test("parsed energies for invalid input", () => {
    const state = createEnergyInputState();
    state.updateRowText(0, "invalid");
    const parsed = state.getParsedEnergies();
    expect(hasError(parsed[0])).toBe(true);
  });

  test("parsed energies for empty row", () => {
    const state = createEnergyInputState();
    state.updateRowText(0, "");
    const parsed = state.getParsedEnergies();
    expect(isEmpty(parsed[0])).toBe(true);
  });

  test("clearAllRows resets to defaults", () => {
    const state = createEnergyInputState();
    state.updateRowText(0, "999");
    state.addRow();
    state.clearAllRows();
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].text).toBe("100");
  });
});
