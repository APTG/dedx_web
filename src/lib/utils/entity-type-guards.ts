import type { MaterialEntity, ParticleEntity } from "$lib/wasm/types";

/** Narrow a material to a built-in MaterialEntity (null if external-only or absent). */
export function asBuiltinMaterial(material: unknown): MaterialEntity | null {
  if (!material) return null;
  if (typeof material === "object" && "isGasByDefault" in material) {
    return material as MaterialEntity;
  }
  return null;
}

/** Narrow a particle to a built-in ParticleEntity (null if external-only). */
export function asBuiltinParticle(particle: unknown): ParticleEntity | null {
  if (!particle) return null;
  if (typeof particle === "object" && "massNumber" in particle) {
    return particle as ParticleEntity;
  }
  return null;
}
