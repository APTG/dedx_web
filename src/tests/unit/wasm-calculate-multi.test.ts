import { describe, test, expect, beforeEach } from "vitest";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import type { LibdedxService, CalculationResult } from "$lib/wasm/types";

describe("LibdedxServiceImpl mock — calculateMulti", () => {
  let svc: LibdedxService;

  beforeEach(() => {
    svc = new LibdedxServiceImpl();
  });

  test("returns Map with CalculationResult for each valid programId", () => {
    const energies = [10, 100];
    const result = svc.calculateMulti({
      programIds: [1, 2],
      particleId: 2,
      materialId: 1,
      energies,
    });

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);

    const res1 = result.get(1) as CalculationResult;
    const res2 = result.get(2) as CalculationResult;

    expect(res1.energies).toHaveLength(2);
    expect(res1.stoppingPowers).toHaveLength(2);
    expect(res1.csdaRanges).toHaveLength(2);

    expect(res2.energies).toHaveLength(2);
    expect(res2.stoppingPowers).toHaveLength(2);
    expect(res2.csdaRanges).toHaveLength(2);
  });

  test("returns LibdedxError for invalid programId, success for valid ones", () => {
    const energies = [10, 100];
    const result = svc.calculateMulti({
      programIds: [1, 999],
      particleId: 2,
      materialId: 1,
      energies,
    });

    expect(result.size).toBe(2);

    const res1 = result.get(1);
    expect(res1).toHaveProperty("energies");
    expect(res1).toHaveProperty("stoppingPowers");
    expect(res1).toHaveProperty("csdaRanges");

    const res999 = result.get(999);
    expect(res999).toBeInstanceOf(Error);
    expect(res999).toHaveProperty("code");
  });

  test("returns empty Map for empty programIds array", () => {
    const result = svc.calculateMulti({
      programIds: [],
      particleId: 2,
      materialId: 1,
      energies: [10, 100],
    });

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});
