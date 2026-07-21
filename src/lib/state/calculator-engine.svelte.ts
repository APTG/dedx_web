import { LibdedxError } from "$lib/wasm/types";
import type { LibdedxService } from "$lib/wasm/types";
import type { EntitySelectionState } from "./entity-selection.svelte";
import type { ExternalDataService } from "$lib/external-data/service";
import { advancedOptions } from "./advanced-options.svelte";
import { isAdvancedMode } from "./advanced-mode.svelte";
import {
  customMaterialElementsForWasm,
  isCustomMaterial,
} from "$lib/utils/custom-compound-material";
import { parseExtRef } from "$lib/external-data/ids";
import { asBuiltinMaterial } from "$lib/utils/entity-type-guards";
import { csdaGcm2ToCm } from "$lib/utils/unit-conversions";

export interface CalculatorEngineState {
  isCalculating: boolean;
  error: LibdedxError | null;
  calculationResults: Map<string, { stoppingPower: number | null; csdaRangeCm: number | null }>;
  outOfRangeRowIds: Set<string>;
  performCalculation(energies: { rowId: string; energy: number }[]): Promise<void>;
  clearResults(): void;
  resetCache(): void;
}

function resolveParticleMass(
  particle: EntitySelectionState["selectedParticle"],
): { massNumber: number; atomicMass: number } | null {
  if (!particle) return null;
  if ("massNumber" in particle)
    return { massNumber: particle.massNumber, atomicMass: particle.atomicMass };
  return { massNumber: particle.A, atomicMass: particle.atomicMass };
}

export function createCalculatorEngine(
  entitySelection: EntitySelectionState,
  service: LibdedxService,
  extService?: ExternalDataService,
): CalculatorEngineState {
  let isCalculating = $state(false);
  let error = $state<LibdedxError | null>(null);
  let calculationResults = $state<
    Map<string, { stoppingPower: number | null; csdaRangeCm: number | null }>
  >(new Map());
  let outOfRangeRowIds = $state<Set<string>>(new Set());
  const outOfRangeCache = new Set<string>();

  /** Find the local ID of a particle or material within a specific external source. */
  function resolveExtLocalId(
    entityId: number | string,
    label: string,
    refMap: Map<number, string[]> | Map<number | string, string[]>,
  ): string | null {
    if (typeof entityId === "string" && entityId.startsWith("ext:")) {
      const parsed = parseExtRef(entityId);
      return parsed && parsed.label === label ? parsed.localId : null;
    }
    if (typeof entityId === "number") {
      const refs = (refMap as Map<number, string[]>).get(entityId) ?? [];
      for (const ref of refs) {
        const p = parseExtRef(ref);
        if (p && p.label === label) return p.localId;
      }
    }
    return null;
  }

  async function performExternalCalculation(
    energies: { rowId: string; energy: number }[],
    programExtRef: string,
  ): Promise<void> {
    if (!extService) {
      isCalculating = false;
      return;
    }

    const parsed = parseExtRef(programExtRef);
    if (!parsed) {
      isCalculating = false;
      return;
    }
    const { label, localId: localProgramId } = parsed;

    const extCtx = entitySelection.externalContext;
    const selectedParticle = entitySelection.selectedParticle;
    const selectedMaterial = entitySelection.selectedMaterial;

    const particleLocalId = selectedParticle
      ? resolveExtLocalId(selectedParticle.id, label, extCtx.externalRefsForBuiltinParticle)
      : null;
    const materialLocalId = selectedMaterial
      ? resolveExtLocalId(selectedMaterial.id, label, extCtx.externalRefsForBuiltinMaterial)
      : null;

    if (!particleLocalId || !materialLocalId) {
      calculationResults = new Map();
      isCalculating = false;
      return;
    }

    const mass = resolveParticleMass(selectedParticle);
    const massA = mass?.massNumber ?? 1;

    const conversionDensity =
      (isAdvancedMode.value ? advancedOptions.value.densityOverride : undefined) ??
      selectedMaterial?.density;

    const results = new Map<string, { stoppingPower: number | null; csdaRangeCm: number | null }>();
    const externalOutOfRange = new Set<string>();
    try {
      for (const { rowId, energy } of energies) {
        const totalMev = energy * massA;
        const result = await extService.interpolateAt(
          label,
          localProgramId,
          particleLocalId,
          materialLocalId,
          totalMev,
        );
        if (result.stp !== null) {
          // Store the raw mass stopping power (MeV·cm²/g); unit conversion to the
          // selected output unit happens at render time in computeRows.
          const csdaCm =
            result.csda !== null && typeof conversionDensity === "number"
              ? csdaGcm2ToCm(result.csda, conversionDensity)
              : null;
          results.set(rowId, { stoppingPower: result.stp, csdaRangeCm: csdaCm });
        } else {
          externalOutOfRange.add(rowId);
        }
      }
      calculationResults = results;
      outOfRangeRowIds = externalOutOfRange;
    } catch (e) {
      error = new LibdedxError(-1, e instanceof Error ? e.message : String(e));
    } finally {
      isCalculating = false;
    }
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

    const resolvedProgramId = entitySelection.resolvedProgramId;
    if (typeof resolvedProgramId === "string") {
      await performExternalCalculation(energies, resolvedProgramId);
      return;
    }
    const particleId = entitySelection.selectedParticle?.id;
    const material = entitySelection.selectedMaterial;
    const materialId = material?.id;
    const builtinMaterial = asBuiltinMaterial(material);
    const customMaterial = isCustomMaterial(builtinMaterial) ? builtinMaterial : null;

    if (!particleId || !materialId) {
      calculationResults = new Map();
      isCalculating = false;
      return;
    }

    if (!resolvedProgramId) {
      // A particle and material are both selected, but no available program supports
      // this combination (e.g. reached via a shared URL that bypassed the picker's
      // greying-out) — show an explicit message instead of silently clearing results.
      calculationResults = new Map();
      error = new LibdedxError(
        -1,
        "No available program supports this particle + material combination.",
      );
      isCalculating = false;
      return;
    }

    const calculationOptions =
      isAdvancedMode.value && !customMaterial ? advancedOptions.value : undefined;

    const density =
      (isAdvancedMode.value && !customMaterial
        ? advancedOptions.value.densityOverride
        : undefined) ??
      material?.density ??
      1;

    function oorCacheKey(energy: number): string {
      return `${resolvedProgramId}:${particleId}:${materialId}:${energy}`;
    }

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

        // Store the raw mass stopping power (MeV·cm²/g); unit conversion to the
        // selected output unit happens at render time in computeRows.
        const csdaCm = csdaGcm2ToCm(csdaGcm2, density);
        map.set(rowId, { stoppingPower: stpMass, csdaRangeCm: csdaCm });
      }
      return map;
    }

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
      calculationResults = new Map();
      outOfRangeRowIds = newOutOfRange;
      isCalculating = false;
      return;
    }

    try {
      const result = callService(uncachedItems.map((e) => e.energy));
      if (!result) {
        // Only reachable when materialId is neither a built-in numeric ID nor
        // a custom compound (e.g. an external-only material paired with a
        // resolved built-in program) — a real incompatible combination, not
        // an empty/loading state, so surface it instead of failing silently.
        calculationResults = new Map();
        error = new LibdedxError(
          -1,
          "No available program supports this particle + material combination.",
        );
        isCalculating = false;
        return;
      }
      calculationResults = processResults(result, uncachedItems);
      outOfRangeRowIds = newOutOfRange;
    } catch (e) {
      if (e instanceof LibdedxError && e.code === 101) {
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

  return {
    get isCalculating() {
      return isCalculating;
    },
    get error() {
      return error;
    },
    get calculationResults() {
      return calculationResults;
    },
    get outOfRangeRowIds() {
      return outOfRangeRowIds;
    },
    performCalculation,
    clearResults() {
      calculationResults = new Map();
      outOfRangeRowIds = new Set();
      isCalculating = false;
      error = null;
    },
    resetCache() {
      outOfRangeCache.clear();
    },
  };
}
