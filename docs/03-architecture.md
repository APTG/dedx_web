# Architecture — webdedx

> **Status:** Draft v1 (14 April 2026)
>
> Describes the SvelteKit project structure, WASM service layer, reactive
> state topology, routing, and static adapter constraints.

---

## 1. Project Structure

```
dedx_web/
├── src/
│   ├── app.html                        # SvelteKit HTML template (one per app)
│   ├── app.css                         # Global Tailwind base + custom CSS variables
│   ├── lib/
│   │   ├── wasm/                       # WASM loader + typed wrapper (§3)
│   │   │   ├── types.ts                # Re-exports from docs/06-wasm-api-contract.md
│   │   │   ├── loader.ts               # Lazy singleton: module factory + init
│   │   │   ├── libdedx.ts              # LibdedxService implementation
│   │   │   └── __mocks__/
│   │   │       └── libdedx.ts          # Vitest mock — static fixture data
│   │   ├── state/                      # App-wide reactive state (§4)
│   │   │   ├── entities.svelte.ts      # Programs, particles, materials, compat matrix
│   │   │   ├── selection.svelte.ts     # Selected program / particle / material
│   │   │   ├── calculation.svelte.ts   # Energy inputs, results, unit settings
│   │   │   ├── ui.svelte.ts            # Basic/Advanced mode, loading flags
│   │   │   └── url-sync.ts             # URL ↔ state serialization
│   │   ├── components/                 # Reusable UI components (§5)
│   │   │   ├── EntityDropdown.svelte   # Typeahead combobox (Calculator layout)
│   │   │   ├── EntityPanel.svelte      # Full scrollable panel (Plot layout)
│   │   │   ├── EnergyInput.svelte      # Textarea: per-line parse + validation
│   │   │   ├── UnitSelector.svelte     # Segmented control: MeV / MeV/nucl / MeV/u
│   │   │   ├── ResultTable.svelte      # Unified input/result table
│   │   │   ├── JsrootPlot.svelte       # JSROOT DOM wrapper (§4.4)
│   │   │   ├── AdvancedOptions.svelte  # Accordion: density/I-value/state/interp/MSTAR
│   │   │   ├── ExportToolbar.svelte    # PDF / CSV / Share buttons
│   │   │   └── BuildBadge.svelte       # Footer: commit hash, date, branch
│   │   ├── export/                     # Export utilities
│   │   │   ├── csv.ts                  # CSV generation (BOM, CRLF, 4 sig figs)
│   │   │   └── pdf.ts                  # jsPDF assembly: metadata + table + SVG
│   │   └── units/                      # Unit conversion utilities
│   │       ├── energy.ts               # MeV ↔ MeV/nucl ↔ MeV/u (particle-aware)
│   │       ├── stopping-power.ts       # MeV·cm²/g ↔ MeV/cm ↔ keV/µm (density-aware)
│   │       └── range.ts                # g/cm² ↔ cm (density-aware)
│   └── routes/                         # SvelteKit file-based routes (§2)
│       ├── +layout.svelte              # Shell: nav bar, Advanced toggle, footer
│       ├── +layout.ts                  # WASM init (load-once for all pages)
│       ├── +page.svelte                # Redirect → /calculator
│       ├── calculator/
│       │   ├── +page.svelte            # Calculator page
│       │   └── +page.ts                # Prerender: export const prerender = true
│       ├── plot/
│       │   ├── +page.svelte            # Plot page
│       │   └── +page.ts                # Prerender: export const prerender = true
│       └── docs/
│           ├── +page.svelte            # Documentation landing
│           ├── user-guide/
│           │   └── +page.svelte        # User guide
│           └── technical/
│               └── +page.svelte        # Technical reference
├── static/
│   ├── wasm/
│   │   ├── libdedx.mjs                 # Emscripten ES module glue (built artifact)
│   │   └── libdedx.wasm                # WASM binary (built artifact)
│   ├── favicon.svg                     # Vector icon — modern browsers; scales to any size
│   ├── favicon.ico                     # Legacy fallback (combined 16×16 + 32×32 ICO)
│   ├── apple-touch-icon.png            # iOS home screen shortcut (180×180 px)
│   └── site.webmanifest                # Web App Manifest — name, theme color, icon list
├── wasm/
│   ├── dedx_extra.h                    # Thin shim: exposes internal libdedx data
│   ├── dedx_extra.c                    # Implementation of dedx_extra shims
│   └── build.sh                        # Emscripten build script (Stage 3)
├── libdedx/                            # Git submodule — upstream C library
├── tests/
│   ├── unit/                           # Vitest unit tests
│   ├── integration/                    # Vitest integration tests (real WASM)
│   └── e2e/                            # Playwright E2E tests
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── eslint.config.js
└── .prettierrc
```

### Icons and Web App Manifest

All icon files live in `static/` so SvelteKit serves them as static assets.
They are referenced in `src/app.html` via static `<link>` tags — not through
Svelte components, because they must be present in the `<head>` on the first
HTML response before any JavaScript runs:

```html
<!-- src/app.html — inside <head>, before %sveltekit.head% -->
<link rel="icon" href="%sveltekit.assets%/favicon.ico" sizes="32x32">
<link rel="icon" href="%sveltekit.assets%/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png">
<link rel="manifest" href="%sveltekit.assets%/site.webmanifest">
```

`%sveltekit.assets%` resolves to the correct base path at build time —
required because GitHub Pages may serve the app from a sub-path
(e.g., `/dedx_web/`). Hardcoding `/favicon.ico` would break sub-path deployments.

`site.webmanifest` declares the app name, `theme_color`, `background_color`,
and icon references for Android home screen and PWA install prompts.

---

### Naming conventions

| Pattern | Description |
|---------|-------------|
| `*.svelte.ts` | State modules — TypeScript files containing `$state` runes. Named with `.svelte.ts` so that `svelte-check` and `eslint-plugin-svelte` apply rune-aware rules. |
| `+layout.svelte` / `+page.svelte` | SvelteKit route files — must use the `+` prefix convention. |
| `__mocks__/` | Vitest manual mocks — co-located with the module they mock. |

---

## 2. Routing

### Route map

| URL path | File | Purpose |
|----------|------|---------|
| `/` | `src/routes/+page.svelte` | Redirects to `/calculator` |
| `/calculator` | `src/routes/calculator/+page.svelte` | Calculator page (landing) |
| `/plot` | `src/routes/plot/+page.svelte` | Plot page |
| `/docs` | `src/routes/docs/+page.svelte` | Documentation landing |
| `/docs/user-guide` | `src/routes/docs/user-guide/+page.svelte` | User guide |
| `/docs/technical` | `src/routes/docs/technical/+page.svelte` | Technical reference |

All pages set `export const prerender = true` in their `+page.ts` files.
SvelteKit's static adapter serializes them to `index.html` files inside
`build/`.

### Navigation

The layout (`+layout.svelte`) renders the persistent navigation bar:

```
[ webdedx logo ]  [ Calculator ]  [ Plot ]  [ Docs ]
                                      (right) [ Basic · Advanced ]  [ Share ]  [ Export ▾ ]
```

The `Basic · Advanced` toggle is an app-wide control (see
`docs/01-project-vision.md §4.4`). It lives in `src/lib/state/ui.svelte.ts`
and is persisted to `localStorage` and the URL (`mode=advanced`).

### Static adapter constraints

Because the site is purely static:

- **No `load()` functions that call a server** — all data comes from WASM.
- **No server routes** (`src/routes/+server.ts` files are forbidden).
- **No `+page.server.ts`** files.
- **URL state** is the only persistence mechanism (beyond `localStorage` for
  Advanced mode and custom compounds).
- **404 handling**: the adapter emits a `404.html` file; GitHub Pages serves
  it for unrecognized paths. Client-side routing then takes over.

---

## 3. WASM Service Layer

### Initialization lifecycle

```
Browser load
    │
    ▼
+layout.ts: load()
    │   ← runs once for all routes (SvelteKit layout load)
    │
    ▼
loader.ts: getService()
    │   ← returns cached singleton on subsequent calls
    │
    ├─► static/wasm/libdedx.mjs  (fetch by Emscripten factory)
    └─► static/wasm/libdedx.wasm (fetch in parallel by browser)
            │
            ▼
        Module compiled and instantiated
            │
            ▼
        libdedx.ts: LibdedxServiceImpl.init()
            │   ← calls dedx_fill_program_list(), caches entities
            ▼
        entities.svelte.ts: loadEntities()
            │   ← populates programs, particles, materials, compat matrix
            ▼
        WASM ready — Calculator/Plot pages reactive
```

The WASM module is initialized in the **root layout load** function, which runs
once and is shared across all routes. This means:

- The Documentation page incurs the WASM load cost on first visit — acceptable
  because it shares the same layout as Calculator and Plot.
- Navigating between Calculator and Plot does not re-initialize WASM.
- The loading state is held in `ui.svelte.ts` (`wasmReady: boolean`);
  Calculator and Plot gate their rendering on this flag.

### Module files

#### `src/lib/wasm/types.ts`

Re-exports all types from `docs/06-wasm-api-contract.md`:

```ts
export type { EnergyUnit, StpUnit, RangeUnit } from './contract';
export type { LibdedxEntity, ParticleEntity, ProgramEntity, MaterialEntity } from './contract';
export type { CalculationResult, InverseStpResult, InverseCsdaResult } from './contract';
export type { AdvancedOptions, AggregateState, MstarMode,
              InterpolationScale, InterpolationMethod } from './contract';
export type { CustomCompound, CompoundElement } from './contract';
export { LibdedxError } from './contract';
export type { LibdedxService } from './contract';
```

#### `src/lib/wasm/loader.ts`

```ts
let service: LibdedxService | null = null;

export async function getService(): Promise<LibdedxService> {
  if (service) return service;
  const factory = await import('/wasm/libdedx.mjs');
  const module = await factory.default({
    locateFile: (f: string) => `/wasm/${f}`
  });
  service = new LibdedxServiceImpl(module);
  await service.init();
  return service;
}
```

The `locateFile` override tells Emscripten where to find `libdedx.wasm`
relative to the site root — required when the `.mjs` and `.wasm` files are
not served from the same URL directory as the requesting page.

#### `src/lib/wasm/libdedx.ts`

Implements `LibdedxService`. Key design points:

- **Stateless path**: `calculate()` uses `dedx_get_stp_table()` and
  `dedx_get_csda_range_table()` directly. No workspace allocation.
- **Stateful path**: When `AdvancedOptions` are non-empty (or for inverse
  lookups, custom compounds), allocates a `dedx_config` workspace, sets
  fields, evaluates, frees. The workspace is always freed in a `finally` block.
- **Memory management**: C arrays are allocated via `_malloc()` /
  `_free()` using the Emscripten heap. Array sizes are known before allocation.
  All allocations are freed in `finally` blocks — no memory leaks on error.
- **String handling**: C strings are read via `UTF8ToString()`. C strings
  written from JS use `stringToUTF8()` + `lengthBytesUTF8()`.

### Compatibility matrix

The `CompatibilityMatrix` is built at init time by iterating all
program/particle/material combinations and noting which (program, particle)
pairs exist in the entity lists returned by `dedx_fill_ion_list(programId)`:

```ts
// Populated once in entities.svelte.ts after WASM init
const compat: CompatibilityMatrix = new Map();
for (const prog of programs) {
  const particles = service.getParticles(prog.id);
  for (const p of particles) {
    const materials = service.getMaterials(prog.id);
    compat.set(`${prog.id}:${p.id}`, materials.map(m => m.id));
  }
}
```

This is referenced by `EntityDropdown.svelte` / `EntityPanel.svelte` for
greying-out incompatible combinations without additional WASM calls.

---

## 4. Reactive State Topology

All application state lives in `.svelte.ts` modules under `src/lib/state/`.
These are plain TypeScript files that use Svelte 5 runes (`$state`, `$derived`).
They are **not** Svelte components — they are shared state singletons imported
by any component that needs them.

### 4.1 `entities.svelte.ts`

Holds the immutable entity lists and compatibility matrix. Populated once
during WASM init.

```ts
// Read-only after init
export const programs = $state<ProgramEntity[]>([]);
export const allParticles = $state<Map<number, ParticleEntity[]>>(new Map());
export const allMaterials = $state<Map<number, MaterialEntity[]>>(new Map());
export const compatMatrix = $state<CompatibilityMatrix>(new Map());
```

### 4.2 `selection.svelte.ts`

Holds the user's current entity selection. Shared between Calculator and
Plot pages — navigating between them preserves the selection.

```ts
export let selectedProgramId = $state<number | null>(null);
export let selectedParticleId = $state<number | null>(null);
export let selectedMaterialId = $state<number | null>(null);

// Derived: the resolved program for the current particle/material combo.
// Implements the "auto-select best program" rule (01-project-vision.md §4.3).
export const resolvedProgramId = $derived(
  autoSelectProgram(selectedProgramId, selectedParticleId, selectedMaterialId, compatMatrix)
);
```

### 4.3 `calculation.svelte.ts`

Holds the energy input state, active unit, and the latest calculation result.

```ts
export let energyInputText = $state('');           // raw textarea content
export let energyUnit = $state<EnergyUnit>('MeV');
export let advancedOptions = $state<AdvancedOptions>({});
export let result = $state<CalculationResult | null>(null);
export let error = $state<LibdedxError | null>(null);
export let calculating = $state(false);

// Derived: parsed energy array (valid lines only)
export const parsedEnergies = $derived(parseEnergyInput(energyInputText, energyUnit));
```

Live calculation is triggered by an `$effect` in the Calculator page that
watches `parsedEnergies`, `resolvedProgramId`, `selectedParticleId`,
`selectedMaterialId`, and `advancedOptions`. The effect is debounced
(300 ms) to avoid firing on every keystroke.

### 4.4 `ui.svelte.ts`

```ts
export let isAdvancedMode = $state(false);       // persisted to localStorage + URL
export let wasmReady = $state(false);            // set true after WASM init
export let wasmError = $state<Error | null>(null);
```

`isAdvancedMode` is initialized from `localStorage` (if present) or the URL
`mode=advanced` parameter, in that order. The URL parameter takes precedence
over localStorage when opening a shared link.

### 4.5 `url-sync.ts`

Not a `.svelte.ts` file — it contains no runes itself. It exposes two pure
functions:

```ts
/** Serialize current state to a URL query string. */
export function stateToUrl(state: AppState): URLSearchParams;

/** Deserialize URL query string into AppState. */
export function urlToState(params: URLSearchParams): Partial<AppState>;
```

The URL ↔ state round-trip follows the canonical ordering and versioning rules
specified in `docs/04-feature-specs/shareable-urls-formal.md`. The `urlv=1`
sentinel is always included when emitting a shareable URL.

URL sync is wired in `+layout.svelte` via a `$effect`:

```svelte
$effect(() => {
  // On state change: push new URL without reload
  const params = stateToUrl(currentState);
  history.replaceState(null, '', `?${params}`);
});
```

On page load, `urlToState` is called once in `+layout.ts` to hydrate state
from the URL.

---

## 5. Component Tree

```
+layout.svelte
│   NavBar.svelte
│   ExportToolbar.svelte (Share / Export PDF / Export CSV)
│   BuildBadge.svelte
│
├── calculator/+page.svelte
│   │   EntityDropdown.svelte (particle)
│   │   EntityDropdown.svelte (material)
│   │   EntityDropdown.svelte (program)
│   │   EnergyInput.svelte
│   │   UnitSelector.svelte
│   │   ResultTable.svelte
│   │   AdvancedOptions.svelte  (accordion, hidden in Basic mode)
│   │   └── [ density / I-value / state / interpolation / MSTAR inputs ]
│   └── InverseLookups.svelte   (tabs, hidden in Basic mode)
│
├── plot/+page.svelte
│   │   EntityPanel.svelte (particle — scrollable list)
│   │   EntityPanel.svelte (material — scrollable list)
│   │   EntityPanel.svelte (program — scrollable list)
│   │   SeriesManager.svelte (add/remove/reorder series)
│   │   JsrootPlot.svelte  ← JSROOT DOM owner
│   │   AxisControls.svelte (log/lin toggle, unit selector)
│   └── AdvancedOptions.svelte
│
└── docs/+page.svelte
    └── (static Svelte components, no WASM interaction)
```

### JsrootPlot.svelte — DOM ownership contract

JSROOT draws into a `<div>` element that it owns completely. Svelte must not
reconcile or re-render the contents of this element.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';   // exception: onMount permitted here
  let container: HTMLDivElement;
  let painter: any = null;

  $effect(() => {
    // series is a reactive dependency; re-draw when it changes
    untrack(() => {
      if (painter) painter.cleanup?.();
    });
    if (!series.length) return;
    drawPlot(container, series).then(p => { painter = p; });

    return () => { painter?.cleanup?.(); };
  });
</script>

<div bind:this={container} class="jsroot-container w-full h-full"></div>
```

`untrack()` prevents the cleanup call from registering `painter` as a reactive
dependency (which would create a re-run loop). The `drawPlot` function is a
pure async function in `src/lib/components/jsroot-helpers.ts` that constructs
`TMultiGraph` and calls `JSROOT.draw()`.

> **Note:** `onMount` is permitted exclusively in `JsrootPlot.svelte` and
> only when needed for initial DOM readiness checks. All other components
> use `$effect` instead.

---

## 6. Data Flow: Calculator Page

```
User types energy
        │
        ▼
EnergyInput.svelte  →  energyInputText (calculation.svelte.ts)
                                │
                         $derived parsedEnergies
                                │
                         $effect (debounced 300ms)
                                │
                    ┌───────────┴───────────────────────┐
                    │ selection.svelte.ts                │
                    │  resolvedProgramId                 │
                    │  selectedParticleId               │
                    │  selectedMaterialId               │
                    └───────────────────────────────────┘
                                │
                     service.calculate(params)   ← LibdedxService
                                │
                         CalculationResult
                                │
                         result (calculation.svelte.ts)
                                │
                         ResultTable.svelte  ←  unit conversion utilities
                                │
                         [ display + live update ]
```

### Unit conversion in the data flow

The `CalculationResult` from WASM always contains:
- `energies` in MeV/nucl
- `stoppingPowers` in MeV·cm²/g
- `csdaRanges` in g/cm²

The `ResultTable.svelte` component calls unit conversion utilities to display
values in the user's selected unit. Conversion is purely JavaScript — the WASM
result is cached as-is; re-rendering with a new unit does not trigger a new
WASM call.

---

## 7. Data Flow: Plot Page

```
User adds a series (program + particle + material)
        │
        ▼
SeriesManager  →  series[] (plot-local $state)
        │
        ▼
$effect: for each series, call service.getPlotData(500 pts, logScale=true)
        │
        ▼
CalculationResult[] (one per series)
        │
        ▼
JsrootPlot.svelte: TMultiGraph construction
  ├── TGraph per series (energies × stoppingPowers)
  ├── Color assigned from palette (perceptually distinct, colorblind-safe)
  └── JSROOT.draw(container, multiGraph, 'AP')
```

The Plot page manages its own `series` state locally (not in
`calculation.svelte.ts`) because it can hold multiple series simultaneously,
whereas Calculator operates on a single (program, particle, material) at a time.

---

## 8. Custom Compounds

Custom compounds require the stateful `dedx_config` WASM API path. The flow:

1. User defines a compound in the `CustomCompoundEditor.svelte` modal.
2. The compound is stored in `localStorage` as a `StoredCompound`
   (with UUID, phase, timestamp — see `docs/04-feature-specs/custom-compounds.md`).
3. When selected as the active material, `selectedMaterialId` is set to the
   special sentinel `CUSTOM_MATERIAL_ID = -1`.
4. `calculation.svelte.ts` detects `selectedMaterialId === CUSTOM_MATERIAL_ID`
   and routes to `service.calculateCustomCompound()` instead of `service.calculate()`.
5. The `CustomCompound` type passed to WASM is stripped of localStorage
   metadata (UUID, phase, timestamp) — it contains only `name`, `elements`,
   `density`, and optional `iValue`.

---

## 9. URL State Synchronization

URL sync follows the canonical 10-step algorithm in
`docs/04-feature-specs/shareable-urls-formal.md`. Key points:

- **Read on load**: `urlToState()` runs once in `+layout.ts` before any
  component mounts. State is hydrated before the first render.
- **Write on change**: `stateToUrl()` runs in a `$effect` in `+layout.svelte`
  whenever any URL-relevant state changes. Uses `history.replaceState()` — no
  page reload, no history entry.
- **Share button**: Copies the current URL to the clipboard. The URL already
  contains all state — no additional serialization is needed.
- **`urlv=1` sentinel**: Always included in the emitted URL. If a future
  breaking change increments `urlv`, the parser in `urlToState()` issues a
  warning banner per `docs/04-feature-specs/shareable-urls.md §3.1`.

---

## 10. SSG / Static Adapter Constraints

| Constraint | Implication |
|-----------|-------------|
| All routes are pre-rendered | No `load()` functions may call a network API. Data comes from WASM only. |
| WASM not available at build time | The `+page.ts` `load()` functions must not call `getService()`. WASM init happens client-side in `+layout.ts` `load()` with `browser` guard. |
| `export const prerender = true` | Every route file must set this. If omitted, the static adapter will not output an `index.html` for that route. |
| No `fetch()` to same-origin API routes | GitHub Pages has no server. Do not rely on SvelteKit's server fetch hook. |
| `localStorage` access | Only safe inside `$effect` or event handlers — not in `+page.ts` load functions that run during SSG prerender. |
| CORS for external data | User-hosted `.webdedx.parquet` files must be served with `Access-Control-Allow-Origin: *`. This is documented in the user guide, not enforced by the app. |

### WASM init guard

```ts
// +layout.ts
import { browser } from '$app/environment';
import { getService } from '$lib/wasm/loader';

export async function load() {
  if (!browser) return;   // Skip during SSG prerender
  await getService();
}
```

Without the `browser` guard, SvelteKit's prerender pass would attempt to load
the WASM module in Node.js — which fails because Emscripten's `web` environment
is browser-only.

---

## 11. Error Handling

### WASM errors

`LibdedxError` (typed, extends `Error`) is thrown by `LibdedxServiceImpl` when
the C library returns a non-zero error code. Caught in `calculation.svelte.ts`
and stored in `error` state. `ResultTable.svelte` renders a human-friendly
message; a "Show details" toggle reveals the raw C error code.

### Multi-program errors

`service.calculateMulti()` returns `Map<number, CalculationResult | LibdedxError>`.
A `LibdedxError` for one program is displayed per-column in the result table
without aborting the other programs.

### WASM module load failure

Caught in `+layout.ts` load function and stored in `ui.svelte.ts`
`wasmError`. The layout renders a full-page error message with instructions
to reload or check browser compatibility.

### Input validation errors

Energy input parsing (`parseEnergyInput()`) returns per-line validation errors.
These are rendered inline in `EnergyInput.svelte` as red borders + tooltips —
not as `LibdedxError` instances (they are JS-level, not C-level errors).

---

## 12. Performance Considerations

| Area | Strategy |
|------|----------|
| WASM binary size | Several MB — served from `static/wasm/`; cached by browser HTTP cache. Progress spinner shown while loading. |
| JSROOT bundle | ~500 kB gzipped — lazy-loaded only when Plot page is first visited (`import('jsroot')`). |
| Calculation debounce | 300 ms debounce on energy input `$effect` prevents WASM calls on every keystroke. |
| Entity list caching | Programs / particles / materials fetched once at init; stored in `entities.svelte.ts`. No per-render WASM calls. |
| Plot data points | 500 points per series is the default; computed once per series add. Re-rendered by JSROOT — no JS-side re-computation on zoom/pan. |
| `noUncheckedIndexedAccess` | TypeScript compiler flag; prevents accidental undefined access in hot WASM result array paths. |

---

## 13. Accessibility Architecture

- All interactive controls use native HTML elements (`<button>`, `<select>`,
  `<input>`, `<textarea>`); no custom ARIA role hacks.
- `ResultTable.svelte` renders a semantic `<table>` with `<thead>` / `<tbody>`;
  screen readers announce column headers.
- `JsrootPlot.svelte` wraps the canvas with `role="img"` and an
  `aria-label` describing the current series (e.g., "Stopping power vs
  energy: proton in water, PSTAR"). Export to SVG provides an accessible
  alternative for screen-reader users.
- Color palette for plot series is colorblind-safe (Okabe-Ito 8-color sequence).
- Focus management: `EntityDropdown.svelte` uses `combobox` role with
  `aria-expanded` and `aria-activedescendant` for typeahead accessibility.

See `docs/09-non-functional-requirements.md` for the full WCAG 2.1 AA checklist.

---

## 14. Related Documents

| Document | Purpose |
|----------|---------|
| [02-tech-stack.md](02-tech-stack.md) | Library versions and rationale |
| [decisions/001-sveltekit-over-react.md](decisions/001-sveltekit-over-react.md) | SvelteKit ADR |
| [decisions/002-keep-jsroot.md](decisions/002-keep-jsroot.md) | JSROOT ADR |
| [decisions/003-wasm-build-pipeline.md](decisions/003-wasm-build-pipeline.md) | WASM build ADR |
| [06-wasm-api-contract.md](06-wasm-api-contract.md) | TypeScript types + LibdedxService interface |
| [04-feature-specs/shareable-urls-formal.md](04-feature-specs/shareable-urls-formal.md) | URL canonicalization algorithm |
| [04-feature-specs/entity-selection.md](04-feature-specs/entity-selection.md) | EntityDropdown / EntityPanel spec |
| [04-feature-specs/calculator.md](04-feature-specs/calculator.md) | Calculator page spec |
| [04-feature-specs/plot.md](04-feature-specs/plot.md) | Plot page spec |
| [09-non-functional-requirements.md](09-non-functional-requirements.md) | WCAG, performance budgets |
