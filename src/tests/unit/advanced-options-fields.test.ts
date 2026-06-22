import { describe, test, expect } from "vitest";
import {
  formatDensityForDisplay,
  getDensityPlaceholder,
  getDensityTooltip,
  validateDensity,
  validateIValue,
  buildHeaderText,
  scaleToSelectValue,
  methodToSelectValue,
  nextInterpolationForScale,
  nextInterpolationForMethod,
} from "$lib/utils/advanced-options-fields";

describe("formatDensityForDisplay", () => {
  test("uses 3 decimals at or above 0.01", () => {
    expect(formatDensityForDisplay(1)).toBe("1.000");
    expect(formatDensityForDisplay(0.01)).toBe("0.010");
  });

  test("uses trimmed scientific notation below 0.01", () => {
    expect(formatDensityForDisplay(0.000125)).toBe("1.25e-4");
    expect(formatDensityForDisplay(0.0001)).toBe("1e-4");
  });
});

describe("getDensityPlaceholder", () => {
  test("returns em dash when density is unknown", () => {
    expect(getDensityPlaceholder(undefined)).toBe("—");
  });

  test("formats a known density", () => {
    expect(getDensityPlaceholder(2.7)).toBe("2.700");
  });
});

describe("getDensityTooltip", () => {
  test("custom-compound message takes precedence", () => {
    expect(getDensityTooltip(true, true)).toMatch(/Custom compounds/);
    expect(getDensityTooltip(true, false)).toMatch(/Custom compounds/);
  });

  test("gas vs condensed messaging", () => {
    expect(getDensityTooltip(false, true)).toMatch(/Gas density/);
    expect(getDensityTooltip(false, false)).toMatch(/bulk material/);
  });
});

describe("validateDensity", () => {
  test("empty is valid with no parsed value", () => {
    expect(validateDensity("")).toEqual({ valid: true });
  });

  test("non-numeric is rejected", () => {
    expect(validateDensity("abc")).toEqual({ valid: false, error: "Enter a numeric value" });
  });

  test("non-positive is rejected", () => {
    expect(validateDensity("0")).toEqual({
      valid: false,
      error: "Density must be greater than 0",
    });
    expect(validateDensity("-1").valid).toBe(false);
  });

  test("positive number passes with parsedValue", () => {
    expect(validateDensity("2.7")).toEqual({ valid: true, parsedValue: 2.7 });
  });
});

describe("validateIValue", () => {
  test("empty is valid", () => {
    expect(validateIValue("")).toEqual({ valid: true });
  });

  test("rejects non-numeric and non-positive", () => {
    expect(validateIValue("x").valid).toBe(false);
    expect(validateIValue("0").valid).toBe(false);
  });

  test("rejects above the 10 000 eV physical maximum", () => {
    expect(validateIValue("10001")).toEqual({
      valid: false,
      error: "I-value exceeds 10 000 eV (physical maximum)",
    });
    expect(validateIValue("10000")).toEqual({ valid: true, parsedValue: 10000 });
  });
});

describe("buildHeaderText", () => {
  test("plain when no override", () => {
    expect(buildHeaderText(undefined)).toBe("Advanced Options");
  });

  test("appends the density override", () => {
    expect(buildHeaderText(2.7)).toBe("Advanced Options (ρ = 2.700 g/cm³)");
  });
});

describe("scaleToSelectValue / methodToSelectValue", () => {
  test("scale mapping", () => {
    expect(scaleToSelectValue("linear")).toBe("lin-lin");
    expect(scaleToSelectValue("log")).toBe("log-log");
    expect(scaleToSelectValue(undefined)).toBe("log-log");
  });

  test("method mapping", () => {
    expect(methodToSelectValue("cubic")).toBe("spline");
    expect(methodToSelectValue("linear")).toBe("linear");
    expect(methodToSelectValue(undefined)).toBe("linear");
  });
});

describe("nextInterpolationForScale", () => {
  test("lin-lin sets linear scale, preserving method", () => {
    expect(nextInterpolationForScale(undefined, "lin-lin")).toEqual({ scale: "linear" });
    expect(nextInterpolationForScale({ method: "cubic" }, "lin-lin")).toEqual({
      method: "cubic",
      scale: "linear",
    });
  });

  test("log-log drops the scale, keeping a bare method", () => {
    expect(nextInterpolationForScale({ scale: "linear" }, "log-log")).toBeUndefined();
    expect(nextInterpolationForScale(undefined, "log-log")).toBeUndefined();
    expect(nextInterpolationForScale({ scale: "linear", method: "cubic" }, "log-log")).toEqual({
      method: "cubic",
    });
  });
});

describe("nextInterpolationForMethod", () => {
  test("spline sets cubic method, preserving scale", () => {
    expect(nextInterpolationForMethod(undefined, "spline")).toEqual({ method: "cubic" });
    expect(nextInterpolationForMethod({ scale: "linear" }, "spline")).toEqual({
      scale: "linear",
      method: "cubic",
    });
  });

  test("linear drops the method, keeping a bare scale", () => {
    expect(nextInterpolationForMethod({ method: "cubic" }, "linear")).toBeUndefined();
    expect(nextInterpolationForMethod(undefined, "linear")).toBeUndefined();
    expect(nextInterpolationForMethod({ scale: "linear", method: "cubic" }, "linear")).toEqual({
      scale: "linear",
    });
  });
});
