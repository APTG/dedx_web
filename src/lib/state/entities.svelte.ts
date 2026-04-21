import type { ProgramEntity, ParticleEntity, MaterialEntity, CompatibilityMatrix } from './types';

export const programs = $state<{ value: ProgramEntity[] }>({ value: [] });
export const allParticles = $state<{ value: Map<number, ParticleEntity[]> }>({ value: new Map() });
export const allMaterials = $state<{ value: Map<number, MaterialEntity[]> }>({ value: new Map() });
export const compatMatrix = $state<{ value: CompatibilityMatrix }>({ value: new Map() });
