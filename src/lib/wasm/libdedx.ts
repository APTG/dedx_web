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
  _dedx_get_ion_atom_mass(ion_id: number, err_ptr: number): number;
  _dedx_get_density(material_id: number, err_ptr: number): number;
  _dedx_target_is_gas(material_id: number): number;
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
  HEAP32: Int32Array;
  HEAPF64: Float64Array;
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
    const heapI32 = this.module.HEAP32;
    const programsPtr = this.module._dedx_get_programs_list();

    let i = programsPtr / 4;
    while (heapI32[i] !== 0) {
      const id = heapI32[i] ?? 0;
      const namePtr = heapI32[i + 1] ?? 0;
      const versionPtr = heapI32[i + 2] ?? 0;
      this.programs.push({
        id,
        name: this.module.UTF8ToString(namePtr),
        version: this.module.UTF8ToString(versionPtr)
      });
      i += 3;
    }

    for (const prog of this.programs) {
      const particlesPtr = this.module._dedx_get_particles_list(prog.id);
      const particles: ParticleEntity[] = [];
      let j = particlesPtr / 4;
      while (heapI32[j] !== 0) {
        const id = heapI32[j] ?? 0;
        const namePtr = heapI32[j + 1] ?? 0;
        const massNumber = heapI32[j + 2] ?? 0;
        particles.push({
          id,
          name: this.module.UTF8ToString(namePtr),
          massNumber,
          atomicMass: this.module._dedx_get_ion_atom_mass(id, 0),
          aliases: []
        });
        j += 5;
      }
      this.particles.set(prog.id, particles);

      const materialsPtr = this.module._dedx_get_materials_list(prog.id);
      const materials: MaterialEntity[] = [];
      let k = materialsPtr / 4;
      while (heapI32[k] !== 0) {
        const id = heapI32[k] ?? 0;
        const namePtr = heapI32[k + 1] ?? 0;
        const density = this.module._dedx_get_density(id, 0);
        const isGasByDefault = this.module._dedx_target_is_gas(id) !== 0;
        materials.push({
          id,
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
      const heapF64 = this.module.HEAPF64;
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
