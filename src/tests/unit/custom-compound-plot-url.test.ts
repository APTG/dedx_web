import { describe, it, expect } from "vitest";
import { encodePlotUrl, decodePlotUrl } from "$lib/utils/plot-url";
import type { PlotUrlInput } from "$lib/utils/plot-url";

const baseInput: PlotUrlInput = {
  particleId: 1,
  materialId: null,
  programId: 9,
  series: [],
  stpUnit: "keV/µm",
  xLog: true,
  yLog: true,
};

describe("encodePlotUrl — custom compounds", () => {
  it("encodes material=custom when materialId is null and custom compound fields are present", () => {
    const p = encodePlotUrl({
      ...baseInput,
      materialId: null,
      materialIsCustom: true,
      matName: "LiF",
      matDensity: 2.64,
      matElements: [
        { atomicNumber: 3, atomCount: 1 },
        { atomicNumber: 9, atomCount: 1 },
      ],
      matPhase: "condensed",
    });
    expect(p.get("material")).toBe("custom");
    expect(p.get("mat_name")).toBe("LiF");
    expect(p.get("mat_density")).toBe("2.64");
    expect(p.get("mat_elements")).toBe("3:1~9:1");
    expect(p.get("mat_phase")).toBeNull();
  });

  it("encodes mat_ival when present", () => {
    const p = encodePlotUrl({
      ...baseInput,
      materialId: null,
      materialIsCustom: true,
      matName: "PMMA",
      matDensity: 1.19,
      matElements: [
        { atomicNumber: 1, atomCount: 8 },
        { atomicNumber: 6, atomCount: 5 },
        { atomicNumber: 8, atomCount: 2 },
      ],
      matIval: 65,
      matPhase: "condensed",
    });
    expect(p.get("mat_ival")).toBe("65");
  });

  it("encodes mat_phase=gas when phase is gas", () => {
    const p = encodePlotUrl({
      ...baseInput,
      materialId: null,
      materialIsCustom: true,
      matName: "Custom Water",
      matDensity: 1.0,
      matElements: [
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ],
      matPhase: "gas",
    });
    expect(p.get("mat_phase")).toBe("gas");
  });

  it("encodes elements in ascending Z order", () => {
    const p = encodePlotUrl({
      ...baseInput,
      materialId: null,
      materialIsCustom: true,
      matName: "Test",
      matDensity: 1.0,
      matElements: [
        { atomicNumber: 8, atomCount: 2 },
        { atomicNumber: 1, atomCount: 8 },
        { atomicNumber: 6, atomCount: 5 },
      ],
    });
    expect(p.get("mat_elements")).toBe("1:8~6:5~8:2");
  });

  it("does NOT encode custom params when materialIsCustom is false", () => {
    const p = encodePlotUrl({
      ...baseInput,
      materialId: 276,
      materialIsCustom: false,
    });
    expect(p.get("material")).toBe("276");
    expect(p.has("mat_name")).toBe(false);
  });
});

describe("decodePlotUrl — custom compounds", () => {
  it("decodes material=custom and all mat_* params", () => {
    const params = new URLSearchParams(
      "particle=1&material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=LiF&mat_density=2.64&mat_elements=3:1,9:1",
    );
    const s = decodePlotUrl(params);
    expect(s.materialId).toBeNull();
    expect(s.materialIsCustom).toBe(true);
    expect(s.matName).toBe("LiF");
    expect(s.matDensity).toBe(2.64);
    expect(s.matElements).toEqual([
      { atomicNumber: 3, atomCount: 1 },
      { atomicNumber: 9, atomCount: 1 },
    ]);
    expect(s.matPhase).toBe("condensed");
  });

  it("sets fromUrlWarning when mat_name is missing", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_density=1.19&mat_elements=1:8,6:5,8:2",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_name/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_density is missing", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=LiF&mat_elements=3:1,9:1",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_density/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_density > 25", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Dense&mat_density=30&mat_elements=1:1",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_density/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_density is not a strict number", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=LiF&mat_density=2.64foo&mat_elements=3:1,9:1",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_density/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_elements is missing", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=LiF&mat_density=2.64",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("drops individual elements with invalid Z but proceeds if at least one valid", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=0:1,1:2,119:1,8:1",
    );
    const s = decodePlotUrl(params);
    expect(s.matElements).toEqual([
      { atomicNumber: 1, atomCount: 2 },
      { atomicNumber: 8, atomCount: 1 },
    ]);
    expect(s.fromUrlWarning).toBeUndefined();
  });

  it("sets fromUrlWarning when all elements are invalid", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=0:1,119:1,999:1",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_elements contains partial numeric tokens", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1abc:2,8:1",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("sets fromUrlWarning when mat_elements contains partial atom counts", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:2foo,8:1",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_elements/);
    expect(s.materialId).toBe(276);
  });

  it("collapses duplicate Z by summing counts", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:2,1:3,8:1",
    );
    const s = decodePlotUrl(params);
    expect(s.matElements).toEqual([
      { atomicNumber: 1, atomCount: 5 },
      { atomicNumber: 8, atomCount: 1 },
    ]);
  });

  it("silently ignores mat_ival when out of range", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:1&mat_ival=0",
    );
    const s = decodePlotUrl(params);
    expect(s.matIval).toBeUndefined();
  });

  it("sets fromUrlWarning when mat_ival is not a strict number", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:1&mat_ival=65foo",
    );
    const s = decodePlotUrl(params);
    expect(s.fromUrlWarning).toMatch(/mat_ival/);
    expect(s.materialId).toBe(276);
  });

  it("silently ignores mat_phase when unknown token", () => {
    const params = new URLSearchParams(
      "material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Test&mat_density=1.0&mat_elements=1:1&mat_phase=plasma",
    );
    const s = decodePlotUrl(params);
    expect(s.matPhase).toBe("condensed");
  });
});

describe("round-trip — Plot custom compounds", () => {
  it("round-trips LiF custom compound", () => {
    const originalParams = new URLSearchParams(
      "particle=1&material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=LiF&mat_density=2.64&mat_elements=3:1,9:1",
    );
    const decoded = decodePlotUrl(originalParams);
    const reEncoded = encodePlotUrl(decoded);

    expect(reEncoded.get("material")).toBe("custom");
    expect(reEncoded.get("mat_name")).toBe("LiF");
    expect(reEncoded.get("mat_density")).toBe("2.64");
    expect(reEncoded.get("mat_elements")).toBe("3:1~9:1");
  });

  it("round-trips PMMA with iValue", () => {
    const originalParams = new URLSearchParams(
      "particle=1&material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=PMMA&mat_density=1.19&mat_elements=1:8,6:5,8:2&mat_ival=65",
    );
    const decoded = decodePlotUrl(originalParams);
    const reEncoded = encodePlotUrl(decoded);

    expect(reEncoded.get("mat_ival")).toBe("65");
  });

  it("round-trips custom water with gas phase", () => {
    const originalParams = new URLSearchParams(
      "particle=1&material=custom&program=9&series=&stp_unit=kev-um&xscale=log&yscale=log" +
        "&mat_name=Custom Water&mat_density=1&mat_elements=1:2,8:1&mat_phase=gas",
    );
    const decoded = decodePlotUrl(originalParams);
    const reEncoded = encodePlotUrl(decoded);

    expect(reEncoded.get("mat_name")).toBe("Custom Water");
    expect(reEncoded.get("mat_phase")).toBe("gas");
  });
});
