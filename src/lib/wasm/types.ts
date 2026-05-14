export type EnergyUnit = "MeV" | "MeV/nucl" | "MeV/u";
export type StpUnit = "MeV·cm²/g" | "MeV/cm" | "keV/µm";
export type RangeUnit = "g/cm²" | "cm";

export interface LibdedxEntity {
  id: number | string;
  name: string;
}

export interface ParticleEntity extends LibdedxEntity {
  massNumber: number;
  atomicMass: number;
  symbol: string;
  aliases: string[];
}

export interface ProgramEntity extends LibdedxEntity {
  version: string;
}

export interface MaterialEntity extends LibdedxEntity {
  density: number;
  isGasByDefault: boolean;
  atomicNumber?: number | undefined;
  elements?: Array<{ atomicNumber: number; atomCount: number }> | undefined;
  iValue?: number | undefined;
  phase?: "gas" | "condensed" | undefined;
}

export interface CalculationResult {
  energies: number[];
  stoppingPowers: number[];
  csdaRanges: number[];
}

export interface InverseStpResult {
  energy: number;
  stoppingPower: number;
}

export interface InverseCsdaResult {
  energy: number;
  csdaRange: number;
}

export type AggregateState = "gas" | "condensed";
export type MstarMode = "a" | "b" | "c" | "d" | "g" | "h";
export type InterpolationScale = "linear" | "log";
export type InterpolationMethod = "linear" | "cubic";

/**
 * Inverse mode — which inverse tab is active.
 * "csda" = Range tab; "stp" = Inverse STP tab.
 * See docs/04-feature-specs/inverse-lookups.md §9 URL State Encoding.
 */
export type InverseMode = "csda" | "stp";

export interface AdvancedOptions {
  aggregateState?: AggregateState;
  interpolation?: {
    scale?: InterpolationScale;
    method?: InterpolationMethod;
  };
  mstarMode?: MstarMode;
  densityOverride?: number;
  iValueOverride?: number;
}

export interface CompoundElement {
  atomicNumber: number;
  fraction: number;
  type: "atomic" | "weight";
}

export interface CustomCompound {
  name: string;
  elements: CompoundElement[];
  density: number;
  iValue?: number | undefined;
}

export interface StoredCompound extends CustomCompound {
  uuid: string;
  phase: "gas" | "condensed";
  timestamp: number;
}

export class LibdedxError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "LibdedxError";
    this.code = code;
  }
}

export interface LibdedxService {
  init(): Promise<void>;
  getPrograms(): ProgramEntity[];
  getParticles(programId: number): ParticleEntity[];
  getMaterials(programId: number): MaterialEntity[];
  calculate(
    programId: number,
    particleId: number,
    materialId: number,
    energies: number[],
    options?: AdvancedOptions,
  ): CalculationResult;
  calculateMulti(params: {
    programIds: number[];
    particleId: number;
    materialId: number;
    energies: number[];
    options?: AdvancedOptions;
  }): Map<number, CalculationResult | LibdedxError>;
  getPlotData(
    programId: number,
    particleId: number,
    materialId: number,
    numPoints: number,
    logScale: boolean,
    options?: AdvancedOptions,
  ): CalculationResult;
  getPlotDataCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number | undefined;
    numPoints: number;
    logScale: boolean;
  }): CalculationResult;
  getMinEnergy(programId: number, particleId: number): number;
  getMaxEnergy(programId: number, particleId: number): number;
  getInverseStp(params: {
    programId: number;
    particleId: number;
    materialId: number;
    stoppingPowers: number[];
    side: 0 | 1;
    options?: AdvancedOptions;
  }): (InverseStpResult | LibdedxError)[];
  getInverseCsda(params: {
    programId: number;
    particleId: number;
    materialId: number;
    ranges: number[];
    options?: AdvancedOptions;
  }): (InverseCsdaResult | LibdedxError)[];
  getBraggPeakStp(params: {
    programId: number;
    particleId: number;
    materialId: number;
    options?: AdvancedOptions;
  }): number;
  calculateCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number | undefined;
    energies: number[];
  }): CalculationResult;
  getInverseStpCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number | undefined;
    stoppingPowers: number[];
    side: 0 | 1;
  }): (InverseStpResult | LibdedxError)[];
  getInverseCsdaCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number | undefined;
    ranges: number[];
  }): (InverseCsdaResult | LibdedxError)[];
  getBraggPeakStpCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number | undefined;
  }): number;
  getDensity(materialId: number): number | undefined;
  convertEnergy(params: {
    fromUnit: EnergyUnit;
    toUnit: EnergyUnit;
    massNumber: number;
    atomicMass: number;
    values: number[];
  }): number[];
}

export interface CompatibilityMatrix {
  particlesByProgram: Map<number, Set<number>>;
  materialsByProgram: Map<number, Set<number>>;
  programsByParticle: Map<number, Set<number>>;
  programsByMaterial: Map<number, Set<number>>;
  allParticles: ParticleEntity[];
  allMaterials: MaterialEntity[];
  allPrograms: ProgramEntity[];
}
