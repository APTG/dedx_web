import type {
  LibdedxService,
  ProgramEntity,
  ParticleEntity,
  MaterialEntity,
  CalculationResult,
  AdvancedOptions,
  InverseStpResult,
  InverseCsdaResult,
  EnergyUnit,
  CompoundElement,
} from "../types";
import { LibdedxError } from "../types";

const mockPrograms: ProgramEntity[] = [
  { id: 1, name: "ASTAR", version: "1.0" },
  { id: 2, name: "PSTAR", version: "1.0" },
  { id: 4, name: "MSTAR", version: "1.0" },
];

const mockParticles: Map<number, ParticleEntity[]> = new Map([
  [
    1,
    [
      {
        id: 2,
        name: "Helium",
        massNumber: 4,
        atomicMass: 4.002,
        symbol: "He",
        aliases: ["alpha", "α", "He-4"],
      },
    ],
  ],
  [
    2,
    [
      {
        id: 1,
        name: "Hydrogen",
        massNumber: 1,
        atomicMass: 1.007,
        symbol: "H",
        aliases: ["proton", "p", "H-1"],
      },
    ],
  ],
  [
    4,
    [
      {
        id: 1,
        name: "Hydrogen",
        massNumber: 1,
        atomicMass: 1.007,
        symbol: "H",
        aliases: ["proton", "p", "H-1"],
      },
      {
        id: 2,
        name: "Helium",
        massNumber: 4,
        atomicMass: 4.002,
        symbol: "He",
        aliases: ["alpha", "α", "He-4"],
      },
      { id: 6, name: "Carbon", massNumber: 12, atomicMass: 12.011, symbol: "C", aliases: ["C-12"] },
    ],
  ],
]);

const mockMaterials: Map<number, MaterialEntity[]> = new Map([
  [1, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
  [2, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
  [
    4,
    [
      { id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false },
      { id: 267, name: "Air", density: 0.0012, isGasByDefault: true },
    ],
  ],
]);

export class LibdedxServiceImpl implements LibdedxService {
  async init(): Promise<void> {}

  getPrograms(): ProgramEntity[] {
    return mockPrograms;
  }

  getParticles(programId: number): ParticleEntity[] {
    return mockParticles.get(programId) || [];
  }

  getMaterials(programId: number): MaterialEntity[] {
    return mockMaterials.get(programId) || [];
  }

  calculate(
    programId: number,
    _particleId: number,
    _materialId: number,
    energies: number[],
    _options?: AdvancedOptions,
  ): CalculationResult {
    // Simulate error for unknown program IDs
    if (!mockPrograms.some((p) => p.id === programId)) {
      throw new LibdedxError(-1, `Unknown program ID: ${programId}`);
    }
    return {
      energies,
      stoppingPowers: energies.map((e) => Math.log(e + 1)),
      csdaRanges: energies.map((e) => Math.pow(e, 1.5)),
    };
  }

  calculateMulti({
    programIds,
    particleId,
    materialId,
    energies,
  }: {
    programIds: number[];
    particleId: number;
    materialId: number;
    energies: number[];
    options?: AdvancedOptions;
  }): Map<number, CalculationResult | LibdedxError> {
    const results = new Map<number, CalculationResult | LibdedxError>();
    for (const programId of programIds) {
      try {
        results.set(programId, this.calculate(programId, particleId, materialId, energies));
      } catch (e) {
        results.set(programId, e instanceof LibdedxError ? e : new LibdedxError(-1, String(e)));
      }
    }
    return results;
  }

  getPlotData(
    programId: number,
    particleId: number,
    materialId: number,
    numPoints: number,
    logScale: boolean,
    _options?: AdvancedOptions,
  ): CalculationResult {
    const energies = Array.from({ length: numPoints }, (_, i) =>
      logScale ? Math.exp(i * 0.1) : (i + 1) * 10,
    );
    return this.calculate(programId, particleId, materialId, energies);
  }

  getMinEnergy(_programId: number, _particleId: number): number {
    return 0.001;
  }

  getMaxEnergy(_programId: number, _particleId: number): number {
    return 1000;
  }

  getInverseStp(params: {
    programId: number;
    particleId: number;
    materialId: number;
    stoppingPowers: number[];
    side: 0 | 1;
    options?: AdvancedOptions;
  }): (InverseStpResult | LibdedxError)[] {
    return params.stoppingPowers.map((stp) => ({
      energy: params.side === 0 ? stp * 2 : stp * 10,
      stoppingPower: stp,
    }));
  }

  getInverseCsda(params: {
    programId: number;
    particleId: number;
    materialId: number;
    ranges: number[];
    options?: AdvancedOptions;
  }): (InverseCsdaResult | LibdedxError)[] {
    return params.ranges.map((r) => ({ energy: r * 13, csdaRange: r }));
  }

  getBraggPeakStp(_params: {
    programId: number;
    particleId: number;
    materialId: number;
    options?: AdvancedOptions;
  }): number {
    return 80.0;
  }

  getDensity(_materialId: number): number {
    return 1.0;
  }

  convertEnergy(params: {
    fromUnit: EnergyUnit;
    toUnit: EnergyUnit;
    massNumber: number;
    atomicMass: number;
    values: number[];
  }): number[] {
    return params.values;
  }

  calculateCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    energies: number[];
  }): CalculationResult {
    const energies: number[] = [];
    return {
      energies,
      stoppingPowers: [],
      csdaRanges: [],
    };
  }

  getInverseStpCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    stoppingPowers: number[];
    side: 0 | 1;
  }): (InverseStpResult | LibdedxError)[] {
    return [];
  }

  getInverseCsdaCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    ranges: number[];
  }): (InverseCsdaResult | LibdedxError)[] {
    return [];
  }

  getBraggPeakStpCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
  }): number {
    return 80.0;
  }
}

export class MockLibdedxServiceWithElectron implements LibdedxService {
  async init(): Promise<void> {}

  getPrograms(): ProgramEntity[] {
    return [
      { id: 2, name: "PSTAR", version: "1.0" },
      { id: 3, name: "ESTAR", version: "1.0" },
      { id: 4, name: "MSTAR", version: "1.0" },
    ];
  }

  getParticles(programId: number): ParticleEntity[] {
    if (programId === 3 || programId === 4) {
      return [
        {
          id: 1001,
          name: "Electron",
          massNumber: 0,
          atomicMass: 0.000548,
          symbol: "e⁻",
          aliases: ["e⁻", "e-", "beta"],
        },
        {
          id: 1,
          name: "Hydrogen",
          massNumber: 1,
          atomicMass: 1.007,
          symbol: "H",
          aliases: ["proton"],
        },
        {
          id: 2,
          name: "Helium",
          massNumber: 4,
          atomicMass: 4.002,
          symbol: "He",
          aliases: ["alpha", "α", "He-4"],
        },
        {
          id: 6,
          name: "Carbon",
          massNumber: 12,
          atomicMass: 12.011,
          symbol: "C",
          aliases: ["C-12"],
        },
      ];
    }
    if (programId === 2) {
      return [
        {
          id: 1,
          name: "Hydrogen",
          massNumber: 1,
          atomicMass: 1.007,
          symbol: "H",
          aliases: ["proton"],
        },
      ];
    }
    return [];
  }

  getMaterials(_programId: number): MaterialEntity[] {
    return [
      { id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false },
      { id: 267, name: "Air", density: 0.0012, isGasByDefault: true },
    ];
  }

  calculate(
    programId: number,
    _particleId: number,
    _materialId: number,
    energies: number[],
    _options?: AdvancedOptions,
  ): CalculationResult {
    const knownPrograms = [2, 3, 4]; // PSTAR, ESTAR, MSTAR
    if (!knownPrograms.includes(programId)) {
      throw new LibdedxError(-1, `Unknown program ID: ${programId}`);
    }
    return {
      energies,
      stoppingPowers: energies.map((e) => Math.log(e + 1)),
      csdaRanges: energies.map((e) => Math.pow(e, 1.5)),
    };
  }

  calculateMulti({
    programIds,
    particleId,
    materialId,
    energies,
  }: {
    programIds: number[];
    particleId: number;
    materialId: number;
    energies: number[];
    options?: AdvancedOptions;
  }): Map<number, CalculationResult | LibdedxError> {
    const results = new Map<number, CalculationResult | LibdedxError>();
    for (const programId of programIds) {
      try {
        results.set(programId, this.calculate(programId, particleId, materialId, energies));
      } catch (e) {
        results.set(programId, e instanceof LibdedxError ? e : new LibdedxError(-1, String(e)));
      }
    }
    return results;
  }

  getPlotData(
    programId: number,
    particleId: number,
    materialId: number,
    numPoints: number,
    logScale: boolean,
    _options?: AdvancedOptions,
  ): CalculationResult {
    const energies = Array.from({ length: numPoints }, (_, i) =>
      logScale ? Math.exp(i * 0.1) : (i + 1) * 10,
    );
    return this.calculate(programId, particleId, materialId, energies);
  }

  getMinEnergy(_programId: number, _particleId: number): number {
    return 0.001;
  }

  getMaxEnergy(_programId: number, _particleId: number): number {
    return 1000;
  }

  getInverseStp(params: {
    programId: number;
    particleId: number;
    materialId: number;
    stoppingPowers: number[];
    side: 0 | 1;
    options?: AdvancedOptions;
  }): (InverseStpResult | LibdedxError)[] {
    return params.stoppingPowers.map((stp) => ({
      energy: params.side === 0 ? stp * 2 : stp * 10,
      stoppingPower: stp,
    }));
  }

  getInverseCsda(params: {
    programId: number;
    particleId: number;
    materialId: number;
    ranges: number[];
    options?: AdvancedOptions;
  }): (InverseCsdaResult | LibdedxError)[] {
    return params.ranges.map((r) => ({ energy: r * 13, csdaRange: r }));
  }

  getBraggPeakStp(_params: {
    programId: number;
    particleId: number;
    materialId: number;
    options?: AdvancedOptions;
  }): number {
    return 80.0;
  }

  getDensity(_materialId: number): number {
    return 1.0;
  }

  convertEnergy(params: {
    fromUnit: EnergyUnit;
    toUnit: EnergyUnit;
    massNumber: number;
    atomicMass: number;
    values: number[];
  }): number[] {
    return params.values;
  }

  calculateCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    energies: number[];
  }): CalculationResult {
    const energies: number[] = [];
    return {
      energies,
      stoppingPowers: [],
      csdaRanges: [],
    };
  }

  getInverseStpCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    stoppingPowers: number[];
    side: 0 | 1;
  }): (InverseStpResult | LibdedxError)[] {
    return [];
  }

  getInverseCsdaCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    ranges: number[];
  }): (InverseCsdaResult | LibdedxError)[] {
    return [];
  }

  getBraggPeakStpCustomCompound(_params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
  }): number {
    return 80.0;
  }
}
