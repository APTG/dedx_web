import type { ProgramEntity, ParticleEntity, MaterialEntity, CompatibilityMatrix } from '../wasm/types';

export const programs = $state<{ value: ProgramEntity[] }>({ value: [] });
export const allParticles = $state<{ value: ParticleEntity[] }>({ value: [] });
export const allMaterials = $state<{ value: MaterialEntity[] }>({ value: [] });
export const compatMatrix = $state<{ value: CompatibilityMatrix | null }>({ value: null });
