# WASM API Contract

> **Status:** Draft — awaiting human review of physics semantics and edge cases.
>
> This document defines the TypeScript interface for the libdedx WebAssembly wrapper.
> All frontend components, stores, and tests are written against these types and interfaces.
> The WASM implementation is swappable — mocked in tests, real in production.

---

## 1. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| C API style | **Stateless wrappers** (`dedx_wrappers.h`) | Simpler memory management in WASM; no workspace/config lifecycle to track. Each call is self-contained. |
| Energy units | **JS-side conversion** | The C API uses MeV/nucl everywhere. MeV↔MeV/nucl conversion requires the ion's mass number (A), which we already know from the entity list. Keeping this in JS avoids adding new C functions. |
| Error handling | **Typed exceptions** | C error codes are translated via `dedx_get_error_code()` into `LibdedxError` with code + human-readable message. |
| Custom compounds | **Supported** | Uses the `dedx_config` path with `elements_id` + `elements_atoms` for user-defined materials. Requires the stateful API for this path only. |
| Inverse functions | **Exposed** | `dedx_get_inverse_stp` and `dedx_get_inverse_csda` are available in the core API (`dedx_tools.h`). |
| Density | **Exposed** | Needed for stopping power unit conversion (MeV cm²/g ↔ MeV/cm ↔ keV/µm) and density-based CSDA range display. |

---

## 2. Type Definitions

### 2.1 Units

```typescript
/** Energy units accepted by the frontend. Internally converted to MeV/nucl for C calls. */
type EnergyUnit = "MeV" | "MeV/nucl" | "MeV/u";

/**
 * Stopping power units.
 * Maps to C enum `dedx_stp_units`:
 *   DEDX_MEVCM2G = 0, DEDX_MEVCM = 1, DEDX_KEVUM = 2
 */
type StpUnit = "MeV·cm²/g" | "MeV/cm" | "keV/µm";

/** CSDA range units. Conversion between g/cm² and cm requires material density. */
type RangeUnit = "g/cm²" | "cm";
```

### 2.2 Entities

```typescript
/** A named entity from libdedx (program, ion, or material). */
interface LibdedxEntity {
  /** Numeric ID used in C API calls (e.g., DEDX_PSTAR = 2, DEDX_PROTON = 1). */
  id: number;
  /** Display name from dedx_get_*_name(). */
  name: string;
}

/** Ion entity with additional mass number for unit conversion. */
interface IonEntity extends LibdedxEntity {
  /**
   * Mass number (A) — number of nucleons.
   * For elemental ions this equals the standard atomic mass number.
   * Needed for MeV ↔ MeV/nucl conversion: E_per_nucl = E_total / A.
   */
  massNumber: number;
}

/** Program entity with version information. */
interface ProgramEntity extends LibdedxEntity {
  /** Version string from dedx_get_program_version(). */
  version: string;
}

/** Material entity with optional density. */
interface MaterialEntity extends LibdedxEntity {
  /**
   * Material density in g/cm³. Read from _dedx_read_density().
   * Used for stopping power unit conversion and CSDA range display.
   * Undefined for custom compounds until user provides it.
   */
  density?: number;
}
```

### 2.3 Calculation Results

```typescript
/** Result of a stopping power + CSDA range calculation. */
interface CalculationResult {
  /** Input energies in MeV/nucl (after conversion from user's chosen unit). */
  energies: number[];
  /** Mass stopping powers in MeV·cm²/g (native C output unit). */
  stoppingPowers: number[];
  /** CSDA ranges in g/cm² (native C output unit). */
  csdaRanges: number[];
}

/** Result of an inverse stopping power lookup. */
interface InverseStpResult {
  /** Input stopping power values in MeV·cm²/g. */
  stoppingPowers: number[];
  /** Resulting energies in MeV/nucl. */
  energies: number[];
}

/** Result of an inverse CSDA range lookup. */
interface InverseCsdaResult {
  /** Input CSDA range values in g/cm². */
  ranges: number[];
  /** Resulting energies in MeV/nucl. */
  energies: number[];
}
```

### 2.4 Errors

```typescript
/**
 * Maps to the DEDX_ERR_* constants from dedx_error.h.
 * The message is obtained by calling dedx_get_error_code(err).
 */
class LibdedxError extends Error {
  /** Numeric error code from the C library. */
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "LibdedxError";
    this.code = code;
  }
}
```

### 2.5 Custom Compound Definition

```typescript
/** Element in a user-defined compound. */
interface CompoundElement {
  /** Atomic number (Z). */
  atomicNumber: number;
  /** Number of atoms of this element per formula unit. */
  atomCount: number;
}

/** User-defined compound material specification. */
interface CustomCompound {
  /** Display name for the compound (user-provided). */
  name: string;
  /** Elemental composition. */
  elements: CompoundElement[];
  /** Material density in g/cm³ (required for unit conversions). */
  density: number;
  /** Optional: mean excitation potential in eV. If omitted, Bragg additivity is used. */
  iValue?: number;
}
```

---

## 3. Service Interface

```typescript
interface LibdedxService {
  // ── Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize the WASM module. Must be called once before any other method.
   * Loads the Emscripten module, waits for WASM compilation, and caches
   * the program/ion/material lists.
   * @throws LibdedxError if WASM module fails to load.
   */
  init(): Promise<void>;

  // ── Entity Lists ───────────────────────────────────────────

  /**
   * All supported stopping power programs.
   * Calls: dedx_fill_program_list(), dedx_get_program_name(), dedx_get_program_version().
   * Cached after init().
   */
  getPrograms(): ProgramEntity[];

  /**
   * Ions supported by a given program.
   * Calls: dedx_fill_ion_list(programId), dedx_get_ion_name(ionId).
   * @param programId — C enum value (e.g., DEDX_PSTAR = 2).
   */
  getIons(programId: number): IonEntity[];

  /**
   * Materials supported by a given program.
   * Calls: dedx_fill_material_list(programId), dedx_get_material_name(materialId).
   * @param programId — C enum value.
   */
  getMaterials(programId: number): MaterialEntity[];

  // ── Energy Bounds ──────────────────────────────────────────

  /**
   * Minimum valid energy for a program/ion combination.
   * Calls: dedx_get_min_energy(programId, ionId).
   * @returns Energy in MeV/nucl.
   */
  getMinEnergy(programId: number, ionId: number): number;

  /**
   * Maximum valid energy for a program/ion combination.
   * Calls: dedx_get_max_energy(programId, ionId).
   * @returns Energy in MeV/nucl.
   */
  getMaxEnergy(programId: number, ionId: number): number;

  // ── Stopping Power ─────────────────────────────────────────

  /**
   * Evaluate stopping power at user-provided energy points.
   * Calls: dedx_get_stp_table() for the stopping powers,
   *        dedx_get_csda_range_table() for CSDA ranges.
   *
   * Energies are always in MeV/nucl internally. If the user provides
   * a different unit, the caller (or a utility) must convert first
   * using `convertEnergy()`.
   *
   * @throws LibdedxError on C-level errors (e.g., DEDX_ERR_ENERGY_OUT_OF_RANGE).
   */
  calculate(params: {
    programId: number;
    ionId: number;
    materialId: number;
    energies: number[];       // in MeV/nucl
  }): CalculationResult;

  /**
   * Same as calculate(), but for a custom compound target.
   * Uses the stateful dedx_config API internally (allocate workspace,
   * load config with elements, evaluate, free).
   *
   * @throws LibdedxError on C-level errors.
   */
  calculateCustomCompound(params: {
    programId: number;
    ionId: number;
    compound: CustomCompound;
    energies: number[];       // in MeV/nucl
  }): CalculationResult;

  /**
   * Calculate across multiple programs at once (same ion, material, energies).
   * Returns a Map keyed by programId.
   *
   * Internally calls calculate() for each program. Errors for individual
   * programs are collected and returned; one failing program does not
   * abort the rest.
   */
  calculateMulti(params: {
    programIds: number[];
    ionId: number;
    materialId: number;
    energies: number[];       // in MeV/nucl
  }): Map<number, CalculationResult | LibdedxError>;

  // ── Plot Data ──────────────────────────────────────────────

  /**
   * Generate a dense energy grid and evaluate stopping power + CSDA range.
   * Used for smooth plot curves.
   *
   * If logScale is true, energies are log-spaced between min and max energy.
   * If false, linearly spaced.
   *
   * Calls: dedx_get_min_energy(), dedx_get_max_energy() for bounds,
   *        then calculate() with the generated grid.
   */
  getPlotData(params: {
    programId: number;
    ionId: number;
    materialId: number;
    pointCount: number;
    logScale: boolean;
  }): CalculationResult;

  /**
   * Get the built-in tabulated data points for a program/ion/material.
   * Calls: dedx_get_stp_table_size(), dedx_fill_default_energy_stp_table().
   * These are the raw data points from the underlying database.
   * CSDA ranges are computed separately via dedx_get_csda_range_table().
   */
  getDefaultTableData(params: {
    programId: number;
    ionId: number;
    materialId: number;
  }): CalculationResult;

  // ── Inverse Lookups ────────────────────────────────────────

  /**
   * Find the energy corresponding to a given stopping power value.
   * Calls: dedx_get_inverse_stp() (requires stateful workspace API).
   *
   * @param side — 0 = low-energy branch, 1 = high-energy branch.
   *   Stopping power is non-monotonic; the Bragg peak creates two
   *   branches with the same stp value.
   * @throws LibdedxError on C-level errors.
   */
  getInverseStp(params: {
    programId: number;
    ionId: number;
    materialId: number;
    stoppingPowers: number[];  // in MeV·cm²/g
    side: 0 | 1;
  }): InverseStpResult;

  /**
   * Find the energy corresponding to a given CSDA range.
   * Calls: dedx_get_inverse_csda() (requires stateful workspace API).
   *
   * @throws LibdedxError on C-level errors.
   */
  getInverseCsda(params: {
    programId: number;
    ionId: number;
    materialId: number;
    ranges: number[];          // in g/cm²
  }): InverseCsdaResult;

  // ── Unit Conversion Utilities ──────────────────────────────

  /**
   * Convert stopping power values between unit systems.
   * Calls: convert_units() from dedx_tools.h.
   *
   * @param materialId — needed for density when converting to/from linear units.
   * @returns New stopping power values in the target unit.
   * @throws LibdedxError if the conversion fails.
   */
  convertStpUnits(params: {
    fromUnit: StpUnit;
    toUnit: StpUnit;
    materialId: number;
    values: number[];
  }): number[];

  /**
   * Convert CSDA range from g/cm² to cm (or vice versa) using material density.
   * Pure JS computation: range_cm = range_gcm2 / density.
   *
   * @param density — material density in g/cm³.
   */
  convertRangeUnits(params: {
    fromUnit: RangeUnit;
    toUnit: RangeUnit;
    density: number;
    values: number[];
  }): number[];

  /**
   * Convert energy values between MeV, MeV/nucl, and MeV/u.
   * Pure JS computation, no WASM call needed.
   *
   * MeV/nucl and MeV/u are equivalent (both mean kinetic energy per nucleon).
   * MeV is total kinetic energy: E_total = E_per_nucl × A.
   *
   * @param massNumber — ion mass number (A), needed for MeV ↔ MeV/nucl.
   */
  convertEnergy(params: {
    fromUnit: EnergyUnit;
    toUnit: EnergyUnit;
    massNumber: number;
    values: number[];
  }): number[];

  // ── Material Properties ────────────────────────────────────

  /**
   * Get material density.
   * Calls: _dedx_read_density(materialId).
   * @returns Density in g/cm³, or undefined if not available.
   */
  getDensity(materialId: number): number | undefined;

  /**
   * Get the mean excitation potential (I-value) of a material.
   * Calls: dedx_get_i_value(materialId).
   * @returns I-value in eV.
   * @throws LibdedxError if the material is not found.
   */
  getIValue(materialId: number): number;

  /**
   * Get the elemental composition of a compound material.
   * Calls: dedx_get_composition(materialId).
   * @returns Array of { atomicNumber, massFraction } pairs.
   * @throws LibdedxError if the material is not a compound or not found.
   */
  getComposition(materialId: number): Array<{
    atomicNumber: number;
    massFraction: number;
  }>;

  // ── Library Metadata ───────────────────────────────────────

  /**
   * Get the libdedx library version string.
   * Calls: dedx_get_version_string().
   */
  getVersion(): string;
}
```

---

## 4. Exported C Functions

These are the C functions that must be exported in the Emscripten build
(via `-sEXPORTED_FUNCTIONS`). The TypeScript wrapper calls them through
`Module.ccall()` / `Module.cwrap()`.

### 4.1 From `dedx_wrappers.h` (stateless)

| C Function | Used by | Notes |
|------------|---------|-------|
| `dedx_fill_program_list(int*)` | `getPrograms()` | Fills array, terminated by -1 |
| `dedx_fill_ion_list(int, int*)` | `getIons()` | Filtered by program |
| `dedx_fill_material_list(int, int*)` | `getMaterials()` | Filtered by program |
| `dedx_get_stp_table(prog, ion, target, n, energies*, stps*)` | `calculate()` | Batch stopping power |
| `dedx_get_csda_range_table(prog, ion, target, n, energies*, ranges*)` | `calculate()` | Batch CSDA range |
| `dedx_get_simple_stp_for_program(prog, ion, target, energy, err*)` | — | Single-point fallback |
| `dedx_get_stp_table_size(prog, ion, target)` | `getDefaultTableData()` | Number of tabulated points |
| `dedx_fill_default_energy_stp_table(prog, ion, target, energies*, stps*)` | `getDefaultTableData()` | Raw tabulated data |

### 4.2 From `dedx.h` (stateful — needed for custom compounds and inverse lookups)

| C Function | Used by | Notes |
|------------|---------|-------|
| `dedx_allocate_workspace(count, err*)` | `calculateCustomCompound()`, inverse fns | Allocate workspace |
| `dedx_free_workspace(ws*, err*)` | cleanup | Free workspace |
| `dedx_load_config(ws*, cfg*, err*)` | config loading | Load a program/ion/material config |
| `dedx_get_stp(ws*, cfg*, energy, err*)` | custom compound calc | Single-point evaluation |
| `dedx_free_config(cfg*, err*)` | cleanup | Free config |

### 4.3 From `dedx_tools.h`

| C Function | Used by | Notes |
|------------|---------|-------|
| `convert_units(old, new, material, n, old_vals*, new_vals*)` | `convertStpUnits()` | Unit conversion |
| `dedx_get_csda(ws*, cfg*, energy, err*)` | `calculateCustomCompound()` | Single-point CSDA |
| `dedx_get_inverse_stp(ws*, cfg*, stp, side, err*)` | `getInverseStp()` | Inverse lookup |
| `dedx_get_inverse_csda(ws*, cfg*, range, err*)` | `getInverseCsda()` | Inverse lookup |

### 4.4 From `dedx.h` (metadata)

| C Function | Used by | Notes |
|------------|---------|-------|
| `dedx_get_program_name(prog)` | `getPrograms()` | Returns `const char*` |
| `dedx_get_program_version(prog)` | `getPrograms()` | Returns `const char*` |
| `dedx_get_ion_name(ion)` | `getIons()` | Returns `const char*` |
| `dedx_get_material_name(mat)` | `getMaterials()` | Returns `const char*` |
| `dedx_get_min_energy(prog, ion)` | `getMinEnergy()` | Returns `float` (MeV/nucl) |
| `dedx_get_max_energy(prog, ion)` | `getMaxEnergy()` | Returns `float` (MeV/nucl) |
| `dedx_get_error_code(buf, err)` | `LibdedxError` constructor | Error code → string |
| `dedx_get_version_string()` | `getVersion()` | Returns `const char*` |
| `dedx_get_i_value(target, err*)` | `getIValue()` | Returns `float` (eV) |
| `dedx_get_composition(target, comp[][2], len*, err*)` | `getComposition()` | Compound composition |
| `_dedx_read_density(material, err*)` | `getDensity()` | Internal fn, returns `float` (g/cm³) |

### 4.5 Emscripten Runtime Methods

```
EXPORTED_RUNTIME_METHODS = ["ccall", "cwrap", "UTF8ToString"]
```

Also export `_malloc` and `_free` for heap allocation from JS.

---

## 5. WASM Build Requirements

| Requirement | Value | Rationale |
|-------------|-------|-----------|
| Module format | **ES module** (`EXPORT_ES6=1`, `MODULARIZE=1`) | Native import in Vite/SvelteKit |
| Environment | `ENVIRONMENT='web'` | Browser-only target |
| Memory growth | `ALLOW_MEMORY_GROWTH=1` | Large material lists and batch calculations |
| Data embedding | `--embed-file data@data/` | Embeds libdedx data tables into the .js module |
| Build tool | **Docker** (`emscripten/emsdk`) | Reproducible builds without local Emscripten install |
| Output files | `libdedx.mjs` + `libdedx.wasm` | ES module naming convention |

---

## 6. Memory Management Contract

The WASM wrapper manages all heap memory internally. Frontend code never touches
`Module._malloc()` / `Module._free()` directly.

**Pattern for batch operations:**

```
1. Allocate input buffer (Float32Array for energies)
2. Copy JS array into WASM heap
3. Allocate output buffer (Float32Array for stps, Float64Array for CSDA ranges)
4. Call the C function via ccall()
5. Copy output buffer back to JS array
6. Free all buffers
7. If error code ≠ 0: call dedx_get_error_code(), throw LibdedxError
```

**Pattern for stateful operations (custom compounds, inverse lookups):**

```
1. dedx_allocate_workspace(1, &err)
2. Allocate and populate a dedx_config struct in WASM memory
3. dedx_load_config(ws, cfg, &err)
4. Perform calculation(s)
5. dedx_free_config(cfg, &err)
6. dedx_free_workspace(ws, &err)
7. Return results or throw LibdedxError
```

All buffers are freed in a `finally` block to prevent leaks.

---

## 7. Energy Unit Conversion (JS-side)

No C function is needed. The conversion is purely arithmetic:

| From | To | Formula |
|------|----|---------|
| MeV/nucl | MeV | `E_MeV = E_per_nucl × A` |
| MeV | MeV/nucl | `E_per_nucl = E_MeV / A` |
| MeV/u | MeV/nucl | Identity (MeV/u ≡ MeV/nucl) |
| MeV/nucl | MeV/u | Identity |
| MeV | MeV/u | Same as MeV → MeV/nucl |
| MeV/u | MeV | Same as MeV/nucl → MeV |

Where **A** is the ion's mass number (number of nucleons, not atomic mass in u).

**Note:** For the purposes of this library, MeV/u and MeV/nucl are treated as
identical. The distinction between atomic mass units and nucleon count is
negligible for stopping power calculations.

---

## 8. C Constants Mapping

The TypeScript wrapper should expose these C enum values as typed constants,
so frontend code never uses magic numbers.

```typescript
/** Stopping power programs — maps to C enum in dedx.h */
const PROGRAMS = {
  ASTAR: 1,
  PSTAR: 2,
  ESTAR: 3,
  MSTAR: 4,
  ICRU73_OLD: 5,
  ICRU73: 6,
  ICRU49: 7,
  ICRU: 9,
  DEFAULT: 100,
  BETHE_EXT00: 101,
} as const;

/** Stopping power unit IDs — maps to C enum dedx_stp_units in dedx_tools.h */
const STP_UNITS = {
  "MeV·cm²/g": 0,
  "MeV/cm": 1,
  "keV/µm": 2,
} as const;

/** Material aggregate states */
const STATES = {
  DEFAULT: 0,
  GAS: 1,
  CONDENSED: 2,
} as const;
```

---

## 9. Open Questions

> Items for the human reviewer to decide:

1. **Ion mass numbers:** The C API identifies ions by atomic number (Z).
   Where do we get mass number (A) for the MeV→MeV/nucl conversion?
   Options:
   - Hardcode A values for Z=1..98 in JS (simple, A is just the most common isotope).
   - Expose `ion_a` from `dedx_config` after loading (requires stateful API for a read op).
   - Let users specify A for exotic isotopes (future feature?).

2. **ESTAR (electrons):** The C header lists `DEDX_ESTAR = 3` and `ion = 1001`.
   The old wrapper didn't expose it. Should we include or exclude electrons?

3. **MSTAR modes:** MSTAR has multiple calculation modes (A, B, C, D, G, H).
   The old app didn't expose this. Should the web interface allow mode selection?

4. **Bethe extended (DEDX_BETHE_EXT00):** Requires user-provided density (`rho`)
   and custom I-value. This overlaps with custom compounds. Expose as an advanced option?

5. **Interpolation mode:** The C API supports log-log and linear interpolation.
   Default is log-log. Should users be able to switch?

6. **Aggregate state:** Some materials exist as gas and condensed. Should we
   expose the state selector?
