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
│       ├── +error.svelte               # Top-level error boundary (unexpected JS errors)
│       ├── calculator/
│       │   ├── +page.svelte            # Calculator page
│       │   ├── +page.ts                # Prerender: export const prerender = true
│       │   └── +error.svelte           # Calculator error boundary (nav bar stays visible)
│       ├── plot/
│       │   ├── +page.svelte            # Plot page
│       │   ├── +page.ts                # Prerender: export const prerender = true
│       │   └── +error.svelte           # Plot error boundary (nav bar stays visible)
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

WASM init is **non-blocking**: the root layout renders immediately; WASM
loads in the background via `$effect` in `+layout.svelte`. A blocking `load()`
in `+layout.ts` was explicitly rejected — it would force every route, including
the Documentation page, to wait for a multi-MB WASM download before rendering
any content.

```
Browser load
    │
    ├─► +layout.ts: load()          ← returns {} synchronously (no WASM here)
    │        │
    │        ▼
    │   SvelteKit renders all routes immediately
    │   (entity dropdowns empty; Calculator/Plot show loading state)
    │
    └─► +layout.svelte: $effect()   ← runs after DOM mount, browser-only
              │
              ▼
         loader.ts: getService()    ← async, non-blocking
              │
              ├─► static/wasm/libdedx.mjs   (fetch)
              └─► static/wasm/libdedx.wasm  (fetch in parallel)
                        │
                        ▼
                  Module compiled and instantiated
                        │
                        ▼
                  libdedx.ts: LibdedxServiceImpl.init()
                        │   ← dedx_fill_program_list(), build compat matrix
                        ▼
                  entities populated → wasmReady.value = true
                        │
                        ▼
                  Calculator/Plot become fully reactive
```

Consequences of the non-blocking model:

- **Documentation page** renders immediately without any WASM cost.
- **Calculator/Plot** render their UI shell (navigation, layout, empty dropdowns)
  immediately, then populate once `wasmReady.value` becomes `true`.
- **Navigating between Calculator and Plot** after first load does not
  re-initialize WASM — `getService()` returns the cached singleton.
- **`$effect` is inherently browser-only** — it never runs during SSG
  prerendering, so no `browser` guard is needed in `+layout.svelte`.
- **Error handling**: if `getService()` rejects, the `$effect` catches the
  error and sets `wasmError.value`; `+layout.svelte` renders an inline error
  banner rather than a full-page crash (see §Error boundaries below).

The `+layout.svelte` init block:

```svelte
$effect(() => {
  getService()
    .then(() => { wasmReady.value = true; })
    .catch((e) => { wasmError.value = e; });
});
```

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
import { base } from '$app/paths';

let service: LibdedxService | null = null;

export async function getService(): Promise<LibdedxService> {
  if (service) return service;
  const factory = await import(`${base}/wasm/libdedx.mjs`);
  const module = await factory.default({
    locateFile: (f: string) => `${base}/wasm/${f}`
  });
  service = new LibdedxServiceImpl(module);
  await service.init();
  return service;
}
```

The `locateFile` override tells Emscripten where to find `libdedx.wasm`
relative to the deployment base path. Using `$app/paths.base` rather than a
hardcoded `/wasm/…` prefix ensures the loader works correctly under sub-path
hosting (e.g. GitHub Pages at `/dedx_web/`).

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

### WASM on the main thread — Web Worker strategy

All WASM calls in Emscripten's default `ENVIRONMENT='web'` mode run
**synchronously on the main thread**. `libdedx` functions fill pre-allocated
C arrays and return; there is no async C API.

**Current workload.** The hot paths and their blocking estimates:

| Operation | WASM calls | Estimated block |
|-----------|-----------|-----------------|
| Calculator: single calculation | 1 × `get_stp_table(500 pts)` | < 20 ms |
| Plot: add 1 series | 1 × `get_stp_table(500 pts)` | < 20 ms |
| Plot: 8-series re-render | 8 × `get_stp_table(500 pts)` | < 160 ms |
| Init (compat matrix) | ~20 synchronous calls | < 5 ms total |

At 500 points per call, each `get_stp_table` is a single WASM call that fills a
buffer — not 500 individual calls. The 300 ms debounce (§4.3) absorbs rapid
user input so WASM is never called on every keystroke.

For the current workload the main-thread blocking is within the 300 ms
threshold at which jank becomes perceptible, and within the 500 ms target for
plot re-render (see `docs/09-non-functional-requirements.md §3`). **Web Worker
offloading is deferred to a future stage.**

**Migration path (deferred).** When a Web Worker becomes necessary:

1. Change `ENVIRONMENT` in `wasm/build.sh` from `'web'` to `'web,worker'`
   (Emscripten 4.0.17+ — `'worker'` alone is disallowed; must specify both).
2. Instantiate the WASM module inside the Worker: `new Worker(...)` with a
   separate `getService()` call inside the Worker thread. No `SharedArrayBuffer`
   is required — Worker and main thread communicate by value copy via
   `postMessage`. This also means GitHub Pages' lack of COOP/COEP headers
   (required for `SharedArrayBuffer`) is not an obstacle.
3. Update the `LibdedxService` interface — `calculate()`, `getPlotData()`, and
   related methods must return `Promise<T>` instead of `T`. All callers need to
   await the result. The interface is otherwise Worker-compatible: `getService()`
   already returns `Promise<LibdedxService>`, and the mock in
   `__mocks__/libdedx.ts` can trivially wrap returns in `Promise.resolve()`.
4. Update `loader.ts` to proxy calls to the Worker via a structured-clone
   round-trip. Comlink (`comlink` npm package) reduces this to boilerplate.

The current synchronous interface (`calculate()` returns `CalculationResult`)
is intentional for v1 simplicity. **Do not pre-emptively make it async** — the
extra `.then()` / `await` at every call site costs readability for a benefit
that does not yet exist.

### Compatibility matrix

The `CompatibilityMatrix` is built at init time by querying the WASM module
once per program for its particle list and once per program for its material
list, then recording which `(program, particle)` keys are valid:

```ts
// Populated once in entities.svelte.ts after WASM init
// WASM calls: 1× getParticles + 1× getMaterials per program = 2P total
const compat: CompatibilityMatrix = new Map();
for (const prog of programs.value) {
  const particles = service.getParticles(prog.id);   // one WASM call
  const materials = service.getMaterials(prog.id);   // one WASM call — hoisted outside particle loop
  for (const p of particles) {
    compat.set(`${prog.id}:${p.id}`, materials.map(m => m.id));
  }
}
compatMatrix.value = compat;
```

`getMaterials` is hoisted outside the inner particle loop — it does not vary
per particle, only per program. Placing it inside the inner loop would make
`P × N` WASM calls instead of `P`.

**Init cost.** libdedx has ~10 programs; each `getParticles` / `getMaterials`
call is a synchronous C function that fills a pre-allocated buffer and returns.
Total: ~20 WASM calls at startup, each completing in < 1 ms. The matrix
construction is negligible compared to the WASM module compilation time.

This is referenced by `EntityDropdown.svelte` / `EntityPanel.svelte` for
greying-out incompatible combinations without additional WASM calls per render.

---

## 4. Reactive State Topology

All application state lives in `.svelte.ts` modules under `src/lib/state/`.
These are plain TypeScript files that use Svelte 5 runes (`$state`, `$derived`).
They are **not** Svelte components — they are shared state singletons imported
by any component that needs them.

### Module-level state pattern

Every exported state value uses the `{ value: T }` wrapper:

```ts
export const x = $state<{ value: T }>({ value: defaultValue });
// consumers read:  x.value
// setters write:   x.value = newValue   ← reactive ✓
```

**Why the wrapper is required.** Module-level `export const` cannot be
reassigned — it is a JavaScript constant. Without the wrapper, writing
`programs = loadedPrograms` is both a TypeScript error and silently
non-reactive. Wrapping in an object makes `.value` a property mutation,
which Svelte 5's proxy-based reactivity tracks correctly.

**Arrays and Maps.** The same rule applies even though arrays and Maps can
be mutated in place (`push`, `set`). In-place mutation IS reactive, but the
pattern is inconsistent with primitives, makes bulk replacement awkward
(`splice(0, arr.length, ...items)`), and obscures intent. Using `{ value: T }`
uniformly means every state field is replaced the same way: `x.value = newVal`.

**`$derived` at module scope.** `$derived` follows the same proxy mechanics —
it is reactive as long as it reads from `$state`-tracked values. It does NOT
need a wrapper because it is read-only by definition.

### 4.1 `entities.svelte.ts`

Holds the entity lists and compatibility matrix. Set once during WASM init,
read-only thereafter.

```ts
export const programs = $state<{ value: ProgramEntity[] }>({ value: [] });
export const allParticles = $state<{ value: Map<number, ParticleEntity[]> }>({ value: new Map() });
export const allMaterials = $state<{ value: Map<number, MaterialEntity[]> }>({ value: new Map() });
export const compatMatrix = $state<{ value: CompatibilityMatrix }>({ value: new Map() });
```

### 4.2 `selection.svelte.ts`

Holds the user's current entity selection. Shared between Calculator and
Plot pages — navigating between them preserves the selection.

```ts
export const selectedProgramId = $state<{ value: number | null }>({ value: null });
export const selectedParticleId = $state<{ value: number | null }>({ value: null });
export const selectedMaterialId = $state<{ value: number | null }>({ value: null });

// Derived: the resolved program for the current particle/material combo.
// Implements the "auto-select best program" rule (01-project-vision.md §4.3).
export const resolvedProgramId = $derived(
  autoSelectProgram(selectedProgramId.value, selectedParticleId.value, selectedMaterialId.value, compatMatrix)
);
```

### 4.3 `calculation.svelte.ts`

Holds the energy input state, active unit, and the latest calculation result.

```ts
export const energyInputText = $state({ value: '' });    // raw textarea content
export const energyUnit = $state<{ value: EnergyUnit }>({ value: 'MeV' });
export const advancedOptions = $state<{ value: AdvancedOptions }>({ value: {} });
export const result = $state<{ value: CalculationResult | null }>({ value: null });
export const error = $state<{ value: LibdedxError | null }>({ value: null });
export const calculating = $state({ value: false });

// Derived: parsed energy array (valid lines only)
export const parsedEnergies = $derived(parseEnergyInput(energyInputText.value, energyUnit.value));
```

Live calculation is triggered by an `$effect` in the Calculator page that
watches `parsedEnergies`, `resolvedProgramId`, `selectedParticleId`,
`selectedMaterialId`, and `advancedOptions`. The effect uses `setTimeout` +
the cleanup return to implement debouncing:

```ts
$effect(() => {
  // Read all dependencies (registers them with Svelte's tracker)
  const energies  = parsedEnergies;
  const programId = resolvedProgramId;
  const particle  = selectedParticleId.value;
  const material  = selectedMaterialId.value;
  const options   = advancedOptions.value;

  const timer = setTimeout(() => {
    runCalculation(energies, programId, particle, material, options);
  }, 300);

  return () => clearTimeout(timer);  // cancel on next dependency change
});
```

**Why this is correct debounce behavior.** When any dependency changes,
Svelte runs the cleanup (`clearTimeout`) before re-running the effect. Only
the last timer survives to fire. Multiple rapid changes — user typing, or
`resolvedProgramId` and `parsedEnergies` both updating in separate ticks —
each restart the 300 ms window; the WASM call runs only after a 300 ms quiet
period. If both values change in the **same** reactive tick, Svelte batches
them and the effect runs once with the combined new values — correct.

**Why the debounce is NOT a utility function created inside the effect.** A
`debounce()` call inside the effect creates a NEW debounced function on every
run, discarding the previous timer state. The `setTimeout` + cleanup pattern
above does not have this problem.

### 4.4 `ui.svelte.ts`

```ts
export const isAdvancedMode = $state({ value: false });  // persisted to localStorage + URL
export const wasmReady = $state({ value: false });       // set true after WASM init
export const wasmError = $state<{ value: Error | null }>({ value: null });
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
  // Read all URL-relevant state (registers reactive dependencies)
  const params = stateToUrl(currentState);
  const newSearch = `?${params}`;

  // Guard: skip replaceState if the URL would not change.
  // This avoids unnecessary browser history manipulation and prevents
  // any edge case where a URL write could be mistaken for a navigation event.
  if (newSearch !== location.search) {
    history.replaceState(null, '', newSearch);
  }
});
```

**Why there is no infinite loop.** `history.replaceState` is a browser API
call — it does NOT mutate any Svelte reactive state, so it cannot re-trigger
the `$effect`. The effect re-runs only when the reactive state it reads
changes. The cycle `replaceState → popstate → state change → effect` does not
occur because (a) `replaceState` does not fire a `popstate` event (only
`pushState` + the browser back button do), and (b) URL hydration runs once in
`+layout.ts` before the effect is wired, so the effect's first run sees already-
hydrated state and writes a canonical URL that is at most a normalization of
the incoming URL (e.g., canonicalizing parameter order).

On page load, `urlToState` is called once in `+layout.ts` to hydrate state
from the URL before any component mounts.

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
  import { untrack } from 'svelte';
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
`TMultiGraph` and calls `JSROOT.draw()`. No `onMount` is needed — `$effect`
runs after the DOM is mounted and handles both the initial draw and subsequent
re-draws when `series` changes.

`painter` is typed `any` — a deliberate compromise. JSROOT ships TypeScript
declarations for its public draw API but not for internal frame-painter methods.
The type boundary is contained to `jsroot-helpers.ts`; all exported functions
use explicit types.

### Scroll and touch behavior

JSROOT's default wheel handler calls `evnt.preventDefault()` unconditionally,
which consumes scroll events and zooms the plot axes when the user intends to
scroll the page. Per
[`docs/04-feature-specs/plot.md` §Disabled Interactions](../docs/04-feature-specs/plot.md),
wheel zoom and touch zoom must be disabled.

`jsroot-helpers.ts` sets the relevant JSROOT settings **before** calling
`JSROOT.draw()`:

```ts
import JSROOT from 'jsroot';

export async function drawPlot(container: HTMLDivElement, series: Series[]): Promise<unknown> {
  // Disable wheel zoom: plain scroll must scroll the page, not zoom the plot.
  // See docs/decisions/002-keep-jsroot.md — Disabled Interactions.
  JSROOT.settings.ZoomWheel = false;

  // Disable touch zoom on coarse-pointer devices so swipe scrolls the page.
  if (window.matchMedia('(pointer: coarse)').matches) {
    JSROOT.settings.ZoomTouch = false;
  }

  // ... build TMultiGraph, call JSROOT.draw() ...
}
```

`JSROOT.settings` is a global object; these flags are set once before the
first draw and do not need to be reset per-render. Click-drag zoom (controlled
by `settings.ZoomMouse`, which remains `true`) is the intended zoom interaction
on desktop.

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

### SSG safety — why no `browser` guard is needed

`$effect` in `+layout.svelte` is inherently browser-only. SvelteKit's SSG
prerender pass evaluates `.ts` `load()` functions in Node.js, but it never
runs Svelte effects — those only execute inside a mounted component in a real
browser context. Therefore `+layout.ts` needs no browser guard and no WASM
call:

```ts
// +layout.ts
export function load() {
  return {};   // Nothing. WASM init happens in +layout.svelte $effect.
}
```

A `browser`-guarded `await getService()` in `+layout.ts` was explicitly
considered and rejected (see §3 Initialization lifecycle): even with the guard,
the `load()` function would block SvelteKit's client-side routing until WASM
finished loading, forcing the Documentation page (which needs no WASM) to wait
behind a multi-MB download.

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

Caught in the `$effect` in `+layout.svelte` (not `+layout.ts load()` — see
§3 Initialization lifecycle) and stored in `wasmError.value`. The layout
renders an inline error banner with instructions to reload or check browser
compatibility. The Documentation page remains fully functional; Calculator and
Plot display the banner in place of their interactive content.

### Component rendering errors (Svelte error boundaries)

When a Svelte component throws during rendering, SvelteKit catches the error
and renders the nearest `+error.svelte` file. The error boundary hierarchy:

| File | Catches |
|------|---------|
| `src/routes/+error.svelte` | Top-level unhandled errors — displays a generic "something went wrong" page with a reload button |
| `src/routes/calculator/+error.svelte` | Calculator-specific errors — allows the nav bar to remain visible |
| `src/routes/plot/+error.svelte` | Plot-specific errors — allows the nav bar to remain visible |

WASM errors and input validation errors are handled in-component (see above)
and do NOT reach the `+error.svelte` boundary. The boundary only fires for
unexpected JavaScript exceptions (bugs, null dereferences, type errors) that
escape component `try/catch` blocks.

### Input validation errors

Energy input parsing (`parseEnergyInput()`) returns per-line validation errors.
These are rendered inline in `EnergyInput.svelte` as red borders + tooltips —
not as `LibdedxError` instances (they are JS-level, not C-level errors).

---

## 12. Performance Considerations

| Area | Strategy |
|------|----------|
| WASM binary size | `libdedx.wasm` ~1–3 MB + `libdedx.data` ~2–4 MB — served from `static/wasm/` as un-hashed filenames. GitHub Pages applies `Cache-Control: max-age=600`; subsequent visits send conditional requests (ETag) and receive 304 if unchanged. See `docs/09-non-functional-requirements.md §3.1`. |
| JSROOT bundle | ~500 kB gzipped — lazy-loaded only when Plot page is first visited (`import('jsroot')`). |
| Main-thread computation | All WASM calls are synchronous. The 300 ms debounce absorbs rapid input; single-series calculations complete in < 20 ms. Worst case (8-series plot re-render) is < 160 ms — within the 500 ms plot budget. Web Worker offloading is deferred (see §3 Web Worker strategy). |
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
