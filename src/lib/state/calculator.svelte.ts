import { createEnergyInputState, type EnergyRow } from "./energy-rows.svelte";
import { convertEnergyToMeVperNucl } from "$lib/utils/energy-conversions";
import { formatSigFigs, autoScaleLengthCm, convertStpMass } from "$lib/utils/unit-conversions";
import {
  parseRowEnergy,
  convertRowTextForNewParticle,
  convertRowTextToUnit,
} from "$lib/utils/energy-row-parse";
import { stpOutputUnit } from "./stp-unit.svelte";
import { LibdedxError } from "$lib/wasm/types";
import type { EnergyUnit, StpUnit, LibdedxService } from "$lib/wasm/types";
import type { EntitySelectionState } from "./entity-selection.svelte";
import type { ParticleEntity } from "$lib/wasm/types";
import type { ExternalOnlyParticle } from "./external-compatibility";
import { debounce } from "$lib/utils/debounce";
import { advancedOptions } from "./advanced-options.svelte";
import { isAdvancedMode } from "./advanced-mode.svelte";
import { isCustomMaterial } from "$lib/utils/custom-compound-material";
import type { ExternalDataService } from "$lib/external-data/service";
import { asBuiltinParticle, asBuiltinMaterial } from "$lib/utils/entity-type-guards";
import { createCalculatorEngine } from "./calculator-engine.svelte";

/** Resolve mass fields (massNumber, atomicMass) from built-in or external-only particle. */
export function resolveParticleMass(
  particle: ParticleEntity | ExternalOnlyParticle | null | undefined,
): { massNumber: number; atomicMass: number } | null {
  if (!particle) return null;
  if ("massNumber" in particle)
    return { massNumber: particle.massNumber, atomicMass: particle.atomicMass };
  return { massNumber: particle.A, atomicMass: particle.atomicMass };
}

export interface CalculatedRow {
  id: number;
  rawInput: string;
  normalizedMevNucl: number | null;
  unit: EnergyUnit;
  unitFromSuffix: boolean;
  status: "valid" | "invalid" | "out-of-range" | "empty";
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
  hasLargeInput: boolean;
  setMasterUnit(unit: EnergyUnit): void;
  setStpDisplayUnit(unit: StpUnit): void;
  setRowUnit(index: number, unit: EnergyUnit): void;
  switchParticle(particleId: number | string | null): void;
  updateRowText(index: number, text: string, autoAdd?: boolean): void;
  handleBlur(index: number): void;
  addRow(): void;
  removeRow(index: number): void;
  moveRow(index: number, direction: "up" | "down"): void;
  triggerCalculation(): void;
  flushCalculation(): Promise<void> | undefined;
  clearResults(): void;
  resetAll(): void;
}

export function createCalculatorState(
  entitySelection: EntitySelectionState,
  service: LibdedxService,
  extService?: ExternalDataService,
): CalculatorState {
  const inputState = createEnergyInputState();
  const engine = createCalculatorEngine(entitySelection, service, extService);

  const debouncedCalculate = debounce(async () => {
    const energies = getValidEnergies();
    await engine.performCalculation(energies);
  }, 300);

  function convertRowsForNewParticle(
    oldParticle: ParticleEntity,
    newParticle: ParticleEntity,
  ): void {
    inputState.rows.forEach((row, i) => {
      const newText = convertRowTextForNewParticle(
        row.text,
        inputState.masterUnit,
        oldParticle,
        newParticle,
      );
      if (newText !== null) {
        inputState.updateRowText(i, newText);
      }
    });
  }

  // Track only built-in particles for unit-rescaling; external particle selection
  // doesn't rescale energy units (handled at the page level).
  let previousParticle: ParticleEntity | null = asBuiltinParticle(entitySelection.selectedParticle);

  function getStpDisplayUnit(): StpUnit {
    // An explicit user choice (calculator header dropdown / plot control / URL
    // `sunit=`) overrides the aggregate-state-derived default below.
    if (stpOutputUnit.value !== null) {
      return stpOutputUnit.value;
    }
    const material = asBuiltinMaterial(entitySelection.selectedMaterial);
    if (isCustomMaterial(material)) {
      return material.isGasByDefault ? "MeV·cm²/g" : "keV/µm";
    }
    // Aggregate state override may flip the effective aggregate state (Behavior §3).
    // Only apply the override when in Advanced mode — Basic mode always uses
    // the material's built-in aggregate state so switching back to Basic reverts the unit.
    const aggOverride = isAdvancedMode.value ? advancedOptions.value.aggregateState : undefined;
    const effectivelyGas =
      aggOverride === "gas" ? true : aggOverride === "condensed" ? false : material?.isGasByDefault;
    if (effectivelyGas) {
      return "MeV·cm²/g";
    }
    return "keV/µm";
  }

  /** Density (g/cm³) used to convert mass stopping power to the display unit;
   *  mirrors the resolution order used by the calculation engine. */
  function getConversionDensity(): number | undefined {
    const material = entitySelection.selectedMaterial;
    const builtin = asBuiltinMaterial(material);
    const customMaterial = isCustomMaterial(builtin) ? builtin : null;
    return (
      (isAdvancedMode.value && !customMaterial
        ? advancedOptions.value.densityOverride
        : undefined) ?? material?.density
    );
  }

  function parseRow(
    row: EnergyRow,
    particleMassNumber: number,
    particleAtomicMass?: number,
  ): CalculatedRow {
    const outcome = parseRowEnergy(
      row.text,
      inputState.masterUnit,
      particleMassNumber,
      particleAtomicMass,
    );

    if (outcome.status === "empty") {
      return {
        id: row.id,
        rawInput: "",
        normalizedMevNucl: null,
        unit: outcome.unit,
        unitFromSuffix: false,
        status: "empty",
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    if (outcome.status === "invalid") {
      return {
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: null,
        unit: outcome.unit,
        unitFromSuffix: outcome.unitFromSuffix,
        status: "invalid",
        message: outcome.message,
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    const rowKey = String(row.id);
    const resultData = engine.calculationResults.get(rowKey);

    if (!resultData && engine.outOfRangeRowIds.has(rowKey)) {
      return {
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: outcome.normalizedMevNucl,
        unit: outcome.unit,
        unitFromSuffix: outcome.unitFromSuffix,
        status: "out-of-range",
        message: "Energy out of tabulated range",
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    const massStp = resultData?.stoppingPower ?? null;
    const density = getConversionDensity();
    const stpUnit = getStpDisplayUnit();
    const isLinearUnit = stpUnit === "keV/µm" || stpUnit === "MeV/cm";

    let stoppingPower: number | null = null;
    if (massStp !== null) {
      if (isLinearUnit && density === undefined) {
        stoppingPower = null;
      } else {
        stoppingPower = convertStpMass(massStp, density ?? 1, stpUnit);
      }
    }

    return {
      id: row.id,
      rawInput: row.text,
      normalizedMevNucl: outcome.normalizedMevNucl,
      unit: outcome.unit,
      unitFromSuffix: outcome.unitFromSuffix,
      status: "valid",
      stoppingPower,
      csdaRangeCm: resultData?.csdaRangeCm ?? null,
    };
  }

  function computeRows(): CalculatedRow[] {
    const mass = resolveParticleMass(entitySelection.selectedParticle);
    if (!mass) {
      return inputState.rows.map((row) => ({
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: null,
        unit: inputState.masterUnit,
        unitFromSuffix: false,
        status: "empty",
        stoppingPower: null,
        csdaRangeCm: null,
      }));
    }

    return inputState.rows.map((row) => parseRow(row, mass.massNumber, mass.atomicMass));
  }

  function getValidEnergies(): { rowId: string; energy: number }[] {
    const mass = resolveParticleMass(entitySelection.selectedParticle);
    if (!mass) return [];

    const parsedEnergies = inputState.getParsedEnergies();

    return inputState.rows
      .map((row, index) => {
        const parsed = parsedEnergies[index];
        if (!parsed || !("value" in parsed) || parsed.value <= 0) {
          return null;
        }

        try {
          const energy = convertEnergyToMeVperNucl(
            parsed.value,
            parsed.unit ?? inputState.masterUnit,
            mass.massNumber,
            mass.atomicMass,
          );
          return { rowId: String(row.id), energy };
        } catch {
          return null;
        }
      })
      .filter((e): e is { rowId: string; energy: number } => e !== null);
  }

  // Memoized reactive views. `$derived` recomputes only when a tracked
  // dependency actually changes, so templates that read these getters several
  // times per frame (table body, footer, validation banner, export wiring)
  // share one computation and a stable object reference instead of re-running
  // the per-row parse/convert/lookup work on every property access.
  const rows = $derived(computeRows());
  const stpDisplayUnit = $derived(getStpDisplayUnit());
  const validationSummary = $derived.by(() => {
    const r = rows;
    return {
      valid: r.filter((row) => row.status === "valid").length,
      invalid: r.filter((row) => row.status === "invalid").length,
      outOfRange: r.filter((row) => row.status === "out-of-range").length,
      total: r.length,
    };
  });

  return {
    get rows() {
      return rows;
    },
    get stpDisplayUnit() {
      return stpDisplayUnit;
    },
    get masterUnit() {
      return inputState.masterUnit;
    },
    get isPerRowMode() {
      return inputState.isPerRowMode;
    },
    get isCalculating() {
      return engine.isCalculating;
    },
    get error() {
      return engine.error;
    },
    get validationSummary() {
      return validationSummary;
    },
    setMasterUnit(unit: EnergyUnit) {
      inputState.setMasterUnit(unit);
    },
    setStpDisplayUnit(unit: StpUnit) {
      stpOutputUnit.set(unit);
    },
    setRowUnit(index: number, unit: EnergyUnit) {
      const row = inputState.rows[index];
      if (!row) {
        return;
      }

      const mass = resolveParticleMass(entitySelection.selectedParticle);
      if (!mass) {
        return;
      }

      const newText = convertRowTextToUnit(
        row.text,
        inputState.masterUnit,
        unit,
        mass.massNumber,
        mass.atomicMass,
      );
      if (newText !== null) {
        inputState.updateRowText(index, newText);
      }
    },
    switchParticle(particleId: number | string | null) {
      const oldParticle = previousParticle;
      const newParticle =
        typeof particleId === "number"
          ? entitySelection.allParticles.find((p) => p.id === particleId) || null
          : null;

      entitySelection.selectParticle(particleId);

      if (newParticle && oldParticle && newParticle.id !== oldParticle.id) {
        if (isAdvancedMode.value) {
          // Advanced mode: convert values to maintain per-nucleon energy conservation.
          convertRowsForNewParticle(oldParticle, newParticle);
        } else {
          // Basic mode: preserve typed values, auto-set masterUnit to match particle type.
          const isHeavyIon = newParticle.id !== 1001 && newParticle.massNumber > 1;
          inputState.setMasterUnit(isHeavyIon ? "MeV/nucl" : "MeV");
        }
      }
      previousParticle = newParticle;
    },
    updateRowText(index: number, text: string, autoAdd?: boolean) {
      inputState.updateRowText(index, text, autoAdd);
    },
    handleBlur(index: number) {
      inputState.handleBlur(index);
    },
    addRow() {
      inputState.addRow();
    },
    removeRow(index: number) {
      inputState.removeRow(index);
    },
    moveRow(index: number, direction: "up" | "down") {
      inputState.moveRow(index, direction);
    },
    triggerCalculation(): void {
      // Schedules a debounced calculation. Use `flushCalculation()` and
      // await its returned promise if you need to wait for the result
      // (tests, pre-screenshot, programmatic recompute on share-link).
      debouncedCalculate();
    },
    flushCalculation(): Promise<void> | undefined {
      return debouncedCalculate.flush();
    },
    clearResults() {
      engine.clearResults();
    },
    resetAll() {
      entitySelection.resetAll();
      inputState.resetRows([{ text: "100" }]);
      engine.clearResults();
      engine.resetCache();
    },
    get hasLargeInput() {
      return inputState.hasLargeInput;
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
  if (cm === null) return "";

  const scaled = autoScaleLengthCm(cm);
  return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
}

export { autoScaleLengthCm };
