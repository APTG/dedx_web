/**
 * ExternalDataService: manages multiple external .webdedx stores,
 * caches loaded data in-memory (page-session only, no localStorage),
 * and provides the data access API used by Calculator and Plot.
 *
 * See docs/04-feature-specs/external-data.md §3, §4.
 */

import type { ExternalSourceDescriptor } from "./types.js";
import type {
  ExternalStoreMetadata,
  ExternalParticleEntry,
  ExternalMaterialEntry,
} from "./schema.js";
import { ExternalDataError } from "./errors.js";
import { loadStoreMetadata, loadStpSlice, loadCsdaSlice } from "./loader.js";
import { convertEnergyGrid, convertStpColumn, convertCsdaColumn, computeCsdaColumn } from "./units.js";
import { interpolate, type InterpolationScale } from "./interpolation.js";

/** Maximum number of simultaneously loaded external sources. */
const MAX_SOURCES = 5;

/**
 * A cached, converted STP column for one (program, particle, material) triple.
 * Values are in MeV·cm²/g. Null entries indicate conversion failure (e.g. missing density).
 * Also includes the per-particle energy grid in MeV.
 */
export interface StpTableEntry {
  energyGridMev: Float64Array;
  /** STP values in MeV·cm²/g; null = missing/unconvertible. */
  values: (number | null)[];
}

export interface CsdaTableEntry {
  energyGridMev: Float64Array;
  /** CSDA range values in g/cm²; null = missing/unconvertible. */
  values: (number | null)[];
}

/** Result of a single interpolated STP/CSDA lookup. */
export interface ExternalLookupResult {
  stp: number | null;
  csda: number | null;
}

export class ExternalDataService {
  /** Metadata keyed by source label. */
  private readonly _metadata = new Map<string, ExternalStoreMetadata>();

  /** In-flight metadata loads, deduped by label. */
  private readonly _loading = new Map<string, Promise<ExternalStoreMetadata>>();

  /**
   * STP cache key: `${label}:${programId}:${particleIndex}:${materialIndex}`
   */
  private readonly _stpCache = new Map<string, StpTableEntry>();

  /**
   * CSDA cache key: same as STP cache key.
   * Stores null when the array is absent for this source (not a failed load).
   */
  private readonly _csdaCache = new Map<string, CsdaTableEntry | null>();

  /**
   * Load (or return cached) metadata for a source descriptor.
   * Concurrent calls with the same label are coalesced into a single request.
   * Throws ExternalDataError on validation failure or network problems.
   */
  async loadSource(descriptor: ExternalSourceDescriptor): Promise<ExternalStoreMetadata> {
    const { label } = descriptor;

    const cached = this._metadata.get(label);
    if (cached) return cached;

    const inflight = this._loading.get(label);
    if (inflight) return inflight;

    if (this._metadata.size + this._loading.size >= MAX_SOURCES) {
      throw new ExternalDataError(
        "validation-error",
        `Too many external sources: maximum is ${MAX_SOURCES}`,
      );
    }

    const promise = loadStoreMetadata(descriptor)
      .then((meta) => {
        if (this._loading.get(label) === promise) {
          this._loading.delete(label);
          this._metadata.set(label, meta);
        }
        return meta;
      })
      .catch((err) => {
        if (this._loading.get(label) === promise) {
          this._loading.delete(label);
        }
        throw err;
      });

    this._loading.set(label, promise);
    return promise;
  }

  /** Return cached metadata for a label, or undefined if not yet loaded. */
  getMetadata(label: string): ExternalStoreMetadata | undefined {
    return this._metadata.get(label);
  }

  /** True if the metadata for this label has already been loaded. */
  isLoaded(label: string): boolean {
    return this._metadata.has(label);
  }

  /** Remove a source from all caches (e.g. when extdata params change). */
  evict(label: string): void {
    this._metadata.delete(label);
    this._loading.delete(label);
    for (const key of [...this._stpCache.keys()]) {
      if (key.startsWith(`${label}:`)) this._stpCache.delete(key);
    }
    for (const key of [...this._csdaCache.keys()]) {
      if (key.startsWith(`${label}:`)) this._csdaCache.delete(key);
    }
  }

  /** Clear all loaded data. */
  clear(): void {
    this._metadata.clear();
    this._loading.clear();
    this._stpCache.clear();
    this._csdaCache.clear();
  }

  /**
   * Get (or load and cache) the STP table for a specific combination.
   * All parameters are local IDs within the named source.
   */
  async getStp(
    label: string,
    programId: string,
    particleLocalId: string,
    materialLocalId: string,
  ): Promise<StpTableEntry | null> {
    const meta = this._metadata.get(label);
    if (!meta) return null;

    const particle = meta.particles.find((p) => p.id === particleLocalId);
    const material = meta.materials.find((m) => m.id === materialLocalId);
    if (!particle || !material) return null;

    const cacheKey = `${label}:${programId}:${particle.index}:${material.index}`;
    const cached = this._stpCache.get(cacheKey);
    if (cached) return cached;

    const raw = await loadStpSlice(meta.url, programId, particle.index, material.index);
    const energyGridMev = convertEnergyGrid(meta.energyGrid, meta.energyUnit, particle.A);
    const values = convertStpColumn(raw, meta.stpUnit, material.density);

    const entry: StpTableEntry = { energyGridMev, values };
    this._stpCache.set(cacheKey, entry);
    return entry;
  }

  /**
   * Get (or load and cache) the CSDA range table.
   *
   * When the store contains a csda_range array (hasCsdaRange = true), the
   * data is loaded from S3. Otherwise CSDA is derived by trapezoidal
   * integration of 1/S(E) over the already-loaded STP data (Option B).
   * Returns null only when no STP data is available.
   */
  async getCsda(
    label: string,
    programId: string,
    particleLocalId: string,
    materialLocalId: string,
  ): Promise<CsdaTableEntry | null> {
    if (!this._metadata.has(label)) return null;
    const meta = this._metadata.get(label)!;

    const particle = meta.particles.find((p) => p.id === particleLocalId);
    const material = meta.materials.find((m) => m.id === materialLocalId);
    if (!particle || !material) return null;

    const cacheKey = `${label}:${programId}:${particle.index}:${material.index}`;
    if (this._csdaCache.has(cacheKey)) return this._csdaCache.get(cacheKey)!;

    if (meta.hasCsdaRange) {
      // Load CSDA from the zarr store.
      const raw = await loadCsdaSlice(meta.url, programId, particle.index, material.index);
      if (raw === null) {
        this._csdaCache.set(cacheKey, null);
        return null;
      }
      const energyGridMev = convertEnergyGrid(meta.energyGrid, meta.energyUnit, particle.A);
      const values = convertCsdaColumn(raw, meta.csdaUnit ?? "g/cm²", material.density);
      const entry: CsdaTableEntry = { energyGridMev, values };
      this._csdaCache.set(cacheKey, entry);
      return entry;
    }

    // STP-only store: derive CSDA by integrating 1/S(E) over the STP data.
    const stpEntry = await this.getStp(label, programId, particleLocalId, materialLocalId);
    if (stpEntry === null) {
      this._csdaCache.set(cacheKey, null);
      return null;
    }
    const values = computeCsdaColumn(stpEntry.energyGridMev, stpEntry.values);
    const entry: CsdaTableEntry = { energyGridMev: stpEntry.energyGridMev, values };
    this._csdaCache.set(cacheKey, entry);
    return entry;
  }

  /**
   * Interpolate STP and CSDA at a given energy (in MeV total).
   * Returns { stp, csda } where each may be null for out-of-range or missing data.
   */
  async interpolateAt(
    label: string,
    programId: string,
    particleLocalId: string,
    materialLocalId: string,
    energyMev: number,
    scale: InterpolationScale = "log-log",
  ): Promise<ExternalLookupResult> {
    const [stpEntry, csdaEntry] = await Promise.all([
      this.getStp(label, programId, particleLocalId, materialLocalId),
      this.getCsda(label, programId, particleLocalId, materialLocalId),
    ]);

    const stp = stpEntry
      ? interpolate(stpEntry.energyGridMev, stpEntry.values as number[], energyMev, scale)
      : null;

    const csda = csdaEntry
      ? interpolate(csdaEntry.energyGridMev, csdaEntry.values as number[], energyMev, scale)
      : null;

    return { stp, csda };
  }

  /**
   * Look up a particle entry by local ID within a named source.
   */
  findParticle(label: string, localId: string): ExternalParticleEntry | undefined {
    return this._metadata.get(label)?.particles.find((p) => p.id === localId);
  }

  /**
   * Look up a material entry by local ID within a named source.
   */
  findMaterial(label: string, localId: string): ExternalMaterialEntry | undefined {
    return this._metadata.get(label)?.materials.find((m) => m.id === localId);
  }
}

/** Singleton service instance for the app. */
export const externalDataService = new ExternalDataService();
