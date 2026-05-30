# 2026-05-30 — Stopping-power output units in the calculator (#670)

## Session Narrative

### Prompt 1: "Work on #670, make PR when ready, ensure static tests pass, create AI log"

**AI response**: Read issue #670 — add a stopping-power **output unit**
selector to the Advanced calculator: the STP column header becomes a dropdown
offering `keV/µm` · `MeV/cm` · `MeV·cm²/g` (same set/order as the plot page),
encoded in the shared `sunit=` URL param, reflected in CSV/PDF exports, with a
mobile bottom sheet. Mapped the codebase before planning.

### Prompt 2–4: planning + a localStorage review

**AI response**: Produced a plan. Two decisions were taken with the user:

1. **Cross-page sharing** — the user chose to **unify on `sunit=` everywhere**
   (plot migrates off `stp_unit=` but keeps reading it as a legacy fallback) so
   one literal param name drives both pages.
2. **No `localStorage`** — at the user's request the persistence/fallback layer
   was dropped. The URL `sunit=` is the single source of truth; the choice also
   carries across in-app navigation via a shared in-memory `$state`. A bare URL
   with no `sunit=` shows the default `keV/µm` (the issue's "fresh tab restores
   last choice" criterion is intentionally not met — noted in the PR).

A read-only review of existing `localStorage` usage was produced (14 keys, one
wrapper in `custom-compounds.svelte.ts`, mixed `dedx_` / `webdedx.` prefixes).

### Prompt 5: "start implementation, remember about adding e2e tests"

**AI response**: Implemented the feature (see Tasks), kept the full static
suite green except 3 pre-existing environmental failures
(`guard-forbidden-files.test.ts`, which also fail on a clean tree), and added
Playwright specs.

## Tasks

### STP output unit selector (#670)

- **Status**: completed
- **Stage**: Stage 8 (calculator v2 / shareable URLs)
- **Key decisions**:
  - **Render-time conversion.** The calc engine now stores the **raw mass**
    stopping power (`MeV·cm²/g`); `computeRows`/`parseRow` converts to the
    display unit via `convertStpMass(mass, density, unit)`. This matches what
    the multi-entity and plot paths already did, makes a unit switch a pure
    re-render (no WASM recompute, enables the one-shot tint), and keeps Basic
    mode + exports consistent for free (they read the now-converted
    `row.stoppingPower` and the `stpDisplayUnit` label).
  - **Override vs. default.** `getStpDisplayUnit()` returns an explicit user
    choice (shared `stpOutputUnit` store) when set, else the existing
    aggregate-state default. So pre-existing URLs/sessions render identically;
    `sunit=` is emitted only when an explicit choice exists.
  - **Shared codec.** Extracted `stpUnitToToken`/`tokenToStpUnit` (+ `STP_UNITS`,
    `tokenToStpUnitOrNull`) to `src/lib/utils/stp-unit-codec.ts`; `plot-url.ts`
    re-exports them. Unknown/missing token ⇒ `keV/µm`.
  - **Cross-page sharing** via shared in-memory `stpOutputUnit` ($state) +
    unified `sunit=` URL param; plot reads `sunit` first, `stp_unit` as legacy
    fallback, and writes `sunit`.
- **Files changed**:
  - `src/lib/utils/stp-unit-codec.ts` (new) — shared codec.
  - `src/lib/state/stp-unit.svelte.ts` (new) — shared in-memory override.
  - `src/lib/components/results/stp-unit-header-menu.svelte` (new) — header
    dropdown: desktop popover + mobile bottom sheet (≥44 px rows, descriptors,
    backdrop dismiss), active unit checked, dashed-underline + chevron trigger.
  - `src/lib/utils/unit-conversions.ts` — `convertStpMass()`.
  - `src/lib/state/calculator-engine.svelte.ts` — store raw mass STP; dropped
    the calc-time keV/µm conversion and the now-unused `getStpDisplayUnit` arg.
  - `src/lib/state/calculator.svelte.ts` — override-aware `getStpDisplayUnit()`,
    `getConversionDensity()`, render-time conversion in `parseRow`,
    `setStpDisplayUnit()` action.
  - `src/lib/components/results/table-advanced.svelte` — header menu + tint.
  - `src/lib/components/result-table/advanced-header.svelte` — group-header menu
    (multi-entity); cells already converted via `stpDisplayUnit`.
  - `src/lib/utils/calculator-url.ts` + `calculator-url-sync.svelte.ts` +
    `calculator-page-orchestrator.svelte.ts` — `sunit=` encode / decode /
    restore.
  - `src/lib/utils/plot-url.ts`, `src/lib/state/plot.svelte.ts`,
    `plot-url-restore.svelte.ts` — unify on `sunit=` with `stp_unit=` fallback;
    plot `setStpUnit` mirrors to the shared store.
  - Docs: `shareable-urls.md` §3.9 + §3.14, `calculator.md`.
  - Tests: `stp-unit-codec.test.ts`, `stp-unit-header-menu.test.ts`,
    `calculator-state.test.ts` (override + render-time), `plot-url.test.ts` &
    `calculator-url.test.ts` (param rename + `sunit` round-trip + legacy
    fallback), `tests/e2e/stp-output-units.spec.ts` (6 specs: header convert +
    URL + reload, unknown-token fallback, plot shared `sunit`/legacy, multi-entity
    one-unit-all-columns, mobile bottom sheet).
- **Verification**: `pnpm run check` (svelte-check + tsc) clean; `pnpm lint`
  clean; `pnpm build` (static prerender) succeeds; `pnpm test` green except the
  3 pre-existing `guard-forbidden-files` env failures. E2E parse-validated via
  `playwright test --list` (browsers couldn't be downloaded in this sandbox;
  WASM-gated specs skip without the binary).
- **Issue / follow-ups**:
  - Per user instruction there is **no `localStorage`** persistence, so a fresh
    tab with a bare URL shows the default unit rather than the last choice.
  - CSV/PDF exports are self-describing for free (single-entity rows carry the
    converted value + `stpDisplayUnit` label); no exporter signature change.
