import type { EnergyUnit, AdvancedOptions, CalculationResult, LibdedxError } from '../wasm/types';
import { parseEnergyInput } from "../units/energy";

export const energyInputText = $state({ value: '' });
export const energyUnit = $state<{ value: EnergyUnit }>({ value: 'MeV' });
export const advancedOptions = $state<{ value: AdvancedOptions }>({ value: {} });
export const result = $state<{ value: CalculationResult | null }>({ value: null });
export const error = $state<{ value: LibdedxError | null }>({ value: null });
export const calculating = $state({ value: false });

export function computeParsedEnergies(): number[] {
  return parseEnergyInput(energyInputText.value);
}
