import type { ParticleEntity } from "$lib/wasm/types";

/**
 * Display label for a particle, matching the conventions documented in
 * `docs/04-feature-specs/entity-selection.md` § "Particle naming preferences":
 *
 * - id 1     → "proton"          (lowercase, no symbol)
 * - id 2     → "alpha particle"  (lowercase, no symbol)
 * - id 1001  → "electron"        (lowercase, no symbol)
 * - others   → "Element (Symbol)" — e.g. "Carbon (C)", "Tin (Sn)".
 *
 * Also accepts ExternalOnlyParticle (shares id, name, symbol fields).
 */
export function getParticleLabel(particle: {
  id: string | number;
  name: string;
  symbol: string;
}): string {
  if (particle.id === 1) return "proton";
  if (particle.id === 2) return "alpha particle";
  if (particle.id === 1001) return "electron";
  const symbol = particle.symbol || "";
  return symbol ? `${particle.name} (${symbol})` : particle.name;
}

/**
 * Variant of `getParticleLabel` that embeds the atomic number inline so
 * Z is not displayed far to the right as a separate column.
 *
 * - ions with a symbol bracket: "Lithium (Li)" → "Lithium (Li, Z=3)"
 * - named particles without brackets: "proton" → "proton (Z=1)"
 * - external particles (string id): Z shown separately only if provided.
 */
export function getParticleListLabel(
  particle: { id: string | number; name: string; symbol: string },
  atomicNumber?: number | null,
): string {
  const base = getParticleLabel(particle);
  const z = atomicNumber ?? (typeof particle.id === "number" ? particle.id : null);
  if (z === null || z === undefined) return base;
  // Ions already end with ") " — insert Z before the closing paren.
  if (base.endsWith(")")) return base.slice(0, -1) + `, Z=${z})`;
  // Named particles (proton, alpha) without brackets.
  return `${base} (Z=${z})`;
}

export function getParticleSearchText(particle: ParticleEntity): string {
  return [
    particle.name,
    particle.symbol,
    `z=${particle.id}`,
    `z${particle.id}`,
    String(particle.id),
    `a=${particle.massNumber}`,
    `a${particle.massNumber}`,
    String(particle.massNumber),
    ...(particle.aliases ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}
