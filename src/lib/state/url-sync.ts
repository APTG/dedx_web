import type { EnergyUnit } from '../wasm/types';

export interface AppState {
  programId: number | null;
  particleId: number | null;
  materialId: number | null;
  energies: string;
  energyUnit: EnergyUnit;
  advancedMode: boolean;
}

export function stateToUrl(state: AppState): URLSearchParams {
  const params = new URLSearchParams();

  params.set("urlv", "1");
  if (state.particleId !== null) params.set("particle", state.particleId.toString());
  if (state.materialId !== null) params.set("material", state.materialId.toString());
  params.set("program", state.programId === null ? "auto" : state.programId.toString());
  if (state.energies) params.set("energies", state.energies);
  params.set("eunit", state.energyUnit);
  if (state.advancedMode) params.set("mode", "advanced");

  return params;
}

export function urlToState(params: URLSearchParams): Partial<AppState> {
  const state: Partial<AppState> = {};
  const parseId = (value: string | null): number | null => {
    if (value === null) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const particleId = parseId(params.get("particle") ?? params.get("i"));
  if (particleId !== null) state.particleId = particleId;

  const materialId = parseId(params.get("material") ?? params.get("m"));
  if (materialId !== null) state.materialId = materialId;

  const programParam = params.get("program") ?? params.get("p");
  if (programParam && programParam !== "auto") {
    const programId = parseId(programParam);
    if (programId !== null) state.programId = programId;
  }

  const energies = params.get("energies") ?? params.get("e");
  if (energies) state.energies = energies;

  const energyUnit = (params.get("eunit") ?? params.get("u")) as EnergyUnit | null;
  if (energyUnit && ["MeV", "MeV/nucl", "MeV/u"].includes(energyUnit)) {
    state.energyUnit = energyUnit;
  }

  const mode = params.get("mode");
  if (mode === "advanced") state.advancedMode = true;

  return state;
}
