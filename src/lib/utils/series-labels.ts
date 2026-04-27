import { COLOR_PALETTE } from "./plot-utils";

interface SeriesForLabel {
  programId: number;
  particleId: number;
  materialId: number;
  programName: string;
  particleName: string;
  materialName: string;
}

export function computeSeriesLabels(series: SeriesForLabel[]): string[] {
  if (series.length === 0) return [];

  const programs = new Set(series.map((s) => s.programId));
  const particles = new Set(series.map((s) => s.particleId));
  const materials = new Set(series.map((s) => s.materialId));

  const programVaries = programs.size > 1;
  const particleVaries = particles.size > 1;
  const materialVaries = materials.size > 1;

  return series.map((s) => {
    const parts: string[] = [];

    // Determine what to show for particle/material based on what varies
    let particleMaterial: string | null = null;
    if (particleVaries && materialVaries) {
      // Both vary: show "Particle in Material"
      particleMaterial = `${s.particleName} in ${s.materialName}`;
    } else if (particleVaries) {
      // Only particle varies: show just particle
      particleMaterial = s.particleName;
    } else if (materialVaries) {
      // Only material varies: show just material
      particleMaterial = s.materialName;
    }

    if (programVaries && particleMaterial) {
      parts.push(`${s.programName} — ${particleMaterial}`);
    } else if (programVaries) {
      parts.push(s.programName);
    } else if (particleMaterial) {
      parts.push(particleMaterial);
    } else {
      // single series: full label
      parts.push(`${s.particleName} in ${s.materialName}`);
    }

    return parts.join("");
  });
}

/**
 * Allocate the lowest available color index from the pool.
 * Returns the index. Removes it from the pool.
 * If the pool is empty, wraps around (all indices re-added).
 */
export function allocateColor(availableIndices: Set<number>): number {
  if (availableIndices.size === 0) {
    // Wrap around: refill the pool
    for (let i = 0; i < COLOR_PALETTE.length; i++) {
      availableIndices.add(i);
    }
  }
  const idx = Math.min(...availableIndices);
  availableIndices.delete(idx);
  return idx;
}

/** Release a color index back to the pool. */
export function releaseColor(availableIndices: Set<number>, idx: number): void {
  availableIndices.add(idx);
}
