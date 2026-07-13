import { describe, test, expect, beforeEach, vi } from "vitest";
import { LibdedxServiceImpl } from "$lib/wasm/libdedx";
import { LibdedxError } from "$lib/wasm/types";
import { convertEnergyFromMeVperNucl } from "$lib/utils/energy-conversions";

// Mock the dependency directly so we have a known conversion for testing
vi.mock("$lib/utils/energy-conversions", () => ({
  convertEnergyFromMeVperNucl: vi.fn((val, toUnit, mass, atomic) => {
    if (toUnit === "MeV/u") return val * (mass / atomic);
    if (toUnit === "MeV") return val * mass;
    return val;
  }),
}));

// Provide minimal implementations for other imports
vi.mock("$lib/utils/csda-integration", () => ({
  integrateCsdaFromStp: vi.fn(),
}));
vi.mock("$lib/config/particle-aliases", () => ({
  getParticleAliases: vi.fn(() => []),
  getParticleSymbol: vi.fn(() => "X"),
}));
vi.mock("$lib/config/material-names", () => ({
  getMaterialFriendlyName: vi.fn((_id, name) => name),
}));
vi.mock("$lib/config/program-names", () => ({
  getProgramFriendlyName: vi.fn((_id, name) => name),
}));
vi.mock("$lib/config/particle-names", () => ({
  getParticleFriendlyName: vi.fn((_id, name) => name),
}));

describe("LibdedxServiceImpl", () => {
  let mockModule: any;
  let service: LibdedxServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();

    const heap = new ArrayBuffer(1024 * 1024); // 1MB
    let allocPtr = 1000;

    mockModule = {
      HEAP32: new Int32Array(heap),
      HEAPF32: new Float32Array(heap),
      HEAPF64: new Float64Array(heap),
      _malloc: vi.fn((size) => {
        // align to 8 bytes to avoid alignment issues
        const ptr = Math.ceil(allocPtr / 8) * 8;
        allocPtr = ptr + size;
        return ptr;
      }),
      _free: vi.fn(),
      _dedx_get_program_list: vi.fn(),
      _dedx_get_program_name: vi.fn(),
      _dedx_get_program_version: vi.fn(),
      _dedx_get_ion_list: vi.fn(),
      _dedx_get_ion_name: vi.fn(),
      _dedx_get_ion_nucleon_number: vi.fn(),
      _dedx_get_ion_atom_mass: vi.fn(),
      _dedx_get_material_list: vi.fn(),
      _dedx_get_material_name: vi.fn(),
      _dedx_get_density: vi.fn(),
      _dedx_target_is_gas: vi.fn(),
      _dedx_get_stp_table: vi.fn(),
      _dedx_get_csda_range_table: vi.fn(),
      _dedx_get_min_energy: vi.fn(),
      _dedx_get_max_energy: vi.fn(),
      _dedx_get_inverse_stp_flat: vi.fn(),
      _dedx_get_inverse_csda_flat: vi.fn(),
      _dedx_get_bragg_peak_stp: vi.fn(),
      _dedx_calculate_custom_forward_flat: vi.fn(),
      _dedx_get_inverse_stp_custom_compound_flat: vi.fn(),
      _dedx_get_inverse_csda_custom_compound_flat: vi.fn(),
      _dedx_get_bragg_peak_stp_custom_compound: vi.fn(),
      _dedx_internal_setup_custom_compound: vi.fn(),
      _dedx_internal_cleanup_custom_compound: vi.fn(),
      UTF8ToString: vi.fn(),
    };

    service = new LibdedxServiceImpl(mockModule);
  });

  describe("Memory allocation and buffer management", () => {
    test("calculate() correctly allocates, populates, and frees buffers", () => {
      const energies = [10.0, 20.0, 30.0];

      mockModule._dedx_get_stp_table.mockImplementation(
        (
          _progId: number,
          _partId: number,
          _matId: number,
          _num: number,
          _ePtr: number,
          sPtr: number,
        ) => {
          mockModule.HEAPF32[sPtr / 4 + 0] = 1.1;
          mockModule.HEAPF32[sPtr / 4 + 1] = 2.2;
          mockModule.HEAPF32[sPtr / 4 + 2] = 3.3;
          return 0; // Success
        },
      );

      mockModule._dedx_get_csda_range_table.mockImplementation(
        (
          _progId: number,
          _partId: number,
          _matId: number,
          _num: number,
          _ePtr: number,
          cPtr: number,
        ) => {
          mockModule.HEAPF64[cPtr / 8 + 0] = 100.1;
          mockModule.HEAPF64[cPtr / 8 + 1] = 200.2;
          mockModule.HEAPF64[cPtr / 8 + 2] = 300.3;
          return 0; // Success
        },
      );

      const result = service.calculate(1, 1, 1, energies);

      // Check allocations: energies (num*4), stp (num*4), csda (num*8)
      expect(mockModule._malloc).toHaveBeenCalledWith(12);
      expect(mockModule._malloc).toHaveBeenCalledWith(12);
      expect(mockModule._malloc).toHaveBeenCalledWith(24);

      // Verify input population for energies
      // We need to know where it was allocated. The first _malloc call returns 1000
      const ePtr = mockModule._malloc.mock.results[0].value;
      expect(mockModule.HEAPF32[ePtr / 4 + 0]).toBe(10.0);
      expect(mockModule.HEAPF32[ePtr / 4 + 1]).toBe(20.0);
      expect(mockModule.HEAPF32[ePtr / 4 + 2]).toBe(30.0);

      // Verify buffers were freed
      expect(mockModule._free).toHaveBeenCalledTimes(3);
      expect(mockModule._free).toHaveBeenCalledWith(mockModule._malloc.mock.results[0].value);
      expect(mockModule._free).toHaveBeenCalledWith(mockModule._malloc.mock.results[1].value);
      expect(mockModule._free).toHaveBeenCalledWith(mockModule._malloc.mock.results[2].value);

      // Verify output
      expect(result.energies).toEqual(energies);
      // Floating point comparisons
      expect(result.stoppingPowers[0]).toBeCloseTo(1.1);
      expect(result.stoppingPowers[1]).toBeCloseTo(2.2);
      expect(result.stoppingPowers[2]).toBeCloseTo(3.3);

      expect(result.csdaRanges[0]).toBeCloseTo(100.1);
      expect(result.csdaRanges[1]).toBeCloseTo(200.2);
      expect(result.csdaRanges[2]).toBeCloseTo(300.3);
    });

    test("getInverseStp() allocates errPtr once and frees it", () => {
      mockModule._dedx_get_inverse_stp_flat.mockImplementation(
        (
          _progId: number,
          _partId: number,
          _matId: number,
          stp: number,
          _side: number,
          errPtr: number,
        ) => {
          mockModule.HEAP32[errPtr >>> 2] = 0; // No error
          return stp * 2; // Dummy energy value
        },
      );

      const result = service.getInverseStp({
        programId: 1,
        particleId: 1,
        materialId: 1,
        stoppingPowers: [10, 20, 30],
        side: 0,
      });

      expect(mockModule._malloc).toHaveBeenCalledTimes(1);
      expect(mockModule._malloc).toHaveBeenCalledWith(4); // 4 bytes for errPtr
      expect(mockModule._free).toHaveBeenCalledTimes(1);

      expect(result.length).toBe(3);
      expect((result[0] as any).energy).toBe(20);
    });
  });

  describe("Error boundary handling", () => {
    test("calculate() throws LibdedxError on stp failure and frees memory", () => {
      mockModule._dedx_get_stp_table.mockReturnValue(42); // Error code 42

      expect.assertions(4);
      try {
        service.calculate(1, 1, 1, [10.0]);
      } catch (e) {
        expect(e).toBeInstanceOf(LibdedxError);
        expect((e as LibdedxError).code).toBe(42);
        expect((e as LibdedxError).message).toBe("WASM STP calculation failed");
      }

      // Memory should be freed despite exception
      expect(mockModule._free).toHaveBeenCalled();
    });

    // Regression test for dedx_web#844: code 202 (DEDX_ERR_COMBINATION_NOT_FOUND) previously
    // surfaced as the opaque "WASM STP calculation failed" — e.g. proton+Boron in PSTAR/ICRU49,
    // where the (now-fixed) stale libdedx table used to falsely claim the material was available.
    test("calculate() translates code 202 into a user-facing 'not supported' message", () => {
      mockModule._dedx_get_stp_table.mockReturnValue(202);

      expect.assertions(2);
      try {
        service.calculate(2, 1, 5, [100.0]);
      } catch (e) {
        expect(e).toBeInstanceOf(LibdedxError);
        expect((e as LibdedxError).message).toBe(
          "No stopping-power data available for this particle + material combination in the selected program.",
        );
      }
    });

    test("calculate() translates code 202 from the CSDA call the same way", () => {
      mockModule._dedx_get_stp_table.mockReturnValue(0);
      mockModule._dedx_get_csda_range_table.mockReturnValue(202);

      expect.assertions(2);
      try {
        service.calculate(2, 1, 5, [100.0]);
      } catch (e) {
        expect(e).toBeInstanceOf(LibdedxError);
        expect((e as LibdedxError).message).toBe(
          "No stopping-power data available for this particle + material combination in the selected program.",
        );
      }
    });

    test("calculate() throws LibdedxError on csda failure and frees memory", () => {
      mockModule._dedx_get_stp_table.mockReturnValue(0);
      mockModule._dedx_get_csda_range_table.mockReturnValue(43); // Error code 43

      expect.assertions(3);
      try {
        service.calculate(1, 1, 1, [10.0]);
      } catch (e) {
        expect(e).toBeInstanceOf(LibdedxError);
        expect((e as LibdedxError).code).toBe(43);
      }

      // Memory should be freed despite exception
      expect(mockModule._free).toHaveBeenCalled();
    });

    test("getInverseStp() returns LibdedxError object in array on failure", () => {
      mockModule._dedx_get_inverse_stp_flat.mockImplementation(
        (
          _pId: number,
          _partId: number,
          _mId: number,
          stp: number,
          _side: number,
          errPtr: number,
        ) => {
          if (stp === 20) {
            mockModule.HEAP32[errPtr >>> 2] = -5; // Error specifically for stp=20
            return 0;
          }
          mockModule.HEAP32[errPtr >>> 2] = 0;
          return stp * 2;
        },
      );

      const results = service.getInverseStp({
        programId: 1,
        particleId: 1,
        materialId: 1,
        stoppingPowers: [10, 20, 30],
        side: 0,
      });

      expect(results.length).toBe(3);

      expect(results[0]).not.toBeInstanceOf(LibdedxError);
      expect((results[0] as any).energy).toBe(20);

      expect(results[1]).toBeInstanceOf(LibdedxError);
      expect((results[1] as LibdedxError).code).toBe(-5);

      expect(results[2]).not.toBeInstanceOf(LibdedxError);
      expect((results[2] as any).energy).toBe(60);
    });
  });

  describe("Type conversions (convertEnergy)", () => {
    test("Converts MeV to MeV/nucl correctly", () => {
      // 120 MeV total, mass = 12 -> 10 MeV/nucl
      const result = service.convertEnergy({
        fromUnit: "MeV",
        toUnit: "MeV/nucl",
        massNumber: 12,
        atomicMass: 12.0,
        values: [120.0],
      });
      expect(result[0]).toBeCloseTo(10.0);
    });

    test("Converts MeV/u to MeV/nucl correctly", () => {
      // MeV/u -> MeV/nucl involves multiplying by atomicMass/massNumber
      // Say value is 10.0, mass=4, atomicMass=4.0026
      const result = service.convertEnergy({
        fromUnit: "MeV/u",
        toUnit: "MeV/nucl",
        massNumber: 4,
        atomicMass: 4.0026,
        values: [10.0],
      });
      expect(result[0]).toBeCloseTo(10.0 * (4.0026 / 4));
    });

    test("Converts MeV/nucl to MeV/u correctly", () => {
      const result = service.convertEnergy({
        fromUnit: "MeV/nucl",
        toUnit: "MeV/u",
        massNumber: 4,
        atomicMass: 4.0026,
        values: [10.0],
      });
      expect(result[0]).toBeCloseTo(10.0 * (4 / 4.0026));
      expect(convertEnergyFromMeVperNucl).toHaveBeenCalledWith(10.0, "MeV/u", 4, 4.0026);
    });
  });
});
