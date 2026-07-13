# 2026-07-13 — Issue #844: stale material-availability table (Boron etc.)

## Session Narrative

### Prompt 1: Check whether a just-merged libdedx PR fixes dedx_web#844

The user asked me to check `APTG/libdedx#144` (which they had just merged) against
`APTG/dedx_web#844` — a frontend issue tracking that the Element picker lets users
select ion/material/program combinations (e.g. proton + Boron) that libdedx's
`dedx_program_available_materials` falsely claims are available, causing an opaque
`LibdedxError code: 202` in Basic mode.

**AI response**: Confirmed PR #144 fixes the underlying stale-table bug
(`libdedx#51`), adds an ion-aware `dedx_get_material_list_for_ion()` API, and adds a
new `DEDX_AUTO` program (id 10) with a Bethe-Bloch fallback for untabulated elements.
Checked the `libdedx/` submodule pin in dedx_web — still one commit behind the PR's
merge commit — so the fix hadn't been consumed yet. Reported back that #144 unblocks
#844 but doesn't close it: the submodule needed bumping, WASM needed rebuilding, and
the frontend's own defensive-handling gap (part of #844's scope) was unaddressed.

### Prompt 2: "Work on that problem on dedx_web side, commit and push when ready"

**AI response**: See Tasks below.

## Tasks

### Bump libdedx submodule + rebuild WASM

- **Status**: completed
- **Stage**: N/A (bugfix)
- **Files changed**: `libdedx` (submodule pin `60d05f0` → `9ec008f`, PR #144's merge commit)
- **Decision**: Rebuilt `static/wasm/libdedx.{mjs,wasm}` locally via `wasm/build.sh` purely
  to verify the fix end-to-end with Playwright — these files are gitignored (built by the
  `build-wasm` CI job from the submodule pin) and were not committed.
- **Verified directly against the rebuilt WASM** (`_dedx_get_material_list` /
  `_dedx_get_stp_table`): Boron is no longer listed as available for ASTAR/PSTAR/ICRU49/
  ICRU73/ICRU73_OLD (previously falsely claimed); MSTAR still lists it (genuinely
  tabulated, untouched by #144); the new `DEDX_AUTO` (id 10) succeeds for proton+Boron via
  Bethe-Bloch fallback. `dedx_get_program_list()` now returns 11 ids (added: 10) instead of 10.

### Hide the new DEDX_AUTO (id=10) from the UI, like DEDX_ICRU (id=9)

- **Status**: completed
- **Files changed**: `src/lib/state/compatibility-matrix.ts`, `docs/06-wasm-api-contract.md`
  §10.3, `docs/04-feature-specs/entity-selection.md` ("Hidden programs" row),
  `src/tests/unit/compatibility-matrix.test.ts`
- **Decision**: Verified in-browser (Playwright against the rebuilt WASM + dev server) that
  without this exclusion, `DEDX_AUTO` shows up as a raw, undescribed "AUTO" tile in the
  Advanced-mode Program picker, right alongside the existing polished "✦ Auto-select →
  ICRU 49" hero entry — a confusing duplicate, exactly the failure mode the existing
  `EXCLUDED_FROM_UI` comment warns about for id 9. Added `10` to the same set, matching the
  established precedent, rather than adopting `DEDX_AUTO` as a new user-facing feature
  (a separate, deliberate scope decision — see Issue below).
- Confirmed via Playwright that excluding it does **not** regress Boron support: the
  pre-existing, already-integrated `DEDX_DEFAULT` ("Default (Bethe)") program is a
  universal analytical fallback (Z 1–112) that was already in `AUTO_SELECT_CHAIN`'s final
  fallback (`availablePrograms[0]`) before this session — so proton+Boron in Basic mode now
  cleanly resolves to "Calculated with Default (Bethe) (auto-selected)" with a real
  computed value (CSDA range 3.973 cm, STP 1.417 keV/µm), no error, no confusing tile.

### Friendly message for LibdedxError code 202 (DEDX_ERR_COMBINATION_NOT_FOUND)

- **Status**: completed
- **Files changed**: `src/lib/wasm/types.ts` (new exported constant), `src/lib/wasm/libdedx.ts`
  (new `describeLibdedxError()` helper applied at all 7 error-construction sites: `calculate()`
  STP/CSDA calls, `getInverseStp`, `getInverseCsda`, `getBraggPeakStp`,
  `calculateCustomCompound`, and the custom-compound inverse/Bragg variants),
  `src/tests/unit/libdedx-service-impl.test.ts`
- **Decision**: Translated the message once, at the single shared throw-site layer in
  `libdedx.ts`, rather than special-casing code 202 separately in the Basic-mode banner
  (`calculator-engine.svelte.ts`) and the Advanced-mode per-cell tooltip
  (`advanced-result-cells.svelte`/`multi-entity-cells.svelte`) — both already render
  `LibdedxError.message` verbatim (`Calculation error: {message}` / `title={message}`), so
  fixing the source message fixes both surfaces for free. Addresses the "cheapest" option
  from #844's suggested direction, as defense-in-depth for any remaining case that still
  reaches a real 202 (e.g. an explicit, invalid `program=` forced via URL).
- Research (an Explore sub-agent) found Advanced mode's "silently renders blank cells" claim
  in #844 was already **partially** fixed by a later, unrelated PR — `advanced-result-cells.svelte`
  already renders `— ⚠️` with a `title` tooltip for any `LibdedxError`, it just wasn't a
  friendly message. This session's fix supplies the missing friendly text without touching
  that already-correct cell-rendering structure.

### "No available program" guard in the calculator engine

- **Status**: completed
- **Files changed**: `src/lib/state/calculator-engine.svelte.ts`,
  `src/tests/unit/calculator-state.test.ts`
- **Decision**: Split the existing single guard (`!resolvedProgramId || !particleId ||
  !materialId`) into two: silently do nothing when particle/material aren't selected yet
  (unchanged, normal initial state), but set an explicit `LibdedxError(-1, "No available
  program supports this particle + material combination.")` when both are selected and
  `resolvedProgramId` is still null. In practice this is a rare defensive branch (the
  Default/Bethe universal fallback means built-in elements essentially always resolve to
  *something*), reachable mainly for the electron/ESTAR-unimplemented case or a
  hypothetical future gap — added as a safety net so that case fails loudly rather than
  silently clearing results with zero feedback (same failure class the issue flagged for
  Advanced mode).

### Verification

- **Status**: completed
- Full Vitest suite: 1954/1954 passing (4 new tests added — 2 in
  `libdedx-service-impl.test.ts` for the 202 message, 1 in `compatibility-matrix.test.ts`
  for the DEDX_AUTO exclusion, 2 in `calculator-state.test.ts` for the no-program-available
  guard).
- `pnpm lint`: clean (0 errors; 1 pre-existing unrelated warning in `coverage/`).
- `pnpm check` (svelte-check + tsc): 0 errors, 0 warnings.
- `pnpm run format:check`: clean.
- Manually verified end-to-end against a real rebuilt WASM binary + dev server via
  throwaway Playwright driver scripts (removed before commit): the original repro URL
  (`/calculator?particle=1&material=5`) now shows a clean, real, well-labeled Boron result
  instead of the opaque `LibdedxError code: 202` banner; the Program picker no longer shows
  a raw "AUTO" tile; proton+water (control) unaffected.

## Issue (discovered, not fixed this session)

While testing the Advanced-mode repro URL
(`/calculator?mode=advanced&particle=1&material=5&program=7`), found that it silently
loads **Water** instead of Boron, with no warning. Root cause (confirmed via a read-only
Explore sub-agent): `setupUrlHydration()` in `calculator-page-orchestrator.svelte.ts`
applies `selectParticle()` → `selectMaterial()` → `selectProgram()` in that order;
`selectProgram()`'s self-healing re-validates the material *just* set against the new
program and silently swaps it to Water if incompatible, with no `fromUrlWarning`-style
message shown. This is a **pre-existing, general** bug (any `program=` + `material=` URL
conflict, not Boron-specific) that was previously masked by #844's stale table (which made
Boron look "available" for ICRU49, so the self-heal never triggered — the user hit the bad
202 error instead). Fixing the table exposed this separate, riskier-to-fix issue
underneath it. Not fixed in this session — reordering URL hydration touches a
central, widely-depended-on code path and deserves its own dedicated change with test
coverage, and creating a new tracking issue wasn't authorized for this session. Flagged
directly to the user instead.
