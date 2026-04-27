/**
 * Human-friendly particle name utilities.
 *
 * The libdedx C API returns ALL-CAPS element names for ions
 * (e.g., "HYDROGEN", "HELIUM", "CARBON").
 * Electron (ID 1001) returns an empty string from dedx_get_ion_name().
 *
 * This module provides display-name formatting and an override table,
 * following the same pattern as material-names.ts.
 */

/**
 * Converts a raw ALL-CAPS element name to title case.
 * Element names are single words with no underscores,
 * so this is a straightforward first-letter capitalisation.
 * Example: "HYDROGEN" → "Hydrogen", "CARBON" → "Carbon"
 */
export function formatParticleName(rawName: string): string {
  if (!rawName) return rawName;
  const lower = rawName.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Override table for particle IDs where auto-formatting is insufficient.
 *
 * Currently covers only the electron (ID 1001), because
 * dedx_get_ion_name(1001) returns "" and the element name
 * "Electron" cannot be derived automatically.
 *
 * Reserved for future use if libdedx introduces mass-specific ion names
 * (e.g., "CARBON12" for ¹²C) that need splitting.
 */
export const PARTICLE_NAME_OVERRIDES: ReadonlyMap<number, string> = new Map([
  [1, "proton"],
  [2, "alpha particle"],
  [1001, "electron"],
]);

/**
 * Returns the human-friendly display name for a particle.
 *
 * 1. Checks the override table (currently only electron ID 1001).
 * 2. Falls back to formatParticleName(rawName) for all other ions
 *    (e.g., "HYDROGEN" → "Hydrogen").
 *
 * @param id      libdedx ion/particle ID
 * @param rawName Raw ALL-CAPS name from dedx_get_ion_name()
 */
export function getParticleFriendlyName(id: number, rawName: string): string {
  return PARTICLE_NAME_OVERRIDES.get(id) ?? formatParticleName(rawName);
}
