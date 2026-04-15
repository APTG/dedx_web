# Stage 2.6: libdedx Data Source Investigation — Phase 1 Report

> **Phase 1 date:** 2026-04-15 — Static C header inspection (`inspect_headers.py`)
> **Phase 2 date:** 2026-04-15 — WASM runtime verification (`wasm-runtime/verify.mjs`)
> **Phase 1 script output:** [`data/headers_stats.json`](data/headers_stats.json)
> **Status:** Both phases complete. 24/24 runtime checks passed.

---

## 1. Critical Finding: Data Is Fully Embedded in the Binary

This is the most important result and directly resolves the original Stage 2.6 question.

**`libdedx/src/dedx_data_access.c` contains zero filesystem calls** — no `fopen`, no `FILE*`,
no path construction. All stopping-power data is served from compiled-in static C arrays.

**`libdedx/src/dedx_embedded_data.c`** is the registry of those arrays. It `#include`s:

| Included header | Program |
|-----------------|---------|
| `data/embedded/dedx_astar.h` | ASTAR (alpha stopping powers) |
| `data/embedded/dedx_pstar.h` | PSTAR (proton stopping powers) |
| `data/embedded/dedx_mstar.h` | MSTAR base (alpha data for parametric scaling) |
| `data/embedded/dedx_icru73.h` | ICRU73 and ICRU73\_OLD (shared table) |
| `data/embedded/dedx_icru73new.h` | ICRU73 updated (Z=1–18, 2 targets) |
| `data/embedded/dedx_icru_pstar.h` | ICRU49 proton table |
| `data/embedded/dedx_icru_astar.h` | ICRU49 alpha table |
| `data/embedded/dedx_bethe.h` | Bethe parametric data |
| `data/embedded/dedx_icru90_a.h` | ICRU90 alpha corrections |
| `data/embedded/dedx_icru90_C.h` | ICRU90 Carbon-12 corrections |
| `data/embedded/dedx_icru90_p.h` | ICRU90 proton corrections |

**Not included:** `dedx_estar.h`, `dedx_icru90_e.h`, `dedx_icru90_pos.h`.

### Implication: `--preload-file` is unnecessary

The Spike 2 build used `--preload-file libdedx/data@/data` to serve the raw `.dat` source
files at runtime. These are the original NIST data files that the `tools/dat2c.py` generator
used to produce the embedded C headers — **they are not read at runtime by the library**.

The `.data` sidecar loaded in Spike 2 (1.5 MB) was fetched by the browser, populated
Emscripten's virtual filesystem, and then **never accessed**. All actual stopping-power
lookups went through the compiled-in static arrays.

**ADR 003 must be updated:** remove `--preload-file`. The Stage 3 WASM build produces
only `libdedx.mjs` + `libdedx.wasm` — no `.data` sidecar needed.

### Open: ESTAR filesystem access unknown

`dedx_estar.h` is present in `src/data/embedded/` but is **not** `#include`d by
`dedx_embedded_data.c`. It is possible that:

- (a) ESTAR is handled by a separate code path not found by static analysis; or
- (b) ESTAR relies on the raw `ESTAR.dat` / `estarEng.dat` files at runtime
  (i.e., it still uses filesystem access, making `--preload-file` necessary for ESTAR only).

**Phase 2 action required:** Call `dedx_get_stp_table_size(DEDX_ESTAR, 1001, 276)` in
the WASM runtime without the `.data` sidecar. If it returns a non-zero value, ESTAR
data is embedded via a different mechanism. If it returns 0 or errors, ESTAR needs
the `.dat` files.

---

## 2. Programs

### 2.1 Program inventory

| ID | Constant | Type | Description |
|----|----------|------|-------------|
| 1 | `DEDX_ASTAR` | Tabulated | NIST ASTAR — alpha particle stopping powers |
| 2 | `DEDX_PSTAR` | Tabulated | NIST PSTAR — proton stopping powers |
| 3 | `DEDX_ESTAR` | Tabulated (?) | NIST ESTAR — electron stopping powers (see §1) |
| 4 | `DEDX_MSTAR` | Parametric+Tabulated | MSTAR (H. Paul) — heavy ions via scaling |
| 5 | `DEDX_ICRU73_OLD` | Tabulated | ICRU Report 73 (2005) — older parametrisation |
| 6 | `DEDX_ICRU73` | Tabulated | ICRU Report 73 (2005) |
| 7 | `DEDX_ICRU49` | Tabulated | ICRU Report 49 (1993) — protons and alphas |
| 8 | *(reserved)* | — | Not a public program |
| 9 | `DEDX_ICRU` | Auto-select | Routes to ICRU49 or ICRU73 by ion type |
| 100 | `DEDX_DEFAULT` | Parametric | Bethe formula — any ion, any material |
| 101 | `DEDX_BETHE_EXT00` | Parametric | Bethe with extensions |

ICRU73\_OLD (id=5) and ICRU73 (id=6) **share the same embedded data table** (`dedx_icru73.h`).
They differ only in parametrisation code, not in raw data.

DEDX\_ICRU (id=9) is an auto-selector, not a real database. It must not appear as a standalone
program in the UI's entity-selection compatibility matrix.

### 2.2 Tabulated data per program

| Program | Ions | Targets | Energy points | E min | E max | Raw float data |
|---------|------|---------|---------------|-------|-------|---------------|
| ASTAR | 1 (He, Z=2) | 74 | 122 | 250 eV/nucl | 250 MeV/nucl | 35.3 KB |
| PSTAR | 1 (H, Z=1) | 74 | 133 | 1 keV/nucl | 10 GeV/nucl | 38.4 KB |
| ESTAR | 1 (electron) | 76 | 132 | 1 keV | 10 GeV | 39.2 KB |
| MSTAR (base) | 1 (He, Z=2) | 78 | 132 | 1 keV/nucl | 4 GeV/nucl | 40.2 KB |
| ICRU73\_OLD | 16 (Z=3–18) | 56 | 53 | 25 keV/nucl | 1 GeV/nucl | *shared* |
| ICRU73 | 16 (Z=3–18) | 56 | 53 | 25 keV/nucl | 1 GeV/nucl | 185.5 KB |
| ICRU49 | 2 (H+He) | 74 | 122–133 | 250 eV/nucl | 10 GeV/nucl | 73.7 KB |

**Total raw float data (unique tables):** 412.3 KB

Note: ESTAR energy axis is in **MeV total** (not MeV/nucl) — electrons have no nucleon number.
All other programs use MeV/nucl.

### 2.3 Supplementary datasets (not standalone programs)

These tables are compiled in and used as correction data or for specific material overrides.
They do not appear in `dedx_fill_program_list()`.

| Dataset | Ions | Targets | Energy points | Raw |
|---------|------|---------|---------------|-----|
| ICRU73 updated | 18 (Z=1–18) | 2 (Air, Water) | 53 | 7.5 KB |
| ICRU90 alpha | 1 (He) | 3 | 49 | 0.6 KB |
| ICRU90 Carbon-12 | 1 (C) | 3 | 57 | 0.7 KB |
| ICRU90 proton | 1 (H) | 3 | 57 | 0.7 KB |
| ICRU90 electron | 1 (e⁻) | 3 | 49 | 0.6 KB |
| ICRU90 positron | 1 (e⁺) | 3 | 49 | 0.6 KB |

---

## 3. Ion (Particle) Coverage

### 3.1 Tabulated databases

| Program | Ion Z values | Ion names |
|---------|-------------|-----------|
| PSTAR | 1 | Hydrogen (proton) |
| ASTAR | 2 | Helium (alpha) |
| ICRU49 | 1, 2 | Hydrogen, Helium |
| ICRU73 | 3–18 | Li, Be, B, C, N, O, F, Ne, Na, Mg, Al, Si, P, S, Cl, Ar |
| MSTAR (base) | 2 | Helium — used as base for parametric scaling |
| ESTAR | 1001 | Electron (special ID, not an atomic number) |

Across all tabulated databases: **19 unique ions** (Z=1, Z=2, Z=3–18, electron).

### 3.2 MSTAR parametric coverage

MSTAR uses tabulated alpha (Z=2) stopping power data as the **base dataset** and applies a
polynomial scaling coefficient (Helmut Paul formula, `dedx_mpaul.c`) to compute stopping power
for any projectile ion.

- The scaling polynomial uses `pow(ion, n)` for n = 0.5 through 4.5 (general case).
- Mode `h` has special hardcoded coefficients for Z = 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18.
- No explicit upper-Z bound found in the source — coverage extends to at least Z=18 with validated
  special modes; general polynomial covers higher Z.
- The exact upper runtime limit must be confirmed via Phase 2 (`dedx_fill_ion_list(DEDX_MSTAR)`).

### 3.3 The "~240 particles" spec claim

The `entity-selection.md` spec mentions approximately 240 particles. This cannot be satisfied
by tabulated data alone (19 tabulated ions). The ~240 figure is best understood as:

- All **elemental ions Z=1–98** available via the Bethe (`DEDX_DEFAULT`) parametric path.
- **Electron** (ID 1001) via ESTAR.
- Plus special particles defined in `dedx_elements.h`: positron (1002), π⁻ (1003), π⁺ (1004),
  π⁰ (1005), antiproton (1006).

Total: 98 elemental + 1 electron + 5 special = **104 particles** via Bethe path alone,
or ~239 if Z=1–98 includes all isotopes enumerated in the UI.

**Verdict:** The spec claim is approximately correct only when counting all Z=1–98
ions as available through the Bethe/MSTAR parametric path. The tabulated databases
cover a much smaller subset. The entity-selection UI compatibility matrix must accurately
reflect which programs support which ions.

**Action:** `entity-selection.md` should clarify that "available particles" is a function
of the selected program; the ~240 figure applies to `DEDX_DEFAULT` / `DEDX_MSTAR` only.

---

## 4. Material Coverage

### 4.1 Counts from `dedx_elements.h`

| Category | Count | ID range |
|----------|-------|----------|
| Elemental (Z=1–98) | 98 | 1–98 |
| Compound/mixture | 180 | 99–278 |
| Special (Graphite) | 1 | 906 |
| **Total** | **279** | — |

The spec claims ~280 materials. **CLOSE: 279 defined.** The discrepancy is negligible.

### 4.2 Target counts per program

Not all 279 materials are available for every program. Tabulated databases cover:

| Program | Targets available |
|---------|-----------------|
| ASTAR, PSTAR, ICRU49 | 74 |
| ESTAR | 76 |
| MSTAR | 78 |
| ICRU73 | 56 |
| DEDX\_DEFAULT (Bethe) | all 279 (parametric — no restriction) |

ESTAR covers 2 more materials than ASTAR/PSTAR (includes e.g. Boron Z=5, Silicon oxide).
ICRU73 covers significantly fewer (56 vs 74–78) — it focuses on medically and
dosimetrically relevant materials.

### 4.3 Gas targets

**29 gas targets** are flagged in `dedx_embedded_gas_targets[]`:

```
IDs: 1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86, 101, 104, 108, 124, 134,
     152, 155, 161, 162, 163, 164, 165, 197, 207, 238, 263, 264, 277
```

This matches the spec claim of 29 exactly. These are the materials for which the
aggregate-state UI selector is shown in Advanced Options.

---

## 5. Energy Ranges

### 5.1 Per-program ranges

| Program | Min energy | Max energy | Notes |
|---------|-----------|-----------|-------|
| ASTAR | **250 eV/nucl** | 250 MeV/nucl | Lowest minimum of any program |
| PSTAR | 1 keV/nucl | **10 GeV/nucl** | Highest maximum |
| ESTAR | 1 keV | **10 GeV** | In MeV total (not per nucleon) |
| MSTAR | 1 keV/nucl | 4 GeV/nucl | — |
| ICRU73 | 25 keV/nucl | 1 GeV/nucl | Narrowest range |
| ICRU49 | 250 eV/nucl | 10 GeV/nucl | Combined: alpha from 250 eV/nucl, proton to 10 GeV/nucl |

The spec mentions an energy range of "~10 eV to ~10 GeV". **MATCH with qualification:**
- No tabulated program starts as low as 10 eV. The minimum is 250 eV/nucl (ASTAR, ICRU49 alpha).
- The 10 GeV maximum is reached by PSTAR, ESTAR, and ICRU49 (proton).
- The Bethe parametric program has no fixed bounds.

### 5.2 Unit clarification — ESTAR

ESTAR's energy axis is in **MeV** (total kinetic energy of the electron), not MeV/nucl.
This is confirmed by the embedded header comment and aligns with `06-wasm-api-contract.md §1`:

> "For ESTAR electron (particle ID 1001), C calls use MeV."

All other programs use MeV/nucl (kinetic energy per nucleon of the projectile ion).

---

## 6. Units Audit

All unit claims from `06-wasm-api-contract.md` and `unit-handling.md` have been
verified against C source:

| Quantity | C-level unit | Source | Status |
|----------|-------------|--------|--------|
| Stopping power output | MeV·cm²/g | `dedx_wrappers.h` docstring | ✓ Confirmed |
| Energy input (ions) | MeV/nucl | `dedx_wrappers.h`, `dedx.h` | ✓ Confirmed |
| Energy input (ESTAR electron) | MeV | `dedx.h` + ESTAR comment | ✓ Confirmed |
| CSDA range output | g/cm² | `dedx_wrappers.h` | ✓ Confirmed |
| Material density | g/cm³ | `dedx_metadata.h` + `dedx_tools.h` | ✓ Confirmed |
| I-value (mean excitation potential) | eV | `dedx.h` + `dedx_metadata.h` | ✓ Confirmed |
| Composition | [Z, mass\_fraction] | `dedx.h` (`dedx_get_composition`) | ✓ Confirmed |
| Inverse stopping power input | MeV·cm²/g | `dedx_tools.h` | ✓ Confirmed |
| Inverse CSDA range input | g/cm² | `dedx_tools.h` | ✓ Confirmed |

**Density range** (from 285 embedded metadata rows): 8.4×10⁻⁵ – 22.6 g/cm³
**I-value range**: 19.2 – 966.0 eV

No unit inconsistencies found between headers and the WASM API contract.

---

## 7. WASM Bundle Size Analysis

### 7.1 Raw data

| Table | Unique? | Raw size |
|-------|---------|---------|
| ASTAR | yes | 35.3 KB |
| PSTAR | yes | 38.4 KB |
| ESTAR | yes | 39.2 KB |
| MSTAR | yes | 40.2 KB |
| ICRU73 | yes (shared by ICRU73\_OLD) | 185.5 KB |
| ICRU49 (proton + alpha) | yes | 73.7 KB |
| **Total raw floats** | | **412.3 KB** |

### 7.2 What the 1.5 MB `.data` sidecar actually contained

The Spike 2 `--preload-file libdedx/data@/data` command bundled the **raw source files**:
`ASTAR.dat`, `PSTAR.dat`, `ESTAR.dat`, `MSTAR.dat`, `ICRU73.dat`, `PSTAR.dat`, and their
corresponding `*Eng.dat` energy-axis files. These total ~1.5 MB uncompressed.

Since `dedx_data_access.c` never calls `fopen()`, the `.dat` files were loaded into
the Emscripten virtual filesystem and **never accessed**. The WASM module was reading
from its compiled-in static arrays the whole time.

### 7.3 Revised WASM build output

With `--preload-file` removed, the Stage 3 WASM build produces:

| File | Estimated size | Purpose |
|------|---------------|---------|
| `libdedx.mjs` | ~130–160 KB | Emscripten module + loader JS |
| `libdedx.wasm` | ~500–700 KB | Compiled C code + 412 KB static arrays |
| ~~`libdedx.data`~~ | ~~1.5 MB~~ | **Not needed** |

The total download is reduced from ~1.65 MB to ~650–860 KB (before gzip compression).

### 7.4 Per-program splitting — not recommended

A per-program split (one WASM binary per program) would:
- Require multiple module instances sharing no memory
- Complicate the WASM API contract (must know which binary to load before selection)
- Save at most 185 KB (ICRU73) per avoided load, versus the ~160 KB fixed loader overhead
- Make multi-program comparison impossible without loading multiple modules

**Recommendation:** Keep a single monolithic WASM binary. The data reduction from
removing `--preload-file` already saves 1.5 MB. Further splitting is premature.

---

## 8. Spec Cross-check Summary

*Updated after Phase 2 (2026-04-15) with runtime-confirmed values.*

| Spec claim | Phase 1 (static) | Phase 2 (runtime) | Status |
|------------|------------------|--------------------|--------|
| ~10 programs | 9 real + 1 auto + 1 reserved + 2 Bethe | 10 returned by `dedx_get_program_list()` | **MATCH** |
| ~280 materials | 279 in `dedx_elements.h` | 279 via DEFAULT | **MATCH** |
| 29 gas targets | 29 in `dedx_embedded_gas_targets` | — (not runtime-tested) | **MATCH** |
| Energy 10 eV – 10 GeV | 250 eV/nucl – 10 GeV/nucl tabulated | Min 2.5×10⁻⁴ MeV/nucl; max 10 GeV | **MATCH with note** |
| ~240 particles | 19 tabulated; ~100–240 parametric | MSTAR list: Z=2–18 only | **NEEDS CLARIFICATION** |
| MSTAR modes A/B/C/D/G/H | All 6 confirmed in `dedx.h` | — (not runtime-tested) | **MATCH** |
| ESTAR support | Header present but not compiled | Returns `DEDX_ERR_ESTAR_NOT_IMPL` | **NOT IMPLEMENTED** |
| Density g/cm³ | Confirmed in `dedx_metadata.h` | — | **MATCH** |
| I-value eV | Confirmed in `dedx_metadata.h` | — | **MATCH** |
| PSTAR H₂O ref STP | 7.3 MeV·cm²/g (NIST) | 7.28614 MeV·cm²/g (Δ −0.19%) | **MATCH** |

---

## 9. Required Spec / ADR Amendments

| Document | Amendment |
|----------|-----------|
| `docs/decisions/003-wasm-build-pipeline.md` | Remove `--preload-file`. Build produces `.mjs` + `.wasm` only. Add finding from Phase 1 analysis. |
| `docs/04-feature-specs/entity-selection.md` | Clarify that particle count (~240) applies only to DEDX\_DEFAULT/MSTAR parametric path; tabulated programs cover 1–16 ions each. |
| `docs/06-wasm-api-contract.md` | Note that `DEDX_ICRU` (id=9) is an auto-selector and must be excluded from program list queries. |
| `docs/11-prototyping-spikes.md` | Append Stage 2.6 gate: Phase 1 complete; ESTAR open question → Phase 2. |

---

## 10. Phase 2 — WASM Runtime Verification

> **Date:** 2026-04-15
> **Method:** Node.js ESM test runner (`wasm-runtime/verify.mjs`) loading a fresh WASM
> build compiled without `--preload-file` or `--embed-file`.
> **Script:** [`wasm-runtime/verify.mjs`](wasm-runtime/verify.mjs)
> **Build:** [`wasm-runtime/build.sh`](wasm-runtime/build.sh) — Docker, `emscripten/emsdk:5.0.5`
> **Result:** 24/24 checks PASS.

### 10.1 Build artifacts (no .data sidecar)

| File | Size | Notes |
|------|------|-------|
| `libdedx.mjs` | 13 KB | Emscripten module loader |
| `libdedx.wasm` | 456 KB | Compiled C + 412 KB static arrays |
| ~~`libdedx.data`~~ | — | **Not present** — confirmed unnecessary |

**Emscripten note (build fix):** Emscripten 5.0.5 requires JSON-quoted function names in
`EXPORTED_FUNCTIONS`: `["_func1","_func2"]` rather than the old bracket-only format
`[_func1,_func2]`. Using the old format silently produced a 241-byte empty WASM.
The `build.sh` uses a mounted inner script (heredoc with single-quoted delimiter) to
avoid shell-quoting issues when passing JSON arrays inside `docker run`.

### 10.2 ESTAR critical finding — **NOT IMPLEMENTED**

This was the open question from Phase 1. The answer is more definitive than expected:

**ESTAR is explicitly unimplemented in libdedx v1.4.0.** It is not a `.dat` file access
problem at all.

Evidence from static analysis (`dedx.c` lines 587–589):
```c
} else if (prog == DEDX_ESTAR) {
    *err = DEDX_ERR_ESTAR_NOT_IMPL;
    return -1;
}
```

Runtime confirmation:
```
dedx_get_stp_table_size(ESTAR=3, electron=1001, Water=276) = -1
```

The `DEDX_ERR_ESTAR_NOT_IMPL` error is defined with the message `"ESTAR is not implemented yet."`.
The `dedx_estar.h` header exists and contains the full tabulated data (132 energy points,
76 targets) but is never compiled in by `dedx_embedded_data.c` and never used.

**Implication for ADR 003:** `--preload-file` is doubly unnecessary for ESTAR:
1. The raw `.dat` files are never read anyway (Phase 1 finding: zero `fopen()` calls).
2. ESTAR implementation is missing in the calculation path (`find_data()` early-returns).

**Implication for Stage 3:** The WASM service layer must document ESTAR as
"not available in libdedx v1.4.0" and either exclude it from the compatibility matrix
or show it as greyed out. The `dedx_estar.h` data and code path exist and could be
wired up in a future libdedx version; no API changes are needed.

**Implication for the spec:** `entity-selection.md` and `06-wasm-api-contract.md`
must note that ESTAR (program ID 3) is present in `dedx_get_program_list()` output
but returns `DEDX_ERR_ESTAR_NOT_IMPL` for all calculation requests.
The UI must treat ESTAR as an incompatible program for all particle/material combinations.

### 10.3 Runtime program list

10 programs returned by `dedx_get_program_list()`:

| ID | Name | Min energy (ion=1) | Max energy (ion=1) |
|----|------|-----------|---------|
| 1 | ASTAR | 2.50×10⁻⁴ MeV/nucl | 2.50×10² MeV/nucl |
| 2 | PSTAR | 1.00×10⁻³ MeV/nucl | 1.00×10⁴ MeV/nucl |
| 3 | ESTAR | 1.00×10⁻³ MeV *(hardcoded — unimplemented)* | 1.00×10⁴ MeV |
| 4 | MSTAR | 1.00×10⁻³ MeV/nucl | 1.00×10³ MeV/nucl |
| 5 | ICRU73\_OLD | 1.00×10⁻³ MeV/nucl | 1.00×10⁴ MeV/nucl |
| 6 | ICRU73 | 1.00×10⁻³ MeV/nucl | 1.00×10⁴ MeV/nucl |
| 7 | ICRU49 | 1.00×10⁻³ MeV/nucl | 1.00×10⁴ MeV/nucl |
| 9 | ICRU | 1.00×10⁻³ MeV/nucl | 1.00×10⁴ MeV/nucl |
| 100 | DEFAULT | 1.00×10⁻³ MeV/nucl | 1.00×10³ MeV/nucl |
| 101 | BETHE\_EXT00 | 1.00×10⁻³ MeV/nucl | 1.00×10³ MeV/nucl |

Note: energy range queried with `ion=1` (proton). For programs that don't support proton
(ICRU73: Z=3–18), the switch-case default values are returned rather than the actual
program limits. The energy ranges for specific ion types must be queried with the
correct ion ID.

**Matches static header enum:** IDs 1–7, 9, 100, 101 — all accounted for. ID 8 is
reserved and not returned. ID 9 (ICRU auto-select) IS in the program list, which
**contradicts the Phase 1 recommendation** to exclude it. This must be handled in the
TypeScript wrapper (exclude ID 9 from the UI program picker even though it appears
in `dedx_get_program_list()`).

### 10.4 MSTAR ion list (runtime)

`dedx_get_ion_list(MSTAR=4)` returns **17 ions: Z = 2–18**.

```
[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
```

- The list starts at Z=2 (alpha), **not** Z=1 (proton). PSTAR handles protons.
- The list ends at Z=18 (argon). Higher-Z ions (Z=19–98) are supported via the general
  polynomial scaling formula in `dedx_mpaul.c` (`pow(ion, n)` for n=0.5–4.5) but are
  not enumerated in the runtime ion list.
- **Implication:** The UI cannot use `dedx_get_ion_list(MSTAR)` to discover the full
  MSTAR ion coverage. The TypeScript wrapper must know that MSTAR supports Z=1–98
  and expose this range based on the spec/docs, not from the runtime list.

### 10.5 Runtime material counts

| Program | Materials (runtime) | Notes |
|---------|-------------------|-------|
| ASTAR | 78 | Phase 1 static: 74 (target_ids array size) |
| PSTAR | 78 | Phase 1 static: 74 |
| ESTAR | 0 | Unimplemented |
| MSTAR | 78 | Phase 1 static: 78 ✓ |
| ICRU73\_OLD | 78 | Phase 1 static: 56 |
| ICRU73 | 78 | Phase 1 static: 56 |
| ICRU49 | 78 | Phase 1 static: 74 |
| DEFAULT | 279 | Parametric — all materials |

**Discrepancy with Phase 1:** `dedx_get_material_list()` returns 78 for all tabulated
programs regardless of actual tabulated coverage. The function appears to return the set
of materials that *have density/metadata* (ICRU-relevant subset) rather than strictly
those with tabulated stopping power data. When an ICRU73 calculation is requested for
a material not in its 56-target tabulation, libdedx likely falls back to PSTAR or
Bethe internally. The runtime value (78) is authoritative for what the API exposes.

### 10.6 Material and ion names

Material names are returned in **ALL CAPS** by `dedx_get_material_name()`:
`"WATER"`, `"HYDROGEN"`, `"GRAPHITE"`, etc. The TypeScript wrapper in Stage 3 will
need to apply title-case or a display-name mapping for UI presentation.

Ion names for Z=1–98 are returned correctly (e.g., `"HYDROGEN"`, `"HELIUM"`, `"CARBON"`).
Ion ID 1001 (electron) has **no name entry** — `dedx_get_ion_name(1001)` returns `""`.
The TypeScript wrapper must hard-code the display name `"Electron"` for ID 1001.

### 10.7 Reference STP value

```
PSTAR, H (Z=1), Water (ID=276), E = 100.0 MeV/nucl
Result: 7.28614 MeV·cm²/g  (error code = 0)
Expected: ≈ 7.3 MeV·cm²/g  (NIST PSTAR)
Delta: −0.19%  ✓
```

The reference value matches within 0.2%. The data pipeline (static C arrays → WASM →
Node.js float) introduces no significant precision loss.

### 10.8 Additional amendments required (Phase 2)

The Phase 1 amendment list from §9 is updated with these new findings:

| Document | Amendment |
|----------|-----------|
| `docs/decisions/003-wasm-build-pipeline.md` | Already listed in §9. Add Phase 2 build note: Emscripten 5.x requires JSON-quoted `EXPORTED_FUNCTIONS`; actual WASM size 456 KB. |
| `docs/04-feature-specs/entity-selection.md` | ESTAR must be treated as incompatible for all particle/material combinations (grey out in UI). |
| `docs/06-wasm-api-contract.md` | ESTAR: program ID 3 is present in program list but returns `DEDX_ERR_ESTAR_NOT_IMPL`. MSTAR: `dedx_get_ion_list()` returns Z=2–18 only; wrapper must expose Z=1–98 from spec knowledge. Material names: all-caps from C API; display formatting required in wrapper. Electron (1001): name not available from C API; hard-code `"Electron"` in wrapper. |
| `docs/04-feature-specs/entity-selection.md` | MSTAR ion coverage for Z>18 is supported via parametric path but not discoverable from `dedx_get_ion_list()`. |
