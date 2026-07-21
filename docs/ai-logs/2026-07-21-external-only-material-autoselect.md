# 2026-07-21 — External-only material silently fails under Auto-select (#861)

## Session Narrative

### Prompt 1: Investigate a live bug report

The user opened the calculator with the SRIM external dataset loaded
(`extdata=srim:...`), then switched the material to "Epoxy" (the SRIM store
has two entries with that name, distinguished only by density — 1.18 and
1.85 g/cm³ — and the user picked the 1.18 one). Whatever energy was
entered, the app showed no stopping power / CSDA range, with no error.

**AI response**: Investigated end-to-end rather than guessing. Ruled out
the CORS issue from the prior session (`2026-07-21-srim-s3p-migration.md`)
by re-checking the live endpoint — CORS headers were present, data loads
fine. Confirmed via `libdedx/src/dedx_program_const.h`'s
`dedx_material_table` that "EPOXY" does not exist anywhere in the built-in
material list (id 276, part of the example URL, is actually "WATER" — the
user's material change happened after page load, so the URL param was a
red herring). Fetched the live SRIM `.webdedx` store's `zarr.json` and
found the two "Epoxy" entries directly:
`{"id": "mat-epoxy", "name": "Epoxy", "density": 1.18}` and
`{"id": "mat-epoxy-dup02-src050", "name": "Epoxy", "density": 1.85}` —
deliberately-crafted duplicate-name test fixtures, confirming these are
external-only materials (no built-in libdedx match at all).

Traced the actual state flow: `matchBuiltinMaterial()`
(`external-compatibility.ts`) correctly registers both as
`externalOnlyMaterials` (unique `ext:srim:mat-epoxy` / `...dup02-src050`
refs — the initial theory that duplicate-name matching collapsed them into
one was wrong). The real bug was one layer up: `resolveAutoSelect()`
(`entity-availability.svelte.ts`) only type-guarded the selected
*particle*, never the *material* — so when the material ID was an `ext:`
string, `computeAvailablePrograms()` silently dropped the material filter
(`typeof selection.selectedMaterialId === "number" ? ... : undefined`) and
Auto-select resolved to a mismatched built-in program (e.g. ICRU 49, id 7)
that has no data for "Epoxy" at all. `calculator-engine.svelte.ts`'s
`callService()` then hit its `typeof materialId === "number"` guard,
returned `null`, and the code cleared `calculationResults` without ever
setting `error` — total silent failure.

Confirmed with an isolated Vitest reproduction (using
`createEntitySelectionState` + the existing `makeExternalEntityStore()`
fixture, which already ships an "External Polymer" external-only material
fixture for exactly this scenario) before filing
[APTG/dedx_web#861](https://github.com/APTG/dedx_web/issues/861).

### Prompt 2: Close out #853 (unrelated prior report)

The user asked whether #853 ("SRIM links seems dead") could be closed.
Its screenshot showed the *old* host (`s3.cloud.cyfronet.pl`, 403) — the
exact problem already fixed by PR #859 (previous session). Re-verified
live via `curl`, then closed #853 with an explanatory comment.

### Prompt 3: Fix #861

**AI response**: Implemented the two-part fix described in the issue:

1. `entity-availability.svelte.ts`: `resolveAutoSelect()` now returns
   `null` immediately when the selected material is an external-only
   (`ext:`-prefixed) string — it can never be computed by a built-in
   program. `getResolvedProgramId()` now falls back to
   `getAvailableExternalPrograms(extCtx, particleId, materialId)` when
   `resolveAutoSelect()` comes back empty, so Auto-select correctly routes
   to the covering external program instead of a mismatched built-in one.
2. `calculator-engine.svelte.ts`: the `callService() === null` branch
   (previously reachable only for a genuine incompatible combination, e.g.
   external-only material paired with a resolved built-in program) now
   sets `error` with the same "No available program supports this
   particle + material combination." message already used by the sibling
   `resolvedProgramId === null` guard a few lines above, instead of
   silently clearing results.

Added a regression test in `entity-selection-state.test.ts` reusing the
existing `makeExternalEntityStore()` fixture's "poly" (External Polymer)
material: selecting it under Auto-select now resolves `resolvedProgramId`
to `"ext:srim:srim-2013-gui"` instead of a builtin id.

## Tasks

### Fix external-only material silently failing under Auto-select

- **Status**: completed
- **Stage**: entity-selection (bugfix, not a redesign-plan stage)
- **Files changed**:
  - `src/lib/state/entity-availability.svelte.ts`
  - `src/lib/state/calculator-engine.svelte.ts`
  - `src/tests/unit/entity-selection-state.test.ts`
- **Decision**: Fixed at the `getResolvedProgramId()` layer (fall back to
  the external program) rather than special-casing external-only
  materials deeper in `calculator-engine.svelte.ts`, since the resolution
  layer is the single place that already understands both built-in and
  external program spaces, and every caller of `resolvedProgramId`
  benefits automatically (no separate fix needed in the manual-explicit-
  program-selection path, since that already produces a string program id
  when the user picks an external program directly).
- **Issue**: None outstanding. Manually selecting a *built-in* program
  explicitly (not Auto-select) while an external-only material stays
  selected is still possible via the picker (not blocked by
  `isMaterialAvailable()`, which always returns `true` for external-only
  materials) and would hit the same `callService() === null` path — now
  covered by the added `error` message rather than a UI-level block, which
  is an intentional, narrower fix matching the issue's suggested direction.
- **Verification**: Full Vitest suite (1961 tests, including the new
  regression test) green; `svelte-check`/`tsc --noEmit`/ESLint/Prettier
  clean. Not verified in a live browser this session — no local
  `static/wasm/libdedx.{mjs,wasm}` build present; the fix and regression
  test are purely in the client-side entity-selection/calculator-engine
  state layer (mocked WASM service in tests), no WASM behavior involved.
