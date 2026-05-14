import { describe, expect, it } from "vitest";
import { LibdedxServiceImpl } from "$lib/wasm/libdedx";

type EmscriptenModuleArg = ConstructorParameters<typeof LibdedxServiceImpl>[0];

function createRangeCheckingModule({
  minEnergy,
  maxEnergy,
}: {
  minEnergy: number;
  maxEnergy: number;
}): EmscriptenModuleArg {
  const buffer = new ArrayBuffer(4096);
  const heap32 = new Int32Array(buffer);
  const heapF32 = new Float32Array(buffer);
  const heapF64 = new Float64Array(buffer);
  let nextPtr = 128;

  return {
    HEAP32: heap32,
    HEAPF32: heapF32,
    HEAPF64: heapF64,
    _malloc(size: number) {
      const ptr = nextPtr;
      nextPtr += size + 16;
      return ptr;
    },
    _free() {},
    UTF8ToString() {
      return "";
    },
    _dedx_get_program_list: () => 0,
    _dedx_get_ion_list: () => 0,
    _dedx_get_material_list: () => 0,
    _dedx_get_program_name: () => 0,
    _dedx_get_program_version: () => 0,
    _dedx_get_ion_name: () => 0,
    _dedx_get_material_name: () => 0,
    _dedx_get_ion_nucleon_number: () => 0,
    _dedx_get_ion_atom_mass: () => 0,
    _dedx_get_density: () => 1,
    _dedx_target_is_gas: () => 0,
    _dedx_get_min_energy: () => minEnergy,
    _dedx_get_max_energy: () => maxEnergy,
    _dedx_get_stp_table: (
      _programId,
      _particleId,
      _materialId,
      numEnergies,
      energiesPtr,
      stpPtr,
    ) => {
      const tolerance = 1e-4;
      for (let i = 0; i < numEnergies; i++) {
        const energy = heapF32[energiesPtr / 4 + i]!;
        if (energy < minEnergy - tolerance || energy > maxEnergy + tolerance) {
          throw new Error("too much recursion");
        }
        heapF32[stpPtr / 4 + i] = energy + 1;
      }
      return 0;
    },
    _dedx_get_csda_range_table: (
      _programId,
      _particleId,
      _materialId,
      numEnergies,
      energiesPtr,
      csdaPtr,
    ) => {
      for (let i = 0; i < numEnergies; i++) {
        heapF64[csdaPtr / 8 + i] = heapF32[energiesPtr / 4 + i]! + 2;
      }
      return 0;
    },
    _dedx_get_inverse_stp_flat: () => 0,
    _dedx_get_inverse_csda_flat: () => 0,
    _dedx_get_bragg_peak_stp: () => 0,
    _dedx_calculate_custom_forward_flat: () => 0,
    _dedx_get_inverse_stp_custom_compound_flat: () => 0,
    _dedx_get_inverse_csda_custom_compound_flat: () => 0,
    _dedx_get_bragg_peak_stp_custom_compound: () => 0,
    _dedx_internal_setup_custom_compound: () => 0,
    _dedx_internal_cleanup_custom_compound: () => {},
  };
}

describe("LibdedxServiceImpl.getPlotData", () => {
  it("uses the program and particle tabulated energy range for alpha plot data", () => {
    const service = new LibdedxServiceImpl(
      createRangeCheckingModule({ minEnergy: 0.01, maxEnergy: 500 }),
    );

    const result = service.getPlotData(7, 2, 276, 5, true);

    expect(result.energies).toHaveLength(5);
    expect(result.energies[0]).toBeCloseTo(0.01);
    expect(result.energies.at(-1)).toBeCloseTo(500);
  });
});
