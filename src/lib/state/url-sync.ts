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

  if (state.programId !== null) params.set('p', state.programId.toString());
  if (state.particleId !== null) params.set('i', state.particleId.toString());
  if (state.materialId !== null) params.set('m', state.materialId.toString());
  if (state.energies) params.set('e', state.energies);
  if (state.energyUnit !== 'MeV') params.set('u', state.energyUnit);
  if (state.advancedMode) params.set('mode', 'advanced');

  params.set('urlv', '1');

  return params;
}

export function urlToState(params: URLSearchParams): Partial<AppState> {
  const state: Partial<AppState> = {};

  const programId = params.get('p');
  if (programId) state.programId = parseInt(programId, 10);

  const particleId = params.get('i');
  if (particleId) state.particleId = parseInt(particleId, 10);

  const materialId = params.get('m');
  if (materialId) state.materialId = parseInt(materialId, 10);

  const energies = params.get('e');
  if (energies) state.energies = energies;

  const energyUnit = params.get('u') as EnergyUnit | null;
  if (energyUnit && ['MeV', 'MeV/nucl', 'MeV/u'].includes(energyUnit)) {
    state.energyUnit = energyUnit;
  }

  const mode = params.get('mode');
  if (mode === 'advanced') state.advancedMode = true;

  return state;
}
