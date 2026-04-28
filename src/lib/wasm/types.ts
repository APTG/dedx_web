export type EnergyUnit = 'MeV' | 'MeV/nucl' | 'MeV/u';
export type StpUnit = 'MeV·cm²/g' | 'MeV/cm' | 'keV/µm';
export type RangeUnit = 'g/cm²' | 'cm';

export interface LibdedxEntity {
  id: number;
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
  atomicNumber?: number;
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

export type AggregateState = 'gas' | 'condensed';
export type MstarMode = 'a' | 'b' | 'c' | 'd' | 'g' | 'h';
export type InterpolationScale = 'linear' | 'log';
export type InterpolationMethod = 'linear' | 'cubic';

export interface AdvancedOptions {
  aggregateState?: AggregateState;
  interpolation?: {
    scale: InterpolationScale;
    method: InterpolationMethod;
  };
  mstarMode?: MstarMode;
  densityOverride?: number;
  iValueOverride?: number;
}

export interface CompoundElement {
  atomicNumber: number;
  fraction: number;
  type: 'atomic' | 'weight';
}

export interface CustomCompound {
  name: string;
  elements: CompoundElement[];
  density: number;
  iValue?: number;
}

export interface StoredCompound extends CustomCompound {
  uuid: string;
  phase: 'gas' | 'condensed';
  timestamp: number;
}

export class LibdedxError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'LibdedxError';
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
    options?: AdvancedOptions
  ): CalculationResult;
  getPlotData(
    programId: number,
    particleId: number,
    materialId: number,
    numPoints: number,
    logScale: boolean
  ): CalculationResult;
  getMinEnergy(programId: number, particleId: number): number;
  getMaxEnergy(programId: number, particleId: number): number;
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
