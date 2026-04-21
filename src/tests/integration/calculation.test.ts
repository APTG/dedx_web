import { describe, test, expect, beforeEach } from "vitest";
import { energyInputText, computeParsedEnergies } from "$lib/state/calculation.svelte";

// computeParsedEnergies reads module-level $state; reset between tests.
beforeEach(() => {
  energyInputText.value = "";
});

describe("computeParsedEnergies", () => {
  test("returns empty array for empty input state", () => {
    expect(computeParsedEnergies()).toEqual([]);
  });

  test("parses a single energy value from state", () => {
    energyInputText.value = "100";
    expect(computeParsedEnergies()).toEqual([100]);
  });

  test("parses multiple newline-separated values", () => {
    energyInputText.value = "1.0\n2.5\n10.0";
    expect(computeParsedEnergies()).toEqual([1.0, 2.5, 10.0]);
  });

  test("skips invalid (non-numeric) lines in state", () => {
    energyInputText.value = "1.0\ninvalid\n2.5";
    expect(computeParsedEnergies()).toEqual([1.0, 2.5]);
  });

  test("skips negative values in state", () => {
    energyInputText.value = "-5\n10";
    expect(computeParsedEnergies()).toEqual([10]);
  });

  test("parses scientific notation from state", () => {
    energyInputText.value = "1e3\n1.5E-2";
    expect(computeParsedEnergies()).toEqual([1000, 0.015]);
  });

  test("reflects updated state on second call", () => {
    energyInputText.value = "50";
    expect(computeParsedEnergies()).toEqual([50]);

    energyInputText.value = "50\n100\n200";
    expect(computeParsedEnergies()).toEqual([50, 100, 200]);
  });
});
