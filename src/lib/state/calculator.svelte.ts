import { createEnergyInputState, type EnergyRow } from "./energy-input.svelte";
import { parseEnergyInput } from "$lib/utils/energy-parser";
import { convertEnergyToMeVperU } from "$lib/utils/energy-conversions";
import {
  stpMassToKevUm,
  csdaGcm2ToCm,
  formatSigFigs,
} from "$lib/utils/unit-conversions";
import type { EnergyUnit, StpUnit, LibdedxService, LibdedxError } from "$lib/wasm/types";
import type { EntitySelectionState } from "./entity-selection.svelte";

export interface CalculatedRow {
  id: number;
  rawInput: string;
  normalizedMevNucl: number | null;
  unit: EnergyUnit;
  unitFromSuffix: boolean;
  status: 'valid' | 'invalid' | 'out-of-range' | 'empty';
  message?: string;
  stoppingPower: number | null;
  csdaRangeCm: number | null;
}

export interface CalculatorState {
  rows: CalculatedRow[];
  stpDisplayUnit: StpUnit;
  masterUnit: EnergyUnit;
  isPerRowMode: boolean;
  isCalculating: boolean;
  error: LibdedxError | null;
  validationSummary: { valid: number; invalid: number; outOfRange: number; total: number };
  setMasterUnit(unit: EnergyUnit): void;
  setRowUnit(index: number, unit: EnergyUnit): void;
  updateRowText(index: number, text: string): void;
  handleBlur(index: number): void;
  triggerCalculation(): void;
  clearResults(): void;
}

export function createCalculatorState(
  entitySelection: EntitySelectionState,
  service: LibdedxService
): CalculatorState {
  const inputState = createEnergyInputState();
  let isCalculating = $state(false);
  let error = $state<LibdedxError | null>(null);
  let calculationResults = $state<Map<number, { stoppingPower: number; csdaRangeCm: number }>>(new Map());

  function getStpDisplayUnit(): StpUnit {
    const material = entitySelection.selectedMaterial;
    if (material?.isGasByDefault) {
      return 'MeV·cm²/g';
    }
    return 'keV/µm';
  }

  function parseRow(row: EnergyRow, particleMassNumber: number, particleAtomicMass?: number): CalculatedRow {
    const parsed = parseEnergyInput(row.text);

    if ('empty' in parsed) {
      return {
        id: row.id,
        rawInput: '',
        normalizedMevNucl: null,
        unit: inputState.masterUnit,
        unitFromSuffix: false,
        status: 'empty',
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    if ('error' in parsed) {
      return {
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: null,
        unit: inputState.masterUnit,
        unitFromSuffix: false,
        status: 'invalid',
        message: parsed.error,
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    const effectiveUnit = parsed.unit !== null 
      ? (parsed.unit === 'MeV' || parsed.unit === 'MeV/nucl' || parsed.unit === 'MeV/u' 
         ? parsed.unit 
         : inputState.masterUnit)
      : inputState.masterUnit;

    const unitFromSuffix = parsed.unit !== null;

    let normalizedMevNucl: number | null = null;
    try {
      if (parsed.unit === 'MeV') {
        normalizedMevNucl = parsed.value / particleMassNumber;
      } else if (parsed.unit === 'MeV/nucl' || parsed.unit === 'keV/nucl' || parsed.unit === 'GeV/nucl') {
        const mevPerNucl = parsed.unit === 'MeV/nucl' ? parsed.value : 
                          parsed.unit === 'keV/nucl' ? parsed.value / 1000 :
                          parsed.value * 1000;
        normalizedMevNucl = (mevPerNucl * particleMassNumber) / (particleAtomicMass ?? particleMassNumber);
      } else if (parsed.unit === null) {
        // No unit suffix - use master unit
        normalizedMevNucl = convertEnergyToMeVperU(
          parsed.value,
          inputState.masterUnit,
          particleMassNumber,
          particleAtomicMass
        );
      } else {
        normalizedMevNucl = convertEnergyToMeVperU(
          parsed.value,
          parsed.unit,
          particleMassNumber,
          particleAtomicMass
        );
      }
    } catch {
      return {
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: null,
        unit: effectiveUnit,
        unitFromSuffix,
        status: 'invalid',
        message: 'conversion error',
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    const resultData = calculationResults.get(normalizedMevNucl);
    
    return {
      id: row.id,
      rawInput: row.text,
      normalizedMevNucl,
      unit: effectiveUnit,
      unitFromSuffix,
      status: 'valid',
      stoppingPower: resultData?.stoppingPower ?? null,
      csdaRangeCm: resultData?.csdaRangeCm ?? null,
    };
  }

  function computeRows(): CalculatedRow[] {
    const particle = entitySelection.selectedParticle;
    if (!particle) {
      return inputState.rows.map((row) => ({
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: null,
        unit: inputState.masterUnit,
        unitFromSuffix: false,
        status: 'empty',
        stoppingPower: null,
        csdaRangeCm: null,
      }));
    }

    return inputState.rows.map((row) =>
      parseRow(row, particle.massNumber, particle.atomicMass)
    );
  }

  async function performCalculation(energies: number[]): Promise<void> {
    if (energies.length === 0) {
      calculationResults = new Map();
      return;
    }

    isCalculating = true;
    error = null;

    try {
      const resolvedProgramId = entitySelection.resolvedProgramId;
      const particleId = entitySelection.selectedParticle?.id;
      const materialId = entitySelection.selectedMaterial?.id;

      if (!resolvedProgramId || !particleId || !materialId) {
        calculationResults = new Map();
        isCalculating = false;
        return;
      }

      const result = service.calculate(resolvedProgramId, particleId, materialId, energies);
      
      const material = entitySelection.selectedMaterial;
      const density = material?.density ?? 1;

      const newResults = new Map<number, { stoppingPower: number; csdaRangeCm: number }>();
      
      for (let i = 0; i < energies.length; i++) {
        const stpMass = result.stoppingPowers[i];
        const csdaGcm2 = result.csdaRanges[i];

        let stpDisplay: number;
        if (getStpDisplayUnit() === 'keV/µm') {
          const converted = stpMassToKevUm(stpMass, density);
          stpDisplay = converted ?? stpMass;
        } else {
          stpDisplay = stpMass;
        }

        const csdaCm = csdaGcm2ToCm(csdaGcm2, density);

        newResults.set(energies[i], {
          stoppingPower: stpDisplay,
          csdaRangeCm: csdaCm,
        });
      }

      calculationResults = newResults;
    } catch (e) {
      error = e instanceof LibdedxError ? e : new LibdedxError(-1, 'Calculation failed');
    } finally {
      isCalculating = false;
    }
  }

  function getValidEnergies(): number[] {
    const particle = entitySelection.selectedParticle;
    if (!particle) return [];

    return inputState.getParsedEnergies()
      .filter((p): p is { value: number; unit: string | null } => 'value' in p && p.value > 0)
      .map((p) => {
        try {
          return convertEnergyToMeVperU(
            p.value,
            p.unit ?? inputState.masterUnit,
            particle.massNumber,
            particle.atomicMass
          );
        } catch {
          return null;
        }
      })
      .filter((e): e is number => e !== null);
  }

  function computeValidationSummary(): { valid: number; invalid: number; outOfRange: number; total: number } {
    const rows = computeRows();
    return {
      valid: rows.filter((r) => r.status === 'valid').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      outOfRange: rows.filter((r) => r.status === 'out-of-range').length,
      total: rows.length,
    };
  }

  return {
    get rows() {
      return computeRows();
    },
    get stpDisplayUnit() {
      return getStpDisplayUnit();
    },
    get masterUnit() {
      return inputState.masterUnit;
    },
    get isPerRowMode() {
      return inputState.isPerRowMode;
    },
    get isCalculating() {
      return isCalculating;
    },
    get error() {
      return error;
    },
    get validationSummary() {
      return computeValidationSummary();
    },
    setMasterUnit(unit: EnergyUnit) {
      inputState.setMasterUnit(unit);
    },
    setRowUnit(index: number, unit: EnergyUnit) {
      const row = inputState.rows[index];
      if (row) {
        inputState.updateRowText(index, row.text);
      }
    },
    updateRowText(index: number, text: string) {
      inputState.updateRowText(index, text);
    },
    handleBlur(index: number) {
      inputState.handleBlur(index);
    },
    triggerCalculation() {
      const energies = getValidEnergies();
      performCalculation(energies);
    },
    clearResults() {
      calculationResults = new Map();
      isCalculating = false;
    },
  };
}

export function formatStpValue(value: number, unit: StpUnit): string {
  return formatSigFigs(value, 4);
}

export function formatRangeValue(cm: number | null): string {
  if (cm === null) return '';
  
  const scaled = autoScaleLengthCm(cm);
  return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
}

export function autoScaleLengthCm(cm: number): { value: number; unit: 'nm' | 'µm' | 'mm' | 'cm' | 'm' } {
  if (cm >= 100) {
    return { value: cm / 100, unit: 'm' };
  } else if (cm >= 1) {
    return { value: cm, unit: 'cm' };
  } else if (cm >= 0.1) {
    return { value: cm * 10, unit: 'mm' };
  } else if (cm >= 1e-4) {
    return { value: cm * 10000, unit: 'µm' };
  } else {
    return { value: cm * 1e7, unit: 'nm' };
  }
}
