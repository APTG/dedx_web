import { createEnergyInputState, type EnergyRow } from "./energy-rows.svelte";
import { parseEnergyInput } from "$lib/utils/energy-parser";
import {
  convertEnergyToMeVperNucl,
  convertEnergyFromMeVperNucl,
  getEnergyUnitCategory,
} from "$lib/utils/energy-conversions";
import {
  stpMassToKevUm,
  csdaGcm2ToCm,
  formatSigFigs,
  autoScaleLengthCm,
} from "$lib/utils/unit-conversions";
import { LibdedxError } from "$lib/wasm/types";
import type { EnergyUnit, StpUnit, LibdedxService, MaterialEntity } from "$lib/wasm/types";
import type { EntitySelectionState } from "./entity-selection.svelte";
import type { ParticleEntity } from "$lib/wasm/types";
import { debounce } from "$lib/utils/debounce";
import { advancedOptions } from "./advanced-options.svelte";
import { isAdvancedMode } from "./advanced-mode.svelte";
import {
  customMaterialElementsForWasm,
  isCustomMaterial,
} from "$lib/utils/custom-compound-material";

/**
 * Returns the mass number (A) for a particle entity, supporting both built-in
 * (ParticleEntity.massNumber) and external-only particles (ExternalOnlyParticle.A).
 */
function particleMassNumber(particle: ParticleEntity): number {
  return particle.massNumber;
}

/**
 * Narrow a material to a built-in MaterialEntity (null if external-only or absent).
 * The calculator state only handles built-in calculations — external ones are done at the page level.
 */
function asBuiltinMaterial(material: unknown): MaterialEntity | null {
  if (!material) return null;
  if (typeof material === "object" && material !== null && "isGasByDefault" in material) {
    return material as MaterialEntity;
  }
  return null;
}

/**
 * Narrow a particle to a built-in ParticleEntity (null if external-only).
 */
function asBuiltinParticle(particle: unknown): ParticleEntity | null {
  if (!particle) return null;
  if (typeof particle === "object" && particle !== null && "massNumber" in particle) {
    return particle as ParticleEntity;
  }
  return null;
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
  switchParticle(particleId: number | null): void;
  updateRowText(index: number, text: string): void;
  handleBlur(index: number): void;
  addRow(): void;
  triggerCalculation(): void;
  flushCalculation(): Promise<void> | undefined;
  clearResults(): void;
  resetAll(): void;
}

export function createCalculatorState(
  entitySelection: EntitySelectionState,
  service: LibdedxService,
): CalculatorState {
  const inputState = createEnergyInputState();
  let isCalculating = $state(false);
  let error = $state<LibdedxError | null>(null);
  let calculationResults = $state<
    Map<string, { stoppingPower: number; csdaRangeCm: number | null }>
  >(new Map());
  let outOfRangeRowIds = $state<Set<string>>(new Set());
  // Persistent across calculations within this state instance — once an energy
  // is identified as OOR for a given (program, particle, material) context, we
  // skip calling WASM again. Prevents the C library from hanging on a second
  // call with the same out-of-range energy. Key: "programId:particleId:materialId:energy".
  const outOfRangeCache = new Set<string>();

  const debouncedCalculate = debounce(async () => {
    const energies = getValidEnergies();
    await performCalculation(energies);
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
    const resultData = calculationResults.get(rowKey);

    if (!resultData && outOfRangeRowIds.has(rowKey)) {
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
    const particle = asBuiltinParticle(entitySelection.selectedParticle);
    if (!particle) {
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

    return inputState.rows.map((row) => parseRow(row, particleMassNumber(particle), particle.atomicMass));
  }

  async function performCalculation(energies: { rowId: string; energy: number }[]): Promise<void> {
    if (energies.length === 0) {
      calculationResults = new Map();
      outOfRangeRowIds = new Set();
      return;
    }

    isCalculating = true;
    error = null;
    outOfRangeRowIds = new Set();

    // Resolved outside try/catch so the per-row retry path can reuse them.
    const resolvedProgramId = entitySelection.resolvedProgramId;
    // External programs are handled at the page level, not here.
    if (typeof resolvedProgramId === "string") {
      isCalculating = false;
      return;
    }
    const particleId = entitySelection.selectedParticle?.id;
    const material = entitySelection.selectedMaterial;
    const materialId = material?.id;
    const builtinMaterial = asBuiltinMaterial(material);
    const customMaterial = isCustomMaterial(builtinMaterial) ? builtinMaterial : null;

    if (!resolvedProgramId || !particleId || !materialId) {
      calculationResults = new Map();
      isCalculating = false;
      return;
    }

    // Only pass advanced options to WASM in Advanced mode — Basic mode uses
    // defaults so switching back to Basic always reverts to default behaviour.
    const calculationOptions =
      isAdvancedMode.value && !customMaterial ? advancedOptions.value : undefined;

    // Use the density override only in Advanced mode; Basic mode always uses
    // the material's built-in density so switching back reverts the value.
    const density =
      (isAdvancedMode.value && !customMaterial
        ? advancedOptions.value.densityOverride
        : undefined) ??
      material?.density ??
      1;

    function oorCacheKey(energy: number): string {
      return `${resolvedProgramId}:${particleId}:${materialId}:${energy}`;
    }

    // resolvedProgramId is guaranteed numeric here (string = external, returned early above)
    const numericProgramId = resolvedProgramId as number;
    const numericParticleId = particleId as number;

    function callService(energyValues: number[]) {
      return customMaterial
        ? service.calculateCustomCompound({
            programId: numericProgramId,
            particleId: numericParticleId,
            elements: customMaterialElementsForWasm(customMaterial!),
            density: customMaterial!.density,
            ...(customMaterial!.iValue !== undefined ? { iValue: customMaterial!.iValue } : {}),
            energies: energyValues,
          })
        : typeof materialId === "number"
          ? service.calculate(
              numericProgramId,
              numericParticleId,
              materialId,
              energyValues,
              calculationOptions,
            )
          : null;
    }

    function processResults(
      result: { stoppingPowers: number[]; csdaRanges: number[] },
      items: { rowId: string; energy: number }[],
    ): Map<string, { stoppingPower: number; csdaRangeCm: number | null }> {
      const map = new Map<string, { stoppingPower: number; csdaRangeCm: number | null }>();
      for (let i = 0; i < items.length; i++) {
        const stpMass = result.stoppingPowers[i]!;
        const csdaGcm2 = result.csdaRanges[i]!;
        const { rowId, energy } = items[i]!;

        // Debug logging for subnormal/invalid WASM output values.
        // This helps diagnose physics issues when WASM returns nonsensical values.
        if (
          !Number.isFinite(stpMass) ||
          (Math.abs(stpMass) > 0 && Math.abs(stpMass) < Number.MIN_VALUE * 1e10)
        ) {
          console.warn("[dedx] subnormal/invalid WASM output (stopping power)", {
            programId: resolvedProgramId,
            particleId,
            materialId,
            energyMevNucl: energy,
            rawValue: stpMass,
          });
        }
        if (
          !Number.isFinite(csdaGcm2) ||
          (Math.abs(csdaGcm2) > 0 && Math.abs(csdaGcm2) < Number.MIN_VALUE * 1e10)
        ) {
          console.warn("[dedx] subnormal/invalid WASM output (CSDA range)", {
            programId: resolvedProgramId,
            particleId,
            materialId,
            energyMevNucl: energy,
            rawValue: csdaGcm2,
          });
        }

        let stpDisplay: number;
        if (getStpDisplayUnit() === "keV/µm") {
          const converted = stpMassToKevUm(stpMass, density);
          stpDisplay = converted ?? stpMass;
        } else {
          stpDisplay = stpMass;
        }

        const csdaCm = csdaGcm2ToCm(csdaGcm2, density);
        map.set(rowId, { stoppingPower: stpDisplay, csdaRangeCm: csdaCm });
      }
      return map;
    }

    // Pre-classify energies using the persistent OOR cache.
    // Cached OOR entries are known to fail for this (program, particle, material)
    // context — skip WASM for them to prevent redundant calls that may hang the
    // C library on repeated out-of-range inputs.
    const cachedOorItems: { rowId: string; energy: number }[] = [];
    let uncachedItems: { rowId: string; energy: number }[] = [];
    for (const item of energies) {
      if (outOfRangeCache.has(oorCacheKey(item.energy))) {
        cachedOorItems.push(item);
      } else {
        uncachedItems.push(item);
      }
    }

    const newOutOfRange = new Set<string>(cachedOorItems.map((item) => item.rowId));

    // Range pre-check: classify items outside the tabulated energy limits as OOR
    // without calling WASM. Some programs (e.g. ICRU 49) hang in _dedx_get_stp_table
    // on out-of-range energies rather than returning error code 101.
    if (!customMaterial && typeof materialId === "number") {
      const minE = service.getMinEnergy(numericProgramId, numericParticleId);
      const maxE = service.getMaxEnergy(numericProgramId, numericParticleId);
      const inRange: { rowId: string; energy: number }[] = [];
      for (const item of uncachedItems) {
        if (item.energy < minE || item.energy > maxE) {
          newOutOfRange.add(item.rowId);
          outOfRangeCache.add(oorCacheKey(item.energy));
        } else {
          inRange.push(item);
        }
      }
      uncachedItems = inRange;
    }

    if (uncachedItems.length === 0) {
      // All energies are OOR (from cache or range pre-check) — skip WASM entirely.
      calculationResults = new Map();
      outOfRangeRowIds = newOutOfRange;
      isCalculating = false;
      return;
    }

    try {
      const result = callService(uncachedItems.map((e) => e.energy));
      if (!result) {
        calculationResults = new Map();
        isCalculating = false;
        return;
      }
      // Reassign to a new Map so Svelte detects the change.
      calculationResults = processResults(result, uncachedItems);
      outOfRangeRowIds = newOutOfRange;
    } catch (e) {
      if (e instanceof LibdedxError && e.code === 101 /* DEDX_ERR_ENERGY_OUT_OF_RANGE */) {
        // Retry per-row to identify which energies are out of the tabulated range.
        // This lets valid rows show results while out-of-range rows are marked individually.
        const newResults = new Map<string, { stoppingPower: number; csdaRangeCm: number | null }>();
        let fatalError: LibdedxError | null = null;

        for (const item of uncachedItems) {
          if (fatalError) break;
          try {
            const result = callService([item.energy]);
            if (result) {
              const entry = processResults(result, [item]).get(item.rowId);
              if (entry) newResults.set(item.rowId, entry);
            }
          } catch (rowErr) {
            if (rowErr instanceof LibdedxError && rowErr.code === 101) {
              newOutOfRange.add(item.rowId);
              outOfRangeCache.add(oorCacheKey(item.energy));
            } else {
              fatalError =
                rowErr instanceof LibdedxError
                  ? rowErr
                  : new LibdedxError(-1, "Calculation failed");
            }
          }
        }

        calculationResults = newResults;
        outOfRangeRowIds = newOutOfRange;
        if (fatalError) error = fatalError;
      } else {
        error = e instanceof LibdedxError ? e : new LibdedxError(-1, "Calculation failed");
      }
    } finally {
      isCalculating = false;
    }
  }

  function getValidEnergies(): { rowId: string; energy: number }[] {
    const particle = asBuiltinParticle(entitySelection.selectedParticle);
    if (!particle) return [];

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
            particle.massNumber,
            particle.atomicMass,
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

      const particle = asBuiltinParticle(entitySelection.selectedParticle);
      if (!particle) {
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
        particle.massNumber,
        particle.atomicMass,
      );
      const converted = convertEnergyFromMeVperNucl(
        mevNucl,
        unit,
        particle.massNumber,
        particle.atomicMass,
      );
      inputState.updateRowText(index, `${formatSigFigs(converted, 4)} ${unit}`);
    },
    switchParticle(particleId: number | null) {
      const oldParticle = previousParticle;
      const newParticle =
        particleId !== null
          ? entitySelection.allParticles.find((p) => p.id === particleId) || null
          : null;

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
      calculationResults = new Map();
      outOfRangeRowIds = new Set();
      isCalculating = false;
    },
    resetAll() {
      entitySelection.resetAll();
      inputState.resetRows([{ text: "100" }]);
      calculationResults = new Map();
      outOfRangeRowIds = new Set();
      outOfRangeCache.clear();
      isCalculating = false;
      error = null;
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
