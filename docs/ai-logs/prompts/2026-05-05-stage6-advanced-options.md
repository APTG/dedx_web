# opencode task prompt — 2026-05-05

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation (TDD)
> **Branch:** `feat/stage6-advanced-options`
> **MCPs needed:** playwright, tailwind
> **TDD rule:** Write the failing test(s) first, then minimal impl, then refactor.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging rules.
2. `docs/04-feature-specs/advanced-options.md` — **the normative spec for this entire
   session**. Read the complete file. Pay special attention to:
   - §User Stories (two scenarios: density override for phantom, gas/condensed override)
   - §Inputs and their validation rules (density > 0; I-value > 0; Gas/Condensed toggle)
   - §Behavior — which fields are visible in basic vs advanced mode, validation timing,
     localStorage persistence, URL round-trip
   - §Reactivity Rules — which changes trigger a recalculation
   - §CSDA Interaction (§4) — `interpolationMethod=spline` bypasses the WASM CSDA call;
     CSDA is computed by JS numerical integration in that case
   - §URL Parameters (§7) — `agg_state`, `interp_scale`, `interp_method`, `mstar_mode`,
     `density`, `ival`
   - §Acceptance Criteria (the reviewer grades against these)
3. `docs/04-feature-specs/advanced-options.md` §Wireframes — the accordion layout, field
   ordering (density first), Gas/Condensed toggle, read-only "Built-in: …" label.
4. `docs/06-wasm-api-contract.md` §2.6 — `AdvancedOptions` TypeScript interface.
5. `src/lib/wasm/types.ts` — existing `AdvancedOptions` interface (already defined;
   verify it matches §2.6 of the contract).
6. `src/lib/wasm/libdedx.ts` — `LibdedxServiceImpl.calculate()` signature; it already
   accepts `options?: AdvancedOptions` — confirm it passes options to the C layer.
7. `src/lib/state/calculator.svelte.ts` — existing Calculator state; understand where
   `calculate()` is called to know where to thread `advancedOptions`.
8. `src/routes/calculator/+page.svelte` — Calculator page; you will add the accordion.
9. `src/routes/plot/+page.svelte` — Plot page; you will add the accordion there too
   (spec §3 specifies both pages get the panel).
10. `src/lib/utils/calculator-url.ts` — add `agg_state`, `interp_scale`, `interp_method`,
    `mstar_mode`, `density`, `ival` encode/decode.
11. `src/lib/utils/plot-url.ts` — add the same six params for the Plot page URL.
12. `src/tests/unit/calculator-url.test.ts` — add round-trip tests for new params.

Key source files (read before writing code):

- `src/lib/wasm/types.ts`
- `src/lib/wasm/libdedx.ts`
- `src/lib/wasm/__mocks__/libdedx.ts`
- `src/lib/state/calculator.svelte.ts`
- `src/lib/state/plot.svelte.ts`
- `src/routes/calculator/+page.svelte`
- `src/routes/plot/+page.svelte`
- `src/lib/utils/calculator-url.ts`
- `src/lib/utils/plot-url.ts`

---

## Tasks

### Task 1 — `AdvancedOptionsState` module + unit tests

**Create** `src/lib/state/advanced-options.svelte.ts`:

```typescript
// Module-level $state following the { value: T } wrapper pattern used elsewhere
export const advancedOptions: { value: AdvancedOptions } = $state({ value: {} });

export function resetAdvancedOptions(): void { ... }
export function persistAdvancedOptions(): void { ... }  // localStorage
export function loadAdvancedOptionsFromStorage(): void { ... }
export function encodeAdvancedOptionsUrl(opts: AdvancedOptions): URLSearchParams { ... }
export function decodeAdvancedOptionsUrl(params: URLSearchParams): AdvancedOptions { ... }
```

- Types: import `AdvancedOptions`, `AggregateState`, `InterpolationScale`,
  `InterpolationMethod`, `MstarMode` from `src/lib/wasm/types.ts`.
- localStorage key prefix: `dedx_adv_` (e.g. `dedx_adv_density`, `dedx_adv_mstar_mode`).
- URL parameter names: `agg_state`, `interp_scale`, `interp_method`, `mstar_mode`,
  `density`, `ival` (per `advanced-options.md` §7 and `shareable-urls-formal.md` §3.5).
- Defaults: all fields `undefined` (no override = use libdedx built-in).

**Unit tests** in `src/tests/unit/advanced-options-state.test.ts`:
- `resetAdvancedOptions()` clears all fields.
- URL encode/decode round-trip for each of the 6 params.
- Invalid values (negative density, unknown `mstar_mode` string) are silently ignored on
  decode (per spec §3 validation rules — only reject on user input, not URL restore).

### Task 2 — Advanced Options accordion component

**Create** `src/lib/components/advanced-options-panel.svelte`:

Props: `options: { value: AdvancedOptions }` (writable reactive reference), `materialIsGas: boolean` (determines Gas/Condensed toggle default label), `materialBuiltInDensity: number | undefined`, `materialBuiltInAggregateState: 'gas' | 'condensed' | undefined`.

Accordion structure (per spec wireframe):
1. **Density override** — number input, sci notation supported, placeholder = built-in
   density in g/cm³ (or sci notation if < 0.01). Clear button. Tooltip: gas-specific
   wording if `materialIsGas`. Validation: ρ > 0 only (no upper bound).
2. **I-value override** — number input, placeholder = built-in I-value in eV. Validation:
   I > 0.
3. **Aggregate state** — read-only "Built-in: Gas" / "Built-in: Condensed" label above
   a two-option Gas/Condensed toggle button. Hidden when material has no density (gas
   status unknown).
4. **Interpolation** — two orthogonal controls:
   - Axis scale: Log-log (default) / Lin-lin segmented control.
   - Method: Linear (default) / Spline segmented control.
5. **MSTAR mode** — dropdown with options A/B/C/D/G/H (default B). Visible only when
   selected program is MSTAR. Hide entirely when MSTAR not selected.

Styling: shadcn-svelte Accordion primitive (`bits-ui` accordion). Collapse by default.
Show density override value in accordion header when active (e.g. "Advanced Options
(ρ = 1.20 g/cm³)").

**Component tests** in `src/tests/components/advanced-options-panel.test.ts`:
- Density input: valid number updates `options.value.densityOverride`.
- Density input: negative value shows validation error, does not update state.
- Aggregate state toggle: switches between Gas/Condensed.
- MSTAR dropdown: hidden when program ≠ MSTAR; visible when MSTAR selected.

### Task 3 — Wire Advanced Options into Calculator page + URL sync

**In** `src/routes/calculator/+page.svelte`:

- Import and render `<AdvancedOptionsPanel>` inside the Advanced-mode section (below
  the entity selectors, above the energy input).
- Thread `advancedOptions.value` into the `calculate()` / `calculateMulti()` call.
- On page mount: call `loadAdvancedOptionsFromStorage()`, then check URL params for
  `agg_state` / `interp_scale` / `interp_method` / `mstar_mode` / `density` / `ival`
  (URL params take precedence over localStorage for initial state).
- URL sync: extend the existing URL update `$effect` to include advanced options params
  via `encodeAdvancedOptionsUrl()`.

**In** `src/lib/utils/calculator-url.ts`:

- Add the six advanced-options params to `encodeCalculatorUrl()` and `decodeCalculatorUrl()`.

**Unit tests** in `src/tests/unit/calculator-url.test.ts`:
- Round-trip with `density=1.20`, `ival=78`, `mstar_mode=a`, `interp_scale=linlin`,
  `interp_method=spline`, `agg_state=gas`.
- Partial params (only density set) round-trip correctly.

### Task 4 — Wire Advanced Options into Plot page + URL sync

**In** `src/routes/plot/+page.svelte`:

- Same accordion panel placement as Calculator (below series list, above the plot canvas).
- Thread `advancedOptions.value` into `getPlotData()` / `calculate()` calls.
- URL sync: extend `plot-url.ts` encoder/decoder for the six advanced-options params.

**In** `src/lib/utils/plot-url.ts`:

- Mirror the six params added to `calculator-url.ts`.

### Task 5 — Spline CSDA integration (JS-side, `interpolationMethod=spline`)

Per spec §4:

> When `interpolationMethod = 'spline'`, the WASM CSDA call is **bypassed**. CSDA range
> is computed by JS-side adaptive numerical integration of `1 / STP(E)` using the spline
> STP values already returned by the WASM call.

**Create** `src/lib/utils/csda-integration.ts`:

```typescript
export function integrateCsdaFromStp(
  energiesMeVperNucl: Float32Array,
  stpMeVcm2perG: Float32Array,
  density: number,   // g/cm³
): Float64Array;     // CSDA range in g/cm²
```

Use trapezoidal integration over `1/S(E)` with the energy grid from the WASM STP call.
The density is needed only for unit conversion if the result is displayed in cm — the
raw integration gives g/cm².

**Unit tests** in `src/tests/unit/csda-integration.test.ts`:
- Known analytical case: constant STP = S₀ over range [E₀, E₁] → CSDA = (E₁ - E₀) / S₀.
- Monotonically decreasing STP (like real data) → CSDA increases with integration range.

**Wire into Calculator + Plot** so that when `interpolationMethod === 'spline'`, the
CSDA column is filled from `integrateCsdaFromStp()` instead of the WASM CSDA call.

### Task 6 — E2E tests

**In** `tests/e2e/advanced-options.spec.ts` (create new):

- Open Calculator in Advanced mode, expand accordion, enter density 1.20 → assert URL
  contains `density=1.20`.
- Navigate away and back → density 1.20 restored from URL.
- Enter invalid density (negative) → validation error displayed, URL unchanged.
- Toggle aggregate state Gas → Condensed → assert `agg_state=condensed` in URL.
- Switch interpolation method to Spline → assert CSDA column re-populates (non-zero).

---

## Out of Scope for This Session

- Inverse Lookups (Stage 6.9) — separate session after Advanced Options.
- Custom Compounds density interaction (Stage 6.10) — Custom Compounds spec §5.4
  says density/I-value/aggregate-state overrides are **disabled** for custom compounds;
  wiring that disable logic is Stage 6.10's job.
- External data interpolation coupling — Stage 7.

---

## Acceptance Criteria Checklist (from `advanced-options.md`)

Grade each item ✅ / ❌ / N/A before opening the PR:

- [ ] Density override input accepts positive decimals and scientific notation.
- [ ] Density override value shown in collapsed accordion header when set.
- [ ] Density override cleared with × button → state resets to `undefined`.
- [ ] I-value override input accepts positive decimals.
- [ ] Aggregate state Gas/Condensed toggle visible and functional.
- [ ] Built-in aggregate state label shows correct value from `MaterialEntity`.
- [ ] Interpolation Axis scale Log-log / Lin-lin segmented control works.
- [ ] Interpolation Method Linear / Spline segmented control works.
- [ ] MSTAR mode dropdown hidden when selected program is not MSTAR.
- [ ] MSTAR mode dropdown shows A/B/C/D/G/H; default B.
- [ ] All six URL params encode/decode correctly (round-trip).
- [ ] URL params restored on page load (URL > localStorage precedence).
- [ ] Changes to Advanced Options trigger recalculation (debounced).
- [ ] `interpolationMethod=spline` → CSDA column computed by JS integration.
- [ ] Advanced Options panel visible on Plot page, wired into plot series calculation.
- [ ] `pnpm lint && pnpm test && pnpm build` pass.

---

## Commit Convention

Conventional Commits: `feat(advanced-options): ...`, `test(advanced-options): ...`,
`fix(advanced-options): ...`. Commit after each Task (one commit per task minimum).

## AI Logging

After the session, create:

1. A row in `CHANGELOG-AI.md` (prepend at top of table body):
   ```
   | 2026-05-05 | 6.8 | Stage 6.8 Advanced Options panel — ... (Qwen3.5-397B-A17B-FP8 via opencode) | [log](docs/ai-logs/2026-05-05-stage6-advanced-options.md) |
   ```
2. A session log at `docs/ai-logs/2026-05-05-stage6-advanced-options.md` following the
   template in `CLAUDE.md`.
3. Update `docs/ai-logs/README.md` with the new log entry.
