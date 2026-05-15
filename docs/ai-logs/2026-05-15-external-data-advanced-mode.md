# 2026-05-15 — External data in Calculator Advanced Mode

## Session Narrative

### Prompt 1: Feature request — external programs in advanced mode comparison

**AI response**: Created branch `feat/external-data-in-advanced-mode` and produced a
detailed plan covering: widening `MultiProgramState` to `EntityId`, updating
`MultiProgramPicker` with an "External" section, wiring the calculator page, and adding
an external program calculation loop. Plan was accepted and autonomous implementation
began.

### Prompt 2: Implement the plan, commit often, run E2E tests

**AI response**: Implemented all four code layers and tests:

1. **`src/lib/state/multi-program.svelte.ts`** — Changed every `number` program-ID type
   to `EntityId` (`number | ExtRef`). `encodeMultiProgramUrl` now calls
   `formatEntityIdList` so ExtRef strings survive the URL round-trip.

2. **`src/lib/components/multi-program-picker.svelte`** — Added
   `availableExternalPrograms` prop and an "External" section in the listbox with a
   🔗 prefix per spec §7.1. `compatibleIds` widened to `Set<EntityId>`.

3. **`src/lib/components/result-table.svelte`** — `comparisonResults`,
   `visibleProgramIds`, drag-handle state variables and `getProgramName` all updated to
   `EntityId`. The helper looks up both built-in and external program names.

4. **`src/routes/calculator/+page.svelte`** — Added external program calculation loop
   to the multi-program `$effect`: splits `selectedProgramIds` into numeric (WASM path)
   and ExtRef (external path), resolves particle/material local IDs via
   `externalRefsForBuiltinParticle` / `externalRefsForBuiltinMaterial`, calls
   `externalDataService.interpolateAt()` for each energy, and assembles a
   `CalculationResult`. URL restore switched from `parsedProgramIds` (numeric-only) to
   `parsedProgramEntityIds`. Picker call updated to pass `availableExternalPrograms` and
   combined `compatibleIds`.

5. **`src/tests/unit/multi-program-state.test.ts`** — 22 new tests covering ExtRef
   add/remove/reorder, mixed-ID `encodeMultiProgramUrl` round-trips, and
   `decodeMultiProgramUrl` with ExtRef strings. All 56 tests pass.

6. **`tests/e2e/external-data-advanced.spec.ts`** — 5 E2E tests using the real SRIM
   `.webdedx` store from S3. A `beforeEach` hook proxies S3 responses with
   `Access-Control-Allow-Origin: *` (the bucket has no CORS headers; zarrita's `fetch()`
   is blocked without this). Tests: picker shows External section, adding creates column,
   STP values are numeric, URL round-trip after reload.

### Key bugs found during E2E

**CORS**: `https://s3.cloud.cyfronet.pl/dedxweb/srim-gui.webdedx/` does not send
`Access-Control-Allow-Origin` headers. Playwright's browser (same-origin policy) blocks
all cross-origin fetches. Fixed in tests via `page.route()` to inject CORS headers for
OPTIONS preflights and GET responses.

**URL round-trip race (root cause bug)**: After reload the `programs` URL param was
silently dropped. Root cause: the URL-update effect (declared at line 318) runs before
the `multiProgState`-creation effect (line 636) in Svelte 5's creation-order schedule.
On first flush after the `.then()` callback, the URL-update effect saw `multiProgState
=== null` in advanced mode and rebuilt the URL without a `programs` param, overwriting
`window.location.search` before the `multiProgState` effect could read it.

Fix: guard the URL-update effect to return early when `isAdvancedMode.value && multiProgState === null`.
The effect re-fires once `multiProgState` is set (it's already a reactive dep), at which
point the full `[7, "ext:srim:srim-gui-2013"]` list is correctly encoded.

## Tasks

### Widen MultiProgramState to EntityId

- **Status**: completed
- **Files changed**: `src/lib/state/multi-program.svelte.ts`
- **Decision**: Used `number | ExtRef` (`EntityId`) throughout. `formatEntityIdList`
  used in `encodeMultiProgramUrl` so `:` in ExtRef strings are written literally (RFC 3986
  permits them in query values).

### Update MultiProgramPicker

- **Status**: completed
- **Files changed**: `src/lib/components/multi-program-picker.svelte`
- **Decision**: External section added after built-in list with 🔗 prefix per spec.

### Wire calculator page

- **Status**: completed
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: External program calculation uses `externalDataService.interpolateAt()`
  inside the same `setTimeout`-guarded async block as the WASM path. CSDA uses `[]` when
  `hasCsdaRange=false` (store has no csda_range array; the STP-integration path in
  `ExternalDataService.getCsda()` handles the conversion).

### Fix URL-update race condition

- **Status**: completed
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Guard `if (isAdvancedMode.value && multiProgState === null) return;` in
  the URL-update effect. This is minimal and correct: the URL-update effect becomes a
  reactive dep of `multiProgState`, so it re-fires once multiProgState is initialized.

### Unit tests

- **Status**: completed
- **Files changed**: `src/tests/unit/multi-program-state.test.ts`

### E2E tests

- **Status**: completed
- **Files changed**: `tests/e2e/external-data-advanced.spec.ts` (new)
- **Issue**: S3 bucket has no CORS headers. Tests inject them via `page.route()`.
  In production the app works if the data provider serves with `Access-Control-Allow-Origin: *`
  (documented in `docs/03-architecture.md §10`).
