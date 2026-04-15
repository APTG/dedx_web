# 2026-04-15 — Stage 2.6: libdedx Data Source Investigation (Phase 1)

## Session Narrative

### Prompt 1: Prepare a plan for Stage 2.6

**User request:** Prepare a detailed plan for the "Stage 2.6: libdedx Data Source
Investigation (pre-Stage 3 gate)" task. Goals: deep investigation of the libdedx
C headers and WASM bundle; verify that all spec-required data exists; check units;
produce a markdown summary report; determine WASM bundle strategy (monolithic vs.
per-program). Plan only — no implementation.

**AI response:** Explored the repository structure and read:
- All `libdedx/include/` headers (`dedx.h`, `dedx_elements.h`, `dedx_tools.h`, `dedx_wrappers.h`)
- All `libdedx/src/data/embedded/*.h` data tables
- `docs/06-wasm-api-contract.md`
- All three prior Spike VERDICT.md files
- `prototypes/wasm-preload/VERDICT.md` (Spike 2 artifact sizes and runtime results)
- `build_wasm.sh` (legacy exported functions list)

Produced a four-phase plan:
- **Phase 1** — Static C header analysis (Python script, no compilation)
- **Phase 2** — Live WASM runtime queries (minimal SvelteKit app, no recompilation)
- **Phase 3** — Bundle size analysis (per-program vs monolithic comparison)
- **Phase 4** — Spec cross-check and markdown report generation

Plan delivered as structured markdown with per-phase task tables, acceptance criteria,
and pre-identified risks.

### Prompt 2: Go ahead with Phase 1 implementation

**AI response:** Implemented `prototypes/libdedx-investigation/inspect_headers.py` —
a self-contained Python 3 script that performs static analysis of the libdedx C
headers without any compilation.

**Parsing targets:**
- `libdedx/include/dedx.h` — program enum constants, special particle `#define`s
- `libdedx/include/dedx_elements.h` — material/element enum (parsed with implicit-value tracking)
- `libdedx/src/data/embedded/dedx_{astar,pstar,estar,mstar,icru73,icru73new,icru90_*,icru_astar,icru_pstar}.h`
  — energy arrays, ion ID arrays, target ID arrays, STP array dimensions
- `libdedx/src/data/embedded/dedx_metadata.h` — 285 density/I-value rows, 29 gas target IDs
- `libdedx/src/dedx_mpaul.c` — MSTAR parametric ion coverage (polynomial degree, mode-h
  special-case Z values)

**Script output:**
- `prototypes/libdedx-investigation/data/headers_stats.json` — machine-readable full results
- Colour-coded terminal summary with 8 sections

**Bug found and fixed during implementation:** The initial `fmt_energy()` helper
showed "0.25 eV/nucl" for 2.5×10⁻⁴ MeV/nucl (should be "250 eV/nucl"). The function
was dividing into the wrong unit tier; fixed by computing in eV first then selecting
the display unit.

**Second fix:** ICRU49 ion names were not resolved in the merged sub-header view.
The `_merge_sub_headers()` function was updated to propagate `ion_names` from
sub-header records.

### Prompt 3: Write conclusions to markdown + fill AI logs

**AI response (this session):**

Additional analysis performed before writing:
- Inspected `libdedx/src/dedx_data_access.c` — confirmed **zero `fopen()` calls**;
  all data access is via `read_embedded_stopping_data()` and `read_embedded_energy_data()`.
- Inspected `libdedx/src/dedx_embedded_data.c` — confirmed which headers are compiled in.
  Notable omission: `dedx_estar.h` is present in the embedded directory but NOT `#include`d
  — the ESTAR situation requires Phase 2 verification.
- This resolves the original Stage 2.6 question as **Outcome A** (data fully embedded;
  `--preload-file` is unnecessary).

Files written/updated in this prompt:
- `prototypes/libdedx-investigation/REPORT.md` — full investigation report (new)
- `docs/ai-logs/2026-04-15-libdedx-investigation-phase1.md` — this file (new)
- `docs/ai-logs/README.md` — new entry added
- `CHANGELOG-AI.md` — new row added
- `docs/progress/stage-2.md` — Stage 2.6 section added
- `docs/00-redesign-plan.md` — Stage 2.6 description expanded to reflect actual scope

## Tasks

### Phase 1 — Static C header analysis

- **Status:** completed
- **Stage:** 2.6
- **Branch:** `stage/3-wasm-pipeline`
- **Files changed:**
  - `prototypes/libdedx-investigation/inspect_headers.py` (new)
  - `prototypes/libdedx-investigation/data/headers_stats.json` (new, generated)
  - `prototypes/libdedx-investigation/REPORT.md` (new)
  - `docs/ai-logs/2026-04-15-libdedx-investigation-phase1.md` (new)
  - `docs/ai-logs/README.md` (updated)
  - `CHANGELOG-AI.md` (updated)
  - `docs/progress/stage-2.md` (updated)
  - `docs/00-redesign-plan.md` (updated)

### Key findings

1. **Data is fully embedded** — `dedx_data_access.c` has no filesystem I/O; all
   stopping-power tables are compiled into the binary as static C arrays via
   `dedx_embedded_data.c`.

2. **`--preload-file` is unnecessary** — the 1.5 MB `.data` sidecar from Spike 2
   contained only the raw source `.dat` files, which the library never reads at
   runtime. ADR 003 must be updated.

3. **ESTAR open question** — `dedx_estar.h` is present in the embedded directory
   but not compiled in by `dedx_embedded_data.c`. Phase 2 must verify whether
   ESTAR needs the `.dat` files at runtime.

4. **Tabulated ion coverage is narrow** — 19 unique ions across all tabulated
   databases (Z=1, Z=2, Z=3–18, electron). The ~240 particle spec claim applies
   only to the Bethe/MSTAR parametric path (any Z=1–98). `entity-selection.md`
   needs clarification.

5. **MSTAR is parametric** — uses alpha (Z=2) tabulated data as a base, with
   polynomial scaling for any ion Z. Mode `h` has hardcoded special cases for
   Z=3–11, 16–18.

6. **Units confirmed** — density = g/cm³, I-value = eV, stopping power = MeV·cm²/g,
   CSDA range = g/cm², energy (ions) = MeV/nucl, energy (electron/ESTAR) = MeV.
   No unit inconsistencies found.

7. **Material count** — 279 total (98 elemental Z=1–98, 180 compound, 1 special
   Graphite=906). Spec says ~280 — CLOSE.

8. **Raw data volume** — 412.3 KB across unique tables (vs 1.5 MB `.data` sidecar
   which contained unneeded source files). Expected Stage 3 WASM output: `.mjs`
   (~130–160 KB) + `.wasm` (~500–700 KB), no `.data` sidecar.

### Required amendments

| Document | Amendment |
|----------|-----------|
| `docs/decisions/003-wasm-build-pipeline.md` | Remove `--preload-file`; build produces `.mjs`+`.wasm` only |
| `docs/04-feature-specs/entity-selection.md` | Clarify particle count per program (tabulated vs parametric) |
| `docs/06-wasm-api-contract.md` | Note `DEDX_ICRU` (id=9) excluded from program enumeration |

### Phase 2 plan (not yet executed)

Phase 2 uses the Spike 2 WASM build (recompiled without `--preload-file`) to verify:
- ESTAR without `.data` sidecar (resolve the open question)
- Runtime program/ion/material lists match static header analysis
- Reference STP value: PSTAR H₂O at 100 MeV/nucl ≈ 7.3 MeV·cm²/g
