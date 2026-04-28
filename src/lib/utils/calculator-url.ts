import type { EnergyUnit } from "$lib/wasm/types";

const VALID_ENERGY_UNITS: ReadonlySet<string> = new Set([
  "MeV", "MeV/nucl", "MeV/u", "keV", "GeV", "TeV",
  "keV/nucl", "keV/u", "GeV/nucl", "GeV/u", "TeV/nucl", "TeV/u",
]);

export interface CalculatorUrlRow {
  rawInput: string;
  unit: EnergyUnit;
  unitFromSuffix: boolean;
}

export interface CalculatorUrlState {
  particleId: number | null;
  materialId: number | null;
  programId: number | null;
  rows: CalculatorUrlRow[];
  masterUnit: EnergyUnit;
}

export function encodeCalculatorUrl(state: CalculatorUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.particleId !== null) params.set("particle", String(state.particleId));
  if (state.materialId !== null) params.set("material", String(state.materialId));
  params.set("program", state.programId === null ? "auto" : String(state.programId));

  const nonEmpty = state.rows.filter(r => r.rawInput.trim() !== "");
  if (nonEmpty.length > 0) {
    const encoded = nonEmpty.map(r =>
      r.unitFromSuffix && r.unit !== state.masterUnit
        ? `${r.rawInput}:${r.unit}`
        : r.rawInput
    ).join(",");
    params.set("energies", encoded);
  }
  params.set("eunit", state.masterUnit);
  return params;
}

export function decodeCalculatorUrl(params: URLSearchParams): CalculatorUrlState {
  const parseId = (v: string | null): number | null => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return isFinite(n) && n > 0 ? n : null;
  };

  const masterUnit: EnergyUnit =
    VALID_ENERGY_UNITS.has(params.get("eunit") ?? "")
      ? (params.get("eunit") as EnergyUnit)
      : "MeV";

  const rows: CalculatorUrlRow[] = [];
  const energiesParam = params.get("energies");
  if (energiesParam) {
    for (const part of energiesParam.split(",")) {
      const colonIdx = part.lastIndexOf(":");
      if (colonIdx > 0) {
        const rawInput = part.slice(0, colonIdx);
        const unitStr = part.slice(colonIdx + 1);
        if (VALID_ENERGY_UNITS.has(unitStr)) {
          rows.push({ rawInput, unit: unitStr as EnergyUnit, unitFromSuffix: true });
          continue;
        }
      }
      rows.push({ rawInput: part, unit: masterUnit, unitFromSuffix: false });
    }
  }

  return {
    particleId: parseId(params.get("particle")),
    materialId: parseId(params.get("material")),
    programId:
      params.get("program") === "auto" || !params.get("program")
        ? null
        : parseId(params.get("program")),
    rows: rows.length > 0 ? rows : [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
    masterUnit,
  };
}
