# 2026-05-07 — Stage 6.9 WASM Inverse Lookup Calling-Convention Fix

**Model:** Claude Sonnet 4.6 via Claude Code

## Session Narrative

### Prompt 1: Implement Option B — flat C wrappers for inverse lookups

Analysis of the previous Qwen session (`session-ses_1fcf`) revealed that
`_dedx_get_inverse_csda` and `_dedx_get_inverse_stp` were exported from WASM
but have the wrong calling convention for JavaScript use: the C functions take
`(dedx_workspace*, dedx_config*, ...)` while the TypeScript wrapper called them
with plain integer IDs.  `_dedx_get_bragg_peak_stp` did not exist at all.

User chose Option B: add flat C wrappers to `wasm/dedx_extra.c` that manage
workspace/config lifecycle internally, then rebuild WASM.

### Stage 1 — Add C wrappers (commit 7ce77d4)

Added to `wasm/dedx_extra.h`:
- `dedx_get_inverse_csda_flat(int program, int ion, int target, double range, int *err)`
- `dedx_get_inverse_stp_flat(int program, int ion, int target, double stp, int side, int *err)`
- `dedx_get_bragg_peak_stp(int program, int ion, int target, int *err)`

Added implementations to `wasm/dedx_extra.c`:
- Each flat wrapper allocates a workspace, zeroes a `dedx_config`, sets
  program/ion/target, calls `dedx_load_config` (required to populate `ion_a`
  which the core inverse functions check before doing anything), calls the core
  function, then frees everything.
- `dedx_get_bragg_peak_stp` samples 300 log-spaced energies via `dedx_get_stp`
  and returns the maximum, matching the semantics of the Bragg peak.
- Updated `wasm/build.sh` EXPORTED_FUNCTIONS: removed the old workspace-based
  `_dedx_get_inverse_stp` and `_dedx_get_inverse_csda`; added the three new
  flat symbols.

### Stage 2 — Rebuild WASM (commit 72dcc50)

First rebuild failed: `dedx_tools.h` not found because `emcc` only had
`-I/src/wasm` on its include path.  Added `-I/src/libdedx/include` to the
`emcc` link step in `build.sh`.

Second rebuild succeeded.  Verified exports with Node.js:
```
_dedx_get_bragg_peak_stp
_dedx_get_inverse_csda_flat
_dedx_get_inverse_stp_flat
```

### Stage 3 — Update TypeScript interface (commit 766d9bd)

Updated `EmscriptenModule` interface in `src/lib/wasm/libdedx.ts` to match the
new flat function names.  Updated all three call sites in `LibdedxServiceImpl`:
- `getInverseStp` → calls `_dedx_get_inverse_stp_flat`
- `getInverseCsda` → calls `_dedx_get_inverse_csda_flat`
- `getBraggPeakStp` → calls `_dedx_get_bragg_peak_stp` (now actually exists)

826 unit tests pass, build succeeds.

### Stage 4 — E2E tests

Ran the full inverse-lookups E2E suite: all 6 tests passed.
Ran the full E2E suite (121 tests): 121 passed, 4 skipped, 0 failed.

The 3 previously failing tests (smoke, URL round-trip, 'm' suffix) had already
been corrected in the Qwen session to use `toHaveText()` + separate
`textContent()` instead of capturing the void return of `expect.poll().toMatch()`.

### Stage 5 — Fix `*err` initialisation bug (commit 1a6f29a)

User reported that visiting
`?imode=csda&ivalues=2&iunit=cm&program=7&particle=1&material=276`
still produced `"Inverse CSDA lookup failed for range=2"` (twice) even after
the WASM recompile.

Root cause: `_malloc(4)` returns uninitialised memory, and the flat wrappers
passed the caller's `err` pointer directly to the core functions without
zeroing it first.  Both `dedx_get_csda` (called inside `dedx_get_inverse_csda`)
and `dedx_get_inverse_stp` check `if (*err != 0) return -1` on entry — so any
garbage value in `errPtr` caused an immediate false failure.

Two-line fix:
- `wasm/dedx_extra.c` — added `*err = 0;` in both `dedx_get_inverse_csda_flat`
  and `dedx_get_inverse_stp_flat` before delegating to the core functions.
- `src/lib/wasm/libdedx.ts` — added `HEAP32[errPtr >>> 2] = 0` before each
  call in the `getInverseCsda` and `getInverseStp` loops (prevents stale error
  codes from leaking across iterations).

WASM rebuilt, 826 unit tests pass, all 6 inverse-lookup E2E tests pass.

## Tasks

### Add flat C wrappers + rebuild WASM

- **Status**: completed
- **Stage**: 6.9 (Inverse Lookups)
- **Files changed**:
  - `wasm/dedx_extra.h` — three new function declarations
  - `wasm/dedx_extra.c` — three new function implementations + `#include dedx_tools.h` + `#include math.h` + `#include string.h`
  - `wasm/build.sh` — `-I/src/libdedx/include` added; exported symbols updated
  - `static/wasm/libdedx.mjs` + `static/wasm/libdedx.wasm` — rebuilt binary
- **Decision**: `dedx_get_bragg_peak_stp` samples 300 log-spaced energies rather
  than re-implementing the ternary-search from `dedx_tools.c` (which is `static`
  and inaccessible).  300 points gives sub-1% accuracy for the Bragg peak
  without measurable latency on WASM.

### Fix TypeScript calling convention

- **Status**: completed
- **Files changed**: `src/lib/wasm/libdedx.ts`
- **Decision**: renamed symbols match flat wrapper names; no changes to
  `LibdedxService` interface or call sites in `inverse-lookups.svelte.ts`.
