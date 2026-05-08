# 2026-05-08 — Inverse STP: WASM bisection bug for monotone curves

## Session Narrative

### Prompt 1: 1 keV/µm still shows red dashes; add E2E tests

**User request**: After the keV/µm formula fix, `?imode=stp&ivalues=1&iunit=kev-um`
(program=7 ICRU 49, proton/water) still shows "—". Add E2E tests using real WASM.

**Root cause found**:

Two bugs identified after the formula fix:

**Bug A — `dedx_get_inverse_stp` in `dedx_tools.c`: bisection hits negative energies**

`find_min()` searches for the Bragg-peak energy by minimising `1/STP`. For ICRU 49
proton/water, the STP is monotonically decreasing over [0.001, 10000] MeV — there is no
local minimum of `1/STP` in the tabulated range. `find_min` returns -1 when it cannot
converge.

The caller `dedx_get_inverse_stp` uses this -1 as `x2` (an energy endpoint). The
bisection midpoint `(x1 + (-1)) / 2` eventually becomes negative, `dedx_get_stp`
returns an error for negative energies, and the error propagates to TypeScript as
`LibdedxError` → `status="no-solution"` → red "—".

**Bug B — `side` parameter mapping mismatch**

TypeScript passes `side: 0` (E_low) and `side: 1` (E_high) to the C flat wrapper.
The original `dedx_get_inverse_stp` maps `side < 0` → low (ascending) branch and
`side >= 0` → high (descending) branch. Both side=0 and side=1 therefore return the
same high-branch result, never the low-branch solution for programs with a Bragg peak
in range (e.g. PSTAR).

**Fix**:

Rewrote `dedx_get_inverse_stp_flat` in `wasm/dedx_extra.c` with a sample-based peak
detection and two-branch bisection:

1. Sample STP at 40 log-spaced energies across `[emin, emax]` to locate the peak
   (`max_stp` and `e_peak`).
2. Feasibility: check `stp_at_emax ≤ stp ≤ max_stp`; return error otherwise.
3. Branch selection:
   - `!has_peak` (monotone, peak at first sample): bisect `[emin, emax]` on
     the descending branch.
   - `side == 0` and `stp >= stp_at_emin`: bisect `[emin, e_peak]` on the
     ascending branch (invariant: `STP(x_lo) ≤ stp ≤ STP(x_hi)`).
   - `side == 1` or `stp < stp_at_emin`: bisect `[e_peak, emax]` on the
     descending branch (invariant: `STP(x_lo) ≥ stp > STP(x_hi)`).

Both ICRU 49 (monotone) and PSTAR (Bragg peak at ~0.2 MeV) are handled correctly.

**E2E test failures after first WASM recompile**: The smoke test regex
`/^\d+(\.\d+)?\s*(MeV|GeV)?$/` did not match `keV` (the auto-scaled display for the
~5 keV low-branch answer). Fixed by:
- Updating all 3 affected test regexes to `/^\d+(\.\d+)?\s*(keV|MeV|GeV)?$/`.
- Adding `parseEnergyMeV()` helper to convert keV/MeV/GeV labels to MeV for the
  `E_high > E_low` comparison.

**New E2E test** added specifically for the ICRU 49 monotone case: `1 keV/µm` proton
in water (program=7) must produce a result in the 40–120 MeV range.

**Results**: 834 unit tests pass. 10/10 E2E inverse-lookups tests pass.

## Tasks

### Fix WASM bisection for monotone STP curves and two-branch selection

- **Status**: completed
- **Stage**: 6.9
- **Files changed**:
  - `wasm/dedx_extra.c` — `dedx_get_inverse_stp_flat` rewritten
  - `tests/e2e/inverse-lookups.spec.ts` — regex fixes, `parseEnergyMeV` helper,
    new @smoke test for ICRU49 1 keV/µm case
  - `static/wasm/libdedx.mjs`, `static/wasm/libdedx.wasm` — rebuilt binaries
- **Decision**: Sample-based peak detection (N=40 log-spaced points) was chosen over
  calling `find_min()` directly because `find_min` is a static function in
  `dedx_tools.c` and inaccessible from `dedx_extra.c`. 40 samples across 7 log-decades
  gives ~0.4-decade resolution, sufficient to locate the Bragg peak unambiguously.
- **Decision**: The `side` mapping is fixed in the wrapper rather than patching the
  TypeScript call site, keeping the TS API unchanged.
