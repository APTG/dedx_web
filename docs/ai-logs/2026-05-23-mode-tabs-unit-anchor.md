# 2026-05-23 — Mode Tab Rename + Unit-Anchor Strip (#558)

## Session Narrative

### Prompt 1: Implement issue #558

**AI response**: Planned and implemented the full scope of issue #558 — mode tab rename,
unit-anchor strip component, energy unit selector removal, and `uanchor=` URL round-trip.

## Tasks

### Mode tab rename (Energy →, Range →, STP →)

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Used `min-[400px]:hidden` / `hidden min-[400px]:block` Tailwind v4 arbitrary breakpoint
  for the < 400px mobile single-letter glyph. The `data-testid` attributes and URL keys are unchanged.

### New `unit-anchor-strip.svelte` component

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `src/lib/components/results/unit-anchor-strip.svelte`
- **Decision**: Component extends `HTMLAttributes<HTMLDivElement>` so arbitrary HTML attributes
  (including `data-testid`) can be passed to the container div. Uses `TooltipProvider` + `Tooltip` +
  `TooltipTrigger` from existing UI primitives. Selected pill: amber-50 background + orange-400 border
  (matches existing selection patterns in material-tab.svelte). Keyboard nav mirrors the deleted
  `energy-unit-selector.svelte`. Note: component is reusable for the plot page unit anchor strip.

### Replace energy-unit-selector + Range/STP dropdowns

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Per-row Range unit `<select>` replaced with a static read-only badge showing the active
  unit (master or per-row suffix). STP tab changed from 4-column to 3-column grid (unit column removed;
  unit anchor strip shown above the table). `energy-unit-selector.svelte` deleted along with its test
  file `energy-unit-selector.test.ts` — it had exactly one call site.

### Proton MeV/u in Advanced mode + badge

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `src/lib/utils/available-units.ts`
- **Decision**: Updated `getAvailableEnergyUnits` to return `["MeV", "MeV/u"]` for proton in Advanced
  mode (MeV/nucl ≡ MeV for proton, so it's omitted). The `(≠MeV)` sub-badge is added to the MeV/u
  option in `getEnergyAnchorOptions` when particle is proton and mode is Advanced.

### `uanchor=` URL round-trip

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `src/lib/utils/calculator-url.ts`
- **Decision**: Added `UANCHOR_TO_UNIT` / `UNIT_TO_UANCHOR` token maps. `uanchor` is omitted from
  the URL when it equals the default `"MeV"`. `energyAnchor` is decoded alongside `masterUnit`
  (`eunit`) — they track the same value; `uanchor` is the explicit UI anchor slug.
