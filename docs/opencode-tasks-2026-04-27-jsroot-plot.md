# opencode task prompt — 2026-04-27 — Stage 5.5: JSROOT Plot Wrapper

> **Model:** Qwen3.5-397B-A17B-FP8
> **Branch:** `qwen/stage-5-jsroot-plot` (create from `master`)
> **Session type:** Multi-task implementation. Work through the tasks **in
> order**. After each task is complete and `pnpm test` is green, commit with
> a Conventional Commits message and **stop so the user can run `/compact`**
> before the next task.
> **MCPs available:** `playwright` (run / inspect E2E tests),
> `tailwind` (Tailwind CSS class lookup).
> **TDD rule:** Write the failing test(s) first (`pnpm test` must show RED),
> then write the minimal implementation to make them pass (GREEN), then
> commit. No implementation file without a test file committed first.

---

## Context

This session implements **Stage 5.5 — JSROOT Plot Wrapper**, the last
remaining item in Stage 5. The result is a fully functional, tested
`JsrootPlot.svelte` Svelte 5 component and the complete Plot page route.

### What is already done

All Stage 5.1–5.4 work is merged to `master`:

- `src/lib/components/entity-selection-comboboxes.svelte` — compact dropdown entity selector (Calculator page)
- `src/lib/components/entity-selection-panels.svelte` — full panel entity selector (Plot page, see §Entity panel)
- `src/lib/components/result-table.svelte` — unified input/result table
- `src/lib/components/energy-unit-selector.svelte` — segmented unit control
- `src/lib/state/entity-selection.svelte.ts` — reactive entity selection state (shared between pages)
- `src/lib/state/calculator.svelte.ts` — calculator page state
- `src/lib/utils/energy-parser.ts` — energy string parser (TeV, typo hints, etc.)
- `src/lib/utils/energy-conversions.ts` — MeV/nucl conversion functions
- `src/lib/utils/unit-conversions.ts` — stopping power unit conversion (`stpMassToKevUm`, etc.)
- `src/lib/utils/debounce.ts` — debounce utility (300 ms used in calculator)
- `src/lib/config/particle-aliases.ts`, `particle-names.ts`, `material-names.ts`, `program-names.ts`
- `src/lib/wasm/libdedx.ts` + `src/lib/wasm/types.ts` — WASM wrapper and TypeScript types
- `src/lib/wasm/__mocks__/libdedx.ts` — mock for unit tests
- `src/lib/components/jsroot-helpers.ts` — **incomplete** JSROOT helper (used nowhere; will be replaced by the new component)

### What is NOT done (this session builds it)

- `src/lib/components/jsroot-plot.svelte` — the JSROOT Svelte 5 lifecycle wrapper
- `src/lib/state/plot.svelte.ts` — reactive state for the Plot page
- `src/lib/utils/plot-utils.ts` — pure utility functions for the plot
- `src/routes/plot/+page.svelte` — full Plot page (currently just a placeholder)
- URL state encoding for the Plot page
- All unit and E2E tests for the above

### Read at session start (in order)

1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging
2. `docs/04-feature-specs/plot.md` (Final v5) — **the primary spec for this entire session**
3. `docs/04-feature-specs/entity-selection.md` §"Full Panel Mode" — layout of the sidebar entity selector
4. `docs/04-feature-specs/unit-handling.md` §5.2 — stopping power conversion formulas
5. `docs/11-prototyping-spikes.md` §"Spike 1 — JSROOT" — validated lifecycle pattern
6. `prototypes/jsroot-svelte5/src/lib/JsrootPlot.svelte` — the Spike 1 prototype (read this; it is the validated starting pattern for the component)
7. `docs/06-wasm-api-contract.md` §`getPlotData` — WASM service method signature

### Key source files to know

```
src/lib/
├── components/
│   ├── entity-selection-panels.svelte  ← full panel mode (use in plot sidebar)
│   ├── entity-selection-comboboxes.svelte  ← compact mode (calculator only; don't use in plot)
│   ├── energy-unit-selector.svelte     ← segmented unit control (reuse in controls bar)
│   └── jsroot-helpers.ts               ← OLD incomplete helper; DELETE in Task 5
├── state/
│   ├── entity-selection.svelte.ts      ← EntitySelectionState (shared with calculator)
│   └── ui.svelte.ts                    ← wasmReady, entityState singletons
├── utils/
│   ├── unit-conversions.ts             ← stpMassToKevUm, autoScaleLengthCm, formatSigFigs
│   └── debounce.ts                     ← debounce(fn, ms)
├── wasm/
│   ├── types.ts                        ← StpUnit, CalculationResult, MaterialEntity, etc.
│   ├── libdedx.ts                      ← LibdedxServiceImpl (has getPlotData)
│   └── __mocks__/libdedx.ts            ← MockLibdedxService (has getPlotData)
src/routes/
├── calculator/+page.svelte             ← working reference for page structure
└── plot/+page.svelte                   ← PLACEHOLDER — you will replace this
src/tests/
├── unit/                               ← Vitest unit tests (no WASM; use mock)
└── components/                         ← Svelte component tests (Svelte Testing Library)
tests/e2e/                              ← Playwright E2E tests (needs real WASM in static/wasm/)
```

### WASM `getPlotData` signature

```typescript
// From src/lib/wasm/types.ts
getPlotData(
  programId: number,
  particleId: number,
  materialId: number,
  numPoints: number,    // use 500
  logScale: boolean,    // use true
): CalculationResult;  // { energies: number[], stoppingPowers: number[], csdaRanges: number[] }
```

The mock in `src/lib/wasm/__mocks__/libdedx.ts` already implements this.
STP values are in MeV·cm²/g (mass stopping power). Energies are in MeV/nucl.

### Entity panel component API

```typescript
// entity-selection-panels.svelte
interface Props {
  state: EntitySelectionState;  // from src/lib/state/entity-selection.svelte.ts
  class?: string;
}
```

### Shared entity selection singleton

```typescript
// src/lib/state/ui.svelte.ts
import { entityState } from "$lib/state/ui.svelte";
// entityState is an EntitySelectionState shared between calculator and plot pages
```

Read `src/lib/state/ui.svelte.ts` to see how `entityState` and `wasmReady`
are exported — use the same import pattern as `src/routes/calculator/+page.svelte`.

### Stopping power conversion formulas (from unit-handling.md §5.2)

```typescript
// density in g/cm³, massStpValue in MeV·cm²/g
// keV/µm = massStpValue × density / 10
// MeV/cm = massStpValue × density
// MeV·cm²/g = massStpValue (no conversion)
```

### Run tests

```sh
pnpm test                          # Vitest unit + component tests (no WASM needed)
pnpm exec playwright test          # E2E tests (needs WASM in static/wasm/)
pnpm lint                          # ESLint
pnpm format                        # Prettier
```

---

## AI Logging (MANDATORY)

Every task that changes code must be logged. Rules in `AGENTS.md`.

For the entire session (after all tasks):
1. Prepend **one row** to `CHANGELOG-AI.md` table body.
2. Create `docs/ai-logs/2026-04-27-stage5-jsroot-plot.md` (or use today's
   actual date) with the session narrative (one section per task).
3. Add a one-line pointer to `docs/ai-logs/README.md`.

Attribution line: `(Qwen3.5-397B-A17B-FP8 via opencode)`

---

## Task 1 — Stopping power unit conversion + axis range + draw options utilities

**File to create:** `src/lib/utils/plot-utils.ts`  
**Test file to create:** `src/tests/unit/plot-utils.test.ts`

These are pure functions with no Svelte dependencies. Test them first.

### Step 1a — tests first (RED)

Create `src/tests/unit/plot-utils.test.ts`. All tests must fail initially
(the implementation file does not exist yet).

```typescript
import { describe, it, expect } from "vitest";
import {
  convertStpForDisplay,
  buildDrawOptions,
  computeAxisRanges,
  COLOR_PALETTE,
  PREVIEW_COLOR,
} from "$lib/utils/plot-utils";
import type { StpUnit } from "$lib/wasm/types";
```

#### `describe("convertStpForDisplay")`

```
// Spec fixture: mass STP = 25 MeV·cm²/g, density 1.0 → keV/µm = 2.5
convertStpForDisplay([25], 1.0, "keV/µm") → [2.5]

// Spec fixture: mass STP = 25 MeV·cm²/g, density 0.0012 → keV/µm = 0.003
convertStpForDisplay([25], 0.0012, "keV/µm") → [0.003]

// MeV/cm = massStpValue × density
convertStpForDisplay([25], 1.0, "MeV/cm") → [25.0]
convertStpForDisplay([25], 0.0012, "MeV/cm") → [0.03]

// MeV·cm²/g = no conversion
convertStpForDisplay([25], 1.0, "MeV·cm²/g") → [25]
convertStpForDisplay([10, 20], 2.0, "MeV·cm²/g") → [10, 20]

// empty array
convertStpForDisplay([], 1.0, "keV/µm") → []
```

#### `describe("buildDrawOptions")`

```
// log-log (default)
buildDrawOptions(true, true) → "logx;logy;gridx;gridy;tickx;ticky"

// linear x, log y
buildDrawOptions(false, true) → "logy;gridx;gridy;tickx;ticky"

// log x, linear y
buildDrawOptions(true, false) → "logx;gridx;gridy;tickx;ticky"

// fully linear
buildDrawOptions(false, false) → "gridx;gridy;tickx;ticky"
```

#### `describe("computeAxisRanges")`

Use simple stub series objects for these tests (no JSROOT/Svelte needed):

```typescript
interface StubSeries {
  result: { energies: number[]; stoppingPowers: number[] };
  density: number;
  visible: boolean;
}

// When no series visible: use defaults
computeAxisRanges([], null, "keV/µm")
  → { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 }

// Single visible series, energies 1..100, stoppingPowers all 5
// density 1.0, unit "MeV·cm²/g"
// xMin = 10^floor(log10(1)) = 1 → 1
// xMax = 10^ceil(log10(100)) = 100 → 100
// yMin = 10^floor(log10(5)) = 1
// yMax = 10^ceil(log10(5)) = 10
computeAxisRanges(
  [{ result: { energies: [1, 10, 100], stoppingPowers: [5, 5, 5] }, density: 1.0, visible: true }],
  null,
  "MeV·cm²/g"
) → { xMin: 1, xMax: 100, yMin: 1, yMax: 10 }

// Hidden series are excluded
computeAxisRanges(
  [{ result: { energies: [1, 100], stoppingPowers: [5, 5] }, density: 1.0, visible: false }],
  null,
  "MeV·cm²/g"
) → { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 }
```

#### `describe("COLOR_PALETTE and PREVIEW_COLOR")`

```
COLOR_PALETTE.length === 9
COLOR_PALETTE[0] === "#e41a1c"   // red
COLOR_PALETTE[1] === "#377eb8"   // blue
PREVIEW_COLOR === "#000000"       // black reserved for preview
// All palette colors differ from PREVIEW_COLOR
COLOR_PALETTE.every(c => c !== PREVIEW_COLOR) === true
```

### Step 1b — implement `src/lib/utils/plot-utils.ts`

```typescript
import type { StpUnit } from "$lib/wasm/types";

export const COLOR_PALETTE: readonly string[] = [
  "#e41a1c", // red
  "#377eb8", // blue
  "#4daf4a", // green
  "#984ea3", // purple
  "#ff7f00", // orange
  "#a65628", // brown
  "#f781bf", // pink
  "#999999", // grey
  "#17becf", // cyan
];

/** Black is reserved exclusively for the preview series. */
export const PREVIEW_COLOR = "#000000";

/**
 * Convert mass stopping power values (MeV·cm²/g) to the target display unit.
 * Each series must supply its own material density for density-dependent units.
 */
export function convertStpForDisplay(
  massStpValues: number[],
  density: number,
  targetUnit: StpUnit,
): number[] {
  switch (targetUnit) {
    case "keV/µm":
      return massStpValues.map((s) => (s * density) / 10);
    case "MeV/cm":
      return massStpValues.map((s) => s * density);
    case "MeV·cm²/g":
      return massStpValues;
  }
}

/**
 * Build the JSROOT draw options string from axis scale settings.
 * Gridlines and ticks are always on.
 */
export function buildDrawOptions(xLog: boolean, yLog: boolean): string {
  const opts: string[] = [];
  if (xLog) opts.push("logx");
  if (yLog) opts.push("logy");
  opts.push("gridx", "gridy", "tickx", "ticky");
  return opts.join(";");
}

interface SeriesForRange {
  result: { energies: number[]; stoppingPowers: number[] };
  density: number;
  visible: boolean;
}

interface AxisRanges {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const DEFAULT_RANGES: AxisRanges = {
  xMin: 0.001,
  xMax: 10000,
  yMin: 0.1,
  yMax: 1000,
};

/**
 * Auto-compute axis ranges from all visible series data.
 * Rounds to powers of 10 (floor for min, ceil for max).
 */
export function computeAxisRanges(
  series: SeriesForRange[],
  preview: SeriesForRange | null,
  stpUnit: StpUnit,
): AxisRanges {
  const allVisible = [
    ...(preview && preview.visible ? [preview] : []),
    ...series.filter((s) => s.visible),
  ];

  if (allVisible.length === 0) return DEFAULT_RANGES;

  let xMinRaw = Infinity;
  let xMaxRaw = -Infinity;
  let yMinRaw = Infinity;
  let yMaxRaw = -Infinity;

  for (const s of allVisible) {
    const { energies, stoppingPowers } = s.result;
    const yData = convertStpForDisplay(stoppingPowers, s.density, stpUnit);

    for (const e of energies) {
      if (e > 0 && e < xMinRaw) xMinRaw = e;
      if (e > xMaxRaw) xMaxRaw = e;
    }
    for (const y of yData) {
      if (y > 0 && y < yMinRaw) yMinRaw = y;
      if (y > yMaxRaw) yMaxRaw = y;
    }
  }

  if (!isFinite(xMinRaw) || !isFinite(xMaxRaw)) return DEFAULT_RANGES;

  return {
    xMin: Math.pow(10, Math.floor(Math.log10(xMinRaw))),
    xMax: Math.pow(10, Math.ceil(Math.log10(xMaxRaw))),
    yMin: Math.pow(10, Math.floor(Math.log10(yMinRaw))),
    yMax: Math.pow(10, Math.ceil(Math.log10(yMaxRaw))),
  };
}
```

Run `pnpm test` — all tests in `plot-utils.test.ts` must pass. Commit:

```
feat(plot): add plot utility functions (unit conversion, axis ranges, draw options)
```

---

## Task 2 — Smart series labels + color pool management

**File to create:** `src/lib/utils/series-labels.ts`  
**Test file to create:** `src/tests/unit/series-labels.test.ts`

### Step 2a — tests first (RED)

```typescript
import { describe, it, expect } from "vitest";
import { computeSeriesLabels, allocateColor, releaseColor } from "$lib/utils/series-labels";
import { COLOR_PALETTE } from "$lib/utils/plot-utils";
```

#### `describe("computeSeriesLabels")`

Use minimal stub series objects. The function signature is:
```typescript
computeSeriesLabels(series: Array<{
  programId: number; particleId: number; materialId: number;
  programName: string; particleName: string; materialName: string;
}>): string[]
```

Per the spec table in `docs/04-feature-specs/plot.md` §"Smart Series Labels":

```
// Single series — always full label
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276,
    programName: "PSTAR", particleName: "Proton", materialName: "Water (liquid)" }
]) → ["Proton in Water (liquid)"]

// Two series, only program varies → show only program name
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276, programName: "PSTAR",    particleName: "Proton", materialName: "Water (liquid)" },
  { programId: 9, particleId: 1, materialId: 276, programName: "ICRU 90",  particleName: "Proton", materialName: "Water (liquid)" },
]) → ["PSTAR", "ICRU 90"]

// Two series, only particle varies → show only particle name
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276, programName: "PSTAR", particleName: "Proton",  materialName: "Water (liquid)" },
  { programId: 2, particleId: 6, materialId: 276, programName: "PSTAR", particleName: "Carbon",  materialName: "Water (liquid)" },
]) → ["Proton", "Carbon"]

// Two series, only material varies → show only material name
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276, programName: "PSTAR", particleName: "Proton", materialName: "Water (liquid)" },
  { programId: 2, particleId: 1, materialId: 267, programName: "PSTAR", particleName: "Proton", materialName: "Air" },
]) → ["Water (liquid)", "Air"]

// Program + particle vary
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276, programName: "PSTAR",   particleName: "Proton",  materialName: "Water (liquid)" },
  { programId: 9, particleId: 6, materialId: 276, programName: "ICRU 90", particleName: "Carbon",  materialName: "Water (liquid)" },
]) → ["PSTAR — Proton", "ICRU 90 — Carbon"]

// Program + material vary
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276, programName: "PSTAR",   particleName: "Proton", materialName: "Water (liquid)" },
  { programId: 9, particleId: 1, materialId: 267, programName: "ICRU 90", particleName: "Proton", materialName: "Air" },
]) → ["PSTAR — Water (liquid)", "ICRU 90 — Air"]

// Particle + material vary
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276, programName: "PSTAR", particleName: "Proton",  materialName: "Water (liquid)" },
  { programId: 2, particleId: 6, materialId: 267, programName: "PSTAR", particleName: "Carbon",  materialName: "Air" },
]) → ["Proton in Water (liquid)", "Carbon in Air"]

// All three vary
computeSeriesLabels([
  { programId: 2, particleId: 1, materialId: 276, programName: "PSTAR",   particleName: "Proton",  materialName: "Water (liquid)" },
  { programId: 9, particleId: 6, materialId: 267, programName: "ICRU 90", particleName: "Carbon",  materialName: "Air" },
]) → ["PSTAR — Proton in Water (liquid)", "ICRU 90 — Carbon in Air"]

// Empty array
computeSeriesLabels([]) → []
```

#### `describe("color pool")`

```
// allocateColor on a fresh pool returns palette colors in order
const pool = new Set(COLOR_PALETTE.keys());  // indices 0..8
allocateColor(pool) → 0   // lowest index
pool now has size 8

// after using all 9 slots, next wrap to 0
// (fill all, release 0, allocate → 0)
```

### Step 2b — implement `src/lib/utils/series-labels.ts`

```typescript
import { COLOR_PALETTE } from "./plot-utils";

interface SeriesForLabel {
  programId: number;
  particleId: number;
  materialId: number;
  programName: string;
  particleName: string;
  materialName: string;
}

export function computeSeriesLabels(series: SeriesForLabel[]): string[] {
  if (series.length === 0) return [];

  const programs = new Set(series.map((s) => s.programId));
  const particles = new Set(series.map((s) => s.particleId));
  const materials = new Set(series.map((s) => s.materialId));

  const programVaries = programs.size > 1;
  const particleVaries = particles.size > 1;
  const materialVaries = materials.size > 1;

  return series.map((s) => {
    const parts: string[] = [];
    const particleMaterial =
      particleVaries || materialVaries
        ? materialVaries
          ? `${s.particleName} in ${s.materialName}`
          : s.particleName
        : null;

    if (programVaries && particleMaterial) {
      parts.push(`${s.programName} — ${particleMaterial}`);
    } else if (programVaries) {
      parts.push(s.programName);
    } else if (materialVaries && !particleVaries) {
      parts.push(s.materialName);
    } else if (particleMaterial) {
      parts.push(particleMaterial);
    } else {
      // single series: full label
      parts.push(`${s.particleName} in ${s.materialName}`);
    }

    return parts.join("");
  });
}

/**
 * Allocate the lowest available color index from the pool.
 * Returns the index. Removes it from the pool.
 * If the pool is empty, wraps around (all indices re-added).
 */
export function allocateColor(availableIndices: Set<number>): number {
  if (availableIndices.size === 0) {
    // Wrap around: refill the pool
    for (let i = 0; i < COLOR_PALETTE.length; i++) {
      availableIndices.add(i);
    }
  }
  const idx = Math.min(...availableIndices);
  availableIndices.delete(idx);
  return idx;
}

/** Release a color index back to the pool. */
export function releaseColor(availableIndices: Set<number>, idx: number): void {
  availableIndices.add(idx);
}
```

Run `pnpm test`. Commit:

```
feat(plot): add smart series labels and color pool management
```

---

## Task 3 — Plot state module

**File to create:** `src/lib/state/plot.svelte.ts`  
**Test file to create:** `src/tests/unit/plot-state.test.ts`

### Step 3a — tests first (RED)

Create `src/tests/unit/plot-state.test.ts`.

Import the factory (which does not exist yet):

```typescript
import { createPlotState } from "$lib/state/plot.svelte";
import type { CalculationResult, StpUnit } from "$lib/wasm/types";
```

The factory takes no arguments (uses the shared `entityState` singleton via
the reactive mock). For tests, pass a mock result builder inline:

```typescript
const mockResult: CalculationResult = {
  energies: Array.from({ length: 500 }, (_, i) => Math.exp(i * 0.01)),
  stoppingPowers: Array.from({ length: 500 }, () => 5.0),
  csdaRanges: Array.from({ length: 500 }, () => 0.5),
};

const mockSeries = (overrides: Partial<{
  programId: number; particleId: number; materialId: number;
  programName: string; particleName: string; materialName: string;
  density: number;
}> = {}) => ({
  programId: 2,
  particleId: 1,
  materialId: 276,
  programName: "PSTAR",
  particleName: "Proton",
  materialName: "Water (liquid)",
  density: 1.0,
  result: mockResult,
  ...overrides,
});
```

Tests — wrap in `describe("createPlotState")`:

```
// Initial state
const state = createPlotState();
state.series → []
state.preview → null
state.stpUnit → "keV/µm"
state.xLog → true
state.yLog → true
state.nextSeriesId → 1

// addSeries: appends with correct structure
state.addSeries(mockSeries());
state.series.length → 1
state.series[0].seriesId → 1
state.series[0].visible → true
state.series[0].color → "#e41a1c"  (palette index 0)
state.nextSeriesId → 2

// addSeries: sequential colors
state.addSeries(mockSeries({ programId: 9 }));
state.series[1].color → "#377eb8"  (palette index 1)

// addSeries: duplicate detection (same programId + particleId + materialId)
const initial = state.series.length;
state.addSeries(mockSeries());  // same triplet as first
state.series.length → initial  // not added
// (the function should return false or throw — define: return boolean isDuplicate)

// removeSeries: removes by seriesId
state.addSeries(mockSeries());
const id = state.series[0].seriesId;
state.removeSeries(id);
state.series.find(s => s.seriesId === id) → undefined

// removeSeries: releases color back to pool
state.addSeries(mockSeries());          // gets color index 0
const sid0 = state.series[state.series.length - 1].seriesId;
state.removeSeries(sid0);
state.addSeries(mockSeries({ particleId: 6 }));  // should get index 0 again
state.series[state.series.length - 1].color → "#e41a1c"

// toggleVisibility
state.addSeries(mockSeries());
const sid = state.series[0].seriesId;
state.toggleVisibility(sid);
state.series.find(s => s.seriesId === sid)!.visible → false
state.toggleVisibility(sid);
state.series.find(s => s.seriesId === sid)!.visible → true

// setStpUnit
state.setStpUnit("MeV/cm");
state.stpUnit → "MeV/cm"

// setAxisScale
state.setAxisScale("x", false);
state.xLog → false
state.setAxisScale("y", false);
state.yLog → false

// setPreview: sets the preview series
state.setPreview({ ...mockSeries(), result: mockResult, density: 1.0 });
state.preview !== null → true
state.clearPreview();
state.preview → null

// resetAll: clears all series and resets state
state.addSeries(mockSeries());
state.addSeries(mockSeries({ particleId: 6 }));
state.resetAll();
state.series → []
state.preview → null
state.stpUnit → "keV/µm"
state.xLog → true
state.yLog → true

// Label recomputation on add (single series → full label)
const freshState = createPlotState();
freshState.addSeries(mockSeries());
freshState.series[0].label → "Proton in Water (liquid)"

// Label recomputation on add (second series, only program varies)
freshState.addSeries(mockSeries({ programId: 9, programName: "ICRU 90" }));
freshState.series[0].label → "PSTAR"
freshState.series[1].label → "ICRU 90"

// Label recomputation on remove (back to single series → full label)
const s1id = freshState.series[0].seriesId;
freshState.removeSeries(s1id);
freshState.series[0].label → "Proton in Water (liquid)"
```

### Step 3b — implement `src/lib/state/plot.svelte.ts`

```typescript
import { $state } from "svelte";  // NOTE: runes — no import needed in .svelte.ts, but declare properly
```

Actually in Svelte 5 `.svelte.ts` files you do NOT import runes — they are
globally available. Write the module as follows:

```typescript
// src/lib/state/plot.svelte.ts
import type { CalculationResult, StpUnit } from "$lib/wasm/types";
import { computeSeriesLabels } from "$lib/utils/series-labels";
import { COLOR_PALETTE, PREVIEW_COLOR } from "$lib/utils/plot-utils";
import { allocateColor, releaseColor } from "$lib/utils/series-labels";

export interface PlotSeriesData {
  programId: number;
  particleId: number;
  materialId: number;
  programName: string;
  particleName: string;
  materialName: string;
  density: number;
  result: CalculationResult;
}

export interface PlotSeries extends PlotSeriesData {
  seriesId: number;
  label: string;
  color: string;
  colorIndex: number;
  visible: boolean;
}

export interface PlotState {
  series: PlotSeries[];
  preview: PlotSeries | null;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
  nextSeriesId: number;

  addSeries(data: PlotSeriesData): boolean;  // returns true if added, false if duplicate
  removeSeries(seriesId: number): void;
  toggleVisibility(seriesId: number): void;
  setPreview(data: PlotSeriesData): void;
  clearPreview(): void;
  setStpUnit(unit: StpUnit): void;
  setAxisScale(axis: "x" | "y", log: boolean): void;
  resetAll(): void;
}

export function createPlotState(): PlotState {
  let series = $state<PlotSeries[]>([]);
  let preview = $state<PlotSeries | null>(null);
  let stpUnit = $state<StpUnit>("keV/µm");
  let xLog = $state(true);
  let yLog = $state(true);
  let nextSeriesId = $state(1);
  let availableColorIndices = $state<Set<number>>(
    new Set(COLOR_PALETTE.map((_, i) => i))
  );

  function recomputeLabels(): void {
    const labels = computeSeriesLabels(series);
    for (let i = 0; i < series.length; i++) {
      series[i] = { ...series[i], label: labels[i] };
    }
  }

  function addSeries(data: PlotSeriesData): boolean {
    const isDuplicate = series.some(
      (s) =>
        s.programId === data.programId &&
        s.particleId === data.particleId &&
        s.materialId === data.materialId,
    );
    if (isDuplicate) return false;

    const colorIndex = allocateColor(availableColorIndices);
    const newSeries: PlotSeries = {
      ...data,
      seriesId: nextSeriesId,
      label: "",  // will be set by recomputeLabels()
      color: COLOR_PALETTE[colorIndex],
      colorIndex,
      visible: true,
    };
    series = [...series, newSeries];
    nextSeriesId = nextSeriesId + 1;
    recomputeLabels();
    return true;
  }

  function removeSeries(seriesId: number): void {
    const target = series.find((s) => s.seriesId === seriesId);
    if (!target) return;
    releaseColor(availableColorIndices, target.colorIndex);
    series = series.filter((s) => s.seriesId !== seriesId);
    recomputeLabels();
  }

  function toggleVisibility(seriesId: number): void {
    series = series.map((s) =>
      s.seriesId === seriesId ? { ...s, visible: !s.visible } : s,
    );
  }

  function setPreview(data: PlotSeriesData): void {
    preview = {
      ...data,
      seriesId: 0,  // preview always has seriesId 0
      label: "",    // set dynamically by the page component
      color: PREVIEW_COLOR,
      colorIndex: -1,
      visible: true,
    };
  }

  function clearPreview(): void {
    preview = null;
  }

  function setStpUnit(unit: StpUnit): void {
    stpUnit = unit;
  }

  function setAxisScale(axis: "x" | "y", log: boolean): void {
    if (axis === "x") xLog = log;
    else yLog = log;
  }

  function resetAll(): void {
    // Release all colors back to pool
    for (const s of series) {
      releaseColor(availableColorIndices, s.colorIndex);
    }
    series = [];
    preview = null;
    stpUnit = "keV/µm";
    xLog = true;
    yLog = true;
    nextSeriesId = 1;
  }

  return {
    get series() { return series; },
    get preview() { return preview; },
    get stpUnit() { return stpUnit; },
    get xLog() { return xLog; },
    get yLog() { return yLog; },
    get nextSeriesId() { return nextSeriesId; },
    addSeries,
    removeSeries,
    toggleVisibility,
    setPreview,
    clearPreview,
    setStpUnit,
    setAxisScale,
    resetAll,
  };
}
```

Run `pnpm test`. Commit:

```
feat(plot): add plot state module with series management and label recomputation
```

---

## Task 4 — `JsrootPlot.svelte` component

**File to create:** `src/lib/components/jsroot-plot.svelte`  
**Test file to create:** `src/tests/components/jsroot-plot.test.ts`  
**Also:** delete `src/lib/components/jsroot-helpers.ts` (it is replaced).

> **Pattern reference:** Read `prototypes/jsroot-svelte5/src/lib/JsrootPlot.svelte`
> before writing this. The Spike 1 validated the exact `$effect` + `cancelled`
> flag + `restore` pattern. Your implementation must follow the same structure.

### Step 4a — tests first (RED)

The component uses JSROOT via `await import("jsroot")`. In tests, mock it:

```typescript
// src/tests/components/jsroot-plot.test.ts
import { render, screen } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jsroot", () => ({
  default: {
    settings: { ZoomWheel: true, ZoomTouch: true },
    createTGraph: vi.fn((n: number, x: number[], y: number[]) => ({
      fLineColor: 1, fLineWidth: 2, fLineStyle: 1, fTitle: "",
      InvertBit: vi.fn(),
    })),
    createTMultiGraph: vi.fn((...graphs: unknown[]) => ({
      fGraphs: { Add: vi.fn() },
      fHistogram: null,
      fTitle: "",
    })),
    createHistogram: vi.fn(() => ({
      fXaxis: { fTitle: "", fXmin: 0, fXmax: 1, InvertBit: vi.fn() },
      fYaxis: { fTitle: "", InvertBit: vi.fn() },
      fMinimum: 0, fMaximum: 1, fTitle: "",
    })),
    draw: vi.fn(async () => ({ cleanup: vi.fn() })),
    BIT: vi.fn((n: number) => n),
  },
}));

import JsrootPlot from "$lib/components/jsroot-plot.svelte";
import type { PlotSeries } from "$lib/state/plot.svelte";
import type { StpUnit } from "$lib/wasm/types";
```

Tests:

```
// renders a container div
render(JsrootPlot, { props: {
  series: [], preview: null, stpUnit: "keV/µm", xLog: true, yLog: true,
  axisRanges: { xMin: 0.001, xMax: 10000, yMin: 0.1, yMax: 1000 },
}});
screen.getByRole("img") → exists  // canvas div has role="img"

// shows loading text initially (before JSROOT resolves)
screen.getByText(/loading plot/i) OR container div exists

// JSROOT.draw is called after mount (async: use waitFor)
await vi.waitFor(() => expect(JSROOT.draw).toHaveBeenCalled());

// aria-label describes the plot contents
const canvas = screen.getByRole("img");
canvas.getAttribute("aria-label") → contains "Stopping power"
```

These tests verify the DOM structure and JSROOT call without actually rendering
plots (the mock JSROOT returns immediately).

### Step 4b — implement `src/lib/components/jsroot-plot.svelte`

Props interface:

```typescript
interface Props {
  series: PlotSeries[];
  preview: PlotSeries | null;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
  axisRanges: { xMin: number; xMax: number; yMin: number; yMax: number };
}
```

Full component structure (adapt the Spike 1 prototype pattern):

```svelte
<script lang="ts">
  import type { PlotSeries } from "$lib/state/plot.svelte";
  import type { StpUnit } from "$lib/wasm/types";
  import { convertStpForDisplay, buildDrawOptions } from "$lib/utils/plot-utils";

  interface AxisRanges { xMin: number; xMax: number; yMin: number; yMax: number; }

  let {
    series,
    preview,
    stpUnit,
    xLog,
    yLog,
    axisRanges,
  }: { series: PlotSeries[]; preview: PlotSeries | null; stpUnit: StpUnit;
       xLog: boolean; yLog: boolean; axisRanges: AxisRanges; } = $props();

  let container: HTMLDivElement;
  let jsrootReady = $state(false);
  let jsrootError = $state<string | null>(null);

  interface JsrootPainter { cleanup?: () => void; }
  let currentPainter = $state<JsrootPainter | null>(null);

  $effect(() => {
    // Track all reactive dependencies: series, preview, stpUnit, xLog, yLog, axisRanges
    const snapshot = { series, preview, stpUnit, xLog, yLog, axisRanges };
    let cancelled = false;
    let restoreSettings: (() => void) | null = null;

    drawPlot(container, snapshot)
      .then(({ painter, restore }) => {
        if (cancelled) { painter?.cleanup?.(); restore(); return; }
        currentPainter = painter;
        restoreSettings = restore;
        jsrootReady = true;
      })
      .catch((err) => {
        if (!cancelled) {
          jsrootError = "Failed to load the plot engine. Please refresh the page.";
          console.error("JsrootPlot error:", err);
        }
      });

    return () => {
      cancelled = true;
      currentPainter?.cleanup?.();
      currentPainter = null;
      if (container) container.innerHTML = "";
      restoreSettings?.();
      restoreSettings = null;
    };
  });

  // Resize observer: call JSROOT.resize when container dimensions change
  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver(() => {
      import("jsroot").then((mod) => {
        const JSROOT = mod.default;
        if (typeof JSROOT.resize === "function") JSROOT.resize(container);
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  async function drawPlot(
    el: HTMLDivElement,
    opts: { series: PlotSeries[]; preview: PlotSeries | null;
            stpUnit: StpUnit; xLog: boolean; yLog: boolean;
            axisRanges: AxisRanges }
  ): Promise<{ painter: JsrootPainter; restore: () => void }> {
    const JSROOT = (await import("jsroot")).default;

    // Disable wheel zoom globally — restore on cleanup
    const prevZoomWheel = JSROOT.settings.ZoomWheel;
    JSROOT.settings.ZoomWheel = false;

    // Disable touch zoom on touch/coarse-pointer devices
    const prevZoomTouch = JSROOT.settings.ZoomTouch;
    if (window.matchMedia("(pointer: coarse)").matches) {
      JSROOT.settings.ZoomTouch = false;
    }

    const restore = () => {
      JSROOT.settings.ZoomWheel = prevZoomWheel;
      JSROOT.settings.ZoomTouch = prevZoomTouch;
    };

    const mg = buildMultigraph(JSROOT, opts);
    const drawOpts = buildDrawOptions(opts.xLog, opts.yLog);

    // JSROOT.cleanup before redraw (per spec lifecycle)
    if (typeof JSROOT.cleanup === "function") JSROOT.cleanup(el);

    const painter = (await JSROOT.draw(el, mg, drawOpts)) as JsrootPainter;
    return { painter, restore };
  }

  function buildMultigraph(JSROOT: unknown, opts: {
    series: PlotSeries[]; preview: PlotSeries | null;
    stpUnit: StpUnit; axisRanges: AxisRanges;
  }) {
    const JSROOT_any = JSROOT as any;

    const allVisible = [
      ...(opts.preview && opts.preview.visible ? [opts.preview] : []),
      ...opts.series.filter((s) => s.visible),
    ];

    const graphs = allVisible.map((s) => {
      const yData = convertStpForDisplay(s.result.stoppingPowers, s.density, opts.stpUnit);
      const tgraph = JSROOT_any.createTGraph(s.result.energies.length, s.result.energies, yData);
      const isPreview = s.seriesId === 0;
      tgraph.fLineColor = isPreview ? 1 : s.colorIndex + 2;  // JSROOT color index offset
      tgraph.fLineWidth = isPreview ? 1 : 2;
      tgraph.fLineStyle = isPreview ? 2 : 1;  // 2=dashed, 1=solid
      tgraph.fTitle = "";
      // Disable graph dragging (kNotEditable bit 18)
      tgraph.InvertBit(JSROOT_any.BIT(18));
      return tgraph;
    });

    const mg = JSROOT_any.createTMultiGraph(...graphs);

    // Axis labels and ranges via histogram frame
    const hist = JSROOT_any.createHistogram("TH1F", 20);
    hist.fXaxis.fTitle = "Energy [MeV/nucl]";
    hist.fXaxis.fXmin = opts.axisRanges.xMin;
    hist.fXaxis.fXmax = opts.axisRanges.xMax;
    hist.fYaxis.fTitle = `Stopping Power [${opts.stpUnit}]`;
    hist.fMinimum = opts.axisRanges.yMin;
    hist.fMaximum = opts.axisRanges.yMax;
    hist.fXaxis.InvertBit(JSROOT_any.BIT(12));  // center axis label
    hist.fYaxis.InvertBit(JSROOT_any.BIT(12));
    hist.fTitle = "";
    mg.fHistogram = hist;

    return mg;
  }

  const numVisibleSeries = $derived(series.filter((s) => s.visible).length + (preview ? 1 : 0));
</script>

{#if jsrootError}
  <div class="flex items-center justify-center text-destructive" style="width:100%; height:100%;">
    {jsrootError}
  </div>
{:else}
  {#if !jsrootReady}
    <div class="flex items-center justify-center text-muted-foreground" style="width:100%; height:100%;">
      Loading plot engine…
    </div>
  {/if}
  <div
    bind:this={container}
    role="img"
    aria-label={`Stopping power vs energy plot with ${numVisibleSeries} data series`}
    style="width: 100%; height: 100%;"
    class:invisible={!jsrootReady}
  ></div>
{/if}
```

**Also delete** `src/lib/components/jsroot-helpers.ts` (it is now superseded).
Check with `grep -rn "jsroot-helpers" src/` — if nothing imports it, delete it.

Run `pnpm test`. Commit:

```
feat(plot): add JsrootPlot.svelte component with JSROOT lifecycle management
chore: delete obsolete jsroot-helpers.ts
```

---

## Task 5 — Plot page route (entity panels + controls + canvas + series list)

**File to replace:** `src/routes/plot/+page.svelte`  
**E2E test file to create:** `tests/e2e/plot.spec.ts`

This is the main integration task. The page wires together:
- `entity-selection-panels.svelte` (sidebar)
- `JsrootPlot.svelte` (main area)
- `createPlotState()` (state)
- `entityState` singleton (shared with calculator)

### Step 5a — E2E smoke tests first (RED)

Create `tests/e2e/plot.spec.ts`. These will fail until the page is implemented.

```typescript
import { test, expect } from "@playwright/test";

test.describe("Plot page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plot");
    // Wait for WASM to load
    await expect(page.getByRole("heading", { name: /plot/i })).toBeVisible();
  });

  test("has entity selection panels in sidebar", async ({ page }) => {
    // Full panel mode: scrollable lists, not comboboxes
    await expect(page.getByRole("list", { name: /particle/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("list", { name: /material/i })).toBeVisible({ timeout: 10000 });
  });

  test("has Add Series button (disabled when entity selection incomplete)", async ({ page }) => {
    const btn = page.getByRole("button", { name: /add series/i });
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

  test("has stopping power unit controls", async ({ page }) => {
    // Segmented control with 3 options
    await expect(page.getByRole("radio", { name: /keV/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("radio", { name: /MeV\/cm/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("radio", { name: /MeV·cm/i })).toBeVisible({ timeout: 10000 });
  });

  test("has axis scale controls (default Log/Log)", async ({ page }) => {
    // X and Y axis scale controls
    const xLogRadio = page.getByRole("radio", { name: /x.*log/i });
    await expect(xLogRadio).toBeVisible({ timeout: 10000 });
  });

  test("shows plot canvas with role=img", async ({ page }) => {
    await expect(page.getByRole("img", { name: /stopping power/i })).toBeVisible({ timeout: 15000 });
  });
});
```

### Step 5b — implement `src/routes/plot/+page.svelte`

Replace the placeholder content. Follow the layout from
`docs/04-feature-specs/plot.md` §"Page Layout Overview":

- **Desktop (≥900px):** sidebar (~30%) + main area (~70%) side-by-side grid.
- **Sidebar:** entity panels + "Add Series" button + "Reset all" link.
- **Main area:** controls bar + JSROOT canvas + series list.

```svelte
<script lang="ts">
  import { base } from "$app/paths";
  import { wasmReady, entityState } from "$lib/state/ui.svelte";
  import EntitySelectionPanels from "$lib/components/entity-selection-panels.svelte";
  import JsrootPlot from "$lib/components/jsroot-plot.svelte";
  import { createPlotState } from "$lib/state/plot.svelte";
  import { computeAxisRanges } from "$lib/utils/plot-utils";
  import { libdedx } from "$lib/wasm/libdedx";
  import type { StpUnit } from "$lib/wasm/types";
  import { Button } from "$lib/components/ui/button";

  const plotState = createPlotState();

  // ── Preview series: auto-calculated whenever entity selection changes ──
  $effect(() => {
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } = entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) {
      plotState.clearPreview();
      return;
    }
    const service = libdedx.service;
    if (!service) return;

    try {
      const result = service.getPlotData(
        resolvedProgramId,
        selectedParticle.id,
        selectedMaterial.id,
        500,
        true,
      );
      plotState.setPreview({
        programId: resolvedProgramId,
        particleId: selectedParticle.id,
        materialId: selectedMaterial.id,
        programName: entityState.selectedProgram.id === -1
          ? (entityState.selectedProgram.resolvedProgram?.name ?? "Auto")
          : entityState.selectedProgram.name,
        particleName: selectedParticle.name,
        materialName: selectedMaterial.name,
        density: selectedMaterial.density,
        result,
      });
    } catch (err) {
      console.error("Preview series error:", err);
      plotState.clearPreview();
    }
  });

  // ── Derived: axis ranges from visible series ──
  const axisRanges = $derived(
    computeAxisRanges(
      [...plotState.series, ...(plotState.preview ? [plotState.preview] : [])],
      null,
      plotState.stpUnit,
    ),
  );

  // ── Add Series ──
  function handleAddSeries() {
    const { resolvedProgramId, selectedParticle, selectedMaterial, isComplete } = entityState;
    if (!isComplete || resolvedProgramId === null || !selectedParticle || !selectedMaterial) return;
    const service = libdedx.service;
    if (!service) return;
    if (!plotState.preview) return;

    const added = plotState.addSeries({
      programId: resolvedProgramId,
      particleId: selectedParticle.id,
      materialId: selectedMaterial.id,
      programName: plotState.preview.programName,
      particleName: selectedParticle.name,
      materialName: selectedMaterial.name,
      density: selectedMaterial.density,
      result: plotState.preview.result,
    });

    if (!added) {
      // TODO: show toast "This series is already plotted."
      console.warn("Duplicate series — not added.");
    }
  }

  // ── Reset All ──
  let showResetConfirm = $state(false);

  function handleResetAll() {
    if (plotState.series.length >= 2) {
      showResetConfirm = true;
    } else {
      doReset();
    }
  }

  function doReset() {
    plotState.resetAll();
    entityState.resetAll();
    showResetConfirm = false;
  }
</script>

<svelte:head>
  <title>Plot - webdedx</title>
</svelte:head>

{#if !wasmReady.value}
  <div class="flex h-64 items-center justify-center rounded-lg border bg-card p-6">
    <p class="text-muted-foreground">Loading WASM module…</p>
  </div>
{:else}
  <!-- Desktop: sidebar + main grid -->
  <div class="grid gap-4 lg:grid-cols-[minmax(360px,3fr)_7fr]">

    <!-- ── SIDEBAR ── -->
    <aside class="flex flex-col gap-4">
      <EntitySelectionPanels state={entityState} />

      <!-- Add Series button -->
      <Button
        variant="default"
        disabled={!entityState.isComplete}
        aria-disabled={!entityState.isComplete}
        onclick={handleAddSeries}
        class="w-full"
      >
        ＋ Add Series
      </Button>

      {#if plotState.series.length >= 10}
        <p class="text-sm text-muted-foreground">
          10 series displayed. Adding more may reduce readability.
        </p>
      {/if}

      <button
        class="text-sm text-muted-foreground underline hover:no-underline"
        onclick={handleResetAll}
      >
        Reset all
      </button>
    </aside>

    <!-- ── MAIN AREA ── -->
    <div class="flex flex-col gap-4">

      <!-- Controls bar: stp unit + axis scale -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- Stopping power unit segmented control -->
        <div role="radiogroup" aria-label="Stopping power unit" class="flex gap-1">
          {#each (["keV/µm", "MeV/cm", "MeV·cm²/g"] as const) as unit}
            <label class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
              {plotState.stpUnit === unit ? 'bg-primary text-primary-foreground' : 'bg-background'}">
              <input
                type="radio"
                class="sr-only"
                name="stp-unit"
                value={unit}
                checked={plotState.stpUnit === unit}
                onchange={() => plotState.setStpUnit(unit)}
              />
              {unit}
            </label>
          {/each}
        </div>

        <!-- X axis scale -->
        <div role="radiogroup" aria-label="X axis scale" class="flex gap-1">
          {#each [["Log", true], ["Lin", false]] as [label, isLog]}
            <label class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
              {plotState.xLog === isLog ? 'bg-primary text-primary-foreground' : 'bg-background'}">
              <input
                type="radio"
                class="sr-only"
                name="x-scale"
                checked={plotState.xLog === isLog}
                onchange={() => plotState.setAxisScale("x", isLog as boolean)}
              />
              X: {label}
            </label>
          {/each}
        </div>

        <!-- Y axis scale -->
        <div role="radiogroup" aria-label="Y axis scale" class="flex gap-1">
          {#each [["Log", true], ["Lin", false]] as [label, isLog]}
            <label class="flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-sm
              {plotState.yLog === isLog ? 'bg-primary text-primary-foreground' : 'bg-background'}">
              <input
                type="radio"
                class="sr-only"
                name="y-scale"
                checked={plotState.yLog === isLog}
                onchange={() => plotState.setAxisScale("y", isLog as boolean)}
              />
              Y: {label}
            </label>
          {/each}
        </div>
      </div>

      <!-- JSROOT canvas -->
      <div style="width: 100%; height: min(60vh, 600px); min-height: 400px;">
        <JsrootPlot
          series={plotState.series}
          preview={plotState.preview}
          stpUnit={plotState.stpUnit}
          xLog={plotState.xLog}
          yLog={plotState.yLog}
          {axisRanges}
        />
      </div>

      <!-- Series list (legend) -->
      {#if plotState.series.length > 0 || plotState.preview}
        <div role="list" aria-label="Plot series" class="flex flex-col gap-1">
          {#if plotState.preview}
            <div role="listitem" class="flex items-center gap-2 text-sm italic text-muted-foreground">
              <span
                class="inline-block h-4 w-4 rounded-sm border border-dashed"
                style="background-color: #000; opacity: 0.5"
                aria-label="Black, dashed line (preview)"
              ></span>
              <span>Preview — {plotState.preview.particleName} in {plotState.preview.materialName}</span>
              <button
                aria-label="Toggle preview visibility"
                onclick={() => { if (plotState.preview) plotState.preview.visible = !plotState.preview.visible; }}
                class="ml-auto text-muted-foreground hover:text-foreground"
              >👁</button>
            </div>
          {/if}

          {#each plotState.series as s (s.seriesId)}
            <div
              role="listitem"
              class="flex items-center gap-2 text-sm"
              style={s.visible ? "" : "opacity: 0.4"}
            >
              <span
                class="inline-block h-4 w-4 rounded-sm"
                style="background-color: {s.color}"
                aria-label="{s.color}, solid line"
              ></span>
              <span>{s.label}</span>
              <button
                aria-label={s.visible ? `Hide series ${s.label}` : `Show series ${s.label}`}
                aria-pressed={!s.visible}
                onclick={() => plotState.toggleVisibility(s.seriesId)}
                class="ml-auto text-muted-foreground hover:text-foreground"
              >👁</button>
              <button
                aria-label="Remove series {s.label}"
                onclick={() => plotState.removeSeries(s.seriesId)}
                class="text-muted-foreground hover:text-destructive"
              >×</button>
            </div>
          {/each}
        </div>
      {/if}

    </div>
  </div>

  <!-- Reset confirmation dialog -->
  {#if showResetConfirm}
    <div role="dialog" aria-modal="true" aria-label="Confirm reset"
         class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="rounded-lg border bg-card p-6 shadow-lg">
        <p class="mb-4">Remove all {plotState.series.length} series and reset selections?</p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" onclick={() => (showResetConfirm = false)}>Cancel</Button>
          <Button variant="destructive" onclick={doReset}>Reset</Button>
        </div>
      </div>
    </div>
  {/if}
{/if}
```

Use the `tailwind` MCP to verify any class names you are unsure about.

Run `pnpm test` (unit) and `pnpm exec playwright test tests/e2e/plot.spec.ts`
(after downloading WASM artifacts if not present locally). Commit:

```
feat(plot): implement full plot page route with entity panels, controls, and series management
```

---

## Task 6 — URL state encoding for the Plot page

**Files to modify:**
- `src/routes/plot/+page.svelte` — add URL read on mount + write on state change
- **Test file to create:** `src/tests/unit/plot-url.test.ts`

### Spec reference

From `docs/04-feature-specs/plot.md` §"URL State Encoding":

| Parameter | Example | Notes |
|-----------|---------|-------|
| `particle` | `1` | Current entity selection — particle ID |
| `material` | `276` | Current entity selection — material ID |
| `program` | `auto` or `2` | Current entity selection — program |
| `series` | `2.1.276,9.6.276` | Comma-separated triplets: `programId.particleId.materialId` |
| `stp_unit` | `kev-um` | `kev-um`, `mev-cm`, `mev-cm2-g` |
| `xscale` | `log` | `log` or `lin` |
| `yscale` | `log` | `log` or `lin` |

URL updates via `replaceState` (not `pushState`) on every state change.
Preview series is NOT encoded.

### Step 6a — unit tests first (RED)

Create `src/tests/unit/plot-url.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  encodePlotUrl,
  decodePlotUrl,
  stpUnitToToken,
  tokenToStpUnit,
} from "$lib/utils/plot-url";
import type { StpUnit } from "$lib/wasm/types";
```

#### `describe("stpUnitToToken / tokenToStpUnit")`

```
stpUnitToToken("keV/µm")    → "kev-um"
stpUnitToToken("MeV/cm")    → "mev-cm"
stpUnitToToken("MeV·cm²/g") → "mev-cm2-g"

tokenToStpUnit("kev-um")    → "keV/µm"
tokenToStpUnit("mev-cm")    → "MeV/cm"
tokenToStpUnit("mev-cm2-g") → "MeV·cm²/g"
tokenToStpUnit("invalid")   → "keV/µm"  // default fallback
```

#### `describe("encodePlotUrl")`

```typescript
const input = {
  particleId: 1,
  materialId: 276,
  programId: -1,      // -1 = auto
  series: [
    { programId: 2, particleId: 1, materialId: 276 },
    { programId: 9, particleId: 6, materialId: 276 },
  ],
  stpUnit: "keV/µm" as StpUnit,
  xLog: true,
  yLog: true,
};
const params = encodePlotUrl(input);
params.get("particle") → "1"
params.get("material") → "276"
params.get("program")  → "auto"
params.get("series")   → "2.1.276,9.6.276"
params.get("stp_unit") → "kev-um"
params.get("xscale")   → "log"
params.get("yscale")   → "log"

// programId not -1
const params2 = encodePlotUrl({ ...input, programId: 2 });
params2.get("program") → "2"

// empty series list → no series param (or empty string)
const params3 = encodePlotUrl({ ...input, series: [] });
params3.has("series") → false  // omit when empty
```

#### `describe("decodePlotUrl")`

```
const sp = new URLSearchParams("particle=1&material=276&program=auto&series=2.1.276,9.6.276&stp_unit=kev-um&xscale=log&yscale=lin");
const decoded = decodePlotUrl(sp);
decoded.particleId → 1
decoded.materialId → 276
decoded.programId  → -1   // "auto" → -1
decoded.series[0]  → { programId: 2, particleId: 1, materialId: 276 }
decoded.series[1]  → { programId: 9, particleId: 6, materialId: 276 }
decoded.stpUnit    → "keV/µm"
decoded.xLog       → true
decoded.yLog       → false  // "lin"

// Invalid/missing params use defaults
const sp2 = new URLSearchParams("");
const decoded2 = decodePlotUrl(sp2);
decoded2.particleId → null
decoded2.materialId → null
decoded2.programId  → -1
decoded2.series     → []
decoded2.stpUnit    → "keV/µm"
decoded2.xLog       → true
decoded2.yLog       → true

// Invalid series triplets are silently dropped
const sp3 = new URLSearchParams("series=2.1.276,invalid,9.6.276");
decodePlotUrl(sp3).series → [{ programId: 2, particleId: 1, materialId: 276 }, { programId: 9, particleId: 6, materialId: 276 }]
```

### Step 6b — implement `src/lib/utils/plot-url.ts`

```typescript
import type { StpUnit } from "$lib/wasm/types";

const STP_TOKENS: Record<StpUnit, string> = {
  "keV/µm":    "kev-um",
  "MeV/cm":    "mev-cm",
  "MeV·cm²/g": "mev-cm2-g",
};

const TOKEN_TO_STP: Record<string, StpUnit> = Object.fromEntries(
  Object.entries(STP_TOKENS).map(([k, v]) => [v, k as StpUnit])
);

export function stpUnitToToken(unit: StpUnit): string {
  return STP_TOKENS[unit];
}

export function tokenToStpUnit(token: string): StpUnit {
  return TOKEN_TO_STP[token] ?? "keV/µm";
}

export interface PlotUrlInput {
  particleId: number | null;
  materialId: number | null;
  programId: number;  // -1 for auto
  series: Array<{ programId: number; particleId: number; materialId: number }>;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
}

export interface PlotUrlDecoded {
  particleId: number | null;
  materialId: number | null;
  programId: number;
  series: Array<{ programId: number; particleId: number; materialId: number }>;
  stpUnit: StpUnit;
  xLog: boolean;
  yLog: boolean;
}

export function encodePlotUrl(input: PlotUrlInput): URLSearchParams {
  const params = new URLSearchParams();
  if (input.particleId !== null) params.set("particle", String(input.particleId));
  if (input.materialId !== null) params.set("material", String(input.materialId));
  params.set("program", input.programId === -1 ? "auto" : String(input.programId));
  if (input.series.length > 0) {
    params.set("series", input.series.map((s) => `${s.programId}.${s.particleId}.${s.materialId}`).join(","));
  }
  params.set("stp_unit", stpUnitToToken(input.stpUnit));
  params.set("xscale", input.xLog ? "log" : "lin");
  params.set("yscale", input.yLog ? "log" : "lin");
  return params;
}

export function decodePlotUrl(params: URLSearchParams): PlotUrlDecoded {
  const particleId = params.has("particle") ? Number(params.get("particle")) : null;
  const materialId = params.has("material") ? Number(params.get("material")) : null;
  const programParam = params.get("program");
  const programId = !programParam || programParam === "auto" ? -1 : Number(programParam);

  const seriesParam = params.get("series") ?? "";
  const series = seriesParam
    ? seriesParam
        .split(",")
        .map((triplet) => {
          const parts = triplet.split(".").map(Number);
          if (parts.length !== 3 || parts.some(isNaN)) return null;
          return { programId: parts[0], particleId: parts[1], materialId: parts[2] };
        })
        .filter((s): s is { programId: number; particleId: number; materialId: number } => s !== null)
    : [];

  const stpUnit = tokenToStpUnit(params.get("stp_unit") ?? "");
  const xLog = (params.get("xscale") ?? "log") === "log";
  const yLog = (params.get("yscale") ?? "log") === "log";

  return { particleId, materialId, programId, series, stpUnit, xLog, yLog };
}
```

### Step 6c — wire URL sync into the plot page

In `src/routes/plot/+page.svelte`, add URL read on mount and write on state change.

**Read on mount** (use `$effect` with `untrack` to avoid reactivity loop):

```svelte
<script>
  import { page } from "$app/stores";  // or $app/state in SvelteKit 2
  import { goto } from "$app/navigation";
  import { decodePlotUrl, encodePlotUrl } from "$lib/utils/plot-url";
  import { browser } from "$app/environment";

  // On mount: read URL params and restore state
  $effect(() => {
    if (!browser || !wasmReady.value) return;
    const params = new URLSearchParams(window.location.search);
    const decoded = decodePlotUrl(params);

    // Restore entity selection
    if (decoded.particleId !== null) entityState.selectParticle(decoded.particleId);
    if (decoded.materialId !== null) entityState.selectMaterial(decoded.materialId);
    if (decoded.programId !== -1) entityState.selectProgram(decoded.programId);

    // Restore plot settings
    if (decoded.stpUnit) plotState.setStpUnit(decoded.stpUnit);
    plotState.setAxisScale("x", decoded.xLog);
    plotState.setAxisScale("y", decoded.yLog);

    // Restore series (each series needs a getPlotData call)
    const service = libdedx.service;
    if (!service) return;
    for (const s of decoded.series) {
      try {
        const result = service.getPlotData(s.programId, s.particleId, s.materialId, 500, true);
        // Look up names from the service
        const programs = service.getPrograms();
        const particles = service.getParticles(s.programId);
        const materials = service.getMaterials(s.programId);
        const prog = programs.find((p) => p.id === s.programId);
        const part = particles.find((p) => p.id === s.particleId);
        const mat = materials.find((m) => m.id === s.materialId);
        if (!prog || !part || !mat) continue;
        plotState.addSeries({
          programId: s.programId, particleId: s.particleId, materialId: s.materialId,
          programName: prog.name, particleName: part.name, materialName: mat.name,
          density: mat.density, result,
        });
      } catch {
        // Invalid triplet — silently skip per spec
      }
    }
  });

  // Write URL on state change (replaceState — no history entry)
  $effect(() => {
    if (!browser) return;
    const params = encodePlotUrl({
      particleId: entityState.selectedParticle?.id ?? null,
      materialId: entityState.selectedMaterial?.id ?? null,
      programId: entityState.selectedProgram.id,
      series: plotState.series.map((s) => ({
        programId: s.programId, particleId: s.particleId, materialId: s.materialId,
      })),
      stpUnit: plotState.stpUnit,
      xLog: plotState.xLog,
      yLog: plotState.yLog,
    });
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.replaceState({}, "", newUrl);
  });
</script>
```

Run `pnpm test` (unit). For E2E URL tests, add to `tests/e2e/plot.spec.ts`:

```typescript
test("URL updates when series is added", async ({ page }) => {
  // select particle, material — then add series
  // after add, expect ?series= in URL
  await page.goto("/plot");
  // ... (implementation depends on actual UI; use playwright MCP to inspect)
  const url = page.url();
  expect(url).toContain("stp_unit=kev-um");
  expect(url).toContain("xscale=log");
  expect(url).toContain("yscale=log");
});
```

Commit:

```
feat(plot): add URL state encoding and decoding for plot page
```

---

## Task 7 — AI session logging

Create the mandatory session log and update the changelog.

### Step 7a — create session log

Create `docs/ai-logs/2026-04-27-stage5-jsroot-plot.md` (adjust date to actual
session date):

```markdown
# YYYY-MM-DD — Stage 5.5: JSROOT Plot Wrapper

## Session Narrative

### Task 1: Plot utilities
**AI response**: Created `plot-utils.ts` with `convertStpForDisplay`,
`buildDrawOptions`, `computeAxisRanges`, `COLOR_PALETTE`, `PREVIEW_COLOR`.
All unit tests passing.

### Task 2: Series labels + color pool
**AI response**: Created `series-labels.ts` with `computeSeriesLabels`,
`allocateColor`, `releaseColor`. All 8 label variants tested.

### Task 3: Plot state module
**AI response**: Created `plot.svelte.ts` with `createPlotState()` factory.
Tests cover add/remove/toggle, duplicate detection, label recomputation,
color pool recycling.

### Task 4: JsrootPlot.svelte
**AI response**: Created `jsroot-plot.svelte` with `$effect` lifecycle,
TMultiGraph construction, ZoomWheel/ZoomTouch disabled, resize observer.
Deleted obsolete `jsroot-helpers.ts`.

### Task 5: Plot page route
**AI response**: Replaced placeholder `src/routes/plot/+page.svelte` with
full implementation: entity panels, controls bar, JSROOT canvas, series list,
Add Series button, Reset All confirmation dialog.

### Task 6: URL state
**AI response**: Created `plot-url.ts` with encode/decode. Wired
`history.replaceState` into the plot page. URL roundtrip E2E test added.

## Tasks

### Stage 5.5: JSROOT Plot Wrapper
- **Status**: completed
- **Stage**: Stage 5 (docs/00-redesign-plan.md §8)
- **Files changed**:
  - `src/lib/utils/plot-utils.ts` (new)
  - `src/lib/utils/series-labels.ts` (new)
  - `src/lib/utils/plot-url.ts` (new)
  - `src/lib/state/plot.svelte.ts` (new)
  - `src/lib/components/jsroot-plot.svelte` (new)
  - `src/lib/components/jsroot-helpers.ts` (deleted)
  - `src/routes/plot/+page.svelte` (replaced)
  - `src/tests/unit/plot-utils.test.ts` (new)
  - `src/tests/unit/series-labels.test.ts` (new)
  - `src/tests/unit/plot-state.test.ts` (new)
  - `src/tests/unit/plot-url.test.ts` (new)
  - `src/tests/components/jsroot-plot.test.ts` (new)
  - `tests/e2e/plot.spec.ts` (new)
- **Decision**: ...any non-obvious choices made during implementation
- **Issue**: ...anything unresolved (e.g. E2E flakiness with WASM)
```

### Step 7b — update CHANGELOG-AI.md

Prepend a new row at the **top** of the table body:

```markdown
| 2026-04-27 | 5.5 | **Stage 5.5: JSROOT plot wrapper — COMPLETE** (Qwen3.5-397B-A17B-FP8 via opencode): implemented `JsrootPlot.svelte` component (JSROOT lifecycle, TMultiGraph, ZoomWheel/ZoomTouch disabled, resize observer), `plot.svelte.ts` state module (series add/remove/toggle, color pool, smart labels), `plot-utils.ts` (unit conversion, axis ranges, draw options), `series-labels.ts` (8-variant label algorithm), `plot-url.ts` (URL encode/decode), full Plot page route with entity panels, controls bar, series list, Add Series, Reset All, and URL sync. Deleted obsolete `jsroot-helpers.ts`. N unit tests + N E2E tests passing. | [log](docs/ai-logs/2026-04-27-stage5-jsroot-plot.md) |
```

(Replace `N` with actual counts.)

### Step 7c — update docs/ai-logs/README.md

Add a one-line pointer to the new log file.

Commit:

```
docs: add AI session log for Stage 5.5 JSROOT plot wrapper
```

---

## Final checklist before handing back

- [ ] `pnpm test` green (all Vitest unit + component tests)
- [ ] `pnpm exec playwright test tests/e2e/plot.spec.ts` green (plot E2E)
- [ ] `pnpm lint` clean (no ESLint errors)
- [ ] `pnpm build` succeeds
- [ ] Each task has a Conventional Commit
- [ ] `CHANGELOG-AI.md` has a new row at the top
- [ ] `docs/ai-logs/2026-04-27-stage5-jsroot-plot.md` created
- [ ] `docs/ai-logs/README.md` updated with one-line pointer

---

## Notes on Svelte 5 (critical — read before writing any component)

| Use | Never use |
|-----|-----------|
| `$state`, `$derived`, `$effect`, `$props`, `$bindable` | `export let`, `$:`, `createEventDispatcher()` |
| `$effect(() => { ... return () => cleanup(); })` | `onMount` / `onDestroy` from `svelte` |
| `onclick={handler}` | `on:click={handler}` |
| `$derived.by(() => ...)` for complex derivations | Computed values in `$:` |
| Reassign `$state` arrays: `arr = [...arr, item]` | `arr.push(item)` (does not trigger reactivity) |

In `.svelte.ts` files, runes (`$state`, `$derived`, etc.) are available
globally — **do not import them**.

## Notes on JSROOT import

Use dynamic import so JSROOT is not bundled eagerly:

```typescript
const JSROOT = (await import("jsroot")).default;
```

The `prototypes/jsroot-svelte5/` spike validated this pattern. Do NOT use
static `import JSROOT from "jsroot"` — it breaks SSR prerendering.

## Notes on shadcn-svelte components

- `Button` → `import { Button } from "$lib/components/ui/button"`
- Never hand-roll button HTML when a shadcn component exists
- Use the `tailwind` MCP to look up Tailwind v4 class names if uncertain
- CSS variables for theming are in `src/app.css` (`@theme inline` block)

## Notes on testing the plot component

The Vitest component test environment runs in jsdom (not a real browser).
Mock `jsroot` with `vi.mock("jsroot", ...)` before importing the component.
`JSROOT.draw` in tests should return `Promise.resolve({ cleanup: vi.fn() })`.
Use `vi.waitFor(() => ...)` for assertions after async effects.

Do NOT try to run actual JSROOT rendering in unit tests — mock it completely.

## Notes on the WASM mock

The `MockLibdedxService` in `src/lib/wasm/__mocks__/libdedx.ts` implements
`getPlotData`. The mock generates 500 log-spaced energies and simple
`Math.log(e+1)` stopping powers — sufficient for state-layer tests.
Do not modify the mock unless a new method is needed on `LibdedxService`.
