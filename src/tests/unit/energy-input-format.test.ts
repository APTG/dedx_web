import { describe, it, expect } from "vitest";
import { formatSigFigs } from "$lib/utils/unit-conversions";

/**
 * Unit tests for `formatSigFigs(value, 4)`.
 *
 * These assertions verify the formatter's behavior directly for a range
 * of representative numeric values. They do not exercise any Svelte
 * component rendering path; the goal is to lock in the formatter contract
 * shared by `energy-input.svelte`, `result-table.svelte`, and the calculator.
 */
describe("formatSigFigs with 4 significant figures", () => {
  it("formats typical energy values to 4 significant figures", () => {
    expect(formatSigFigs(12.0, 4)).toBe("12");
    expect(formatSigFigs(12.096, 4)).toBe("12.1");
    expect(formatSigFigs(100.0, 4)).toBe("100");
    expect(formatSigFigs(50.5, 4)).toBe("50.5");
  });

  it("formats small values correctly", () => {
    expect(formatSigFigs(0.001234, 4)).toBe("0.001234");
    expect(formatSigFigs(0.01234, 4)).toBe("0.01234");
  });

  it("formats large values without scientific notation (within range)", () => {
    expect(formatSigFigs(1234, 4)).toBe("1234");
    expect(formatSigFigs(9999, 4)).toBe("9999");
  });

  it("uses scientific notation for extreme magnitudes", () => {
    // Very small (subnormal-like)
    const result = formatSigFigs(1e-20, 4);
    expect(result).toMatch(/e-20/i);
    
    // Very large
    const largeResult = formatSigFigs(1e15, 4);
    expect(largeResult).toMatch(/e\+15/i);
  });

  it("handles zero correctly", () => {
    expect(formatSigFigs(0, 4)).toBe("0");
  });

  it("handles NaN and Infinity with em-dash", () => {
    expect(formatSigFigs(NaN, 4)).toBe("—");
    expect(formatSigFigs(Infinity, 4)).toBe("—");
    expect(formatSigFigs(-Infinity, 4)).toBe("—");
  });
});
