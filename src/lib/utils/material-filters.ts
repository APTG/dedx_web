import type { MaterialEntity } from "$lib/wasm/types";
import type { ExternalOnlyMaterial } from "$lib/state/external-compatibility";

/** A material as shown in the picker: built-in or external-only. */
export type MaterialLike = MaterialEntity | ExternalOnlyMaterial;

/**
 * Category/sort predicates shared by the material picker surfaces
 * (`entity-selection/material-tab.svelte` and `picker-sheet.svelte`). Kept in
 * one place so a change to how externals are categorized can't silently miss
 * one of the two lists.
 */

/** Atomic numbers 1–98 are elements; everything else is treated as a compound. */
export function isElementId(id: number): boolean {
  return id >= 1 && id <= 98;
}

/** External-only materials carry a string ExtRef id prefixed with `ext:`. */
export function isExternalMaterial(m: MaterialLike): m is ExternalOnlyMaterial {
  return typeof m.id === "string" && m.id.startsWith("ext:");
}

/** True when the material belongs in the Elements sub-list. */
export function inElements(m: MaterialLike): boolean {
  if (isExternalMaterial(m)) {
    return m.atomicNumber !== undefined && isElementId(m.atomicNumber);
  }
  return typeof m.id === "number" && isElementId(m.id);
}

/** True when the material belongs in the Compounds sub-list. */
export function inCompounds(m: MaterialLike): boolean {
  if (isExternalMaterial(m)) {
    return !(m.atomicNumber !== undefined && isElementId(m.atomicNumber));
  }
  return typeof m.id === "number" && m.id > 98;
}

/** Sort comparator for the Elements list: ascending atomic number. */
export function compareElements(a: MaterialLike, b: MaterialLike): number {
  const ai = isExternalMaterial(a)
    ? (a.atomicNumber ?? 999)
    : typeof a.id === "number"
      ? a.id
      : 999;
  const bi = isExternalMaterial(b)
    ? (b.atomicNumber ?? 999)
    : typeof b.id === "number"
      ? b.id
      : 999;
  return ai - bi;
}

/** Sort comparator for Compounds/Custom lists: by display name. */
export function compareByName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

/**
 * Searchable text index for a material row, shared by the picker surfaces.
 * Externals expose their local id/label plus `ext external` so a free-text
 * query for "external" surfaces them.
 */
export function materialSearchText(m: MaterialLike): string {
  if (isExternalMaterial(m)) {
    return `${m.localId} ${m.name} ${m.label} ext external`;
  }
  return `${m.id} ${m.name} ${m.rawName ?? ""}`;
}

/**
 * Match the query against a material's searchable text. Supports a plain
 * substring match plus density operators (advanced syntax):
 *   ρ>N   ρ>=N   ρ<N   ρ<=N   ρ=N   (ASCII alias `rho` is also accepted).
 */
export function matchesMaterialQuery(m: MaterialLike, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const rhoOp = trimmed.match(/^(?:ρ|rho)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/);
  if (rhoOp) {
    const density = m.density;
    if (density === undefined) return false;
    const n = Number(rhoOp[2]);
    if (rhoOp[1] === ">=") return density >= n;
    if (rhoOp[1] === "<=") return density <= n;
    if (rhoOp[1] === ">") return density > n;
    if (rhoOp[1] === "<") return density < n;
    if (rhoOp[1] === "=") return Math.abs(density - n) < 0.0001;
  }
  return materialSearchText(m).toLowerCase().includes(trimmed);
}

/** Density value formatted for the `ρ=… g/cm³` label, or undefined if unknown. */
export function formatDensity(m: MaterialLike): string | undefined {
  if (isExternalMaterial(m)) {
    return m.density !== undefined ? m.density.toFixed(4) : undefined;
  }
  return m.density.toFixed(m.density < 0.1 ? 4 : 2);
}

/** True when the material is a gas at standard conditions. */
export function isGas(m: MaterialLike): boolean {
  return !isExternalMaterial(m) && m.isGasByDefault;
}
