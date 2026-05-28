import type { ParticleEntity } from "$lib/wasm/types";
import type { ExternalOnlyParticle } from "$lib/state/external-compatibility";

export type Particle = ParticleEntity | ExternalOnlyParticle;

export function isExternal(p: Particle): p is ExternalOnlyParticle {
  return typeof p.id === "string";
}

export function atomicNumber(p: Particle): number {
  return isExternal(p) ? p.Z : (p.id as number);
}
