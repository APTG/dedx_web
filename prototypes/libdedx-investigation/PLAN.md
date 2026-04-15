# Stage 2.6: libdedx Data Source Investigation — Plan

> **Status:** Complete (all phases done, 2026-04-15)
> **Branch:** `stage/3-wasm-pipeline`

## Spike Goal

Answer three interconnected questions before Stage 3 implementation begins:

1. **Data completeness** — Does libdedx actually contain all the data the specs assume?
2. **Units consistency** — Verify every data field's unit at the source (C headers).
3. **WASM bundle strategy** — One monolithic bundle or per-program shards?

## Deliverables

| File | Description | Status |
|------|-------------|--------|
| `PLAN.md` | This document (living) | ✓ Complete |
| `inspect_headers.py` | Phase 1: static C header analysis | ✓ Complete |
| `wasm-runtime/build.sh` | Phase 2: WASM build (Docker, emscripten/emsdk:5.0.5) | ✓ Complete |
| `wasm-runtime/verify.mjs` | Phase 2: Node.js runtime verification (44 checks) | ✓ Complete |
| `data/headers_stats.json` | Phase 1 output: machine-readable header analysis | ✓ Complete |
| `data/wasm_runtime_stats.json` | Phase 2 output: machine-readable runtime data | ✓ Complete |
| `REPORT.md` | Full human-readable report with all tables | ✓ Complete |
| `VERDICT.md` | Structured go/no-go decisions + spec amendments | ✓ Complete |

## Phases

### Phase 1 — Static C Header Analysis ✓
Python script `inspect_headers.py` — no WASM, no compilation.
Extracted: program IDs, per-program ions/targets/energy arrays, ICRU90 variants,
metadata (density/I-value), element/compound counts, raw data volumes, MSTAR anomaly.

### Phase 2 — Live WASM Runtime Query ✓
Node.js ESM runner `wasm-runtime/verify.mjs` loading WASM built without `--preload-file`.
44/44 checks pass. Confirmed: program list, ESTAR not implemented, MSTAR Z=2–18,
material counts, I-values, densities, compositions, reference STP value.

### Phase 3 — WASM Bundle Size Analysis ✓
Incorporated into REPORT.md §7. Critical finding: all data is compiled into static
C arrays — no `.data` sidecar needed. 457 KB monolithic WASM recommended.

### Phase 4 — Spec Cross-Check & Report ✓
REPORT.md contains all required tables. VERDICT.md lists spec amendments and gaps.

## Key Findings

1. **No `.data` sidecar needed** — `dedx_data_access.c` has zero `fopen()` calls
2. **ESTAR not implemented** — code returns `DEDX_ERR_ESTAR_NOT_IMPL` (not a data issue)
3. **457 KB monolithic WASM** — well within budget, no splitting needed
4. **MSTAR ion list** — runtime Z=2–18, parametric path extends beyond
5. **All units confirmed** — I-value (eV), density (g/cm³), STP (MeV·cm²/g)
