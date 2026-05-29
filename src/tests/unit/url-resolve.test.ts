import { describe, it, expect } from "vitest";
import { parseQuery } from "$lib/utils/url-parse";
import { resolveCalculatorState } from "$lib/utils/calculator-url";
import { resolvePlotState } from "$lib/utils/plot-url";
import type { Diagnostic } from "$lib/utils/url-diagnostics";

/**
 * The resolvers are exported so the semantic layer can be tested directly from
 * an AST, with no URLSearchParams round-trip and no page render (issue #477).
 */

describe("resolveCalculatorState", () => {
  const resolve = (q: string, diags: Diagnostic[] = []) =>
    resolveCalculatorState(parseQuery(q), [], diags);

  it("applies defaults for an empty query", () => {
    const state = resolve("");
    expect(state).toMatchObject({
      particleId: null,
      masterUnit: "MeV",
      isAdvancedMode: false,
      rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
    });
  });

  it("resolves duplicate params last-wins (§3.2)", () => {
    expect(resolve("particle=1&particle=2").particleId).toBe(2);
  });

  it("gates advanced-only params in basic mode", () => {
    // qshow / programs are ignored without mode=advanced
    const state = resolve("particle=1&programs=9,2&qshow=stp");
    expect(state.isAdvancedMode).toBe(false);
    expect(state.selectedProgramIds).toBeUndefined();
    expect(state.quantityFocus).toBeUndefined();
  });

  it("parses per-row energy unit suffixes", () => {
    const rows = resolve("energies=100,200:keV").rows;
    expect(rows).toEqual([
      { rawInput: "100", unit: "MeV", unitFromSuffix: false },
      { rawInput: "200", unit: "keV", unitFromSuffix: true },
    ]);
  });

  it("emits an info diagnostic for each unknown param", () => {
    const diags: Diagnostic[] = [];
    resolve("particle=1&foo=bar&baz=1", diags);
    const unknown = diags.filter((d) => d.code === "param.unknown");
    expect(unknown.map((d) => d.param).sort()).toEqual(["baz", "foo"]);
    expect(unknown[0]?.severity).toBe("info");
  });

  it("falls back to material 276 for a bad custom compound and points at the offending param", () => {
    const diags: Diagnostic[] = [];
    // mat_density present but out of range → invalid; mat_name missing too.
    const state = resolve(
      "mode=advanced&material=custom&mat_name=X&mat_density=99&mat_elements=1:2",
      diags,
    );
    expect(state.materialId).toBe(276);
    expect(state.materialIsCustom).toBeUndefined();
    expect(state.fromUrlWarning).toMatch(/mat_density/);
    // The density param IS present, so its diagnostic carries an exact span.
    const densityDiag = diags.find((d) => d.param === "mat_density");
    expect(densityDiag?.severity).toBe("warning");
    expect(densityDiag?.span).toBeDefined();
  });
});

describe("resolvePlotState", () => {
  const resolve = (q: string) => resolvePlotState(parseQuery(q), []);

  it("applies plot defaults", () => {
    expect(resolve("")).toMatchObject({
      particleId: null,
      materialId: null,
      programId: -1,
      series: [],
      stpUnit: "keV/µm",
      xLog: true,
      yLog: true,
    });
  });

  it("parses series triplets and drops invalid ones", () => {
    const series = resolve("series=9.1.276,bad,2.1.276").series;
    expect(series).toEqual([
      { programId: 9, particleId: 1, materialId: 276 },
      { programId: 2, particleId: 1, materialId: 276 },
    ]);
  });

  it("decodes linear scales and stp unit token", () => {
    const state = resolve("stp_unit=mev-cm2-g&xscale=lin");
    expect(state.stpUnit).toBe("MeV·cm²/g");
    expect(state.xLog).toBe(false);
    expect(state.yLog).toBe(true);
  });
});
