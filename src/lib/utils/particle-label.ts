import type { ParticleEntity } from "$lib/wasm/types";

/**
 * Display label for a particle, matching the conventions documented in
 * `docs/04-feature-specs/entity-selection.md` § "Particle naming preferences":
 *
 * - id 1     → "proton"          (lowercase, no symbol)
 * - id 2     → "alpha particle"  (lowercase, no symbol)
 * - id 1001  → "electron"        (lowercase, no symbol)
 * - others   → "Element (Symbol)" — e.g. "Carbon (C)", "Tin (Sn)".
 */
export function getParticleLabel(particle: ParticleEntity): string {
  if (particle.id === 1) return "proton";
  if (particle.id === 2) return "alpha particle";
  if (particle.id === 1001) return "electron";
  const symbol = particle.symbol || "";
  return symbol ? `${particle.name} (${symbol})` : particle.name;
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
