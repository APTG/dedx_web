import { advancedOptions } from "$lib/state/advanced-options.svelte";
import {
  customMaterialElementsForWasm,
  isCustomMaterial,
} from "$lib/utils/custom-compound-material";
import { getService } from "$lib/wasm/loader";
import { HIGH_E_SIDE, LOW_E_SIDE } from "$lib/utils/inverse-stp";
import { rangeUnitToCmFactor, stpToMevCm2g } from "$lib/utils/inverse-units";
import type { InverseCsdaResult } from "$lib/wasm/types";
import type { CalculatorState } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { InverseLookupState } from "$lib/state/inverse-lookups.svelte";

/**
 * Headless inverse-CSDA-range lookup orchestrator.
 *
 * Reads the active particle/material/program from `entityState`, takes the
 * range rows from `inverseLookupState.rangeRows`, converts to g/cm², and
 * resolves to particle energies via the WASM inverse-CSDA lookup. Custom
 * compounds are supported.
 */
export function setupInverseRangeCalculation(
  getCalcState: () => CalculatorState | null,
  getEntityState: () => EntitySelectionState | null,
  getInverseLookupState: () => InverseLookupState | null,
  getUrlVersionMismatch: () => unknown,
  getAdvOptsKey: () => string,
) {
  $effect(() => {
    const _advOptsKey = getAdvOptsKey();
    void _advOptsKey;
    if (getUrlVersionMismatch() !== null) return;
    const inverseLookupState = getInverseLookupState();
    const entityState = getEntityState();
    const calcState = getCalcState();
    if (!inverseLookupState || !entityState || !calcState || !entityState.isComplete) return;
    const inverseState = inverseLookupState;
    if (inverseState.activeTab !== "csda") return;

    // Snapshot reactive deps synchronously at the top.
    const _rangeMasterUnit = inverseState.rangeMasterUnit;
    void _rangeMasterUnit;
    const advOptsSnapshot = advancedOptions.value;
    const rawParticleId = entityState.selectedParticle?.id;
    if (typeof rawParticleId !== "number") return;
    const particleId: number = rawParticleId;
    const material = entityState.selectedMaterial;
    const builtinRangeMat = material && "isGasByDefault" in material ? material : null;
    const customMaterial = isCustomMaterial(builtinRangeMat) ? builtinRangeMat : null;
    const materialId = material?.id;
    const rawProgramId = entityState.resolvedProgramId;
    if (typeof rawProgramId === "string") return; // external program: no inverse lookup
    const programId = rawProgramId;
    const rowsSnapshot = inverseState.rangeRows.map((r) => ({
      id: r.id,
      text: r.text,
      value: r.value,
      unit: r.unit,
      status: r.status,
    }));

    if (materialId === null || programId === null) return;

    const validRows = rowsSnapshot.filter(
      (r) => r.status === "valid" || r.status === "out-of-range",
    );
    if (validRows.length === 0) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const service = await getService();
      if (cancelled) return;

      const asyncMat = entityState.selectedMaterial;
      const asyncBuiltinMat = asyncMat && "isGasByDefault" in asyncMat ? asyncMat : null;
      const currentCustomMaterial = isCustomMaterial(asyncBuiltinMat) ? asyncBuiltinMat : null;
      const density =
        (currentCustomMaterial ? undefined : advOptsSnapshot.densityOverride) ??
        asyncMat?.density ??
        1;

      if (density <= 0) {
        for (const r of inverseState.rangeRows) {
          if (r.text.trim()) {
            r.status = "invalid";
            r.message = "Density not available for this material";
            r.energyMevNucl = null;
          }
        }
        return;
      }

      const rangesGcm2 = validRows.map((r) => {
        const rangeCm = r.value! * rangeUnitToCmFactor(r.unit);
        return rangeCm * density;
      });

      try {
        const activeCustomMaterial = customMaterial ?? currentCustomMaterial;
        const results: (InverseCsdaResult | Error)[] = activeCustomMaterial
          ? service.getInverseCsdaCustomCompound({
              programId,
              particleId,
              elements: customMaterialElementsForWasm(activeCustomMaterial),
              density,
              iValue: activeCustomMaterial.iValue,
              ranges: rangesGcm2,
            })
          : typeof materialId === "number"
            ? service.getInverseCsda({
                programId,
                particleId,
                materialId,
                ranges: rangesGcm2,
                options: advOptsSnapshot,
              })
            : [];

        let resultIdx = 0;
        for (const r of inverseState.rangeRows) {
          if (r.status === "valid" || r.status === "out-of-range") {
            const result = results[resultIdx++];
            if (result instanceof Error || result === undefined) {
              r.energyMevNucl = null;
            } else {
              r.energyMevNucl = result.energy;
            }
          }
        }
      } catch {
        for (const r of inverseState.rangeRows) {
          if (r.status === "valid" || r.status === "out-of-range") {
            r.status = "error";
            r.message = "Inverse range lookup failed";
            r.energyMevNucl = null;
          }
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });
}

/**
 * Headless inverse-stopping-power lookup orchestrator.
 *
 * Resolves each STP row to both branches (low-E and high-E) of the inverse
 * stopping-power curve. Identical branch energies collapse to a single
 * high-E solution (the C inverse lookup returns the same energy for both
 * sides when only one physical solution exists).
 */
export function setupInverseStpCalculation(
  getCalcState: () => CalculatorState | null,
  getEntityState: () => EntitySelectionState | null,
  getInverseLookupState: () => InverseLookupState | null,
  getUrlVersionMismatch: () => unknown,
  getAdvOptsKey: () => string,
) {
  $effect(() => {
    const _advOptsKey = getAdvOptsKey();
    void _advOptsKey;
    if (getUrlVersionMismatch() !== null) return;
    const inverseLookupState = getInverseLookupState();
    const entityState = getEntityState();
    const calcState = getCalcState();
    if (!inverseLookupState || !entityState || !calcState || !entityState.isComplete) return;
    const inverseState = inverseLookupState;
    if (inverseState.activeTab !== "stp") return;

    const _stpMasterUnit = inverseState.stpMasterUnit;
    void _stpMasterUnit;
    const advOptsSnapshot = advancedOptions.value;
    const rawParticleIdStp = entityState.selectedParticle?.id;
    if (typeof rawParticleIdStp !== "number") return;
    const particleId: number = rawParticleIdStp;
    const material = entityState.selectedMaterial;
    const builtinStpMat = material && "isGasByDefault" in material ? material : null;
    const customMaterial = isCustomMaterial(builtinStpMat) ? builtinStpMat : null;
    const materialId = material?.id;
    const rawProgramIdStp = entityState.resolvedProgramId;
    if (typeof rawProgramIdStp === "string") return;
    const programId = rawProgramIdStp;
    const rowsSnapshot = inverseState.stpRows.map((r) => ({
      id: r.id,
      text: r.text,
      value: r.value,
      unit: r.unit,
      status: r.status,
    }));

    if (materialId === null || programId === null) return;

    const validRows = rowsSnapshot.filter(
      (r) => r.status === "valid" || r.status === "no-solution",
    );
    if (validRows.length === 0) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const service = await getService();
      if (cancelled) return;

      const stpAsyncMat = entityState.selectedMaterial;
      const stpBuiltinMat = stpAsyncMat && "isGasByDefault" in stpAsyncMat ? stpAsyncMat : null;
      const currentCustomMaterial = isCustomMaterial(stpBuiltinMat) ? stpBuiltinMat : null;
      const density =
        (currentCustomMaterial ? undefined : advOptsSnapshot.densityOverride) ??
        stpAsyncMat?.density ??
        1;

      const stpMevCm2g = validRows.map((r) => stpToMevCm2g(r.value!, r.unit, density));

      try {
        const activeCustomMaterial = customMaterial ?? currentCustomMaterial;
        const lowResults = activeCustomMaterial
          ? service.getInverseStpCustomCompound({
              programId,
              particleId,
              elements: customMaterialElementsForWasm(activeCustomMaterial),
              density,
              iValue: activeCustomMaterial.iValue,
              stoppingPowers: stpMevCm2g,
              side: LOW_E_SIDE,
            })
          : typeof materialId === "number"
            ? service.getInverseStp({
                programId,
                particleId,
                materialId,
                stoppingPowers: stpMevCm2g,
                side: LOW_E_SIDE,
                options: advOptsSnapshot,
              })
            : [];

        const highResults = activeCustomMaterial
          ? service.getInverseStpCustomCompound({
              programId,
              particleId,
              elements: customMaterialElementsForWasm(activeCustomMaterial),
              density,
              iValue: activeCustomMaterial.iValue,
              stoppingPowers: stpMevCm2g,
              side: HIGH_E_SIDE,
            })
          : typeof materialId === "number"
            ? service.getInverseStp({
                programId,
                particleId,
                materialId,
                stoppingPowers: stpMevCm2g,
                side: HIGH_E_SIDE,
                options: advOptsSnapshot,
              })
            : [];

        let resultIdx = 0;
        for (const r of inverseState.stpRows) {
          if (r.status === "valid" || r.status === "no-solution") {
            const lowResult = lowResults[resultIdx];
            const highResult = highResults[resultIdx];

            if (lowResult instanceof Error && highResult instanceof Error) {
              r.status = "no-solution";
              r.energyLowMevNucl = null;
              r.energyHighMevNucl = null;
            } else {
              r.status = "valid";
              const lowE =
                lowResult instanceof Error || lowResult === undefined ? null : lowResult.energy;
              const highE =
                highResult instanceof Error || highResult === undefined ? null : highResult.energy;
              // Identical branch energies collapse to a single solution — the C
              // inverse lookup returns the same energy for both sides when
              // only one physical solution exists.
              const isSingleSolution =
                lowE !== null &&
                highE !== null &&
                Math.abs(lowE - highE) / Math.max(Math.abs(highE), 1e-300) < 1e-6;
              r.energyLowMevNucl = isSingleSolution ? null : lowE;
              r.energyHighMevNucl = highE;
            }

            resultIdx++;
          }
        }
      } catch {
        for (const r of inverseState.stpRows) {
          if (r.status === "valid" || r.status === "no-solution") {
            r.status = "error";
            r.message = "Inverse STP lookup failed";
            r.energyLowMevNucl = null;
            r.energyHighMevNucl = null;
          }
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });
}
