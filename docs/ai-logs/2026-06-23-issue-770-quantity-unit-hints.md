# 2026-06-23 — Contextual help PR 2: quantity & unit hints (#770)

## Session Narrative

### Prompt 1: Work on issue #770, make a PR when ready

**AI response**: Implemented PR 2 of the three-part contextual-help effort —
quantity & unit tooltips with explicit stopping-power / CSDA-range parity, plus
the MeV/nucl-vs-MeV/u energy distinction. Built on the `HelpHint` component and
`help-text.ts` registry from the #769 foundation.

**Registry (`src/lib/config/help-text.ts`)**

- Added `stoppingPower` and `csdaRange` **concept** keys to `HELP_TEXT`
  (electronic + nuclear components; CSDA = integral of 1/STP, Bragg-peak
  relationship). Copy trimmed to ≤150 chars, sourced from
  `docs/10-terminology.md`.
- Added per-unit maps `STP_UNIT_HELP` (keyed by `StpUnit`) and
  `ENERGY_UNIT_HELP` (keyed by `EnergyUnit`). `energy-anchor-options.ts` now
  re-uses `ENERGY_UNIT_HELP` text for the strip's hover tooltips, so the short
  tooltip and the ⓘ hint can never drift.

**Placement (siblings, never nested in interactive controls)**

- `stp-unit-header-menu.svelte`: a `stoppingPower` hint sits beside the unit
  trigger button (the hint stops click propagation, so it never opens the menu).
  This single change surfaces the STP concept hint in every STP header
  (Basic/Advanced/multi-program/multi-entity).
- `quantity-toggle.svelte`: each radio is wrapped in a span with a trailing
  per-quantity hint. Roving tabindex only targets `[role="radio"]`, so arrow-key
  nav is undisturbed.
- `table-basic.svelte`: `stoppingPower` + `csdaRange` hints on the single-row
  card labels and the multi-row column headers.
- `table-advanced.svelte`: `csdaRange` hint on the forward-tab CSDA header and
  the inverse Range-tab "Range" header; an energy-unit hint beside the
  `UnitAnchorStrip` reflecting the selected unit.
- `multi-program/advanced-header.svelte` + `multi-entity-header.svelte`:
  `csdaRange` hint on the CSDA colgroup header (STP side already covered by
  `StpUnitHeaderMenu`).

**Docs**

- New "Quantities & units" section in the user guide (`#quantities` + `#units`
  anchors) as the deep-link target for the new hints; added to the on-page nav.
- `contextual-help.md` bumped to Draft v2 with PR 2 placement decisions, test
  plan, and out-of-scope update. Spec README status → Draft v2.

**Tests**

- `src/tests/unit/help-text.test.ts` — consistency check (every STP unit and
  every energy unit has a registry entry), ≤150-char + href-format checks, and
  that the energy strip tooltips are sourced from the registry.
- `src/tests/components/quantity-toggle.test.ts` — both hints render with
  glossary-sourced accessible names; radiogroup still owns exactly two radios.
- Extended `src/tests/components/stp-unit-header-menu.test.ts` — asserts the
  concept hint renders beside the trigger.
- Extended `tests/e2e/contextual-help.spec.ts` — Basic-card STP hint (content +
  `#quantities` deep-link, ESC-dismiss) and CSDA-range parity hint.

## Tasks

### Quantity & unit contextual-help hints (#770)

- **Status**: completed
- **Stage**: Stage 8 / contextual-help (PR 2 of 3)
- **Files changed**:
  - `src/lib/config/help-text.ts`
  - `src/lib/utils/energy-anchor-options.ts`
  - `src/lib/components/results/stp-unit-header-menu.svelte`
  - `src/lib/components/results/quantity-toggle.svelte`
  - `src/lib/components/results/table-basic.svelte`
  - `src/lib/components/results/table-advanced.svelte`
  - `src/lib/components/results/multi-program/advanced-header.svelte`
  - `src/lib/components/results/multi-program/multi-entity-header.svelte`
  - `src/routes/docs/user-guide/+page.svelte`
  - `src/tests/unit/help-text.test.ts` (new)
  - `src/tests/components/quantity-toggle.test.ts` (new)
  - `src/tests/components/stp-unit-header-menu.test.ts`
  - `tests/e2e/contextual-help.spec.ts`
  - `docs/04-feature-specs/contextual-help.md`, `docs/04-feature-specs/README.md`
- **Decision**: Surfaced the STP concept hint via the shared
  `StpUnitHeaderMenu` rather than per-call-site so all STP headers stay
  consistent with one edit. Left the generic `BasicHeader` string-only path
  un-hinted (edge path; restructuring `ColumnDef` to carry a help key was not
  justified — the primary Basic/Advanced/multi surfaces are all covered).
- **Issue**: none. `pnpm check` / `lint` / `format:check` and the full Vitest
  suite (1845 passed / 3 skipped) pass. E2E not run locally (requires built
  WASM).
