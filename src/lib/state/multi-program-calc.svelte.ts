import { advancedOptions } from "$lib/state/advanced-options.svelte";
import {
  isCustomMaterial,
  customMaterialElementsForWasm,
} from "$lib/utils/custom-compound-material";
import { getService } from "$lib/wasm/loader";
import { externalDataService } from "$lib/external-data/service";
import { parseExtRef, resolveExtLocalIdForLabel } from "$lib/external-data/ids";
import { LibdedxError } from "$lib/wasm/types";
import type { CalculationResult } from "$lib/wasm/types";
import type { EntityId, ExtRef } from "$lib/external-data/types";
import type { CalculatorState } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { MultiProgramState } from "$lib/state/multi-program.svelte";
import { runDebouncedSnapshot } from "$lib/utils/debounced-snapshot";

/**
 * Headless multi-program calculation orchestrator.
 *
 * Wires a Svelte 5 `$effect` that recomputes stopping-power and CSDA range for
 * every program in `multiProgState.selectedProgramIds` whenever inputs (entity
 * selection, energies, advanced options) change. Built-in programs go through
 * the WASM service; external programs go through `ExternalDataService`.
 *
 * Caller must invoke this inside a component setup so the `$effect` is
 * attached to that component's lifecycle.
 */
export function setupMultiProgramCalculation(
  getCalcState: () => CalculatorState | null,
  getEntityState: () => EntitySelectionState | null,
  getMultiProgState: () => MultiProgramState | null,
  getUrlVersionMismatch: () => unknown,
  getAdvOptsDep: () => unknown,
) {
  $effect(() => {
    // Register a reactive dep on every advanced option field.
    void getAdvOptsDep();

    if (getUrlVersionMismatch() !== null) return;
    const multiProgState = getMultiProgState();
    const entityState = getEntityState();
    const calcState = getCalcState();
    if (!multiProgState || !entityState || !calcState || !entityState.isComplete) return;
    if (entityState.across !== "program") return;

    const selectedProgramIds = multiProgState.selectedProgramIds;
    if (selectedProgramIds.length <= 1) return;

    const rawParticleId = entityState.selectedParticle?.id;
    // External-only particles have string IDs; multi-program mode is built-in only.
    if (typeof rawParticleId !== "number") return;
    const particleId: number = rawParticleId;
    const material = entityState.selectedMaterial;
    const builtinMat = material && "isGasByDefault" in material ? material : null;
    const customMaterial = isCustomMaterial(builtinMat) ? builtinMat : null;
    const materialId = material?.id;
    if (materialId === null || materialId === undefined) return;

    const validRows = calcState.rows.filter(
      (r) => r.status === "valid" && r.normalizedMevNucl !== null,
    );
    if (validRows.length === 0) return;

    const energies = validRows.map((r) => r.normalizedMevNucl as number);
    const advOptsSnapshot = advancedOptions.value;

    // Clamp particle mass to 1 for particles whose massNumber/A is 0 (e.g. electrons),
    // to prevent totalMev = energy * 0 = 0 which breaks external interpolation.
    const extCtxSnapshot = entityState.externalContext;
    const selectedParticle = entityState.selectedParticle;
    const massASnapshot =
      selectedParticle && "massNumber" in selectedParticle
        ? selectedParticle.massNumber || 1
        : selectedParticle && "A" in selectedParticle
          ? selectedParticle.A || 1
          : 1;

    // Snapshot inputs so a stale async resolution cannot overwrite fresh results.
    return runDebouncedSnapshot(
      {
        selectedProgramIds,
        particleId,
        materialId,
        energies,
        customMaterial,
      },
      async (inputSnapshot, isCancelled) => {
        const service = await getService();
        if (isCancelled()) return;

        const builtinProgramIds = inputSnapshot.selectedProgramIds.filter(
          (id): id is number => typeof id === "number",
        );
        const extProgramIds = inputSnapshot.selectedProgramIds.filter(
          (id): id is ExtRef => typeof id === "string",
        );

        const results = new Map<EntityId, CalculationResult | LibdedxError>();

        // --- Built-in (WASM) calculations ---
        // Range pre-check: skip WASM per program if any energy is outside its tabulated
        // range. Some programs (e.g. ICRU 49) hang in _dedx_get_stp_table on out-of-range
        // inputs rather than returning error code 101.
        let safeProgramIds = builtinProgramIds;
        if (!inputSnapshot.customMaterial && typeof inputSnapshot.materialId === "number") {
          safeProgramIds = [];
          for (const programId of builtinProgramIds) {
            const minEnergy = service.getMinEnergy(programId, inputSnapshot.particleId);
            const maxEnergy = service.getMaxEnergy(programId, inputSnapshot.particleId);
            const allEnergiesInRange = inputSnapshot.energies.every(
              (energy) => energy >= minEnergy && energy <= maxEnergy,
            );
            if (allEnergiesInRange) {
              safeProgramIds.push(programId);
            } else {
              results.set(
                programId,
                new LibdedxError(
                  101,
                  `Energy out of tabulated range (${minEnergy} – ${maxEnergy} MeV/nucl)`,
                ),
              );
            }
          }
        }

        if (safeProgramIds.length > 0) {
          if (inputSnapshot.customMaterial) {
            for (const programId of safeProgramIds) {
              try {
                results.set(
                  programId,
                  service.calculateCustomCompound({
                    programId,
                    particleId: inputSnapshot.particleId,
                    elements: customMaterialElementsForWasm(inputSnapshot.customMaterial),
                    density: inputSnapshot.customMaterial.density,
                    iValue: inputSnapshot.customMaterial.iValue,
                    energies: inputSnapshot.energies,
                  }),
                );
              } catch (e) {
                results.set(
                  programId,
                  e instanceof LibdedxError
                    ? e
                    : new LibdedxError(-1, e instanceof Error ? e.message : String(e)),
                );
              }
            }
          } else if (typeof inputSnapshot.materialId === "number") {
            const builtInResults = service.calculateMulti({
              programIds: safeProgramIds,
              particleId: inputSnapshot.particleId,
              materialId: inputSnapshot.materialId,
              energies: inputSnapshot.energies,
              options: advOptsSnapshot,
            });
            for (const [programId, result] of builtInResults) {
              results.set(programId, result);
            }
          }
        }

        // --- External (ExternalDataService) calculations ---
        for (const extProgramId of extProgramIds) {
          const parsed = parseExtRef(extProgramId);
          if (!parsed) {
            results.set(extProgramId, new LibdedxError(-1, "Invalid external program reference"));
            continue;
          }
          const { label, localId: localProgramId } = parsed;

          const particleLocalId = resolveExtLocalIdForLabel(
            inputSnapshot.particleId,
            label,
            extCtxSnapshot.externalRefsForBuiltinParticle,
          );
          const materialLocalId = resolveExtLocalIdForLabel(
            inputSnapshot.materialId as number | string,
            label,
            extCtxSnapshot.externalRefsForBuiltinMaterial,
          );

          if (!particleLocalId || !materialLocalId) {
            results.set(
              extProgramId,
              new LibdedxError(-1, "Particle or material not covered by this external program"),
            );
            continue;
          }

          try {
            const stoppingPowers: number[] = [];
            const csdaValuesGcm2: (number | null)[] = [];
            const validEnergies: number[] = [];

            for (const energy of inputSnapshot.energies) {
              const totalMev = energy * massASnapshot;
              const r = await externalDataService.interpolateAt(
                label,
                localProgramId,
                particleLocalId,
                materialLocalId,
                totalMev,
              );
              if (r.stp !== null) {
                validEnergies.push(energy);
                stoppingPowers.push(r.stp);
                csdaValuesGcm2.push(r.csda);
              }
            }

            if (validEnergies.length === 0) {
              results.set(
                extProgramId,
                new LibdedxError(101, "Energy out of range for this external program"),
              );
            } else {
              // Only include CSDA when every value is non-null (store has CSDA data).
              const allCsdaAvailable =
                csdaValuesGcm2.length > 0 && csdaValuesGcm2.every((v) => v !== null);
              results.set(extProgramId, {
                energies: validEnergies,
                stoppingPowers,
                csdaRanges: allCsdaAvailable ? (csdaValuesGcm2 as number[]) : [],
              });
            }
          } catch (e) {
            results.set(
              extProgramId,
              e instanceof LibdedxError
                ? e
                : new LibdedxError(-1, e instanceof Error ? e.message : String(e)),
            );
          }
        }

        if (!isCancelled()) {
          multiProgState.setComparisonResults(results);
        }
      },
    );
  });
}
