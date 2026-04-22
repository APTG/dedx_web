import type {
  LibdedxService,
  ProgramEntity,
  ParticleEntity,
  MaterialEntity,
  CalculationResult
} from '../types';

const mockPrograms: ProgramEntity[] = [
  { id: 1, name: 'PSTAR', version: '1.0' },
  { id: 2, name: 'ASTAR', version: '1.0' },
  { id: 3, name: 'MSTAR', version: '1.0' }
];

const mockParticles: Map<number, ParticleEntity[]> = new Map([
  [1, [{ id: 1, name: 'Hydrogen', massNumber: 1, atomicMass: 1.007, symbol: 'H', aliases: ['proton', 'p', 'H-1'] }]],
  [2, [{ id: 2, name: 'Helium', massNumber: 4, atomicMass: 4.002, symbol: 'He', aliases: ['alpha', 'α', 'He-4'] }]],
  [3, [
    { id: 1, name: 'Hydrogen', massNumber: 1, atomicMass: 1.007, symbol: 'H', aliases: ['proton', 'p', 'H-1'] },
    { id: 2, name: 'Helium', massNumber: 4, atomicMass: 4.002, symbol: 'He', aliases: ['alpha', 'α', 'He-4'] },
    { id: 6, name: 'Carbon', massNumber: 12, atomicMass: 12.011, symbol: 'C', aliases: ['C-12'] }
  ]]
]);

const mockMaterials: Map<number, MaterialEntity[]> = new Map([
  [1, [{ id: 276, name: 'Water (liquid)', density: 1.0, isGasByDefault: false, atomicNumber: 1 }]],
  [2, [{ id: 267, name: 'Air', density: 0.0012, isGasByDefault: true, atomicNumber: 1 }]],
  [3, [
    { id: 276, name: 'Water (liquid)', density: 1.0, isGasByDefault: false, atomicNumber: 1 },
    { id: 267, name: 'Air', density: 0.0012, isGasByDefault: true, atomicNumber: 1 }
  ]]
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
    particleId: number,
    materialId: number,
    energies: number[]
  ): CalculationResult {
    return {
      energies,
      stoppingPowers: energies.map((e) => Math.log(e + 1)),
      csdaRanges: energies.map((e) => Math.pow(e, 1.5))
    };
  }

  getPlotData(
    programId: number,
    particleId: number,
    materialId: number,
    numPoints: number,
    logScale: boolean
  ): CalculationResult {
    const energies = Array.from({ length: numPoints }, (_, i) =>
      logScale ? Math.exp(i * 0.1) : (i + 1) * 10
    );
    return this.calculate(programId, particleId, materialId, energies);
  }
}
