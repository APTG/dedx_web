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
} from "./types.js";
import { LibdedxError } from "./types.js";
import { getParticleAliases, getParticleSymbol } from "$lib/config/particle-aliases.js";
import { getMaterialFriendlyName } from "$lib/config/material-names.js";
import { getProgramFriendlyName } from "$lib/config/program-names.js";
import { getParticleFriendlyName } from "$lib/config/particle-names.js";
import { integrateCsdaFromStp } from "$lib/utils/csda-integration.js";
import { convertEnergyFromMeVperNucl } from "$lib/utils/energy-conversions.js";

type RuntimeProgramEntity = ProgramEntity & { id: number };

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
    num_energies: number,
    energies: number,
    stp: number,
  ): number;
  _dedx_get_csda_range_table(
    program_id: number,
    particle_id: number,
    material_id: number,
    num_energies: number,
    energies: number,
    csda: number,
  ): number;
  _dedx_get_min_energy(program_id: number, ion_id: number): number;
  _dedx_get_max_energy(program_id: number, ion_id: number): number;
  // Inverse lookup flat wrappers (manage workspace/config internally)
  _dedx_get_inverse_stp_flat(
    program_id: number,
    particle_id: number,
    material_id: number,
    stopping_power: number,
    side: number,
    err_ptr: number,
  ): number;
  _dedx_get_inverse_csda_flat(
    program_id: number,
    particle_id: number,
    material_id: number,
    range: number,
    err_ptr: number,
  ): number;
  _dedx_get_bragg_peak_stp(
    program_id: number,
    particle_id: number,
    material_id: number,
    err_ptr: number,
  ): number;
  /* Custom compound wrappers */
  _dedx_calculate_custom_forward_flat(
    program_id: number,
    ion_id: number,
    elements_id: number,
    elements_atoms: number,
    n_elements: number,
    density: number,
    iValue: number,
    energies: number,
    stp_out: number,
    csda_out: number,
    n_energies: number,
    err_ptr: number,
  ): number;
  _dedx_get_inverse_stp_custom_compound_flat(
    program_id: number,
    ion_id: number,
    elements_id: number,
    elements_atoms: number,
    n_elements: number,
    density: number,
    iValue: number,
    stopping_power: number,
    side: number,
    err_ptr: number,
  ): number;
  _dedx_get_inverse_csda_custom_compound_flat(
    program_id: number,
    ion_id: number,
    elements_id: number,
    elements_atoms: number,
    n_elements: number,
    density: number,
    iValue: number,
    range: number,
    err_ptr: number,
  ): number;
  _dedx_get_bragg_peak_stp_custom_compound(
    program_id: number,
    ion_id: number,
    elements_id: number,
    elements_atoms: number,
    n_elements: number,
    density: number,
    iValue: number,
    err_ptr: number,
  ): number;
  /* Internal custom compound helpers */
  _dedx_internal_setup_custom_compound(
    cfg_ptr: number,
    program_id: number,
    ion_id: number,
    elements_id: number,
    elements_atoms: number,
    n_elements: number,
    density: number,
    iValue: number,
    err_ptr: number,
  ): number;
  _dedx_internal_cleanup_custom_compound(cfg_ptr: number, err_ptr: number): void;
  _malloc(size: number): number;
  _free(ptr: number): void;
  UTF8ToString(ptr: number): string;
  HEAP32: Int32Array;
  HEAPF32: Float32Array;
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
  private programs: RuntimeProgramEntity[] = [];
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
    options?: AdvancedOptions,
  ): CalculationResult {
    const numEnergies = energies.length;

    // Check if spline interpolation method is active (requires JS-side CSDA integration)
    const useJsCsda = options?.interpolation?.method === "cubic";

    // energies and STP are float (4 bytes each) in the C API.
    // CSDA ranges are double (8 bytes each).
    const energiesPtr = this.module._malloc(numEnergies * 4);
    const stpPtr = this.module._malloc(numEnergies * 4);
    const csdaPtr = useJsCsda ? 0 : this.module._malloc(numEnergies * 8);

    try {
      const heapF32 = this.module.HEAPF32;
      const heapF64 = this.module.HEAPF64;

      // Write inputs and zero-initialise output buffers.
      for (let i = 0; i < numEnergies; i++) {
        heapF32[energiesPtr / 4 + i] = energies[i] ?? 0; // float*
        heapF32[stpPtr / 4 + i] = 0; // float* (zeroed)
        if (!useJsCsda) {
          heapF64[csdaPtr / 8 + i] = 0; // double* (zeroed)
        }
      }

      // Call 1: stopping powers (6 args: program, ion, target, n, energies*, stps*)
      const stpErr = this.module._dedx_get_stp_table(
        programId,
        particleId,
        materialId,
        numEnergies,
        energiesPtr,
        stpPtr,
      );
      if (stpErr !== 0) {
        throw new LibdedxError(stpErr, "WASM STP calculation failed");
      }

      // Call 2: CSDA ranges (6 args: program, ion, target, n, energies*, csda*)
      // Skip this call when using JS-side CSDA integration (spline mode)
      let csdaErr = 0;
      if (!useJsCsda) {
        csdaErr = this.module._dedx_get_csda_range_table(
          programId,
          particleId,
          materialId,
          numEnergies,
          energiesPtr,
          csdaPtr,
        );
        if (csdaErr !== 0) {
          throw new LibdedxError(csdaErr, "WASM CSDA calculation failed");
        }
      }

      const stoppingPowers: number[] = [];
      const csdaRanges: number[] = [];

      if (useJsCsda) {
        // JS-side CSDA integration for spline mode
        // Read STP values from WASM heap
        const stpValues = new Float32Array(numEnergies);
        for (let i = 0; i < numEnergies; i++) {
          stpValues[i] = heapF32[stpPtr / 4 + i] ?? 0;
        }

        // Read energy values from WASM heap
        const energyValues = new Float32Array(numEnergies);
        for (let i = 0; i < numEnergies; i++) {
          energyValues[i] = heapF32[energiesPtr / 4 + i] ?? 0;
        }

        // Get density for integration (density parameter is not used for mass stopping power integration)
        const material = this.materials.get(programId)?.find((m) => m.id === materialId);
        const density = material?.density ?? 1.0;

        // Perform JS-side CSDA integration
        const csdaResult = integrateCsdaFromStp(energyValues, stpValues, density);

        for (let i = 0; i < numEnergies; i++) {
          const stpMass = stpValues[i]!;
          const csdaGcm2 = csdaResult[i]!;

          // Subnormal / non-finite guard — log and continue rather than throw.
          if (
            !Number.isFinite(stpMass) ||
            (Math.abs(stpMass) > 0 && Math.abs(stpMass) < Number.MIN_VALUE * 1e10)
          ) {
            console.warn("[dedx] subnormal/invalid WASM output (stopping power)", {
              programId,
              particleId,
              materialId,
              energyMevNucl: energies[i],
              rawValue: stpMass,
            });
          }
          if (
            !Number.isFinite(csdaGcm2) ||
            (Math.abs(csdaGcm2) > 0 && Math.abs(csdaGcm2) < Number.MIN_VALUE * 1e10)
          ) {
            console.warn("[dedx] subnormal/invalid JS CSDA integration", {
              programId,
              particleId,
              materialId,
              energyMevNucl: energies[i],
              rawValue: csdaGcm2,
            });
          }

          stoppingPowers.push(stpMass);
          csdaRanges.push(csdaGcm2);
        }
      } else {
        // WASM-based CSDA calculation (linear interpolation mode)
        for (let i = 0; i < numEnergies; i++) {
          const stpMass = heapF32[stpPtr / 4 + i] ?? 0; // read float
          const csdaGcm2 = heapF64[csdaPtr / 8 + i] ?? 0; // read double

          // Subnormal / non-finite guard — log and continue rather than throw.
          if (
            !Number.isFinite(stpMass) ||
            (Math.abs(stpMass) > 0 && Math.abs(stpMass) < Number.MIN_VALUE * 1e10)
          ) {
            console.warn("[dedx] subnormal/invalid WASM output (stopping power)", {
              programId,
              particleId,
              materialId,
              energyMevNucl: energies[i],
              rawValue: stpMass,
            });
          }
          if (
            !Number.isFinite(csdaGcm2) ||
            (Math.abs(csdaGcm2) > 0 && Math.abs(csdaGcm2) < Number.MIN_VALUE * 1e10)
          ) {
            console.warn("[dedx] subnormal/invalid WASM output (CSDA range)", {
              programId,
              particleId,
              materialId,
              energyMevNucl: energies[i],
              rawValue: csdaGcm2,
            });
          }

          stoppingPowers.push(stpMass);
          csdaRanges.push(csdaGcm2);
        }
      }

      return {
        energies: [...energies],
        stoppingPowers,
        csdaRanges,
      };
    } finally {
      this.module._free(energiesPtr);
      this.module._free(stpPtr);
      if (csdaPtr !== 0) {
        this.module._free(csdaPtr);
      }
    }
  }

  calculateMulti({
    programIds,
    particleId,
    materialId,
    energies,
    options,
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
        results.set(
          programId,
          this.calculate(programId, particleId, materialId, energies, options),
        );
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
    options?: AdvancedOptions,
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

    return this.calculate(programId, particleId, materialId, energies, options);
  }

  getPlotDataCustomCompound({
    programId,
    particleId,
    elements,
    density,
    iValue,
    numPoints,
    logScale,
  }: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    numPoints: number;
    logScale: boolean;
  }): CalculationResult {
    const minEnergy = 0.001;
    const maxEnergy = 1000;
    const energies: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      energies.push(
        logScale
          ? Math.pow(maxEnergy / minEnergy, t) * minEnergy
          : minEnergy + t * (maxEnergy - minEnergy),
      );
    }

    const params = {
      programId,
      particleId,
      elements,
      density,
      energies,
    };
    return this.calculateCustomCompound(
      iValue === undefined ? params : { ...params, iValue },
    );
  }

  getMinEnergy(programId: number, particleId: number): number {
    return this.module._dedx_get_min_energy(programId, particleId);
  }

  getMaxEnergy(programId: number, particleId: number): number {
    return this.module._dedx_get_max_energy(programId, particleId);
  }

  getInverseStp(params: {
    programId: number;
    particleId: number;
    materialId: number;
    stoppingPowers: number[];
    side: 0 | 1;
    options?: AdvancedOptions;
  }): (InverseStpResult | LibdedxError)[] {
    const { programId, particleId, materialId, stoppingPowers, side } = params;
    const results: (InverseStpResult | LibdedxError)[] = [];

    // Allocate error pointer once and reuse for all calls
    const errPtr = this.module._malloc(4);

    try {
      for (const stp of stoppingPowers) {
        this.module.HEAP32[errPtr >>> 2] = 0;
        const energy = this.module._dedx_get_inverse_stp_flat(
          programId,
          particleId,
          materialId,
          stp,
          side,
          errPtr,
        );

        const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
        if (errCode !== 0) {
          results.push(new LibdedxError(errCode, `Inverse STP lookup failed for stp=${stp}`));
        } else {
          results.push({ energy, stoppingPower: stp });
        }
      }
    } finally {
      this.module._free(errPtr);
    }

    return results;
  }

  getInverseCsda(params: {
    programId: number;
    particleId: number;
    materialId: number;
    ranges: number[];
    options?: AdvancedOptions;
  }): (InverseCsdaResult | LibdedxError)[] {
    const { programId, particleId, materialId, ranges } = params;
    const results: (InverseCsdaResult | LibdedxError)[] = [];

    // Allocate error pointer once and reuse for all calls
    const errPtr = this.module._malloc(4);

    try {
      for (const range of ranges) {
        this.module.HEAP32[errPtr >>> 2] = 0;
        const energy = this.module._dedx_get_inverse_csda_flat(
          programId,
          particleId,
          materialId,
          range,
          errPtr,
        );

        const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
        if (errCode !== 0) {
          results.push(new LibdedxError(errCode, `Inverse CSDA lookup failed for range=${range}`));
        } else if (energy < 0) {
          results.push(
            new LibdedxError(
              -1,
              `Inverse CSDA returned invalid energy ${energy} for range=${range}`,
            ),
          );
        } else {
          results.push({ energy, csdaRange: range });
        }
      }
    } finally {
      this.module._free(errPtr);
    }

    return results;
  }

  getBraggPeakStp(params: {
    programId: number;
    particleId: number;
    materialId: number;
    options?: AdvancedOptions;
  }): number {
    const { programId, particleId, materialId } = params;
    const errPtr = this.module._malloc(4);

    try {
      const braggPeakStp = this.module._dedx_get_bragg_peak_stp(
        programId,
        particleId,
        materialId,
        errPtr,
      );

      const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
      if (errCode !== 0) {
        throw new LibdedxError(errCode, "Bragg peak STP lookup failed");
      }

      return braggPeakStp;
    } finally {
      this.module._free(errPtr);
    }
  }

  getDensity(materialId: number): number | undefined {
    const errPtr = this.module._malloc(4);

    try {
      const density = this.module._dedx_get_density(materialId, errPtr);
      const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
      if (errCode !== 0) {
        return undefined;
      }
      return density;
    } finally {
      this.module._free(errPtr);
    }
  }

  convertEnergy(params: {
    fromUnit: EnergyUnit;
    toUnit: EnergyUnit;
    massNumber: number;
    atomicMass: number;
    values: number[];
  }): number[] {
    const { fromUnit, toUnit, massNumber, atomicMass, values } = params;

    return values.map((value) => {
      // First convert from source unit to MeV/nucl as intermediate
      let valueInMeVperNucl: number;

      if (fromUnit === "MeV/nucl") {
        valueInMeVperNucl = value;
      } else if (fromUnit === "MeV/u") {
        // MeV/u to MeV/nucl: multiply by atomicMass/massNumber
        valueInMeVperNucl = (value * atomicMass) / massNumber;
      } else {
        // MeV (total) to MeV/nucl: divide by massNumber
        valueInMeVperNucl = value / massNumber;
      }

      // Then convert from MeV/nucl to target unit
      if (toUnit === "MeV/nucl") {
        return valueInMeVperNucl;
      } else if (toUnit === "MeV/u") {
        return convertEnergyFromMeVperNucl(valueInMeVperNucl, "MeV/u", massNumber, atomicMass);
      } else {
        // toUnit === "MeV" (total energy)
        return convertEnergyFromMeVperNucl(valueInMeVperNucl, "MeV", massNumber, atomicMass);
      }
    });
  }

  private prepareCompoundElements(elements: CompoundElement[]): {
    idsPtr: number;
    atomsPtr: number;
    nElements: number;
  } {
    const nElements = elements.length;
    const idsPtr = this.module._malloc(nElements * 4); // int32
    const atomsPtr = this.module._malloc(nElements * 8); // float64

    const heap32 = this.module.HEAP32;
    const heap64 = this.module.HEAPF64;

    for (let i = 0; i < nElements; i++) {
      heap32[(idsPtr >>> 2) + i] = elements[i]!.atomicNumber;
      heap64[(atomsPtr >>> 3) + i] = elements[i]!.fraction;
    }

    return { idsPtr, atomsPtr, nElements };
  }

  calculateCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    energies: number[];
  }): CalculationResult {
    const { programId, particleId, elements, density, iValue = 0.0, energies } = params;
    const nEnergies = energies.length;

    const { idsPtr, atomsPtr, nElements } = this.prepareCompoundElements(elements);

    const energiesPtr = this.module._malloc(nEnergies * 8);
    const stpPtr = this.module._malloc(nEnergies * 8);
    const csdaPtr = this.module._malloc(nEnergies * 8);
    const errPtr = this.module._malloc(4);

    try {
      const heapF64 = this.module.HEAPF64;

      for (let i = 0; i < nEnergies; i++) {
        heapF64[(energiesPtr >>> 3) + i] = energies[i]!;
      }

      const err = this.module._dedx_calculate_custom_forward_flat(
        programId,
        particleId,
        idsPtr,
        atomsPtr,
        nElements,
        density,
        iValue,
        energiesPtr,
        stpPtr,
        csdaPtr,
        nEnergies,
        errPtr,
      );

      const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
      if (err !== 0 || errCode !== 0) {
        throw new LibdedxError(errCode || err, "Custom compound forward calculation failed");
      }

      const stoppingPowers: number[] = [];
      const csdaRanges: number[] = [];

      for (let i = 0; i < nEnergies; i++) {
        stoppingPowers.push(heapF64[(stpPtr >>> 3) + i]!);
        csdaRanges.push(heapF64[(csdaPtr >>> 3) + i]!);
      }

      return {
        energies: [...energies],
        stoppingPowers,
        csdaRanges,
      };
    } finally {
      this.module._free(idsPtr);
      this.module._free(atomsPtr);
      this.module._free(energiesPtr);
      this.module._free(stpPtr);
      this.module._free(csdaPtr);
      this.module._free(errPtr);
    }
  }

  getInverseStpCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    stoppingPowers: number[];
    side: 0 | 1;
  }): (InverseStpResult | LibdedxError)[] {
    const { programId, particleId, elements, density, iValue = 0.0, stoppingPowers, side } = params;
    const results: (InverseStpResult | LibdedxError)[] = [];

    const { idsPtr, atomsPtr, nElements } = this.prepareCompoundElements(elements);
    const errPtr = this.module._malloc(4);

    try {
      for (const stp of stoppingPowers) {
        this.module.HEAP32[errPtr >>> 2] = 0;

        const energy = this.module._dedx_get_inverse_stp_custom_compound_flat(
          programId,
          particleId,
          idsPtr,
          atomsPtr,
          nElements,
          density,
          iValue,
          stp,
          side,
          errPtr,
        );

        const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
        if (errCode !== 0 || energy < 0) {
          results.push(
            new LibdedxError(
              errCode,
              `Inverse STP lookup failed for stp=${stp} (energy=${energy})`,
            ),
          );
        } else {
          results.push({ energy, stoppingPower: stp });
        }
      }
    } finally {
      this.module._free(idsPtr);
      this.module._free(atomsPtr);
      this.module._free(errPtr);
    }

    return results;
  }

  getInverseCsdaCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
    ranges: number[];
  }): (InverseCsdaResult | LibdedxError)[] {
    const { programId, particleId, elements, density, iValue = 0.0, ranges } = params;
    const results: (InverseCsdaResult | LibdedxError)[] = [];

    const { idsPtr, atomsPtr, nElements } = this.prepareCompoundElements(elements);
    const errPtr = this.module._malloc(4);

    try {
      for (const range of ranges) {
        this.module.HEAP32[errPtr >>> 2] = 0;

        const energy = this.module._dedx_get_inverse_csda_custom_compound_flat(
          programId,
          particleId,
          idsPtr,
          atomsPtr,
          nElements,
          density,
          iValue,
          range,
          errPtr,
        );

        const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
        if (errCode !== 0 || energy < 0) {
          results.push(
            new LibdedxError(
              errCode,
              `Inverse CSDA lookup failed for range=${range} (energy=${energy})`,
            ),
          );
        } else {
          results.push({ energy, csdaRange: range });
        }
      }
    } finally {
      this.module._free(idsPtr);
      this.module._free(atomsPtr);
      this.module._free(errPtr);
    }

    return results;
  }

  getBraggPeakStpCustomCompound(params: {
    programId: number;
    particleId: number;
    elements: CompoundElement[];
    density: number;
    iValue?: number;
  }): number {
    const { programId, particleId, elements, density, iValue = 0.0 } = params;

    const { idsPtr, atomsPtr, nElements } = this.prepareCompoundElements(elements);
    const errPtr = this.module._malloc(4);

    try {
      const braggPeakStp = this.module._dedx_get_bragg_peak_stp_custom_compound(
        programId,
        particleId,
        idsPtr,
        atomsPtr,
        nElements,
        density,
        iValue,
        errPtr,
      );

      const errCode = this.module.HEAP32[errPtr >>> 2] ?? 0;
      if (errCode !== 0) {
        throw new LibdedxError(errCode, "Bragg peak STP lookup failed for custom compound");
      }

      return braggPeakStp;
    } finally {
      this.module._free(idsPtr);
      this.module._free(atomsPtr);
      this.module._free(errPtr);
    }
  }
}

export const libdedx: { service: LibdedxServiceImpl | null } = { service: null };

export function initLibdedx(module: EmscriptenModule): void {
  libdedx.service = new LibdedxServiceImpl(module);
}
