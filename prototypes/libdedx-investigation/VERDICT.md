# Stage 2.6: libdedx Data Source Investigation — Verdict

> **Date:** 2026-04-15
> **Phases completed:** 1 (static header analysis), 2 (WASM runtime, 44/44 PASS),
> 3 (bundle size), 4 (spec cross-check)
> **Status:** All acceptance criteria met. Stage 3 gate: **OPEN**.

---

## 1. Bundle Strategy Recommendation

**Recommendation: (A) Monolithic `.mjs` + `.wasm` — no `.data` sidecar.**

| Strategy | Description | Total size (uncompressed) | Verdict |
|----------|-------------|--------------------------|---------|
| **(A) Monolithic** | Single `libdedx.mjs` (13 KB) + `libdedx.wasm` (457 KB) | **470 KB** | **✓ RECOMMENDED** |
| (B) Per-program `.data` shards | Split 412 KB of float data into per-program files loaded lazily | ~470 KB + loader overhead | ✗ Not worth the complexity |
| (C) Hybrid (core + lazy heavy) | Pre-bundle PSTAR/ASTAR/MSTAR, lazy-load ICRU73 | ~350 KB core + ~185 KB lazy | ✗ Premature optimization |

### Rationale

- **Critical finding:** All stopping-power data is compiled into the WASM binary as static
  C arrays (`dedx_embedded_data.c`). The 1.5 MB `.data` sidecar from Spike 2 bundled raw
  `.dat` source files that are **never accessed at runtime** (`dedx_data_access.c` has zero
  `fopen()` calls). Removing `--preload-file` eliminates 1.5 MB.
- The monolithic WASM binary is **457 KB** uncompressed (~200–250 KB gzip). This is well
  within the 500 KB gzip budget in `09-non-functional-requirements.md`.
- Per-program splitting requires multiple WASM instances with no shared memory, breaks
  multi-program comparison, and saves at most 185 KB (ICRU73's share).

---

## 2. Spec Sections Needing Amendment

| # | Document | Section | Amendment required |
|---|----------|---------|-------------------|
| 1 | `docs/decisions/003-wasm-build-pipeline.md` | Build flags | Remove `--preload-file`. Build produces `.mjs` + `.wasm` only. Add note: Emscripten 5.x requires JSON-quoted `EXPORTED_FUNCTIONS`. Actual WASM size 457 KB. |
| 2 | `docs/04-feature-specs/entity-selection.md` | Particle count | Clarify that "~240 particles" applies only to `DEDX_DEFAULT` parametric path (112 ions, Z=1–112). `DEDX_MSTAR` covers Z=2–18 only. Tabulated programs cover 1–16 ions each. |
| 3 | `docs/04-feature-specs/entity-selection.md` | ESTAR | ESTAR (program ID 3) is present in `dedx_get_program_list()` output but returns `DEDX_ERR_ESTAR_NOT_IMPL` for all calculations. UI must treat it as incompatible for all particle/material combinations (grey out or exclude). |
| 4 | `docs/06-wasm-api-contract.md` | Program list | Note that `DEDX_ICRU` (id=9) is an auto-selector returned by `dedx_get_program_list()` — TypeScript wrapper must exclude it from the UI program picker. |
| 5 | `docs/06-wasm-api-contract.md` | MSTAR ion discovery | `dedx_get_ion_list(MSTAR)` returns only Z=2–18. Wrapper must expose Z=1–98 from spec knowledge (general polynomial extends beyond enumerated list). |
| 6 | `docs/06-wasm-api-contract.md` | Material/ion names | Material names from C API are ALL CAPS — display formatting required. Ion ID 1001 (electron) returns empty name — hard-code `"Electron"` in wrapper. |
| 7 | `docs/06-wasm-api-contract.md` | Density access | `dedx_get_density()` wrapper must call `dedx_internal_read_density()` (internal function) since no public density getter exists in libdedx v1.4.0. Export this function in WASM build. |
| 8 | `docs/11-prototyping-spikes.md` | Stage 2.6 gate | Append: Phase 1 + Phase 2 complete, 44/44 PASS, ESTAR not implemented. |

---

## 3. Breaking Gaps

| Gap | Severity | Impact | Mitigation |
|-----|----------|--------|------------|
| **ESTAR not implemented** | **High** | Electron stopping power unavailable in libdedx v1.4.0. ESTAR header data exists but `dedx.c:587` explicitly returns `DEDX_ERR_ESTAR_NOT_IMPL`. | Exclude ESTAR from UI compatibility matrix. Document as "not available in libdedx v1.4.0". The code path and data exist — a future libdedx release could enable it without API changes. |
| **No public density getter** | **Medium** | `dedx_get_density()` specified in WASM contract does not exist in libdedx public API. Density is accessible only via internal `dedx_internal_read_density()`. | Export the internal function in the Emscripten build. Create a `dedx_extra.c` wrapper (`dedx_get_density()` → `dedx_internal_read_density()`) for clean API. |
| **MSTAR ion list incomplete** | **Low** | `dedx_get_ion_list(MSTAR)` returns Z=2–18 only, but MSTAR analytically supports higher Z via polynomial scaling. | TypeScript wrapper must hard-code MSTAR Z range (or query dynamically via Bethe path). Document that runtime ion list is a subset of actual coverage. |

---

## 4. Acceptance Criteria Evaluation

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All 10 programs enumerated | **PASS** | `dedx_get_program_list()` returns IDs 1–7, 9, 100, 101 (10 programs). |
| 2 | Ion/material counts documented per program | **PASS** | `REPORT.md §§3,4`, `wasm_runtime_stats.json`. |
| 3 | Energy range confirmed | **PASS** | Static + runtime match. Min 2.5×10⁻⁴ MeV/nucl (ASTAR), max 10⁴ MeV/nucl (PSTAR). |
| 4 | Units audit complete | **PASS** | `REPORT.md §6` — all 9 quantity/unit pairs confirmed. I-value (8 materials), density (6 materials), composition (3 compounds) spot-checked at runtime. |
| 5 | Proton-in-water reference check | **PASS** | 7.28614 MeV·cm²/g (Δ −0.19% from NIST 7.3). |
| 6 | MSTAR ion coverage explained | **PASS** | `REPORT.md §§3.2,10.4` — runtime Z=2–18, parametric extension beyond. |
| 7 | Bundle size analysis complete | **PASS** | `REPORT.md §7` — monolithic 457 KB WASM, no `.data` sidecar needed. |
| 8 | REPORT.md published | **PASS** | Contains all tables specified in Phase 4. |
| 9 | Spec gaps documented | **PASS** | This document §§2,3. |
| 10 | No implementation decisions made | **PASS** | Spike collects data only; no Stage 3 code written. |

---

## 5. Summary

The libdedx data source investigation confirms that the library's data is **fully
embedded** in the compiled binary, making the WASM deployment significantly simpler
than initially assumed. The total binary is 457 KB (well under budget), and the
1.5 MB `.data` sidecar is entirely unnecessary.

The one significant gap is **ESTAR** (electron stopping powers) being explicitly
unimplemented in libdedx v1.4.0. This affects the UI's ability to offer electron
calculations but does not block Stage 3 implementation — the UI simply excludes ESTAR
from the compatibility matrix.

All other spec assumptions (material counts, energy ranges, units, gas targets, MSTAR
modes) are confirmed correct or have minor clarifications documented above.

**Stage 3 gate decision: OPEN — proceed with implementation.**
