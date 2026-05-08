import { describe, test, expect } from "vitest";
import { parseLengthInput } from "$lib/utils/range-parser";

describe("parseLengthInput", () => {
  test('parses "7.718 cm" correctly', () => {
    const result = parseLengthInput("7.718 cm");
    expect(result).toEqual({ value: 7.718, unit: "cm", toCm: 1 });
  });

  test('parses "45 µm" correctly', () => {
    const result = parseLengthInput("45 µm");
    expect(result).toEqual({ value: 45, unit: "µm", toCm: 1e-4 });
  });

  test('parses "45 um" correctly (alias for µm)', () => {
    const result = parseLengthInput("45 um");
    expect(result).toEqual({ value: 45, unit: "µm", toCm: 1e-4 });
  });

  test('parses "30 m" correctly', () => {
    const result = parseLengthInput("30 m");
    expect(result).toEqual({ value: 30, unit: "m", toCm: 100 });
  });

  test('parses "0.2" without suffix', () => {
    const result = parseLengthInput("0.2");
    expect(result).toEqual({ value: 0.2, unit: null, toCm: null });
  });

  test('rejects non-numeric text "abc"', () => {
    const result = parseLengthInput("abc");
    expect(result).toEqual({ error: "Enter a numeric value" });
  });

  test('rejects unrecognized unit "km"', () => {
    const result = parseLengthInput("1.5 km");
    expect(result).toEqual({ error: "Unrecognized unit 'km'" });
  });

  test("allows negative values at parse level", () => {
    const result = parseLengthInput("-5 cm");
    expect(result).toEqual({ value: -5, unit: "cm", toCm: 1 });
  });

  test("returns empty marker for empty string", () => {
    const result = parseLengthInput("");
    expect(result).toEqual({ empty: true });
  });

  test("returns empty marker for whitespace-only", () => {
    const result = parseLengthInput("   ");
    expect(result).toEqual({ empty: true });
  });

  test('parses "100 nm" correctly', () => {
    const result = parseLengthInput("100 nm");
    expect(result).toEqual({ value: 100, unit: "nm", toCm: 1e-7 });
  });

  test('parses "5 mm" correctly', () => {
    const result = parseLengthInput("5 mm");
    expect(result).toEqual({ value: 5, unit: "mm", toCm: 1e-1 });
  });

  test('handles case-insensitive units: "CM"', () => {
    const result = parseLengthInput("10 CM");
    expect(result).toEqual({ value: 10, unit: "cm", toCm: 1 });
  });

  test('handles case-insensitive units: "MM"', () => {
    const result = parseLengthInput("10 MM");
    expect(result).toEqual({ value: 10, unit: "mm", toCm: 1e-1 });
  });

  test('handles case-insensitive units: "UM" (alias for µm)', () => {
    const result = parseLengthInput("10 UM");
    expect(result).toEqual({ value: 10, unit: "µm", toCm: 1e-4 });
  });

  test('handles case-insensitive units: "M"', () => {
    const result = parseLengthInput("10 M");
    expect(result).toEqual({ value: 10, unit: "m", toCm: 100 });
  });

  test('handles scientific notation: "1e-3 cm"', () => {
    const result = parseLengthInput("1e-3 cm");
    expect(result).toEqual({ value: 0.001, unit: "cm", toCm: 1 });
  });

  test("handles leading and trailing whitespace", () => {
    const result = parseLengthInput("  7.718 cm  ");
    expect(result).toEqual({ value: 7.718, unit: "cm", toCm: 1 });
  });

  test('handles number without space before unit: "5cm"', () => {
    const result = parseLengthInput("5cm");
    expect(result).toEqual({ value: 5, unit: "cm", toCm: 1 });
  });

  test('rejects unrecognized unit "furlongs"', () => {
    const result = parseLengthInput("1.5 furlongs");
    expect(result).toEqual({ error: "Unrecognized unit 'furlongs'" });
  });

  test('rejects partially matching unit "cms"', () => {
    const result = parseLengthInput("5 cms");
    expect(result).toEqual({ error: "Unrecognized unit 'cms'" });
  });

  test('rejects malformed exponent "1e cm"', () => {
    const result = parseLengthInput("1e cm");
    expect(result).toEqual({ error: "Enter a numeric value" });
  });

  test('rejects malformed numeric "1..2 cm"', () => {
    const result = parseLengthInput("1..2 cm");
    expect(result).toEqual({ error: "Enter a numeric value" });
  });

  test('handles decimal values: "0.5 mm"', () => {
    const result = parseLengthInput("0.5 mm");
    expect(result).toEqual({ value: 0.5, unit: "mm", toCm: 1e-1 });
  });

  test('handles large values: "1000 m"', () => {
    const result = parseLengthInput("1000 m");
    expect(result).toEqual({ value: 1000, unit: "m", toCm: 100 });
  });
});
