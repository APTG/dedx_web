# WASM API Contract

> **Status:** Final (v2, 2 April 2026) — all open questions resolved.
>
> This document defines the TypeScript interface for the libdedx WebAssembly wrapper.
> All frontend components, stores, and tests are written against these types and interfaces.
> The WASM implementation is swappable — mocked in tests, real in production.

---

## 1. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| C API style | **Stateless wrappers** (`dedx_wrappers.h`) | Simpler memory management in WASM; no workspace/config lifecycle to track. Each call is self-contained. Falls back to stateful API when AdvancedOptions are set. |
| Energy units | **JS-side conversion** | For ions (A ≥ 1), C calls use MeV/nucl. For ESTAR electron (particle ID 1001), C calls use MeV. Conversions between MeV, MeV/nucl, and MeV/u require the particle's mass number (A) and atomic mass (m in u). **MeV/nucl ≠ MeV/u** — the distinction matters for CSDA range. Electron uses MeV only (no per-nucleon conversion). |
| Error handling | **Typed exceptions** | C error codes are translated via `dedx_get_error_code()` into `LibdedxError` with code + human-readable message. |
| Custom compounds | **Supported** | Uses the `dedx_config` path with `elements_id` + `elements_atoms` for user-defined materials. Requires the stateful API for this path only. |
| Inverse functions | **Exposed** | `dedx_get_inverse_stp` and `dedx_get_inverse_csda` are available in the core API (`dedx_tools.h`). |
| Density | **Exposed** | Needed for stopping power unit conversion (MeV cm²/g ↔ MeV/cm ↔ keV/µm) and density-based CSDA range display. Obtained via new `dedx_get_density()` public wrapper. |
| ESTAR (electrons) | **Included** | ESTAR (program 3, particle ID 1001) covers all ~280 materials. Exposed in the UI as a special "Electron" entry in the `ParticleEntity` list. |
| MSTAR modes | **Exposed** | 6 modes (a/b/c/d/g/h), default "b". Shown as advanced dropdown when MSTAR is active. |
| Aggregate state | **Exposed** | 29 materials are gaseous by default. State selector shown in advanced mode. Override via `compound_state` in `dedx_config`. |
| Interpolation | **Exposed** | Log-log (default) and linear. Toggle in advanced settings. |

---

## 2. Type Definitions

### 2.1 Units

```typescript
/** Energy units accepted by the frontend. Internally normalized per C-call context: MeV/nucl for ions, MeV for electron (ESTAR). */
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
/** A named entity from libdedx (program, particle, or material). */
interface LibdedxEntity {
  /** Numeric ID used in C API calls (e.g., DEDX_PSTAR = 2, DEDX_PROTON = 1). */
  id: number;
  /** Display name from dedx_get_*_name(). */
  name: string;
}

/**
 * Particle entity (ion or electron) with mass data for unit conversion.
 * Named "ParticleEntity" in dedx_web; the libdedx C API uses "ion" for
 * the same concept (including electrons), but that naming is incorrect.
 */
interface ParticleEntity extends LibdedxEntity {
  /**
   * Mass number (A) — integer number of nucleons.
   * Obtained from dedx_get_ion_nucleon_number() at init time.
   * Needed for MeV ↔ MeV/nucl conversion: E_per_nucl = E_total / A.
   * **Electron (ID 1001):** value is 0 (not applicable; electron uses MeV only).
   */
  massNumber: number;
  /**
   * Atomic mass in unified atomic mass units (u / daltons).
   * Obtained from dedx_get_ion_atom_mass() at init time.
   * Needed for MeV ↔ MeV/u conversion: E_per_u = E_total / m_u.
   * Example: proton has A=1 but m_u=1.00794.
   */
  atomicMass: number;
  /**
   * Chemical symbol (e.g., "H", "He", "C").
   * Derived from the element's standard symbol. Used in display
   * format: "Z=6  Carbon (C)". For particle ID 1001 (Electron): "e⁻".
   */
  symbol: string;
  /** Human-readable aliases for common particle names (e.g., "proton", "alpha", "electron"). */
  aliases?: string[];
}

/** Program entity with version information. */
interface ProgramEntity extends LibdedxEntity {
  /** Version string from dedx_get_program_version(). */
  version: string;
}

/** Material entity with optional density and gas state. */
interface MaterialEntity extends LibdedxEntity {
  /**
   * Material density in g/cm³. Read from dedx_get_density().
   * Used for stopping power unit conversion and CSDA range display.
   * Undefined for custom compounds until user provides it.
   */
  density?: number;
  /**
   * Whether this material is gaseous by default.
   * True for the 29 materials in dedx_embedded_gas_targets[].
   * Used to show an aggregate state selector in the UI.
   */
  isGasByDefault?: boolean;
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

### 2.6 Advanced Options

```typescript
/**
 * MSTAR calculation modes.
 * Only relevant when programId = DEDX_MSTAR.
 * Default is "b" (recommended by H. Paul).
 */
type MstarMode = "a" | "b" | "c" | "d" | "g" | "h";

/**
 * Interpolation mode for stopping power lookup.
 * Maps to C constants: DEDX_INTERPOLATION_LOG_LOG = 0, DEDX_INTERPOLATION_LINEAR = 1.
 * Default is "log-log".
 */
type InterpolationMode = "log-log" | "linear";

/**
 * Aggregate state override for a material.
 * - "default": use the built-in state from the C library (gaseous or condensed).
 * - "gas": force gaseous I-value for this material.
 * - "condensed": force condensed I-value for this material.
 * Maps to C fields: dedx_config.compound_state (0 = default, 1 = gas, 2 = condensed).
 */
type AggregateState = "default" | "gas" | "condensed";

/** Advanced calculation options. Applied to the dedx_config before evaluation. */
interface AdvancedOptions {
  /** Override aggregate state of the target material. Default: "default". */
  aggregateState?: AggregateState;
  /** Interpolation method. Default: "log-log". */
  interpolation?: InterpolationMode;
  /** MSTAR mode. Only used when programId = DEDX_MSTAR. Default: "b". */
  mstarMode?: MstarMode;
  /** Override density in g/cm³. If set, replaces the built-in density. */
  densityOverride?: number;
  /** Override I-value in eV. If set, replaces the built-in I-value. */
  iValueOverride?: number;
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
   * the program/particle/material lists.
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
   * Particles supported by a given program.
   * Calls: dedx_fill_ion_list(programId), dedx_get_ion_name(ionId).
   * @param programId — C enum value (e.g., DEDX_PSTAR = 2).
   */
  getParticles(programId: number): ParticleEntity[];

  /**
   * Materials supported by a given program.
   * Calls: dedx_fill_material_list(programId), dedx_get_material_name(materialId).
   * @param programId — C enum value.
   */
  getMaterials(programId: number): MaterialEntity[];

  // ── Energy Bounds ──────────────────────────────────────────

  /**
   * Minimum valid energy for a program/particle combination.
   * Calls: dedx_get_min_energy(programId, ionId).
   * @returns Energy in MeV/nucl.
   */
  getMinEnergy(programId: number, particleId: number): number;

  /**
   * Maximum valid energy for a program/particle combination.
   * Calls: dedx_get_max_energy(programId, ionId).
   * @returns Energy in MeV/nucl.
   */
  getMaxEnergy(programId: number, particleId: number): number;

  // ── Stopping Power ─────────────────────────────────────────

  /**
   * Evaluate stopping power at user-provided energy points.
   * Calls: dedx_get_stp_table() for the stopping powers,
   *        dedx_get_csda_range_table() for CSDA ranges.
   *
   * When advancedOptions are provided, falls back to the stateful
   * dedx_config API to set compound_state, interpolation, density, etc.
   *
   * Energies are always in MeV/nucl internally. If the user provides
   * a different unit, the caller (or a utility) must convert first
   * using `convertEnergy()`.
   *
   * @throws LibdedxError on C-level errors (e.g., DEDX_ERR_ENERGY_OUT_OF_RANGE).
   */
  calculate(params: {
    programId: number;
    particleId: number;
    materialId: number;
    energies: number[];       // in MeV/nucl
    options?: AdvancedOptions;
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
    particleId: number;
    compound: CustomCompound;
    energies: number[];       // in MeV/nucl
  }): CalculationResult;

  /**
   * Calculate across multiple programs at once (same particle, material, energies).
   * Returns a Map keyed by programId.
   *
   * Internally calls calculate() for each program. Errors for individual
   * programs are collected and returned; one failing program does not
   * abort the rest.
   */
  calculateMulti(params: {
    programIds: number[];
    particleId: number;
    materialId: number;
    energies: number[];       // in MeV/nucl
    options?: AdvancedOptions;
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
    particleId: number;
    materialId: number;
    pointCount: number;
    logScale: boolean;
    options?: AdvancedOptions;
  }): CalculationResult;

  /**
   * Get the built-in tabulated data points for a program/particle/material.
   * Calls: dedx_get_stp_table_size(), dedx_fill_default_energy_stp_table().
   * These are the raw data points from the underlying database.
   * CSDA ranges are computed separately via dedx_get_csda_range_table().
   */
  getDefaultTableData(params: {
    programId: number;
    particleId: number;
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
    particleId: number;
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
    particleId: number;
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
   * MeV/nucl and MeV/u are NOT equivalent:
   * - MeV/nucl uses integer mass number A.
   * - MeV/u uses atomic mass m in daltons.
   *
   * @param massNumber — particle mass number (A), needed for MeV ↔ MeV/nucl.
   * @param atomicMass — particle atomic mass in u, needed for MeV ↔ MeV/u.
   */
  convertEnergy(params: {
    fromUnit: EnergyUnit;
    toUnit: EnergyUnit;
    massNumber: number;
    atomicMass: number;
    values: number[];
  }): number[];

  // ── Material Properties ────────────────────────────────────

  /**
   * Get material density.
   * Calls: dedx_get_density(materialId).
   * @returns Density in g/cm³, or undefined if not available.
   */
  getDensity(materialId: number): number | undefined;

  /**
   * Check if a material is gaseous by default.
   * Calls: dedx_target_is_gas(materialId).
   * @returns true if the material is in the 29-element gas list.
   */
  isGasByDefault(materialId: number): boolean;

  /**
   * Get the nucleon number (mass number A) for a particle.
   * Calls: dedx_get_ion_nucleon_number(ionId).
   * @returns Mass number for Z=1..112, or -1 if invalid.
   */
  getNucleonNumber(particleId: number): number;

  /**
   * Get the atomic mass in unified atomic mass units (u) for a particle.
   * Calls: dedx_get_ion_atom_mass(ionId).
   * @returns Atomic mass in u (e.g., 1.00794 for hydrogen), or -1 if invalid.
   */
  getAtomicMass(particleId: number): number;

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
| `dedx_fill_ion_list(int, int*)` | `getParticles()` | Filtered by program |
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
| `dedx_load_config(ws*, cfg*, err*)` | config loading | Load a program/particle/material config |
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
| `dedx_get_ion_name(ion)` | `getParticles()` | Returns `const char*` |
| `dedx_get_material_name(mat)` | `getMaterials()` | Returns `const char*` |
| `dedx_get_min_energy(prog, ion)` | `getMinEnergy()` | Returns `float` (MeV/nucl) |
| `dedx_get_max_energy(prog, ion)` | `getMaxEnergy()` | Returns `float` (MeV/nucl) |
| `dedx_get_error_code(buf, err)` | `LibdedxError` constructor | Error code → string |
| `dedx_get_version_string()` | `getVersion()` | Returns `const char*` |
| `dedx_get_i_value(target, err*)` | `getIValue()` | Returns `float` (eV) |
| `dedx_get_composition(target, comp[][2], len*, err*)` | `getComposition()` | Compound composition |
| `_dedx_read_density(material, err*)` | `getDensity()` | Internal fn, returns `float` (g/cm³) |

### 4.5 From local `wasm/dedx_extra.h` (thin wrappers — see §10)

These wrappers live in this repository and are compiled alongside libdedx.

| C Function | Used by | Notes |
|------------|---------|-------|
| `dedx_get_ion_nucleon_number(ion)` | `getNucleonNumber()`, `getParticles()` | Returns mass number (A) for Z=1..112 |
| `dedx_get_ion_atom_mass(ion)` | `getAtomicMass()`, `getParticles()` | Returns atomic mass in u for Z=1..112 |
| `dedx_get_density(material, err*)` | `getDensity()`, `getMaterials()` | Returns density in g/cm³ |
| `dedx_target_is_gas(target)` | `isGasByDefault()`, `getMaterials()` | Returns 1 if gaseous by default |

### 4.6 Emscripten Runtime Methods

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

No C function is needed. The conversion is purely arithmetic, but
**MeV/nucl and MeV/u are NOT the same**:

- **MeV/nucl** uses the integer mass number **A** (number of nucleons).
- **MeV/u** uses the atomic mass **m** in unified atomic mass units (daltons).

For example, a proton has A = 1 but m = 1.00794 u. A 100 MeV proton beam
has 100 MeV/nucl but 100 / 1.00794 ≈ 99.21 MeV/u. This distinction matters
for CSDA range calculations.

| From | To | Formula |
|------|----|--------|
| MeV/nucl | MeV | `E_MeV = E_per_nucl × A` |
| MeV | MeV/nucl | `E_per_nucl = E_MeV / A` |
| MeV/u | MeV | `E_MeV = E_per_u × m` |
| MeV | MeV/u | `E_per_u = E_MeV / m` |
| MeV/nucl | MeV/u | `E_per_u = E_per_nucl × A / m` |
| MeV/u | MeV/nucl | `E_per_nucl = E_per_u × m / A` |

Where:
- **A** = particle's mass number (integer nucleon count, from `dedx_nucl[]`)
- **m** = particle's atomic mass in u (from `dedx_amu[]`)

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

/** Special particle IDs */
const PARTICLES = {
  /** Used with ESTAR (program 3) for electron stopping powers. */
  ELECTRON: 1001,
} as const;

/** Stopping power unit IDs — maps to C enum dedx_stp_units in dedx_tools.h */
const STP_UNITS = {
  "MeV·cm²/g": 0,
  "MeV/cm": 1,
  "keV/µm": 2,
} as const;

/** Material aggregate states — maps to C dedx_config.compound_state */
const AGGREGATE_STATES = {
  DEFAULT: 0,
  GAS: 1,
  CONDENSED: 2,
} as const;

/** Interpolation modes — maps to C dedx_config.interpolation */
const INTERPOLATION_MODES = {
  LOG_LOG: 0,
  LINEAR: 1,
} as const;

/** MSTAR calculation modes — maps to C dedx_config.mstar_mode */
const MSTAR_MODES = {
  AUTO_CG: "a",      // condensed→c, gaseous→g
  AUTO_DH: "b",      // condensed→d, gaseous→h (recommended)
  CONDENSED: "c",
  CONDENSED_SPECIAL: "d",
  GASEOUS: "g",
  GASEOUS_SPECIAL: "h",
} as const;
```

---

## 9. Resolved Design Questions

> Resolved during the planning session on 2 April 2026.

### Q1: Particle mass numbers (A)

**Resolution:** Two-layer approach.

1. **Primary:** Expose `dedx_internal_get_nucleon()` as a new public wrapper
   `dedx_get_ion_nucleon_number(int ion)` in the Emscripten build. This is
   the authoritative source (uses `dedx_nucl[112]` from `dedx_periodic_table.h`).

2. **JS alias table:** Hardcode a human-readable particle table in TypeScript with
   display names and aliases. Used for UI labels and search, not for physics.

```typescript
/** Particle metadata table. massNumber comes from C, aliases are JS-only. */
const PARTICLE_ALIASES: Record<number, { name: string; aliases: string[] }> = {
  1:  { name: "Hydrogen",  aliases: ["proton", "p", "H"] },
  2:  { name: "Helium",    aliases: ["alpha", "α", "He"] },
  3:  { name: "Lithium",   aliases: ["Li"] },
  4:  { name: "Beryllium", aliases: ["Be"] },
  5:  { name: "Boron",     aliases: ["B"] },
  6:  { name: "Carbon",    aliases: ["C"] },
  7:  { name: "Nitrogen",  aliases: ["N"] },
  8:  { name: "Oxygen",    aliases: ["O"] },
  // ... Z=9..18 for MSTAR/ICRU73 supported particles
  12: { name: "Carbon-12", aliases: ["12C", "C-12"] },
  // Full table to be generated from dedx_nucl[] + element names
};
```

### Q2: ESTAR (electrons)

**Resolution: Include.** ESTAR (`DEDX_ESTAR = 3`, `particle ID = 1001`) is listed in the
C API. The web interface should expose it. Note:
- ESTAR uses a special particle ID `1001` (not atomic number).
- It covers all ~280 materials.
- The `ParticleEntity` for electrons gets `massNumber = 0` (not applicable;
  electrons use MeV only, and no per-nucleon conversion is allowed).
- UI should label it as "Electron" and handle it as a special case.

### Q3: MSTAR modes

**Resolution: Expose mode picker.** MSTAR has 6 calculation modes:

| Mode | Description |
|------|-------------|
| `a` | Auto: condensed→`c`, gaseous→`g` |
| `b` | Auto: condensed→`d`, gaseous→`h` (recommended by H. Paul) |
| `c` | Condensed target mode |
| `d` | Special condensed-target mode |
| `g` | Gaseous target mode |
| `h` | Special gaseous-target mode |

Default is `b` (recommended). Show as an advanced dropdown when MSTAR is selected.

```typescript
type MstarMode = "a" | "b" | "c" | "d" | "g" | "h";
```

### Q4: Bethe extended (DEDX_BETHE_EXT00)

**Resolution: Expose as advanced option.** When DEDX_BETHE_EXT00 or DEDX_DEFAULT
is selected, the user must provide:
- `rho` (density in g/cm³) — **pre-filled with the library-known density** for the
  selected material (from `dedx_get_density()`), but editable by the user.
- `i_value` (mean excitation potential in eV) — optional, **pre-filled with
  the library-known I-value** (from `dedx_get_i_value()`), uses Bragg additivity
  if omitted or cleared.

This overlaps with custom compounds. In the UI, show additional input fields when
these programs are selected.

### Q5: Interpolation mode

**Resolution: Expose in advanced settings.**

```typescript
type InterpolationMode = "log-log" | "linear";
```

Default is `"log-log"` (maps to `DEDX_INTERPOLATION_LOG_LOG = 0`).
Show as a toggle in an "Advanced" section of the settings panel.

### Q6: Aggregate state

**Resolution: Expose in advanced settings.** 29 materials are gaseous by default
(listed in `dedx_embedded_gas_targets[]`). The `compound_state` field overrides
the default phase for I-value selection.

**Gaseous-by-default materials include:**
- Noble gases: He, Ne, Ar, Kr, Xe, Rn
- Elemental gases: H, N, O, F, Cl
- Compounds: Air, CO₂, NH₃, CH₄, C₂H₆, C₃H₈, C₄H₁₀, C₂H₄, C₂H₂
- Freons: Freon-12, -12B2, -13, -13B1, -13I1
- Tissue-equivalent gases (methane-based, propane-based)
- Water Vapor (distinct from liquid Water)
- Nitrous Oxide

```typescript
type AggregateState = "default" | "gas" | "condensed";
```

Show a state selector only when a gaseous-default material is selected, or as
an advanced override for any material. The TypeScript wrapper should expose
a helper `isGasByDefault(materialId: number): boolean` (calls the to-be-exposed
`dedx_target_is_gas()` wrapper around `dedx_internal_target_is_gas()`).

---

## 10. Thin C Wrappers (Local to This Repository)

The libdedx submodule is kept **unmodified**. Instead, thin C wrapper functions
that expose internal libdedx data live in this repository (e.g., `wasm/dedx_extra.h`
and `wasm/dedx_extra.c`). They are compiled alongside the libdedx sources
during the Emscripten WASM build.

These wrappers call internal libdedx functions that are linked but not declared
in the public API headers. We forward-declare them in our local wrapper.

### 10.1 Wrapper Functions

| Function | Wraps | Returns |
|----|----|----|
| `int dedx_get_ion_nucleon_number(int ion)` | `dedx_internal_get_nucleon()` | Mass number (A) for Z=1..112, or -1 on error |
| `float dedx_get_ion_atom_mass(int ion)` | `dedx_internal_get_atom_mass()` | Atomic mass in u (e.g., 1.00794 for H), or -1 on error |
| `float dedx_get_density(int material, int *err)` | `dedx_internal_read_density()` | Density in g/cm³ |
| `int dedx_target_is_gas(int target)` | `dedx_internal_target_is_gas()` | 1 if gaseous by default, 0 otherwise |

### 10.2 Example Implementation Sketch

```c
/* wasm/dedx_extra.h */
#ifndef DEDX_EXTRA_H
#define DEDX_EXTRA_H

int   dedx_get_ion_nucleon_number(int ion);
float dedx_get_ion_atom_mass(int ion);
float dedx_get_density(int material, int *err);
int   dedx_target_is_gas(int target);

#endif
```

```c
/* wasm/dedx_extra.c */
#include "dedx_extra.h"

/* Forward-declare internal libdedx functions (linked from libdedx objects) */
extern int   dedx_internal_get_nucleon(int id, int *err);
extern float dedx_internal_get_atom_mass(int id, int *err);
extern float dedx_internal_read_density(int material, int *err);
extern int   dedx_internal_target_is_gas(int target);

int dedx_get_ion_nucleon_number(int ion) {
    int err = 0;
    return dedx_internal_get_nucleon(ion, &err);
}

float dedx_get_ion_atom_mass(int ion) {
    int err = 0;
    return dedx_internal_get_atom_mass(ion, &err);
}

float dedx_get_density(int material, int *err) {
    return dedx_internal_read_density(material, err);
}

int dedx_target_is_gas(int target) {
    return dedx_internal_target_is_gas(target);
}
```

These files will be created during Stage 3 (WASM Build Pipeline). The Emscripten
build script compiles them together with the libdedx `.c` sources.
