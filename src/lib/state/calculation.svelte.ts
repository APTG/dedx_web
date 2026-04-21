import type { EnergyUnit, AdvancedOptions, CalculationResult, LibdedxError } from '../wasm/types';

export const energyInputText = $state({ value: '' });
export const energyUnit = $state<{ value: EnergyUnit }>({ value: 'MeV' });
export const advancedOptions = $state<{ value: AdvancedOptions }>({ value: {} });
export const result = $state<{ value: CalculationResult | null }>({ value: null });
export const error = $state<{ value: LibdedxError | null }>({ value: null });
export const calculating = $state({ value: false });

export function computeParsedEnergies(): number[] {
  const text = energyInputText.value;
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const energies: number[] = [];

  for (const line of lines) {
    const value = parseFloat(line.trim());
    if (!isNaN(value) && value > 0) {
      energies.push(value);
    }
  }

  return energies;
}
