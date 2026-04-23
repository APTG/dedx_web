import type {
  CompatibilityMatrix,
  ProgramEntity,
  ParticleEntity,
  MaterialEntity,
  LibdedxService,
} from "$lib/wasm/types";

// DEDX_ICRU (id=9) is the internal auto-selector in libdedx — it picks the best
// ICRU dataset for the current particle/material at the C layer.
// Spec references:
// - docs/04-feature-specs/entity-selection.md ("Hidden programs": ID 9 excluded)
// - docs/06-wasm-api-contract.md §10.3 (ID 9 used internally by Auto-select)
// The UI exposes a synthetic "Auto-select" entry instead, so showing ID 9 directly
// would duplicate behavior and confuse users.
const EXCLUDED_FROM_UI = new Set([9]);

export function buildCompatibilityMatrix(service: LibdedxService): CompatibilityMatrix {
  const programs = service.getPrograms();

  const particlesByProgram = new Map<number, Set<number>>();
  const materialsByProgram = new Map<number, Set<number>>();
  const programsByParticle = new Map<number, Set<number>>();
  const programsByMaterial = new Map<number, Set<number>>();

  const allParticlesMap = new Map<number, ParticleEntity>();
  const allMaterialsMap = new Map<number, MaterialEntity>();
  const allProgramsFiltered: ProgramEntity[] = [];

  for (const program of programs) {
    const particles = service.getParticles(program.id);
    const materials = service.getMaterials(program.id);

    particlesByProgram.set(program.id, new Set(particles.map((p) => p.id)));
    materialsByProgram.set(program.id, new Set(materials.map((m) => m.id)));

    for (const particle of particles) {
      allParticlesMap.set(particle.id, particle);
      if (!programsByParticle.has(particle.id)) {
        programsByParticle.set(particle.id, new Set());
      }
      programsByParticle.get(particle.id)!.add(program.id);
    }

    for (const material of materials) {
      allMaterialsMap.set(material.id, material);
      if (!programsByMaterial.has(material.id)) {
        programsByMaterial.set(material.id, new Set());
      }
      programsByMaterial.get(material.id)!.add(program.id);
    }

    const hasParticles = particles.length > 0;
    const hasMaterials = materials.length > 0;
    const isExcluded = EXCLUDED_FROM_UI.has(program.id);

    if (hasParticles && hasMaterials && !isExcluded) {
      allProgramsFiltered.push(program);
    }
  }

  return {
    particlesByProgram,
    materialsByProgram,
    programsByParticle,
    programsByMaterial,
    allParticles: Array.from(allParticlesMap.values()),
    allMaterials: Array.from(allMaterialsMap.values()),
    allPrograms: allProgramsFiltered,
  };
}

export function getAvailablePrograms(
  matrix: CompatibilityMatrix,
  particleId?: number,
  materialId?: number,
): ProgramEntity[] {
  let candidates = matrix.allPrograms;

  if (particleId !== undefined) {
    const programIds = matrix.programsByParticle.get(particleId);
    if (!programIds || programIds.size === 0) {
      return [];
    }
    candidates = candidates.filter((p) => programIds.has(p.id));
  }

  if (materialId !== undefined) {
    const programIds = matrix.programsByMaterial.get(materialId);
    if (!programIds || programIds.size === 0) {
      return [];
    }
    candidates = candidates.filter((p) => programIds.has(p.id));
  }

  return candidates;
}

export function getAvailableParticles(
  matrix: CompatibilityMatrix,
  programId?: number,
  materialId?: number,
): ParticleEntity[] {
  let candidates = matrix.allParticles;

  if (programId !== undefined) {
    const particleIds = matrix.particlesByProgram.get(programId);
    if (!particleIds || particleIds.size === 0) {
      return [];
    }
    candidates = candidates.filter((p) => particleIds.has(p.id));
  }

  if (materialId !== undefined) {
    const materialPrograms = matrix.programsByMaterial.get(materialId);
    if (!materialPrograms || materialPrograms.size === 0) {
      return [];
    }
    candidates = candidates.filter((particle) => {
      const particlePrograms = matrix.programsByParticle.get(particle.id);
      if (!particlePrograms) return false;
      for (const progId of particlePrograms) {
        if (materialPrograms.has(progId)) {
          return true;
        }
      }
      return false;
    });
  }

  return candidates;
}

export function getAvailableMaterials(
  matrix: CompatibilityMatrix,
  programId?: number,
  particleId?: number,
): MaterialEntity[] {
  let candidates = matrix.allMaterials;

  if (programId !== undefined) {
    const materialIds = matrix.materialsByProgram.get(programId);
    if (!materialIds || materialIds.size === 0) {
      return [];
    }
    candidates = candidates.filter((m) => materialIds.has(m.id));
  }

  if (particleId !== undefined) {
    const particlePrograms = matrix.programsByParticle.get(particleId);
    if (!particlePrograms || particlePrograms.size === 0) {
      return [];
    }
    candidates = candidates.filter((material) => {
      const materialPrograms = matrix.programsByMaterial.get(material.id);
      if (!materialPrograms) return false;
      for (const progId of materialPrograms) {
        if (particlePrograms.has(progId)) {
          return true;
        }
      }
      return false;
    });
  }

  return candidates;
}
