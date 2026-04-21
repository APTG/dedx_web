import { describe, test, expect } from "vitest";
import { stateToUrl, urlToState } from "$lib/state/url-sync";
import type { AppState } from "$lib/state/url-sync";

const fullState: AppState = {
  programId: 1,
  particleId: 2,
  materialId: 3,
  energies: "100\n200\n300",
  energyUnit: "MeV",
  advancedMode: false,
};

describe("stateToUrl", () => {
  test("always sets urlv=1 version marker", () => {
    expect(stateToUrl(fullState).get("urlv")).toBe("1");
  });

  test("serializes particleId", () => {
    expect(stateToUrl(fullState).get("particle")).toBe("2");
  });

  test("serializes materialId", () => {
    expect(stateToUrl(fullState).get("material")).toBe("3");
  });

  test("serializes explicit programId as number string", () => {
    expect(stateToUrl(fullState).get("program")).toBe("1");
  });

  test("serializes null programId as 'auto'", () => {
    expect(stateToUrl({ ...fullState, programId: null }).get("program")).toBe("auto");
  });

  test("omits particle key when particleId is null", () => {
    expect(stateToUrl({ ...fullState, particleId: null }).has("particle")).toBe(false);
  });

  test("omits material key when materialId is null", () => {
    expect(stateToUrl({ ...fullState, materialId: null }).has("material")).toBe(false);
  });

  test("serializes energies string", () => {
    expect(stateToUrl(fullState).get("energies")).toBe("100\n200\n300");
  });

  test("omits energies key when energies is empty string", () => {
    expect(stateToUrl({ ...fullState, energies: "" }).has("energies")).toBe(false);
  });

  test("serializes MeV/nucl energy unit", () => {
    expect(stateToUrl({ ...fullState, energyUnit: "MeV/nucl" }).get("eunit")).toBe("MeV/nucl");
  });

  test("serializes MeV/u energy unit", () => {
    expect(stateToUrl({ ...fullState, energyUnit: "MeV/u" }).get("eunit")).toBe("MeV/u");
  });

  test("includes mode=advanced when advancedMode is true", () => {
    expect(stateToUrl({ ...fullState, advancedMode: true }).get("mode")).toBe("advanced");
  });

  test("omits mode key when advancedMode is false", () => {
    expect(stateToUrl({ ...fullState, advancedMode: false }).has("mode")).toBe(false);
  });
});

describe("urlToState", () => {
  test("parses particleId from 'particle' key", () => {
    expect(urlToState(new URLSearchParams("particle=5")).particleId).toBe(5);
  });

  test("parses materialId from 'material' key", () => {
    expect(urlToState(new URLSearchParams("material=10")).materialId).toBe(10);
  });

  test("parses explicit programId", () => {
    expect(urlToState(new URLSearchParams("program=3")).programId).toBe(3);
  });

  test("leaves programId undefined when program=auto", () => {
    expect(urlToState(new URLSearchParams("program=auto")).programId).toBeUndefined();
  });

  test("parses energies string", () => {
    const params = new URLSearchParams();
    params.set("energies", "100\n200");
    expect(urlToState(params).energies).toBe("100\n200");
  });

  test("parses MeV energy unit", () => {
    expect(urlToState(new URLSearchParams("eunit=MeV")).energyUnit).toBe("MeV");
  });

  test("parses MeV/nucl energy unit", () => {
    const params = new URLSearchParams();
    params.set("eunit", "MeV/nucl");
    expect(urlToState(params).energyUnit).toBe("MeV/nucl");
  });

  test("parses MeV/u energy unit", () => {
    const params = new URLSearchParams();
    params.set("eunit", "MeV/u");
    expect(urlToState(params).energyUnit).toBe("MeV/u");
  });

  test("leaves energyUnit undefined for unknown unit string", () => {
    expect(urlToState(new URLSearchParams("eunit=keV")).energyUnit).toBeUndefined();
  });

  test("sets advancedMode=true when mode=advanced", () => {
    expect(urlToState(new URLSearchParams("mode=advanced")).advancedMode).toBe(true);
  });

  test("leaves advancedMode undefined for other mode values", () => {
    expect(urlToState(new URLSearchParams("mode=simple")).advancedMode).toBeUndefined();
  });

  test("returns empty object for empty params", () => {
    expect(urlToState(new URLSearchParams())).toEqual({});
  });

  test("ignores non-numeric particle ID", () => {
    expect(urlToState(new URLSearchParams("particle=abc")).particleId).toBeUndefined();
  });

  test("ignores non-numeric material ID", () => {
    expect(urlToState(new URLSearchParams("material=bad")).materialId).toBeUndefined();
  });
});

describe("urlToState — legacy param aliases", () => {
  test("'i' is alias for particle", () => {
    expect(urlToState(new URLSearchParams("i=7")).particleId).toBe(7);
  });

  test("'m' is alias for material", () => {
    expect(urlToState(new URLSearchParams("m=8")).materialId).toBe(8);
  });

  test("'p' is alias for program", () => {
    expect(urlToState(new URLSearchParams("p=2")).programId).toBe(2);
  });

  test("'e' is alias for energies", () => {
    expect(urlToState(new URLSearchParams("e=100")).energies).toBe("100");
  });

  test("'u' is alias for eunit", () => {
    expect(urlToState(new URLSearchParams("u=MeV")).energyUnit).toBe("MeV");
  });

  test("canonical key takes precedence over alias", () => {
    const params = new URLSearchParams("particle=10&i=99");
    expect(urlToState(params).particleId).toBe(10);
  });
});

describe("stateToUrl + urlToState round-trip", () => {
  test("preserves all fields through serialization", () => {
    const state: AppState = {
      programId: 1,
      particleId: 2,
      materialId: 3,
      energies: "100\n200",
      energyUnit: "MeV/nucl",
      advancedMode: true,
    };
    const recovered = urlToState(stateToUrl(state));
    expect(recovered.programId).toBe(1);
    expect(recovered.particleId).toBe(2);
    expect(recovered.materialId).toBe(3);
    expect(recovered.energies).toBe("100\n200");
    expect(recovered.energyUnit).toBe("MeV/nucl");
    expect(recovered.advancedMode).toBe(true);
  });

  test("null programId survives round-trip as undefined (auto)", () => {
    const recovered = urlToState(stateToUrl({ ...fullState, programId: null }));
    expect(recovered.programId).toBeUndefined();
  });

  test("MeV/u unit survives round-trip", () => {
    const recovered = urlToState(stateToUrl({ ...fullState, energyUnit: "MeV/u" }));
    expect(recovered.energyUnit).toBe("MeV/u");
  });
});
