import { describe, test, expect, vi } from "vitest";
import { integrateCsdaFromStp } from "$lib/utils/csda-integration";

describe("integrateCsdaFromStp", () => {
  test("basic integration with sample STP data", () => {
    // Simple test case: linearly increasing STP
    // Energies: 1, 2, 3, 4, 5 MeV/nucl
    // STP values: 10, 20, 30, 40, 50 MeV·cm²/g
    // For constant dE = 1 and linearly increasing S:
    // R[0] = 0
    // R[1] = 1 * (1/10 + 1/20) / 2 = 1 * (0.1 + 0.05) / 2 = 0.075
    // R[2] = R[1] + 1 * (1/20 + 1/30) / 2 = 0.075 + 1 * (0.05 + 0.0333...) / 2 = 0.075 + 0.04167 = 0.11667
    // etc.

    const energies = new Float32Array([1, 2, 3, 4, 5]);
    const stp = new Float32Array([10, 20, 30, 40, 50]);
    const density = 1.0;

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(5);
    expect(result[0]).toBe(0); // First point is always 0

    // Verify accumulated trapezoidal integration
    const expected1 = (1 * (1 / 10 + 1 / 20)) / 2;
    expect(result[1]).toBeCloseTo(expected1, 10);

    const expected2 = expected1 + (1 * (1 / 20 + 1 / 30)) / 2;
    expect(result[2]).toBeCloseTo(expected2, 10);

    // Verify monotonic increase
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!).toBeGreaterThan(result[i - 1]!);
    }
  });

  test("constant STP yields analytical solution", () => {
    // When S(E) = constant = S0, the integral becomes:
    // R(E) = ∫(1/S0) dE = (E - E_min) / S0
    // For S0 = 100 MeV·cm²/g and energies 0, 10, 20, 30 MeV:
    // R(0) = 0
    // R(10) = 10/100 = 0.1 g/cm²
    // R(20) = 20/100 = 0.2 g/cm²
    // R(30) = 30/100 = 0.3 g/cm²

    const energies = new Float32Array([0, 10, 20, 30]);
    const stp = new Float32Array([100, 100, 100, 100]); // constant STP
    const density = 2.0; // density doesn't affect the integration for mass units

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(4);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.1, 10); // 10/100
    expect(result[2]).toBeCloseTo(0.2, 10); // 20/100
    expect(result[3]).toBeCloseTo(0.3, 10); // 30/100
  });

  test("single point returns [0]", () => {
    const energies = new Float32Array([5.0]);
    const stp = new Float32Array([25.0]);
    const density = 1.0;

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(1);
    expect(result[0]).toBe(0);
  });

  test("two points performs single trapezoidal step", () => {
    // Simple two-point case
    // E = [0, 10], S = [50, 50]
    // R[1] = 10 * (1/50 + 1/50) / 2 = 10 * 0.04 / 2 = 10 * 0.02 = 0.2

    const energies = new Float32Array([0, 10]);
    const stp = new Float32Array([50, 50]);
    const density = 1.0;

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(2);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.2, 10);
  });

  test("empty arrays return empty result", () => {
    const energies = new Float32Array([]);
    const stp = new Float32Array([]);
    const density = 1.0;

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(0);
  });

  test("non-uniform energy grid", () => {
    // Test with non-uniform spacing
    // E = [0, 5, 15, 20], S = [100, 100, 100, 100]
    // R[1] = 5 * (1/100 + 1/100) / 2 = 5 * 0.01 = 0.05
    // R[2] = R[1] + 10 * (1/100 + 1/100) / 2 = 0.05 + 10 * 0.01 = 0.05 + 0.1 = 0.15
    // R[3] = R[2] + 5 * (1/100 + 1/100) / 2 = 0.15 + 5 * 0.01 = 0.15 + 0.05 = 0.2

    const energies = new Float32Array([0, 5, 15, 20]);
    const stp = new Float32Array([100, 100, 100, 100]);
    const density = 1.0;

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(4);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(0.05, 10);
    expect(result[2]).toBeCloseTo(0.15, 10);
    expect(result[3]).toBeCloseTo(0.2, 10);
  });

  test("varying STP values", () => {
    // More realistic case with decreasing STP (typical for high energies)
    // As energy increases, stopping power often decreases
    const energies = new Float32Array([1, 10, 100, 1000]);
    const stp = new Float32Array([500, 100, 50, 30]); // decreasing STP
    const density = 1.0;

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(4);
    expect(result[0]).toBe(0);
    // Verify CSDA range is monotonically increasing
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!).toBeGreaterThan(result[i - 1]!);
    }
    // Verify all values are positive
    result.forEach((val) => expect(val).toBeGreaterThanOrEqual(0));
  });

  test("small STP values increase CSDA range rapidly", () => {
    // Very small STP → large 1/S → large CSDA range increment
    const energies = new Float32Array([100, 200]);
    const stp = new Float32Array([0.001, 0.001]); // very small STP
    const density = 0.001; // low density (gas)

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result.length).toBe(2);
    expect(result[0]).toBe(0);
    // dE = 100, 1/S = 1000, integral = 100 * (1000 + 1000) / 2 = 100 * 1000 = 100000
    expect(result[1]).toBeCloseTo(100000, 1);
  });

  test("throws error when array lengths mismatch", () => {
    const energies = new Float32Array([1, 2, 3]);
    const stp = new Float32Array([10, 20]); // wrong length
    const density = 1.0;

    expect(() => integrateCsdaFromStp(energies, stp, density)).toThrow(
      "Energies and STP arrays must have the same length",
    );
  });

  test("handles zero STP gracefully with warning", () => {
    const energies = new Float32Array([1, 2, 3, 4]);
    const stp = new Float32Array([10, 0, 20, 30]); // zero at index 1
    const density = 1.0;

    // Should not throw, but should warn
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = integrateCsdaFromStp(energies, stp, density);
    consoleSpy.mockRestore();

    expect(result.length).toBe(4);
    expect(result[0]).toBe(0);
    // Segment 0→1 has zero STP, skipped: result[1] = result[0] = 0
    expect(result[1]).toBe(0);
    // Segment 1→2 also has zero STP at index 1, skipped: result[2] = result[1] = 0
    expect(result[2]).toBe(0);
    // Segment 2→3 can integrate normally: dE=1, 1/20 + 1/30 = 0.05 + 0.0333... = 0.0833...
    expect(result[3]).toBeGreaterThan(0);
  });

  test("density parameter does not affect result (mass stopping power)", () => {
    // The function integrates 1/S where S is mass stopping power (MeV·cm²/g)
    // The result is in g/cm² and should not depend on density
    const energies = new Float32Array([0, 10, 20]);
    const stp = new Float32Array([50, 50, 50]);

    const result1 = integrateCsdaFromStp(energies, stp, 1.0);
    const result2 = integrateCsdaFromStp(energies, stp, 10.0);
    const result3 = integrateCsdaFromStp(energies, stp, 0.001);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  test("Float64Array output type", () => {
    const energies = new Float32Array([0, 10]);
    const stp = new Float32Array([100, 100]);
    const density = 1.0;

    const result = integrateCsdaFromStp(energies, stp, density);

    expect(result).toBeInstanceOf(Float64Array);
  });
});
