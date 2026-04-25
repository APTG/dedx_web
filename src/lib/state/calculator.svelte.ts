import { createEnergyInputState, type EnergyRow } from "./energy-input.svelte";
import { parseEnergyInput } from "$lib/utils/energy-parser";
import { convertEnergyToMeVperNucl } from "$lib/utils/energy-conversions";
import {
  stpMassToKevUm,
  csdaGcm2ToCm,
  formatSigFigs,
  autoScaleLengthCm,
} from "$lib/utils/unit-conversions";
import { LibdedxError } from "$lib/wasm/types";
import type { EnergyUnit, StpUnit, LibdedxService } from "$lib/wasm/types";
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
  triggerCalculation(): Promise<void>;
  clearResults(): void;
}

export function createCalculatorState(
  entitySelection: EntitySelectionState,
  service: LibdedxService
): CalculatorState {
  let inputState = createEnergyInputState();
  let isCalculating = $state(false);
  let error = $state<LibdedxError | null>(null);
  let calculationResults = $state<Map<string, { stoppingPower: number; csdaRangeCm: number }>>(
    new Map()
  );

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

    const conversionUnit: EnergyUnit =
      parsed.unit === "MeV" || parsed.unit === "MeV/nucl" || parsed.unit === "MeV/u"
        ? parsed.unit
        : inputState.masterUnit;

    const effectiveUnit: EnergyUnit = conversionUnit;
    const unitFromSuffix = parsed.unit !== null;

    let normalizedMevNucl: number | null = null;
    try {
      normalizedMevNucl = convertEnergyToMeVperNucl(
        parsed.value,
        parsed.unit ?? inputState.masterUnit,
        particleMassNumber,
        particleAtomicMass
      );
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

    const resultData = calculationResults.get(String(row.id));
    
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

  async function performCalculation(energies: { rowId: string; energy: number }[]): Promise<void> {
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

      const energyValues = energies.map(e => e.energy);
      const result = service.calculate(resolvedProgramId, particleId, materialId, energyValues);
      
      const material = entitySelection.selectedMaterial;
      const density = material?.density ?? 1;

      const newResults = new Map<string, { stoppingPower: number; csdaRangeCm: number }>();
      
      for (let i = 0; i < energies.length; i++) {
        const stpMass = result.stoppingPowers[i];
        const csdaGcm2 = result.csdaRanges[i];
        const { rowId, energy } = energies[i];

        // Debug logging for subnormal/invalid WASM output values.
        // This helps diagnose physics issues when WASM returns nonsensical values.
        if (!Number.isFinite(stpMass) || (Math.abs(stpMass) > 0 && Math.abs(stpMass) < Number.MIN_VALUE * 1e10)) {
          console.warn("[dedx] subnormal/invalid WASM output (stopping power)", {
            programId: resolvedProgramId,
            particleId,
            materialId,
            energyMevNucl: energy,
            rawValue: stpMass,
          });
        }
        if (!Number.isFinite(csdaGcm2) || (Math.abs(csdaGcm2) > 0 && Math.abs(csdaGcm2) < Number.MIN_VALUE * 1e10)) {
          console.warn("[dedx] subnormal/invalid WASM output (CSDA range)", {
            programId: resolvedProgramId,
            particleId,
            materialId,
            energyMevNucl: energy,
            rawValue: csdaGcm2,
          });
        }

        let stpDisplay: number;
        if (getStpDisplayUnit() === 'keV/µm') {
          const converted = stpMassToKevUm(stpMass, density);
          stpDisplay = converted ?? stpMass;
        } else {
          stpDisplay = stpMass;
        }

        const csdaCm = csdaGcm2ToCm(csdaGcm2, density);

        newResults.set(rowId, {
          stoppingPower: stpDisplay,
          csdaRangeCm: csdaCm,
        });
      }

      // Reassign to a new Map so Svelte detects the change.
      calculationResults = newResults;
    } catch (e) {
      error = e instanceof LibdedxError ? e : new LibdedxError(-1, 'Calculation failed');
    } finally {
      isCalculating = false;
    }
  }

  function getValidEnergies(): { rowId: string; energy: number }[] {
    const particle = entitySelection.selectedParticle;
    if (!particle) return [];

    const parsedEnergies = inputState.getParsedEnergies();
    
    return inputState.rows
      .map((row, index) => {
        const parsed = parsedEnergies[index];
        if (!('value' in parsed) || parsed.value <= 0) {
          return null;
        }
        
        try {
          const energy = convertEnergyToMeVperNucl(
            parsed.value,
            parsed.unit ?? inputState.masterUnit,
            particle.massNumber,
            particle.atomicMass
          );
          return { rowId: String(row.id), energy };
        } catch {
          return null;
        }
      })
      .filter((e): e is { rowId: string; energy: number } => e !== null);
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
      if (!row) {
        return;
      }

      const trimmed = row.text.trim();
      if (trimmed === "") {
        return;
      }

      // Match the leading numeric value (incl. sign / decimal / exponent)
      // and replace the suffix with the chosen unit.
      const match = trimmed.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) {
        return;
      }

      inputState.updateRowText(index, `${match[0]} ${unit}`);
    },
    updateRowText(index: number, text: string) {
      inputState.updateRowText(index, text);
    },
    handleBlur(index: number) {
      inputState.handleBlur(index);
    },
    async triggerCalculation(): Promise<void> {
      const energies = getValidEnergies();
      await performCalculation(energies);
    },
    clearResults() {
      calculationResults = new Map();
      isCalculating = false;
    },
  };
}

export function formatStpValue(value: number, _unit: StpUnit): string {
  // 4 sig figs is correct for both keV/µm and MeV·cm²/g; the unit is
  // accepted as a parameter so call-sites stay unit-aware and to allow
  // future per-unit precision tweaks.
  return formatSigFigs(value, 4);
}

export function formatRangeValue(cm: number | null): string {
  if (cm === null) return '';

  const scaled = autoScaleLengthCm(cm);
  return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
}

export { autoScaleLengthCm };
