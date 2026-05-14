/**
 * External compatibility context: merges loaded external .webdedx stores
 * with the built-in libdedx compatibility matrix.
 *
 * External programs are never merged — each is a distinct entity.
 * Particles merge by PDG code (primary) or (Z, A) fallback.
 * Materials merge by icruId (primary), atomicNumber, or name fallback.
 */

import type { ExternalStoreMetadata, ExternalParticleEntry, ExternalMaterialEntry } from "$lib/external-data/schema";
import type { ParticleEntity, MaterialEntity } from "$lib/wasm/types";
import { formatExtRef } from "$lib/external-data/ids";

/** A program from an external store, as shown in the entity selector. */
export interface ExternalProgramEntity {
  /** "ext:{label}:{localId}" */
  id: string;
  name: string;
  version?: string | undefined;
  /** Source label (e.g. "srim"). */
  label: string;
  /** Local program ID within the store (e.g. "srim-2013-gui"). */
  localId: string;
}

/**
 * An external-only particle (not merged with any built-in particle).
 * Uses an ExtRef string as its display ID.
 */
export interface ExternalOnlyParticle {
  id: string; // ExtRef
  name: string;
  symbol: string;
  label: string;
  localId: string;
  Z: number;
  A: number;
  atomicMass: number;
  pdgCode?: number | undefined;
}

/**
 * An external-only material (not merged with any built-in material).
 * Uses an ExtRef string as its display ID.
 */
export interface ExternalOnlyMaterial {
  id: string; // ExtRef
  name: string;
  density?: number | undefined;
  label: string;
  localId: string;
  icruId?: number | undefined;
  atomicNumber?: number | undefined;
  linearUnitsAvailable: boolean;
}

/**
 * Supplemental external compatibility data. Stored alongside the built-in
 * CompatibilityMatrix and consulted when external programs are relevant.
 */
export interface ExternalCompatibilityContext {
  /** All external programs available. */
  programs: ExternalProgramEntity[];

  /**
   * Which particles (built-in numeric IDs + external-only string IDs)
   * each external program covers.
   */
  particlesByProgram: Map<string, Set<number | string>>;

  /**
   * Which materials (built-in numeric/string IDs + external-only string IDs)
   * each external program covers.
   */
  materialsByProgram: Map<string, Set<number | string>>;

  /**
   * Which external program IDs support a given built-in particle ID.
   * Used for bidirectional filtering.
   */
  externalProgramsByBuiltinParticle: Map<number, Set<string>>;

  /**
   * Which external program IDs support a given built-in material ID.
   */
  externalProgramsByBuiltinMaterial: Map<number | string, Set<string>>;

  /** External-only particles (no built-in match found). */
  externalOnlyParticles: ExternalOnlyParticle[];

  /** External-only materials (no built-in match found). */
  externalOnlyMaterials: ExternalOnlyMaterial[];

  /**
   * Maps ExtRef string → built-in particle numeric ID for merged particles.
   * e.g. "ext:srim:p" → 1
   */
  mergedParticleMap: Map<string, number>;

  /**
   * Maps ExtRef string → built-in material ID for merged materials.
   * e.g. "ext:srim:water" → 276
   */
  mergedMaterialMap: Map<string, number | string>;

  /**
   * Reverse: built-in particle ID → list of ExtRef strings from each source
   * that cover that particle.
   */
  externalRefsForBuiltinParticle: Map<number, string[]>;

  /**
   * Reverse: built-in material ID → list of ExtRef strings from each source
   * that cover that material.
   */
  externalRefsForBuiltinMaterial: Map<number | string, string[]>;

  /** Source metadata keyed by label, for attribution UI. */
  sourceMetadata: Map<string, ExternalStoreMetadata>;
}

/** Compute a PDG code for a built-in libdedx particle. */
function builtinParticlePdg(libdedxId: number, massNumber: number): number | null {
  if (libdedxId === 1001) return 11; // electron
  if (libdedxId === 1) return 2212; // proton (special baryon, not nucleus PDG)
  // For ions Z >= 2: ion PDG = 1000000000 + Z * 10000 + A * 10
  const Z = libdedxId;
  return 1000000000 + Z * 10000 + massNumber * 10;
}

/** Match an external particle against the built-in list. Returns built-in ID or null. */
function matchBuiltinParticle(
  extParticle: ExternalParticleEntry,
  builtinParticles: ParticleEntity[],
  pdgByBuiltin: Map<number, number>,
): number | null {
  // 1. PDG code (primary)
  if (extParticle.pdgCode !== undefined) {
    for (const bp of builtinParticles) {
      const bpId = bp.id as number;
      if (pdgByBuiltin.get(bpId) === extParticle.pdgCode) return bpId;
    }
  }

  // 2. (Z, A) fallback
  const extZ = extParticle.Z;
  const extA = extParticle.A;
  for (const bp of builtinParticles) {
    const bpId = bp.id as number;
    // Built-in particle ID 1-92 is atomic number Z; massNumber is A
    const bpZ = bpId === 1001 ? 0 : bpId;
    const bpA = bp.massNumber;
    if (bpZ === extZ && bpA === extA) return bpId;
  }

  return null;
}

/** Match an external material against the built-in list. Returns built-in ID or null. */
function matchBuiltinMaterial(
  extMaterial: ExternalMaterialEntry,
  builtinMaterials: MaterialEntity[],
): number | null {
  // 1. ICRU ID (primary)
  if (extMaterial.icruId !== undefined) {
    const match = builtinMaterials.find((m) => typeof m.id === "number" && m.id === extMaterial.icruId);
    if (match) return match.id as number;
  }

  // 2. Atomic number (pure elements)
  if (extMaterial.atomicNumber !== undefined) {
    const match = builtinMaterials.find(
      (m) => typeof m.id === "number" && m.atomicNumber === extMaterial.atomicNumber,
    );
    if (match) return match.id as number;
  }

  // 3. Case-insensitive name match
  const extNameLower = extMaterial.name.toLowerCase();
  const match = builtinMaterials.find((m) => m.name.toLowerCase() === extNameLower);
  if (match) return match.id as number;

  return null;
}

/**
 * Build an ExternalCompatibilityContext from a set of loaded store metadata objects.
 * Must be called after all sources have been loaded and validated.
 */
export function buildExternalCompatibilityContext(
  sources: ExternalStoreMetadata[],
  builtinParticles: ParticleEntity[],
  builtinMaterials: MaterialEntity[],
): ExternalCompatibilityContext {
  // Precompute PDG codes for all built-in particles (IDs are always numeric for built-ins)
  const pdgByBuiltin = new Map<number, number>();
  for (const bp of builtinParticles) {
    const bpId = bp.id as number;
    const pdg = builtinParticlePdg(bpId, bp.massNumber);
    if (pdg !== null) pdgByBuiltin.set(bpId, pdg);
  }

  const programs: ExternalProgramEntity[] = [];
  const particlesByProgram = new Map<string, Set<number | string>>();
  const materialsByProgram = new Map<string, Set<number | string>>();
  const externalProgramsByBuiltinParticle = new Map<number, Set<string>>();
  const externalProgramsByBuiltinMaterial = new Map<number | string, Set<string>>();
  const externalOnlyParticles: ExternalOnlyParticle[] = [];
  const externalOnlyMaterials: ExternalOnlyMaterial[] = [];
  const mergedParticleMap = new Map<string, number>();
  const mergedMaterialMap = new Map<string, number | string>();
  const externalRefsForBuiltinParticle = new Map<number, string[]>();
  const externalRefsForBuiltinMaterial = new Map<number | string, string[]>();
  const sourceMetadata = new Map<string, ExternalStoreMetadata>();

  for (const meta of sources) {
    sourceMetadata.set(meta.label, meta);

    // Build particle merge map for this source
    const particleIdByExtLocalId = new Map<string, number | string>();
    for (const ep of meta.particles) {
      const extRef = formatExtRef(meta.label, ep.id);
      const builtinId = matchBuiltinParticle(ep, builtinParticles, pdgByBuiltin);
      if (builtinId !== null) {
        // Merged
        mergedParticleMap.set(extRef, builtinId);
        particleIdByExtLocalId.set(ep.id, builtinId);
        if (!externalRefsForBuiltinParticle.has(builtinId)) {
          externalRefsForBuiltinParticle.set(builtinId, []);
        }
        externalRefsForBuiltinParticle.get(builtinId)!.push(extRef);
      } else {
        // External-only
        particleIdByExtLocalId.set(ep.id, extRef);
        const alreadyHave = externalOnlyParticles.some((p) => p.id === extRef);
        if (!alreadyHave) {
          externalOnlyParticles.push({
            id: extRef,
            name: ep.name,
            symbol: ep.symbol,
            label: meta.label,
            localId: ep.id,
            Z: ep.Z,
            A: ep.A,
            atomicMass: ep.atomicMass,
            pdgCode: ep.pdgCode,
          });
        }
      }
    }

    // Build material merge map for this source
    const materialIdByExtLocalId = new Map<string, number | string>();
    for (const em of meta.materials) {
      const extRef = formatExtRef(meta.label, em.id);
      const builtinId = matchBuiltinMaterial(em, builtinMaterials);
      if (builtinId !== null) {
        // Merged
        mergedMaterialMap.set(extRef, builtinId);
        materialIdByExtLocalId.set(em.id, builtinId);
        if (!externalRefsForBuiltinMaterial.has(builtinId)) {
          externalRefsForBuiltinMaterial.set(builtinId, []);
        }
        externalRefsForBuiltinMaterial.get(builtinId)!.push(extRef);
      } else {
        // External-only
        materialIdByExtLocalId.set(em.id, extRef);
        const alreadyHave = externalOnlyMaterials.some((m) => m.id === extRef);
        if (!alreadyHave) {
          externalOnlyMaterials.push({
            id: extRef,
            name: em.name,
            density: em.density,
            label: meta.label,
            localId: em.id,
            icruId: em.icruId,
            atomicNumber: em.atomicNumber,
            linearUnitsAvailable: em.linearUnitsAvailable,
          });
        }
      }
    }

    // Register each program and its coverage
    for (const ep of meta.programs) {
      const programExtRef = formatExtRef(meta.label, ep.id);
      programs.push({
        id: programExtRef,
        name: ep.name,
        version: ep.version,
        label: meta.label,
        localId: ep.id,
      });

      const particleSet = new Set<number | string>(
        meta.particles.map((p) => particleIdByExtLocalId.get(p.id)!),
      );
      particlesByProgram.set(programExtRef, particleSet);

      const materialSet = new Set<number | string>(
        meta.materials.map((m) => materialIdByExtLocalId.get(m.id)!),
      );
      materialsByProgram.set(programExtRef, materialSet);

      // Reverse index for built-in particles
      for (const pid of particleSet) {
        if (typeof pid === "number") {
          if (!externalProgramsByBuiltinParticle.has(pid)) {
            externalProgramsByBuiltinParticle.set(pid, new Set());
          }
          externalProgramsByBuiltinParticle.get(pid)!.add(programExtRef);
        }
      }

      // Reverse index for built-in materials
      for (const mid of materialSet) {
        if (typeof mid !== "string" || !mid.startsWith("ext:")) {
          // built-in (number or custom compound string)
          if (!externalProgramsByBuiltinMaterial.has(mid)) {
            externalProgramsByBuiltinMaterial.set(mid, new Set());
          }
          externalProgramsByBuiltinMaterial.get(mid)!.add(programExtRef);
        }
      }
    }
  }

  return {
    programs,
    particlesByProgram,
    materialsByProgram,
    externalProgramsByBuiltinParticle,
    externalProgramsByBuiltinMaterial,
    externalOnlyParticles,
    externalOnlyMaterials,
    mergedParticleMap,
    mergedMaterialMap,
    externalRefsForBuiltinParticle,
    externalRefsForBuiltinMaterial,
    sourceMetadata,
  };
}

/** Empty context when no external data is loaded. */
export const EMPTY_EXTERNAL_CONTEXT: ExternalCompatibilityContext = {
  programs: [],
  particlesByProgram: new Map(),
  materialsByProgram: new Map(),
  externalProgramsByBuiltinParticle: new Map(),
  externalProgramsByBuiltinMaterial: new Map(),
  externalOnlyParticles: [],
  externalOnlyMaterials: [],
  mergedParticleMap: new Map(),
  mergedMaterialMap: new Map(),
  externalRefsForBuiltinParticle: new Map(),
  externalRefsForBuiltinMaterial: new Map(),
  sourceMetadata: new Map(),
};

/**
 * Resolve the display ID for a particle given the current selection context.
 * If the particle is merged (built-in ID), returns the built-in ID.
 * If external-only, returns the ExtRef string.
 */
export function resolveParticleDisplayId(
  extRef: string,
  ctx: ExternalCompatibilityContext,
): number | string {
  return ctx.mergedParticleMap.get(extRef) ?? extRef;
}

/**
 * Get the built-in particle ID for an external ref (or null if external-only).
 */
export function getBuiltinParticleId(
  extRef: string,
  ctx: ExternalCompatibilityContext,
): number | null {
  return ctx.mergedParticleMap.get(extRef) ?? null;
}

/**
 * Given the currently selected particle/material IDs, return all external program
 * IDs that cover the selection (for filtering in the selector).
 */
export function getAvailableExternalPrograms(
  ctx: ExternalCompatibilityContext,
  particleId?: number | string | null,
  materialId?: number | string | null,
): ExternalProgramEntity[] {
  let candidates = ctx.programs;

  if (particleId !== undefined && particleId !== null) {
    candidates = candidates.filter((prog) => {
      const covered = ctx.particlesByProgram.get(prog.id);
      if (!covered) return false;
      return covered.has(particleId);
    });
  }

  if (materialId !== undefined && materialId !== null) {
    candidates = candidates.filter((prog) => {
      const covered = ctx.materialsByProgram.get(prog.id);
      if (!covered) return false;
      return covered.has(materialId);
    });
  }

  return candidates;
}
