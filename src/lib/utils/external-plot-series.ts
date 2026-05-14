import type { CsdaTableEntry, ExternalDataService, StpTableEntry } from "$lib/external-data/service";
import type { CalculationResult } from "$lib/wasm/types";

export function externalEntriesToCalculationResult(
  stpEntry: StpTableEntry,
  csdaEntry: CsdaTableEntry | null,
  particleA: number,
): CalculationResult {
  const energies = Array.from(stpEntry.energyGridMev).map((e) => (particleA > 0 ? e / particleA : e));
  return {
    energies,
    stoppingPowers: stpEntry.values.map((v) => v ?? 0),
    csdaRanges: csdaEntry ? csdaEntry.values.map((v) => v ?? 0) : [],
  };
}

export async function loadExternalCalculationResult(
  service: Pick<ExternalDataService, "getStp" | "getCsda">,
  label: string,
  programLocalId: string,
  particleLocalId: string,
  materialLocalId: string,
  particleA: number,
): Promise<CalculationResult | null> {
  const [stpEntry, csdaEntry] = await Promise.all([
    service.getStp(label, programLocalId, particleLocalId, materialLocalId),
    service.getCsda(label, programLocalId, particleLocalId, materialLocalId),
  ]);
  if (!stpEntry) return null;
  return externalEntriesToCalculationResult(stpEntry, csdaEntry, particleA);
}
