# 2026-05-14 — Stage 7.5 External Data App Integration (Slices 3–6)

## Session Narrative

### Prompt 1: Continue Stage 7.5 Slices 3–5

**AI response**: Continued from the prior session (context-compacted). Completed Slices 3, 4, and 5 of Stage 7.5.

**Slice 3 — External entity merging (completed in prior session)**:

- Created `src/lib/state/external-compatibility.ts` with `buildExternalCompatibilityContext`, `getAvailableExternalPrograms`, `EMPTY_EXTERNAL_CONTEXT`
- Particle merge: PDG code (primary) → (Z, A) fallback
- Material merge: ICRU ID → atomicNumber → case-insensitive name
- 20 unit tests in `src/tests/unit/external-compatibility.test.ts` — all pass

**Slice 4 — Calculator external calculations**:

- Wired `ExternalDataService` into `createCalculatorState`; external program IDs (string `ext:{label}:{id}`) route to `performExternalCalculation`
- Energy conversion: internal MeV/nucl × massA → total MeV for external service
- Added `externalSources: loadedExternalSources` to URL state (extdata params preserved across navigation)
- Added external loading indicator (skeleton) and error banner with Retry / Load-without-external-data actions
- Guarded multi-program and inverse-lookup WASM effects against external-only particles/programs (skip with early return)
- Fixed `exactOptionalPropertyTypes` violations in `custom-compounds.svelte.ts`, `wasm/types.ts`, `calculator-url.ts`, `advanced-options-panel.svelte`

**Key TypeScript issues resolved**:

- `ExternalOnlyMaterial` lacks `isGasByDefault` → guard everywhere with `"isGasByDefault" in material`
- `ExternalOnlyParticle.id` is string → guard all WASM calls with `typeof particleId !== "number"` early return
- `resolvedProgramId` widened to `string | number | null` → multi-program effects skip string IDs
- PDF metadata used wrong field names `massNum`/`chargeNum` (never existed on `ParticleEntity`) — fixed to `massNumber` and guard for external particles
- `CalculatorUrlState.materialIsGas?: boolean` → changed to `?: boolean | undefined` to accept spread results

**Slice 6 — Source attribution and plot page external loading**:

- Added `parseExtdataParams` + `externalDataService.loadSource()` call chain to plot page entity state init, mirroring calculator pattern
- Added `externalError` state + blocking error banner (Retry / Load-without-external-data) to plot page
- Added `externalSources: loadedExternalSources` to plot URL encoding so extdata params survive navigation
- Created `ExternalSourcesBadge` component rendering loaded sources as pills with label, name, and optional version
- Mounted badge below entity selectors on both calculator and plot pages
- All 1237 unit tests pass; TypeScript error count 168 → 61 (all remaining are pre-existing)

**Slice 5 — Plot page external entity types**:

- Fixed all new TypeScript errors in `src/routes/plot/+page.svelte` introduced by entity type widening
- Preview effect: skips if `resolvedProgramId` is string (external program has no `getPlotData` API)
- `handleAddSeries`: guards external-only particles
- Widened `getParticleLabel` to accept `{ id, name, symbol }` covering both `ParticleEntity` and `ExternalOnlyParticle`
- Fixed URL encoding to pass numeric-only IDs
- Fixed `AdvancedOptionsPanel` props in plot template with `{@const}` narrowing

**Slice 7 — Verification**:

- Confirmed both external stores are accessible and return valid zarr v3 JSON metadata
- Loaded STP arrays via zarrita in Node; read proton + liquid water STP at 1–200 MeV total
- SRIM-GUI values vs PSTAR: differences 0.4–6.5% (within expected SRIM/NIST systematic spread)
- Alpha (He-4) in water at 4–100 MeV total: values physically consistent (Z²-scaling gives ~4× higher STP than proton at same velocity, Bragg curve peak visible around 1 MeV/nucl)
- Energy conversion (MeV/nucl × massA → total MeV for external lookup) confirmed correct
- `pnpm build` succeeds, 1237 unit tests pass, 61 pre-existing TypeScript errors (none new)

## Tasks

### Slice 3: External entity merging

- **Status**: completed
- **Stage**: Stage 7.5 external data app integration
- **Files changed**: `src/lib/state/external-compatibility.ts`, `src/tests/unit/external-compatibility.test.ts`
- **Decision**: PDG code primary merge, (Z,A) fallback; ICRU ID → atomicNumber → name for materials

### Slice 4: Calculator external calculations

- **Status**: completed
- **Stage**: Stage 7.5
- **Files changed**: `src/routes/calculator/+page.svelte`, `src/lib/state/calculator.svelte.ts`, `src/lib/components/advanced-options-panel.svelte`, `src/lib/state/custom-compounds.svelte.ts`, `src/lib/wasm/types.ts`, `src/lib/utils/calculator-url.ts`
- **Decision**: External programs skip multi-program mode (only built-in supported); inverse lookups skip for external particles/programs

### Slice 5: Plot page external entity types

- **Status**: completed (external program preview not implemented — skip for external programs)
- **Stage**: Stage 7.5
- **Files changed**: `src/routes/plot/+page.svelte`, `src/lib/utils/particle-label.ts`
- **Decision**: Plot preview cleared for external programs; series add blocked; URL encoding uses numeric IDs only for built-in compatibility

### Slice 6: Source attribution and plot page external loading

- **Status**: completed
- **Stage**: Stage 7.5
- **Files changed**: `src/lib/components/external-sources-badge.svelte` (new), `src/routes/plot/+page.svelte`, `src/routes/calculator/+page.svelte`
- **Decision**: ExternalSourcesBadge component shows loaded source labels and metadata names (name + optional version) as pills below entity selectors; plot page now mirrors calculator's external source loading (parseExtdataParams + externalDataService + error banner + externalSources in URL state)
