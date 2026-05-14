/**
 * TypeScript types for the webdedx Zarr v3 store schema.
 * See docs/04-feature-specs/external-data.md §2.2.
 */

/** Supported energy units for the energy grid (webdedx.units.energy). */
export type ExternalEnergyUnit = "MeV" | "MeV/nucl" | "MeV/u" | "keV" | "GeV";

/** Supported stopping-power units (webdedx.units.stoppingPower). */
export type ExternalStpUnit = "MeV·cm²/g" | "MeV/cm" | "keV/µm";

/** Supported CSDA-range units (webdedx.units.csdaRange, optional). */
export type ExternalCsdaUnit = "g/cm²" | "cm";

/** Validated program entry from webdedx.programs[]. */
export interface ExternalProgramEntry {
  id: string;
  name: string;
  version?: string | undefined;
}

/** Validated particle entry with its position in the shard layout. */
export interface ExternalParticleEntry {
  id: string;
  name: string;
  symbol: string;
  Z: number;
  A: number;
  atomicMass: number;
  pdgCode?: number | undefined;
  /** 0-based shard index — corresponds to shard file c/{index}/0/0. */
  index: number;
}

/** Validated material entry. */
export interface ExternalMaterialEntry {
  id: string;
  name: string;
  /** g/cm³. Undefined ⇒ linear stopping-power units (keV/µm, MeV/cm) are unavailable. */
  density?: number | undefined;
  phase?: "liquid" | "solid" | "gas" | undefined;
  icruId?: number | undefined;
  atomicNumber?: number | undefined;
  ival?: number | undefined;
  /** 0-based index in the materials dimension of the STP/CSDA arrays. */
  index: number;
  /** false when density is undefined — callers must disable linear STP units. */
  linearUnitsAvailable: boolean;
}

/** Fully validated metadata extracted from the store's root zarr.json. */
export interface ExternalStoreMetadata {
  label: string;
  url: string;

  // Dataset info from webdedx.metadata
  name: string;
  version?: string | undefined;
  author?: string | undefined;
  description?: string | undefined;
  license?: string | undefined;

  programs: ExternalProgramEntry[];
  particles: ExternalParticleEntry[];
  materials: ExternalMaterialEntry[];

  /** Energy grid values in the original source unit (see energyUnit). */
  energyGrid: readonly number[];
  energyUnit: ExternalEnergyUnit;
  stpUnit: ExternalStpUnit;
  csdaUnit?: ExternalCsdaUnit;

  /** True if csda_range arrays are present in the store (verified during metadata load). */
  hasCsdaRange: boolean;
}
