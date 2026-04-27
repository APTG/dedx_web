import { createEnergyInputState, type EnergyRow } from "./energy-input.svelte";
import { parseEnergyInput } from "$lib/utils/energy-parser";
import { convertEnergyToMeVperNucl, convertEnergyFromMeVperNucl } from "$lib/utils/energy-conversions";
import {
  stpMassToKevUm,
  csdaGcm2ToCm,
  formatSigFigs,
  autoScaleLengthCm,
} from "$lib/utils/unit-conversions";
import { LibdedxError } from "$lib/wasm/types";
import type { EnergyUnit, StpUnit, LibdedxService } from "$lib/wasm/types";
import type { EntitySelectionState } from "./entity-selection.svelte";
import type { ParticleEntity } from "$lib/wasm/types";
import { debounce } from "$lib/utils/debounce";

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
  switchParticle(particleId: number | null): void;
  updateRowText(index: number, text: string): void;
  handleBlur(index: number): void;
  addRow(): void;
  triggerCalculation(): Promise<void>;
  flushCalculation(): void;
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

  const debouncedCalculate = debounce(async () => {
    const energies = getValidEnergies();
    await performCalculation(energies);
  }, 300);

  function convertRowsForNewParticle(oldParticle: ParticleEntity, newParticle: ParticleEntity): void {
    const rows = inputState.rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const trimmed = row.text.trim();
      if (trimmed === "") continue;

      const parsed = parseEnergyInput(trimmed);
      if (!("value" in parsed) || parsed.value === undefined) continue;
      if ("error" in parsed || "empty" in parsed) continue;

      // Treat plain numbers (no typed suffix) as if they were typed with the
      // active master unit. This keeps every row under one consistent rule —
      // "interpret the number with its current unit, conserve E_nucl across
      // the particle change" — instead of silently exempting rows that
      // happen to lack an explicit suffix. (Reported in PR #379: typing
      // "100" on proton → switching to alpha used to keep "100" while a
      // sibling row "1 GeV" became "4000 MeV", which made it impossible
      // for the user to tell what was being conserved.)
      const oldUnit: EnergyUnit = parsed.unit ?? inputState.masterUnit;

      // Convert to E_nucl (MeV/nucl) to conserve per-nucleon kinetic energy.
      const mevPerNucl = convertEnergyToMeVperNucl(
        parsed.value,
        oldUnit,
        oldParticle.massNumber,
        oldParticle.atomicMass
      );

      let newUnit: EnergyUnit;
      // Proton (A=1) and electron always use total MeV display.
      if (newParticle.id === 1001 || newParticle.massNumber === 1) {
        newUnit = "MeV";
      } else if (oldUnit === "MeV/nucl") {
        // Preserve MeV/nucl for heavy ions (A>1).
        newUnit = "MeV/nucl";
      } else if (oldUnit === "MeV/u") {
        // Preserve MeV/u for heavy ions (A>1).
        newUnit = "MeV/u";
      } else {
        newUnit = "MeV";
      }

      let newValue: number;
      if (newParticle.id === 1001) {
        // Electron: use old particle's A to compute total MeV (electron has no nucleons).
        newValue = mevPerNucl * oldParticle.massNumber;
      } else if (newParticle.massNumber === 1) {
        // Proton: E_nucl × 1 = total MeV (same numeric value as E_nucl).
        newValue = mevPerNucl;
      } else {
        // Heavy ion: convert E_nucl to the new display unit.
        if (newUnit === "MeV/nucl" || newUnit === "MeV/u") {
          newValue = mevPerNucl;
        } else {
          newValue = mevPerNucl * newParticle.massNumber;
        }
      }

      inputState.updateRowText(i, `${formatSigFigs(newValue, 4)} ${newUnit}`);
    }
  }

  let previousParticle: ParticleEntity | null = entitySelection.selectedParticle;

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

      const particle = entitySelection.selectedParticle;
      if (!particle) {
        return;
      }

      const parsed = parseEnergyInput(trimmed);
      if (!("value" in parsed) || parsed.unit === null && parsed.value === undefined) {
        return;
      }
      if ("error" in parsed || "empty" in parsed) {
        return;
      }

      const currentUnit = parsed.unit ?? inputState.masterUnit;
      const mevNucl = convertEnergyToMeVperNucl(
        parsed.value,
        currentUnit,
        particle.massNumber,
        particle.atomicMass
      );
      const converted = convertEnergyFromMeVperNucl(
        mevNucl,
        unit,
        particle.massNumber,
        particle.atomicMass
      );
      inputState.updateRowText(index, `${formatSigFigs(converted, 4)} ${unit}`);
    },
    switchParticle(particleId: number | null) {
      const oldParticle = previousParticle;
      const newParticle = particleId !== null ? entitySelection.allParticles.find(p => p.id === particleId) || null : null;
      
      entitySelection.selectParticle(particleId);
      
      if (newParticle && oldParticle && newParticle.id !== oldParticle.id) {
        convertRowsForNewParticle(oldParticle, newParticle);
      }
      previousParticle = newParticle;
    },
    updateRowText(index: number, text: string) {
      inputState.updateRowText(index, text);
    },
    handleBlur(index: number) {
      inputState.handleBlur(index);
    },
    addRow() {
      inputState.addRow();
    },
    async triggerCalculation(): Promise<void> {
      debouncedCalculate();
    },
    flushCalculation() {
      debouncedCalculate.flush();
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
