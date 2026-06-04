import { advancedOptions } from "$lib/state/advanced-options.svelte";
import {
  customMaterialElementsForWasm,
  isCustomMaterial,
} from "$lib/utils/custom-compound-material";
import { getService } from "$lib/wasm/loader";
import { rangeUnitToCmFactor } from "$lib/utils/inverse-units";
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
 *
 * Mirrors the `multi-*-calc.svelte.ts` convention: data lives in
 * `inverse-lookups.svelte.ts`; the range calculation `$effect` lives here, and
 * the STP calculation `$effect` lives in `inverse-stp-calc.svelte.ts`.
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
        // Rows that resolved to an energy, paired with that energy — used for a
        // forward calc to recover the stopping power at the resolved energy.
        const resolved: { row: (typeof inverseState.rangeRows)[number]; energy: number }[] = [];
        for (const r of inverseState.rangeRows) {
          if (r.status === "valid" || r.status === "out-of-range") {
            const result = results[resultIdx++];
            if (result instanceof Error || result === undefined) {
              r.energyMevNucl = null;
              r.stoppingPower = null;
            } else {
              r.energyMevNucl = result.energy;
              r.stoppingPower = null;
              resolved.push({ row: r, energy: result.energy });
            }
          }
        }

        // Second output column (#673): stopping power at each resolved energy.
        // The inverse-CSDA call only echoes the input range, so we run the
        // forward calc at the resolved energies to obtain the STP.
        if (resolved.length > 0) {
          try {
            const energies = resolved.map((x) => x.energy);
            const forward = activeCustomMaterial
              ? service.calculateCustomCompound({
                  programId,
                  particleId,
                  elements: customMaterialElementsForWasm(activeCustomMaterial),
                  density,
                  iValue: activeCustomMaterial.iValue,
                  energies,
                })
              : typeof materialId === "number"
                ? service.calculate(programId, particleId, materialId, energies, advOptsSnapshot)
                : null;
            if (forward) {
              for (let i = 0; i < resolved.length; i++) {
                const stp = forward.stoppingPowers[i];
                resolved[i]!.row.stoppingPower = typeof stp === "number" ? stp : null;
              }
            }
          } catch {
            for (const x of resolved) x.row.stoppingPower = null;
          }
        }
      } catch {
        for (const r of inverseState.rangeRows) {
          if (r.status === "valid" || r.status === "out-of-range") {
            r.status = "error";
            r.message = "Inverse range lookup failed";
            r.energyMevNucl = null;
            r.stoppingPower = null;
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
