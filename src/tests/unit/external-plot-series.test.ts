import { describe, it, expect, vi } from "vitest";
import {
  externalEntriesToCalculationResult,
  loadExternalCalculationResult,
} from "$lib/utils/external-plot-series";

describe("externalEntriesToCalculationResult", () => {
  it("converts external preview series values for plotting", () => {
    const result = externalEntriesToCalculationResult(
      {
        energyGridMev: new Float64Array([4, 8]),
        values: [1.2, null],
      },
      {
        energyGridMev: new Float64Array([4, 8]),
        values: [10, null],
      },
      4,
    );
    expect(result).toEqual({
      energies: [1, 2],
      stoppingPowers: [1.2, 0],
      csdaRanges: [10, 0],
    });
  });
});

describe("loadExternalCalculationResult", () => {
  it("loads and maps an external series for URL restore/add-series", async () => {
    const service = {
      getStp: vi.fn().mockResolvedValue({
        energyGridMev: new Float64Array([3, 6]),
        values: [2.5, 5],
      }),
      getCsda: vi.fn().mockResolvedValue({
        energyGridMev: new Float64Array([3, 6]),
        values: [11, 13],
      }),
    };

    await expect(
      loadExternalCalculationResult(service, "srim", "srim-2013", "p", "water", 3),
    ).resolves.toEqual({
      energies: [1, 2],
      stoppingPowers: [2.5, 5],
      csdaRanges: [11, 13],
    });
  });

  it("returns null when external STP data is unavailable", async () => {
    const service = {
      getStp: vi.fn().mockResolvedValue(null),
      getCsda: vi.fn().mockResolvedValue(null),
    };
    await expect(
      loadExternalCalculationResult(service, "srim", "srim-2013", "p", "water", 3),
    ).resolves.toBeNull();
  });
});
