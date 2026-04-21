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
  [1, [{ id: 1, name: 'Proton', massNumber: 1, atomicMass: 1.007, aliases: ['p', 'H+'] }]],
  [2, [{ id: 2, name: 'Alpha', massNumber: 4, atomicMass: 4.002, aliases: ['α', 'He2+'] }]],
  [3, [{ id: 3, name: 'Deuteron', massNumber: 2, atomicMass: 2.014, aliases: ['d', 'D+'] }]]
]);

const mockMaterials: Map<number, MaterialEntity[]> = new Map([
  [1, [{ id: 1, name: 'Water', density: 1.0, isGasByDefault: false }]],
  [2, [{ id: 2, name: 'Air', density: 0.0012, isGasByDefault: true }]],
  [3, [{ id: 3, name: 'Aluminum', density: 2.7, isGasByDefault: false }]]
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
      logScale ? Math.exp(i * 0.1) : i * 10
    );
    return this.calculate(programId, particleId, materialId, energies);
  }
}
