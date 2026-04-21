import type {
  LibdedxService,
  ProgramEntity,
  ParticleEntity,
  MaterialEntity,
  CalculationResult,
  AdvancedOptions
} from './types';
import { LibdedxError } from './types';

interface EmscriptenModule {
  _dedx_get_programs_list(): number;
  _dedx_get_particles_list(program_id: number): number;
  _dedx_get_materials_list(program_id: number): number;
  _dedx_get_stp_table(
    program_id: number,
    particle_id: number,
    material_id: number,
    energies: number,
    num_energies: number,
    stp: number,
    csda: number
  ): number;
  _dedx_get_csda_range_table(
    program_id: number,
    particle_id: number,
    material_id: number,
    energies: number,
    num_energies: number,
    csda: number
  ): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number): string;
  getHeapU32(): Uint32Array;
  getHeapF64(): Float64Array;
}

export class LibdedxServiceImpl implements LibdedxService {
  private module: EmscriptenModule;
  private programs: ProgramEntity[] = [];
  private particles: Map<number, ParticleEntity[]> = new Map();
  private materials: Map<number, MaterialEntity[]> = new Map();

  constructor(module: EmscriptenModule) {
    this.module = module;
  }

  async init(): Promise<void> {
    this.module._dedx_get_programs_list();
    const heapU32 = this.module.getHeapU32();

    let i = 0;
    while (heapU32[i] !== 0) {
      const id = heapU32[i];
      const namePtr = heapU32[i + 1];
      const versionPtr = heapU32[i + 2];
      this.programs.push({
        id: id ?? 0,
        name: this.module.UTF8ToString(namePtr),
        version: this.module.UTF8ToString(versionPtr)
      });
      i += 3;
    }

    for (const prog of this.programs) {
      const particlesPtr = this.module._dedx_get_particles_list(prog.id);
      const particles: ParticleEntity[] = [];
      let j = 0;
      while (heapU32[particlesPtr / 4 + j] !== 0) {
        const id = heapU32[particlesPtr / 4 + j];
        const namePtr = heapU32[particlesPtr / 4 + j + 1];
        const massNumber = heapU32[particlesPtr / 4 + j + 2];
        particles.push({
          id: id ?? 0,
          name: this.module.UTF8ToString(namePtr),
          massNumber: massNumber ?? 0,
          atomicMass: heapU32[particlesPtr / 4 + j + 3] ?? 0,
          aliases: []
        });
        j += 5;
      }
      this.particles.set(prog.id, particles);

      const materialsPtr = this.module._dedx_get_materials_list(prog.id);
      const materials: MaterialEntity[] = [];
      let k = 0;
      while (heapU32[materialsPtr / 4 + k] !== 0) {
        const id = heapU32[materialsPtr / 4 + k];
        const namePtr = heapU32[materialsPtr / 4 + k + 1];
        const density = heapU32[materialsPtr / 4 + k + 2];
        const isGasByDefault = heapU32[materialsPtr / 4 + k + 3] !== 0;
        materials.push({
          id: id ?? 0,
          name: this.module.UTF8ToString(namePtr),
          density: density ?? 0,
          isGasByDefault
        });
        k += 4;
      }
      this.materials.set(prog.id, materials);
    }
  }

  getPrograms(): ProgramEntity[] {
    return this.programs;
  }

  getParticles(programId: number): ParticleEntity[] {
    return this.particles.get(programId) || [];
  }

  getMaterials(programId: number): MaterialEntity[] {
    return this.materials.get(programId) || [];
  }

  calculate(
    programId: number,
    particleId: number,
    materialId: number,
    energies: number[],
    _options?: AdvancedOptions
  ): CalculationResult {
    const numEnergies = energies.length;
    const energiesPtr = this.module._malloc(numEnergies * 8);
    const stpPtr = this.module._malloc(numEnergies * 8);
    const csdaPtr = this.module._malloc(numEnergies * 8);

    try {
      const heapF64 = this.module.getHeapF64();
      for (let i = 0; i < numEnergies; i++) {
        heapF64[energiesPtr / 8 + i] = energies[i] ?? 0;
      }

      const errorCode = this.module._dedx_get_stp_table(
        programId,
        particleId,
        materialId,
        energiesPtr,
        numEnergies,
        stpPtr,
        csdaPtr
      );

      if (errorCode !== 0) {
        throw new LibdedxError(errorCode, 'WASM calculation failed');
      }

      const stoppingPowers: number[] = [];
      const csdaRanges: number[] = [];
      for (let i = 0; i < numEnergies; i++) {
        stoppingPowers.push(heapF64[stpPtr / 8 + i] ?? 0);
        csdaRanges.push(heapF64[csdaPtr / 8 + i] ?? 0);
      }

      return {
        energies: [...energies],
        stoppingPowers,
        csdaRanges
      };
    } finally {
      this.module._free(energiesPtr);
      this.module._free(stpPtr);
      this.module._free(csdaPtr);
    }
  }

  getPlotData(
    programId: number,
    particleId: number,
    materialId: number,
    numPoints: number,
    logScale: boolean
  ): CalculationResult {
    const minEnergy = 0.001;
    const maxEnergy = 1000;
    const energies: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const energy = logScale
        ? Math.pow(maxEnergy / minEnergy, t) * minEnergy
        : minEnergy + t * (maxEnergy - minEnergy);
      energies.push(energy);
    }

    return this.calculate(programId, particleId, materialId, energies);
  }
}
