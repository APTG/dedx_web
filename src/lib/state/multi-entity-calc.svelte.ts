import { advancedOptions } from "$lib/state/advanced-options.svelte";
import {
  isCustomMaterial,
  customMaterialElementsForWasm,
} from "$lib/utils/custom-compound-material";
import { customCompounds } from "$lib/state/custom-compounds.svelte";
import { getService } from "$lib/wasm/loader";
import { LibdedxError } from "$lib/wasm/types";
import type { CalculationResult } from "$lib/wasm/types";
import type { EntityId } from "$lib/external-data/types";
import type { CalculatorState } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { MultiEntityState } from "$lib/state/multi-entity.svelte";

/**
 * Headless multi-entity (material or particle) calculation orchestrator.
 *
 * Recomputes stopping-power and CSDA range for every entity in
 * `entityState.multiSelected[dimension]` whenever inputs change. Custom
 * compounds and built-in materials are both supported in material mode;
 * particle mode requires a built-in material.
 */
export function setupMultiEntityCalculation(
  getCalcState: () => CalculatorState | null,
  getEntityState: () => EntitySelectionState | null,
  getMultiEntityState: () => MultiEntityState | null,
  getUrlVersionMismatch: () => unknown,
  getAdvOptsKey: () => string,
) {
  $effect(() => {
    const _advOptsKey = getAdvOptsKey();
    void _advOptsKey;

    if (getUrlVersionMismatch() !== null) return;
    const multiEntityState = getMultiEntityState();
    const entityState = getEntityState();
    const calcState = getCalcState();
    if (!multiEntityState || !entityState || !calcState || !entityState.isComplete) return;

    const dim = multiEntityState.dimension;
    const entityIds = (
      dim === "material" ? entityState.multiSelected.material : entityState.multiSelected.particle
    ) as EntityId[];

    if (entityIds.length === 0) return;

    // Multi-entity calculation requires built-in (numeric) program + particle.
    const rawProgramId = entityState.resolvedProgramId;
    if (typeof rawProgramId !== "number") return;
    const programId = rawProgramId;

    const rawParticleId = entityState.selectedParticle?.id;
    if (typeof rawParticleId !== "number") return;
    const anchorParticleId = rawParticleId;

    const material = entityState.selectedMaterial;
    const builtinMat = material && "isGasByDefault" in material ? material : null;
    const anchorMaterialId = material?.id;
    if (anchorMaterialId === null || anchorMaterialId === undefined) return;

    if (dim === "particle" && typeof anchorMaterialId !== "number") {
      const unsupportedMaterialMessage =
        typeof anchorMaterialId === "string" && anchorMaterialId.startsWith("ext:")
          ? "Multi-particle comparison does not support external-only materials."
          : "Multi-particle comparison does not support custom compounds.";
      const results = new Map<EntityId, CalculationResult | LibdedxError>();
      for (const entityId of entityIds) {
        results.set(entityId, new LibdedxError(-1, unsupportedMaterialMessage));
      }
      multiEntityState.setComparisonResults(results);
      return;
    }

    const validRows = calcState.rows.filter(
      (r) => r.status === "valid" && r.normalizedMevNucl !== null,
    );
    if (validRows.length === 0) return;

    const energies = validRows.map((r) => r.normalizedMevNucl as number);
    const advOptsSnapshot = advancedOptions.value;
    const inputSnapshot = {
      programId,
      anchorParticleId,
      anchorMaterialId,
      entityIds,
      energies,
      dim,
      builtinMat,
    };
    let cancelled = false;

    const getCustomMaterialById = (id: EntityId) => {
      if (typeof id !== "string" || !id.startsWith("cc_")) return null;
      const compound = customCompounds.getById(id);
      if (!compound) return null;
      return {
        id: compound.id,
        name: compound.name,
        density: compound.density,
        iValue: compound.iValue,
        phase: compound.phase,
        elements: compound.elements,
        isGasByDefault: compound.phase === "gas",
      };
    };

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const service = await getService();
      if (cancelled) return;

      const results = new Map<EntityId, CalculationResult | LibdedxError>();

      for (const entityId of inputSnapshot.entityIds) {
        try {
          let result: CalculationResult;
          if (inputSnapshot.dim === "material") {
            const customMaterial =
              getCustomMaterialById(entityId) ??
              (entityId === inputSnapshot.anchorMaterialId &&
              isCustomMaterial(inputSnapshot.builtinMat)
                ? inputSnapshot.builtinMat
                : null);
            if (customMaterial !== null) {
              result = service.calculateCustomCompound({
                programId: inputSnapshot.programId,
                particleId: inputSnapshot.anchorParticleId,
                elements: customMaterialElementsForWasm(customMaterial),
                density: customMaterial.density,
                iValue: customMaterial.iValue,
                energies: inputSnapshot.energies,
              });
            } else if (typeof entityId === "number") {
              result = service.calculate(
                inputSnapshot.programId,
                inputSnapshot.anchorParticleId,
                entityId,
                inputSnapshot.energies,
                advOptsSnapshot,
              );
            } else {
              throw new LibdedxError(
                -1,
                typeof entityId === "string" && entityId.startsWith("ext:")
                  ? "Multi-material comparison does not support external-only materials."
                  : `Unsupported material ID for multi-material comparison: ${entityId}`,
              );
            }
          } else {
            // across === "particle": iterate particleIds, fixed material
            if (typeof entityId !== "number") {
              throw new LibdedxError(
                -1,
                typeof entityId === "string" && entityId.startsWith("ext:")
                  ? "Multi-particle comparison does not support external-only particles."
                  : `Unsupported particle ID for multi-particle comparison: ${entityId}`,
              );
            }
            result = service.calculate(
              inputSnapshot.programId,
              entityId,
              inputSnapshot.anchorMaterialId as number,
              inputSnapshot.energies,
              advOptsSnapshot,
            );
          }
          results.set(entityId, result);
        } catch (e) {
          results.set(
            entityId,
            e instanceof LibdedxError
              ? e
              : new LibdedxError(-1, e instanceof Error ? e.message : String(e)),
          );
        }
      }

      if (!cancelled) {
        multiEntityState.setComparisonResults(results);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });
}
