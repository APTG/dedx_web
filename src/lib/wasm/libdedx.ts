import type {
  LibdedxService,
  ProgramEntity,
  ParticleEntity,
  MaterialEntity,
  CalculationResult,
  AdvancedOptions,
} from "./types";
import { LibdedxError } from "./types";
import { getParticleAliases, getParticleSymbol } from "$lib/config/particle-aliases";
import { getMaterialFriendlyName } from "$lib/config/material-names";
import { getProgramFriendlyName } from "$lib/config/program-names";
import { getParticleFriendlyName } from "$lib/config/particle-names";

interface EmscriptenModule {
  // List functions — return pointer to sentinel-terminated int32 array of IDs
  _dedx_get_program_list(): number;
  _dedx_get_ion_list(program_id: number): number;
  _dedx_get_material_list(program_id: number): number;
  // Name/version lookups — return char*
  _dedx_get_program_name(program_id: number): number;
  _dedx_get_program_version(program_id: number): number;
  _dedx_get_ion_name(ion_id: number): number;
  _dedx_get_material_name(material_id: number): number;
  // Ion properties (dedx_extra.h — single-argument wrappers)
  _dedx_get_ion_nucleon_number(ion_id: number): number;
  _dedx_get_ion_atom_mass(ion_id: number): number;
  // Material properties
  _dedx_get_density(material_id: number, err_ptr: number): number;
  _dedx_target_is_gas(material_id: number): number;
  // Calculation
  _dedx_get_stp_table(
    program_id: number,
    particle_id: number,
    material_id: number,
    energies: number,
    num_energies: number,
    stp: number,
    csda: number,
  ): number;
  _dedx_get_csda_range_table(
    program_id: number,
    particle_id: number,
    material_id: number,
    energies: number,
    num_energies: number,
    csda: number,
  ): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number): string;
  HEAP32: Int32Array;
  HEAPF64: Float64Array;
}

/** Read a sentinel-terminated int32 array from WASM heap. Stops at 0 or negative. */
function readIdList(heap: Int32Array, ptr: number, maxLen = 600): number[] {
  if (ptr === 0) return [];
  const result: number[] = [];
  const idx0 = ptr >>> 2;
  for (let i = 0; i < maxLen; i++) {
    const v = heap[idx0 + i];
    if (v === undefined || v <= 0) break;
    result.push(v);
  }
  return result;
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
    const heap = this.module.HEAP32;

    // Programs
    const programIds = readIdList(heap, this.module._dedx_get_program_list());
    for (const id of programIds) {
      const rawProgramName = this.module.UTF8ToString(this.module._dedx_get_program_name(id));
      this.programs.push({
        id,
        name: getProgramFriendlyName(id, rawProgramName),
        version: this.module.UTF8ToString(this.module._dedx_get_program_version(id)),
      });
    }

    // Reuse a single errPtr allocation across all density reads
    const errPtr = this.module._malloc(4);
    try {
      for (const prog of this.programs) {
        // Ions for this program
        const ionIds = readIdList(heap, this.module._dedx_get_ion_list(prog.id));
        const particles: ParticleEntity[] = [];
        for (const id of ionIds) {
          const runtimeName = this.module.UTF8ToString(this.module._dedx_get_ion_name(id));
          // dedx_get_ion_name() returns ALL-CAPS ("HYDROGEN") or "" for electron (ID 1001).
          const name = getParticleFriendlyName(id, runtimeName);
          const symbol = getParticleSymbol(id);
          // libdedx does not currently expose aliases/symbols in the C API, so we enrich
          // runtime particles with static lookup data to keep UI labels and search behavior
          // aligned with the Stage 5 entity-selection specification.
          const aliases = Array.from(new Set([runtimeName, ...getParticleAliases(id)]));
          particles.push({
            id,
            name,
            massNumber: this.module._dedx_get_ion_nucleon_number(id),
            atomicMass: this.module._dedx_get_ion_atom_mass(id),
            symbol,
            aliases,
          });
        }
        this.particles.set(prog.id, particles);

        // Materials for this program
        const matIds = readIdList(heap, this.module._dedx_get_material_list(prog.id));
        const materials: MaterialEntity[] = [];
        for (const id of matIds) {
          const density = this.module._dedx_get_density(id, errPtr);
          const rawName = this.module.UTF8ToString(this.module._dedx_get_material_name(id));
          // dedx_get_material_name() returns ALL-CAPS names; apply human-friendly formatting.
          const name = getMaterialFriendlyName(id, rawName);
          materials.push({
            id,
            name,
            density,
            isGasByDefault: this.module._dedx_target_is_gas(id) !== 0,
          });
        }
        this.materials.set(prog.id, materials);
      }
    } finally {
      this.module._free(errPtr);
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
    _options?: AdvancedOptions,
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
        csdaPtr,
      );

      if (errorCode !== 0) {
        throw new LibdedxError(errorCode, "WASM calculation failed");
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
        csdaRanges,
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
    logScale: boolean,
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

export let libdedx: { service: LibdedxServiceImpl | null } = { service: null };

export function initLibdedx(module: EmscriptenModule): void {
  libdedx.service = new LibdedxServiceImpl(module);
}
