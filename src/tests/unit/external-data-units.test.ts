import { describe, it, expect } from "vitest";
import { computeCsdaColumn } from "$lib/external-data/units";

describe("computeCsdaColumn", () => {
  it("returns empty array for empty inputs", () => {
    const result = computeCsdaColumn(new Float64Array([]), []);
    expect(result).toEqual([]);
  });

  it("returns [0] for a single energy point", () => {
    const result = computeCsdaColumn(new Float64Array([5.0]), [100]);
    expect(result).toEqual([0]);
  });

  it("integrates constant STP analytically", () => {
    // S = 100 MeV·cm²/g, energies 0..30 MeV → R = E / 100
    const energies = new Float64Array([0, 10, 20, 30]);
    const stp: (number | null)[] = [100, 100, 100, 100];

    const result = computeCsdaColumn(energies, stp);

    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.1, 10); // 10/100
    expect(result[2]).toBeCloseTo(0.2, 10); // 20/100
    expect(result[3]).toBeCloseTo(0.3, 10); // 30/100
  });

  it("result is monotonically increasing for positive STP", () => {
    const energies = new Float64Array([1, 10, 100, 1000]);
    const stp: (number | null)[] = [500, 100, 50, 30];

    const result = computeCsdaColumn(energies, stp);

    for (let i = 1; i < result.length; i++) {
      expect(result[i]!).toBeGreaterThan(result[i - 1]!);
    }
  });

  it("propagates null when STP is null at a segment endpoint", () => {
    // Null at index 1: segment [0,1] is invalid, [1,2] also invalid (prev is null)
    const energies = new Float64Array([0, 10, 20, 30]);
    const stp: (number | null)[] = [100, null, 100, 100];

    const result = computeCsdaColumn(energies, stp);

    expect(result[0]).toBe(0);
    expect(result[1]).toBeNull(); // s0=100 ok, s1=null → skip
    expect(result[2]).toBeNull(); // prev is null → skip
    expect(result[3]).toBeNull(); // prev is null → skip
  });

  it("propagates null when STP is null at the first position", () => {
    // s[0] = null: segment [0,1] unintegrable
    const energies = new Float64Array([0, 10, 20]);
    const stp: (number | null)[] = [null, 100, 100];

    const result = computeCsdaColumn(energies, stp);

    expect(result[0]).toBe(0); // defined by convention
    expect(result[1]).toBeNull(); // s0 = null
    expect(result[2]).toBeNull(); // prev is null
  });

  it("returns null for non-positive STP (zero)", () => {
    const energies = new Float64Array([0, 10, 20]);
    const stp: (number | null)[] = [100, 0, 100];

    const result = computeCsdaColumn(energies, stp);

    expect(result[0]).toBe(0);
    expect(result[1]).toBeNull(); // s1 = 0 ≤ 0
    expect(result[2]).toBeNull(); // prev is null
  });

  it("handles non-uniform energy grid", () => {
    // E = [0, 5, 15, 20], S = 100 everywhere → R = E / 100
    const energies = new Float64Array([0, 5, 15, 20]);
    const stp: (number | null)[] = [100, 100, 100, 100];

    const result = computeCsdaColumn(energies, stp);

    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.05, 10);
    expect(result[2]).toBeCloseTo(0.15, 10);
    expect(result[3]).toBeCloseTo(0.2, 10);
  });

  it("two-point trapezoidal step", () => {
    // E = [0, 10], S = [50, 50] → R[1] = 10 * (1/50 + 1/50) / 2 = 0.2
    const energies = new Float64Array([0, 10]);
    const stp: (number | null)[] = [50, 50];

    const result = computeCsdaColumn(energies, stp);

    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.2, 10);
  });
});
