# Stage 7.5 External Data App Integration Plan

Date: 2026-05-13
Branch: `qwen/stage-7-5-external-data`
Status: handoff plan only. No app implementation code has been written in this session.

This plan is the handoff for implementing Stage 7.5: user-hosted Zarr v3
`.webdedx` external stopping-power data in Calculator and Plot. It intentionally
does not record any real user-hosted store URLs. Use real stores only through
local shell variables or manually pasted browser URLs during smoke testing.

## 1. Current Snapshot

Completed before this app-integration handoff:

- Branch `qwen/stage-7-5-external-data` exists and was clean before this handoff work.
- SRIM GUI/headless reference Arrow exports were inspected.
- Python tooling was committed for inspecting and converting SRIM reference data.
- Ignored local `.webdedx` stores were generated under `data/`.
- The generated stores are valid Zarr v3 `.webdedx` stores with one program each, shape `[92, 381, 165]`, STP only, and no CSDA range array.
- The user-hosted remote stores were manually validated for root GET, array GET, shard `HEAD`, suffix Range GET, and data Range GET after CORS was adjusted.
- Stage 7.5 app integration has not started. The first code slice should be URL and ID primitives.

Uncommitted handoff/docs files created by this stop-work request:

- `docs/prompts/2026-05-13-stage7-5-external-data-implementation-plan.md`
- `docs/prompts/2026-05-13-stage7-5-external-data-claude-handoff.md`
- `docs/ai-logs/2026-05-13-stage7-5-external-data-app.md`
- `docs/ai-logs/README.md`
- `CHANGELOG-AI.md`

## 2. Non-Negotiable Constraints

1. Do not hardcode, commit, or log the two real user-hosted external data URLs.
2. Do not commit generated `.webdedx` stores, conversion reports, browser outputs, build outputs, `.venv`, or local URL config.
3. Use Svelte 5 runes only: `$state`, `$derived`, `$effect`, `$props`, `$bindable`.
4. Do not use Svelte 4 patterns: `export let`, `$:`, `createEventDispatcher()`, `onMount`, `onDestroy`, or `svelte/store` auto-subscriptions.
5. In `$effect`, synchronously snapshot reactive dependencies before `await`, `.then()`, or timers.
6. Wrap `replaceState(..., page.state)` in `untrack` when used inside reactive effects.
7. Keep external data separate from the WASM service. Do not change the libdedx C/WASM API for Stage 7.5.
8. Activation is URL-only through `extdata`. Do not add UI for adding external sources.
9. No persistent browser cache for external data. In-memory page-session caching is fine.
10. Keep zarrita's default shard behavior where possible so the browser path exercises shard `HEAD` plus Range GETs.
11. Auto-select must remain built-in-only. It must never choose an external program.
12. External inverse lookup and external calculations for user-created custom compounds are out of scope unless the spec is explicitly changed.

## 3. Authoritative Inputs

Read these before implementation:

- `CLAUDE.md` for Claude Code session rules.
- `.github/copilot-instructions.md` for shared project conventions and logging format.
- `docs/00-redesign-plan.md` for Stage 7.5 status.
- `docs/progress/` for completed-stage context.
- `CHANGELOG-AI.md` for recent AI work.
- `docs/04-feature-specs/external-data.md` for the feature behavior.
- `docs/04-feature-specs/shareable-urls-formal.md` for URL grammar, duplicate handling, and canonical order.
- `docs/04-feature-specs/calculator.md`, `plot.md`, `entity-selection.md`, and `unit-handling.md` for cross-spec consistency.
- `docs/06-wasm-api-contract.md` and `src/lib/wasm/**` to confirm the WASM boundary stays unchanged.
- `prototypes/extdata-formats/browser/src/main.ts` for the proven zarrita browser access pattern.
- `.opencode/lessons-learned.md` if using opencode. Claude Code can still read it for project pitfalls.

## 4. Data Facts From Prep Work

Do not infer SRIM details from UI prose alone. Use these known facts when testing
with the generated or user-hosted SRIM reference stores:

- Raw Arrow schema was `energy_keV`, `Se`, `Sn`, `range_A`, `long_strag_A`, `lat_strag_A`.
- Raw `energy_keV` is projectile kinetic energy in keV.
- Raw `Se` and `Sn` are in `MeV/(mg/cm2)`.
- Exported STP is `(Se + Sn) * 1000` in `MeV cm2/g`.
- Raw `range_A` is projected range, not CSDA. Therefore `csda_range` is omitted.
- The app must treat missing CSDA as valid and render range as unavailable/dash.
- The generated stores use Zarr v3 LZ4 shards and no persistent app cache.
- Remote hosting must support CORS for `GET` and `HEAD`, `Range` requests, and exposed range/content headers.

## 5. Implementation Slices

Implement as small commit-sized vertical slices. Run `pnpm guard:staged` before
each commit. Do not push unless the user asks.

### Slice 1: External URL and ID Primitives

Goal: make `extdata` and `ext:{label}:{id}` first-class in pure TypeScript with
focused tests, before loader or UI work.

Create proposed modules:

- `src/lib/external-data/types.ts`
- `src/lib/external-data/ids.ts`
- `src/lib/external-data/url.ts`
- `src/lib/external-data/index.ts`
- `src/tests/unit/external-data-url.test.ts`

Recommended public types:

```ts
export type ExternalSourceLabel = string;
export type ExternalEntityLocalId = string;
export type ExtRef = `ext:${ExternalSourceLabel}:${ExternalEntityLocalId}`;
export type EntityId = number | ExtRef;

export interface ExternalSourceDescriptor {
  label: ExternalSourceLabel;
  url: string;
}

export interface ParsedExtdataParams {
  sources: ExternalSourceDescriptor[];
  errors: ExternalDataUrlError[];
}
```

Recommended helper APIs:

```ts
export function isExternalSourceLabel(value: string): boolean;
export function isExternalEntityLocalId(value: string): boolean;
export function isExtRef(value: unknown): value is ExtRef;
export function parseExtRef(value: string): { label: string; localId: string } | null;
export function formatExtRef(label: string, localId: string): ExtRef;
export function parseEntityId(value: string | null): EntityId | null;
export function formatEntityId(id: EntityId): string;
export function parseExtdataParams(params: URLSearchParams): ParsedExtdataParams;
export function appendExtdataParams(
  params: URLSearchParams,
  sources: ExternalSourceDescriptor[],
): void;
export function externalDataQueryPrefix(sources: ExternalSourceDescriptor[]): string[];
```

Rules to implement:

- Label regex: `/^[A-Za-z0-9_-]+$/`.
- External local ID regex: `/^[A-Za-z0-9_-]+$/`.
- `ext-ref` syntax: `ext:{label}:{entityLocalId}`.
- Numeric built-in IDs are positive integers only.
- `extdata` values are `{label}:{percent-encoded-url}`.
- Parse `URLSearchParams.getAll("extdata")` and preserve source declaration order.
- Split each `extdata` value on the first literal colon after component decoding.
- Duplicate external labels are parse errors. Recommended behavior: drop all sources using that duplicated label and return an error, so all references to that label become invalid instead of binding unpredictably.
- Invalid labels are parse errors and should be ignored as unknown external data params.
- Ordinary duplicate non-`extdata` params keep existing last-wins behavior.
- Canonical order is `urlv`, then all `extdata` params in source declaration order, then normal params.

Important serializer warning:

- The current `calculatorUrlQueryString` globally replaces `%3A` with `:`.
- That is unsafe once `extdata` exists because it can turn the encoded URL part, for example `https%3A`, back into a literal colon, violating the formal URL grammar.
- Add or reuse a serializer that handles `extdata` specially: emit `extdata={label}:{encodeURIComponent(url)}` with only the label separator colon literal. Other URL params may still keep readable commas/colons where already allowed.

Modify existing files in this slice:

- `src/lib/utils/calculator-url.ts`
  - Add `externalSources?: ExternalSourceDescriptor[]` to `CalculatorUrlState`.
  - Decode `extdata` before last-wins param resolution drops duplicates.
  - Encode `urlv`, then `extdata`, then the current calculator params.
  - Keep basic `program` numeric/auto unless the formal contract is updated.
  - In advanced mode, allow `selectedProgramIds` and `hiddenProgramIds` to be `EntityId[]`.

- `src/lib/utils/plot-url.ts`
  - Add `externalSources?: ExternalSourceDescriptor[]` to `PlotUrlInput` and `PlotUrlDecoded`.
  - Allow series triplet components to be `EntityId`.
  - Decode and encode mixed built-in/external triplets such as `ext:label:program.ext:label:p.ext:label:water`.

- `src/lib/state/multi-program.svelte.ts`
  - Introduce mixed-ID helpers for `programs` and `hidden_programs` parsing/serialization.
  - Do not dispatch external programs to WASM yet.

Tests for this slice:

- `parseExtRef` accepts valid refs and rejects missing/invalid label/local ID.
- `formatExtRef` throws or rejects invalid label/local ID.
- `parseExtdataParams` preserves order.
- `parseExtdataParams` drops duplicate labels and reports errors.
- Canonical serialization emits `urlv`, then repeated `extdata`, then normal params.
- The external URL portion remains percent-encoded, especially `https%3A`.
- Calculator advanced `programs` and `hidden_programs` round-trip mixed numeric and external IDs.
- Plot series round-trips mixed built-in/external triplets.
- Ordinary duplicate params still use last-wins semantics.

Verification and commit gate:

```bash
pnpm test -- src/tests/unit/external-data-url.test.ts src/tests/unit/calculator-url.test.ts src/tests/unit/plot-url.test.ts
pnpm guard:staged
git status --short
git commit -m "feat: add external data URL primitives"
```

### Slice 2: Validated Zarrita Loader and External Lookup Service

Goal: load `.webdedx` metadata and provide lookup/interpolation without touching UI.

Create proposed modules:

- `src/lib/external-data/loader.ts`
- `src/lib/external-data/validation.ts`
- `src/lib/external-data/units.ts`
- `src/lib/external-data/interpolation.ts`
- `src/lib/external-data/service.ts`
- `src/tests/unit/external-data-loader.test.ts`
- `src/tests/unit/external-data-service.test.ts`

Access pattern:

```ts
const store = new FetchStore(url);
const group = await open(root(store), { kind: "group" });
const stp = await open(root(store).resolve(`${programId}/stp`), { kind: "array" });
const slice = await get(stp, [particleIndex, materialIndex, null]);
```

Implementation requirements:

- Use zarrita `FetchStore`, `open`, `root`, and `get`.
- Keep default shard suffix behavior so `HEAD` is exercised.
- Add an injectable fetch wrapper only for abort signals, error classification, metadata size checks, and tests.
- Validate root attrs before exposing entities.
- Build source metadata, entity indexes, and program array metadata.
- Fetch per-particle/material table data on demand.
- Cache decoded tables in memory by source label, local program ID, local particle ID, and local material ID.
- Do not use `localStorage` or IndexedDB.

Validation checklist:

- Root `zarr.json` exists and is valid JSON.
- `webdedx.magic === "webdedx-extdata"`.
- Supported `webdedx.formatVersion`.
- Required metadata keys exist.
- `webdedx.units.energy`, `webdedx.units.stoppingPower`, and optional `webdedx.units.csdaRange` are supported.
- `webdedx.energyGrid` is strictly increasing, positive, finite, and within size limits.
- Program, particle, and material IDs match `/^[A-Za-z0-9_-]+$/`.
- Duplicate IDs within each entity type reject the source.
- Max sources: 5.
- Max programs per source: 100.
- Max particles per source: 1000.
- Max materials per source: 10000.
- Max points per table: 10000.
- Max root metadata size: 1 MB.
- Max total computed file size: 1 GB, where available from metadata.
- `materials[].density`, if present, is positive and finite.
- `materials[].ival`, if present, is positive and finite.
- `particles[].pdgCode`, if present, is a positive integer and unique.
- `materials[].icruId`, if present, is a positive integer.
- `materials[].atomicNumber`, if present, is an integer in 1..118.
- Reject material entries that specify both `icruId` and `atomicNumber`.
- Missing `csda_range` array is valid.
- If `csda_range` array exists, `webdedx.units.csdaRange` must be present or defaulted only if the spec allows that exact behavior.
- STP array shape must match `[particles.length, materials.length, energyGrid.length]`.

Unit conversion requirements:

- Energy grid internal form: MeV/nucl where needed by current app code.
- STP internal form: `MeV cm2/g` / `MeV·cm²/g` mass stopping power.
- CSDA internal form: `g/cm2` when present.
- If source CSDA unit is `cm`, convert with density when density is available; otherwise reject or mark unavailable for that material according to the spec.
- If material density is absent, disable linear STP units (`keV/um`, `MeV/cm`) for that material; mass stopping power remains valid.

Interpolation requirements:

- Default external interpolation: log-log axes with piecewise linear interpolation.
- Support lin-lin when advanced options request `interp_scale=lin-lin`.
- Support spline only if the existing advanced options UI exposes spline and a local helper already exists or is simple enough to implement safely.
- Out-of-range energies are per-row failures. Do not clamp.
- `nPoints < 2`, non-finite values, non-positive energies, or non-positive STP reject the table.
- Non-monotonic STP is warning only, not rejection.

Tests:

- Valid minimal STP-only metadata loads.
- Missing CSDA is accepted.
- Missing density is accepted but marks linear units unavailable.
- Invalid magic/version/schema rejects with a classified error.
- Duplicate labels/IDs reject appropriately.
- Unit conversion covers SRIM-like STP mass units.
- Interpolation returns expected values for log-log and lin-lin fixtures.
- Out-of-range energy returns a row error.
- Cache reuses a decoded table for repeated requests.
- Mock fetch covers root metadata, array metadata, `HEAD`, suffix Range, and data Range behavior.

Verification and commit gate:

```bash
pnpm test -- src/tests/unit/external-data-loader.test.ts src/tests/unit/external-data-service.test.ts
pnpm guard:staged
git status --short
git commit -m "feat: load external webdedx stores"
```

### Slice 3: Merge External Entities Into Compatibility and Selection State

Goal: make the entity system understand mixed built-in/external coverage without
performing calculations yet.

Modify likely files:

- `src/lib/wasm/types.ts`
- `src/lib/state/compatibility-matrix.ts`
- `src/lib/state/entity-selection.svelte.ts`
- `src/lib/components/entity-selection-comboboxes.svelte`
- `src/lib/components/entity-combobox.svelte`
- `src/lib/config/particle-aliases.ts`
- `src/lib/config/particle-names.ts`
- `src/lib/config/material-names.ts`
- `src/lib/utils/element-data.ts`

Type direction:

- Introduce a shared `EntityId = number | string` or import the external-data `EntityId` type where appropriate.
- Keep `LibdedxService` method signatures numeric-only.
- Update compatibility maps to support string keys while preserving existing numeric behavior.
- Add reverse lookup metadata so a UI entity can map back to external source label and local entity indexes.

Merge rules:

- Programs are never merged. External programs are distinct and grouped under External.
- Particles merge by `pdgCode`, then `(Z, A)`, then become external-only.
- Built-in particle matching may need a helper using existing particle alias/config data because current `ParticleEntity` does not expose charge number or PDG code.
- Materials merge by `icruId`, then pure-element `atomicNumber`, then exact case-insensitive name, then become external-only.
- Merged particles/materials should not show the external-only marker.
- External-only particles/materials should show an external marker and group treatment.
- Bidirectional filtering must work for mixed built-in/external compatibility links.
- Auto-select only considers numeric built-in programs.

Tests:

- External programs appear in an External group.
- Merged water/proton-like entities do not duplicate selectors.
- External-only particle/material appears with marker.
- Selecting an external program filters to supported particles/materials.
- Selecting a merged material can reveal external program compatibility.
- Auto-select ignores external programs.

Verification and commit gate:

```bash
pnpm test -- src/tests/unit/compatibility-matrix.test.ts src/tests/unit/entity-selection*.test.ts src/tests/components/entity-selection-comboboxes.test.ts
pnpm guard:staged
git status --short
git commit -m "feat: merge external entities into selection"
```

### Slice 4: Calculator External Forward Calculations

Goal: Calculator can load external sources from URL, select external programs,
and calculate forward STP/CSDA rows through the external service.

Modify likely files:

- `src/routes/calculator/+page.svelte`
- `src/lib/state/calculator.svelte.ts`
- `src/lib/state/multi-program.svelte.ts`
- `src/lib/components/multi-program-picker.svelte`
- `src/lib/components/result-table.svelte`
- `src/lib/components/advanced-options-panel.svelte` if density/unit locks require UI updates.

Lifecycle:

- Parse `extdata` before restoring particle/material/program/rows.
- Load external source metadata in parallel while showing a blocking loading state.
- Build built-in compatibility after WASM is ready, then merge external coverage, then restore URL state.
- On external load failure, show blocking error with Retry and Load without external data.
- Load without external data removes all `extdata` params via `replaceState` and restores/reloads built-in-only state.

Calculation behavior:

- Numeric built-in programs still call `LibdedxService`.
- External programs call `ExternalDataService`.
- Custom compounds remain WASM-only. External custom compound calculation is out of scope.
- Missing CSDA renders as `null`/dash, not a failed STP row.
- External out-of-range energies use the existing out-of-range row status path.
- External per-program errors in multi-program mode should display consistently with Stage 7.4 error handling.
- External columns should carry the external marker in headers.
- Inverse lookup tabs should be disabled or gracefully no-op for external programs.

Important URL design checkpoint:

- `shareable-urls-formal.md` currently allows external IDs in `programs` and `hidden_programs`, but basic-mode `program` is defined as `auto` or numeric positive integer.
- `external-data.md` says external programs appear in the compact Program selector.
- Before encoding a basic-mode external program, decide whether to update the formal URL spec to allow `program=ext:...` or canonicalize single external selections through advanced `programs=ext:...`.
- Do not silently invent a URL form without syncing specs and tests.

Tests:

- Calculator with one external source loads, restores selectors, and computes STP.
- Mixed built-in/external advanced multi-program results render columns.
- External out-of-range row renders the expected row error.
- Missing CSDA shows dash while STP remains valid.
- Missing density locks or limits linear units for the affected material.
- Retry and Load without external data behave correctly and rewrite the URL.

Verification and commit gate:

```bash
pnpm test -- src/tests/unit/calculator*.test.ts src/tests/components/result-table.test.ts
pnpm guard:staged
git status --short
git commit -m "feat: calculate with external data"
```

### Slice 5: Plot External Series

Goal: Plot can load external sources from URL, restore external series, and render
external data on native grids with distinct styling.

Modify likely files:

- `src/routes/plot/+page.svelte`
- `src/lib/state/plot.svelte.ts`
- `src/lib/utils/series-labels.ts`
- `src/lib/utils/plot-utils.ts`
- `src/lib/components/jsroot-plot.svelte`
- `src/lib/components/plot-sidebar.svelte` or nearby selector/sidebar components.

Behavior:

- Load external metadata before URL restore, mirroring Calculator.
- Restore `series` triplets containing `ext:` refs after merge.
- External preview series fetches external table data on demand.
- External committed series use their own native energy grid.
- Mixed built-in/external axis ranges must account for each series grid and values.
- Committed external series are dashed.
- Preview already uses dashed style; avoid making every preview/external distinction ambiguous.
- External series labels include the external marker/source context.
- If CSDA is absent, CSDA quantity should be unavailable for that source if the plot UI exposes CSDA.

Tests:

- Plot URL `ext:` series restores correctly.
- Adding an external series renders it in the sidebar/list.
- External committed series gets dashed JSROOT style.
- Mixed built-in/external series axis range includes both series.
- Missing CSDA is handled for plot quantity choices.

Verification and commit gate:

```bash
pnpm test -- src/tests/unit/plot*.test.ts src/tests/components/jsroot-plot.test.ts
pnpm guard:staged
git status --short
git commit -m "feat: plot external data series"
```

### Slice 6: Source Attribution and Error UI Polish

Goal: make external-source state visible and recoverable in both pages.

Create or modify likely files:

- `src/lib/components/external-data-sources.svelte`
- `src/routes/calculator/+page.svelte`
- `src/routes/plot/+page.svelte`
- Existing alert/banner UI components.

Behavior:

- Show a loading banner while external metadata is loading.
- Disable selectors and calculation controls during load.
- Show blocking error states with actionable Retry and Load without external data.
- Add a reusable External Data Sources panel.
- Source attribution fields: name, version, author, description truncated, license, coverage, and URL.
- Render all external strings via normal Svelte text bindings. Do not use `innerHTML`.
- Long strings should truncate visually and not break layout.
- Do not log or commit the real URLs; runtime UI may show the URL because that is part of the feature.

Tests:

- Loading state disables selectors.
- Error state shows correct recovery controls.
- Load without external data removes `extdata` and restores built-in-only state.
- Source attribution renders text safely and truncates long values.

Verification and commit gate:

```bash
pnpm test -- src/tests/components/external-data-sources.test.ts src/tests/components/*external*.test.ts
pnpm guard:staged
git status --short
git commit -m "feat: show external data source status"
```

### Slice 7: Docs, Specs, E2E, and Full Verification

Goal: finish Stage 7.5 with documented status, full gates, and local-only real-data smoke.

Docs to update as needed:

- `docs/00-redesign-plan.md`
- `docs/progress/`
- `CHANGELOG-AI.md`
- `docs/ai-logs/YYYY-MM-DD-stage7-5-external-data-app.md`
- `docs/ai-logs/README.md`
- Specs only if implementation choices require cross-spec sync:
  - `docs/04-feature-specs/external-data.md`
  - `docs/04-feature-specs/shareable-urls-formal.md`
  - `docs/04-feature-specs/shareable-urls.md`
  - `docs/04-feature-specs/calculator.md`
  - `docs/04-feature-specs/plot.md`
  - `docs/04-feature-specs/entity-selection.md`
  - `docs/04-feature-specs/unit-handling.md`

Potential E2E file:

- `tests/e2e/external-data.spec.ts`

E2E should avoid committed real URLs. Use one of these patterns:

- Mock external-data fetches with Playwright route fixtures.
- Use an environment-gated smoke test that skips unless local placeholder env vars are set.
- Use local fixture stores only if tiny fixtures are committed intentionally and pass guard rules. Do not commit generated SRIM stores.

Full automated verification near the end:

```bash
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm exec playwright test tests/e2e/external-data.spec.ts
```

Manual local-only real-data smoke:

1. Start `pnpm dev`.
2. Open Calculator with manually supplied `extdata` params for the user-hosted GUI/headless stores.
3. Verify metadata loads, selectors show external programs, one external calculation works, missing CSDA renders as unavailable, and Load without external data rewrites the URL.
4. Open Plot with manually supplied `extdata` params.
5. Verify one external series and one mixed built-in/external plot.
6. Do not save the real URLs into docs, tests, source, logs, screenshots, or committed config.

Final commit gate:

```bash
pnpm guard:staged
git status --short
git commit -m "docs: mark external data app integration complete"
```

## 6. Known Risk Areas

1. Basic-mode external program URL encoding has a spec tension. Resolve it explicitly before Calculator URL writes for external programs.
2. `MaterialEntity.density` may currently be required, but external materials may omit density. Either make it optional with call-site updates or introduce external metadata that safely gates linear unit conversion.
3. Built-in particles do not expose PDG code or charge number. Add a metadata helper instead of changing the WASM ABI.
4. Existing compatibility maps are numeric-heavy. Convert carefully and keep WASM calls numeric-only.
5. Current URL string serialization decodes `%3A` globally. Fix before adding `extdata` output.
6. Testing Zarr shards without generated stores requires mocked fetch fixtures or tiny deliberate fixtures. Do not accidentally stage `data/*.webdedx/`.
7. Svelte effects in Calculator and Plot are already complex. Snapshot dependencies synchronously and use `untrack` for URL replacement.

## 7. Definition of Done

Stage 7.5 app integration is complete when:

- External `extdata` params parse, validate, canonicalize, and share correctly.
- Multiple external sources work by label.
- External metadata loads through zarrita and validates against the spec.
- External entities merge into selectors and compatibility filtering.
- Auto-select remains built-in-only.
- Calculator performs external forward STP interpolation and handles out-of-range/missing CSDA/missing density correctly.
- Calculator advanced multi-program supports mixed built-in and external programs.
- Plot supports external and mixed series on native grids, with external series visually distinct.
- Source attribution and load/error recovery UI are present.
- Specs/docs/logs are updated without recording real URL values.
- Full automated verification passes or any blocked command is documented clearly.
- `pnpm guard:staged` passes before every commit.
