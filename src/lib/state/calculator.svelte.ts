import { createEnergyInputState, type EnergyRow } from "./energy-rows.svelte";
import { parseEnergyInput } from "$lib/utils/energy-parser";
import {
  convertEnergyToMeVperNucl,
  convertEnergyFromMeVperNucl,
  getEnergyUnitCategory,
} from "$lib/utils/energy-conversions";
import {
  formatSigFigs,
  autoScaleLengthCm,
} from "$lib/utils/unit-conversions";
import { LibdedxError } from "$lib/wasm/types";
import type { EnergyUnit, StpUnit, LibdedxService } from "$lib/wasm/types";
import type { EntitySelectionState } from "./entity-selection.svelte";
import type { ParticleEntity } from "$lib/wasm/types";
import type { ExternalOnlyParticle } from "./external-compatibility";
import { debounce } from "$lib/utils/debounce";
import { advancedOptions } from "./advanced-options.svelte";
import { isAdvancedMode } from "./advanced-mode.svelte";
import {
  isCustomMaterial,
} from "$lib/utils/custom-compound-material";
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
  const engine = createCalculatorEngine(entitySelection, service, getStpDisplayUnit, extService);

  const debouncedCalculate = debounce(async () => {
    const energies = getValidEnergies();
    await engine.performCalculation(energies);
  }, 300);

  function convertRowsForNewParticle(
    oldParticle: ParticleEntity,
    newParticle: ParticleEntity,
  ): void {
    const rows = inputState.rows;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
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
      // The parser may return SI-prefixed suffixes (e.g. `GeV/nucl`,
      // `TeV/u`) which are not part of the base `EnergyUnit` contract;
      // we keep the original suffix as a string for accurate
      // E_nucl conversion and derive the *category* (MeV vs MeV/nucl
      // vs MeV/u) for picking the new display unit.
      const oldUnitSuffix: string = parsed.unit ?? inputState.masterUnit;
      const oldUnitCategory: EnergyUnit = getEnergyUnitCategory(oldUnitSuffix);

      // Convert to E_nucl (MeV/nucl) to conserve per-nucleon kinetic energy.
      const mevPerNucl = convertEnergyToMeVperNucl(
        parsed.value,
        oldUnitSuffix,
        oldParticle.massNumber,
        oldParticle.atomicMass,
      );

      let newUnit: EnergyUnit;
      // Proton (A=1) and electron always use total MeV display.
      if (newParticle.id === 1001 || newParticle.massNumber === 1) {
        newUnit = "MeV";
      } else if (oldUnitCategory === "MeV/nucl") {
        // Preserve MeV/nucl for heavy ions (A>1).
        newUnit = "MeV/nucl";
      } else if (oldUnitCategory === "MeV/u") {
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
        // Heavy ion: convert E_nucl back to the new display unit using
        // the new particle's mass data. This is the inverse of the
        // `convertEnergyToMeVperNucl` call above and correctly handles
        // MeV/u (which depends on atomicMass / m_u, not just A).
        newValue = convertEnergyFromMeVperNucl(
          mevPerNucl,
          newUnit,
          newParticle.massNumber,
          newParticle.atomicMass,
        );
      }

      inputState.updateRowText(i, `${formatSigFigs(newValue, 4)} ${newUnit}`);
    }
  }

  // Track only built-in particles for unit-rescaling; external particle selection
  // doesn't rescale energy units (handled at the page level).
  let previousParticle: ParticleEntity | null = asBuiltinParticle(entitySelection.selectedParticle);

  function getStpDisplayUnit(): StpUnit {
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

  function convertRowEnergyToMevNucl(
    value: number,
    unit: string,
    particleMassNumber: number,
    particleAtomicMass?: number,
  ): number | null {
    try {
      return convertEnergyToMeVperNucl(value, unit, particleMassNumber, particleAtomicMass);
    } catch {
      return null;
    }
  }

  function parseRow(
    row: EnergyRow,
    particleMassNumber: number,
    particleAtomicMass?: number,
  ): CalculatedRow {
    const parsed = parseEnergyInput(row.text);

    if ("empty" in parsed) {
      return {
        id: row.id,
        rawInput: "",
        normalizedMevNucl: null,
        unit: inputState.masterUnit,
        unitFromSuffix: false,
        status: "empty",
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    if ("error" in parsed) {
      return {
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: null,
        unit: inputState.masterUnit,
        unitFromSuffix: false,
        status: "invalid",
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

    const normalizedMevNucl = convertRowEnergyToMevNucl(
      parsed.value,
      parsed.unit ?? inputState.masterUnit,
      particleMassNumber,
      particleAtomicMass,
    );
    if (normalizedMevNucl === null) {
      return {
        id: row.id,
        rawInput: row.text,
        normalizedMevNucl: null,
        unit: effectiveUnit,
        unitFromSuffix,
        status: "invalid",
        message: "conversion error",
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
        normalizedMevNucl,
        unit: effectiveUnit,
        unitFromSuffix,
        status: "out-of-range",
        message: "Energy out of tabulated range",
        stoppingPower: null,
        csdaRangeCm: null,
      };
    }

    return {
      id: row.id,
      rawInput: row.text,
      normalizedMevNucl,
      unit: effectiveUnit,
      unitFromSuffix,
      status: "valid",
      stoppingPower: resultData?.stoppingPower ?? null,
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

  function computeValidationSummary(): {
    valid: number;
    invalid: number;
    outOfRange: number;
    total: number;
  } {
    const rows = computeRows();
    return {
      valid: rows.filter((r) => r.status === "valid").length,
      invalid: rows.filter((r) => r.status === "invalid").length,
      outOfRange: rows.filter((r) => r.status === "out-of-range").length,
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
      return engine.isCalculating;
    },
    get error() {
      return engine.error;
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

      const mass = resolveParticleMass(entitySelection.selectedParticle);
      if (!mass) {
        return;
      }

      const parsed = parseEnergyInput(trimmed);
      if (!("value" in parsed) || (parsed.unit === null && parsed.value === undefined)) {
        return;
      }
      if ("error" in parsed || "empty" in parsed) {
        return;
      }

      const currentUnit = parsed.unit ?? inputState.masterUnit;
      const mevNucl = convertEnergyToMeVperNucl(
        parsed.value,
        currentUnit,
        mass.massNumber,
        mass.atomicMass,
      );
      const converted = convertEnergyFromMeVperNucl(
        mevNucl,
        unit,
        mass.massNumber,
        mass.atomicMass,
      );
      inputState.updateRowText(index, `${formatSigFigs(converted, 4)} ${unit}`);
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
