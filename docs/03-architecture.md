# Architecture — webdedx

> **Status:** Final v1 (19 April 2026); synced to the Stage 8 codebase
> (3 June 2026 — Issue #631).
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
│   │   │   └── __mocks__/libdedx.ts    # Vitest mock — static fixture data
│   │   ├── state/                      # App-wide reactive state (§4)
│   │   │   ├── app-init.svelte.ts                # AppInitState: WASM init + compat matrices + EntitySelectionState
│   │   │   ├── entity-selection.svelte.ts        # createEntitySelectionState factory (program/particle/material)
│   │   │   ├── entity-availability.svelte.ts     # Availability / greying-out derivations
│   │   │   ├── compatibility-matrix.ts           # Build + query (program,particle)→materials matrix
│   │   │   ├── external-compatibility.ts         # Merge external .webdedx stores into compat context
│   │   │   ├── calculator.svelte.ts              # createCalculatorState: energy rows → calculated rows
│   │   │   ├── calculator-engine.svelte.ts       # WASM calc orchestration for the calculator
│   │   │   ├── calculator-page-orchestrator.svelte.ts  # Wires calculator state + URL sync per page
│   │   │   ├── calculator-url-sync.svelte.ts     # Calculator state ↔ URL ($effect writer)
│   │   │   ├── energy-rows.svelte.ts             # Energy textarea rows + per-line parse
│   │   │   ├── inverse-lookups.svelte.ts         # Advanced inverse (Range→, STP→) row state
│   │   │   ├── inverse-calc.svelte.ts            # WASM orchestration for inverse lookups
│   │   │   ├── multi-entity.svelte.ts            # Compare-across materials/particles state
│   │   │   ├── multi-entity-calc.svelte.ts       #   …and its WASM orchestration
│   │   │   ├── multi-program.svelte.ts           # Compare-across programs state
│   │   │   ├── multi-program-calc.svelte.ts      #   …and its WASM orchestration
│   │   │   ├── multi-selection.svelte.ts         # Picker tab + compare-across dimension
│   │   │   ├── advanced-mode.svelte.ts           # Basic/Advanced toggle (localStorage + URL)
│   │   │   ├── advanced-options.svelte.ts        # Density/I-value/state/interp/MSTAR options
│   │   │   ├── custom-compounds.svelte.ts        # User compounds CRUD (localStorage)
│   │   │   ├── stp-unit.svelte.ts                # Shared STP output unit (sunit=)
│   │   │   ├── export.svelte.ts                  # CSV/PDF/image export state
│   │   │   ├── plot.svelte.ts                    # createPlotState: series model
│   │   │   ├── plot-preview-calc.svelte.ts       # Live preview series calc
│   │   │   ├── plot-page-orchestrator.svelte.ts  # Wires plot state + URL sync/restore
│   │   │   ├── plot-url-sync.svelte.ts           # Plot state → URL ($effect writer)
│   │   │   ├── plot-url-restore.svelte.ts        # URL → plot state (hydrate on load)
│   │   │   └── ui.svelte.ts                       # wasmReady / wasmError flags
│   │   ├── components/                 # UI components (§5)
│   │   │   ├── entity-selection/       # Tabbed entity picker subtree (tabs, sheet, toolbar, views)
│   │   │   ├── results/                # table-basic/advanced/multi/inverse-stp, unit-anchor-strip, …
│   │   │   ├── result-table/           # Table cell/header partials
│   │   │   ├── compound-editor/        # Custom-compound editor parts (desktop + mobile sheet)
│   │   │   ├── calculator/             # advanced-hint, shared-compound-alert
│   │   │   ├── layout/                 # page-error-fallback
│   │   │   ├── ui/                     # shadcn-svelte primitives (button, input, tooltip, …)
│   │   │   ├── jsroot-plot.svelte      # JSROOT DOM wrapper (§5)
│   │   │   ├── advanced-options-panel.svelte
│   │   │   ├── compound-editor-modal.svelte
│   │   │   ├── build-info-badge.svelte
│   │   │   └── url-version-warning-banner.svelte
│   │   ├── export/                     # csv.ts, pdf.ts, plot-csv.ts, plot-image.ts, utils.ts
│   │   ├── external-data/              # External .webdedx (Zarr/FSDH) loader, schema, service
│   │   ├── utils/                      # Pure helpers (unit conversions, URL grammar+AST, parsers)
│   │   │   ├── energy-conversions.ts   # MeV ↔ MeV/nucl ↔ MeV/u (particle-aware)
│   │   │   ├── unit-conversions.ts     # MeV·cm²/g ↔ MeV/cm ↔ keV/µm; range g/cm² ↔ cm
│   │   │   ├── url-grammar.peggy        # Peggy grammar → url-ast.ts via url-parse.ts (§4.5)
│   │   │   └── …                        # energy-parser, calculator-url, plot-url, inverse-*, series-labels
│   │   ├── config/                     # Display-name tables (programs, particles, materials)
│   │   ├── data/                       # compound-presets.ts
│   │   ├── parse/                      # inline-unit.ts
│   │   ├── actions/                    # draggable-column.svelte.ts (Svelte action)
│   │   └── shims/                      # resvg-js.ts (SVG→PNG for image export)
│   ├── routes/                         # SvelteKit file-based routes (§2)
│   │   ├── +layout.svelte              # Shell: nav bar, Advanced toggle, footer; starts WASM via $effect
│   │   ├── +layout.ts                  # Synchronous layout load; returns {} without blocking on WASM
│   │   ├── +page.svelte / +page.ts     # Redirect → /calculator
│   │   ├── +error.svelte               # Top-level error boundary (unexpected JS errors)
│   │   ├── calculator/+page.svelte + +page.ts   # Calculator page (prerender = true)
│   │   ├── plot/
│   │   │   ├── +page.svelte / +page.ts          # Plot page (prerender = true)
│   │   │   └── series-strip.svelte              # Plot series add/remove/reorder strip
│   │   └── docs/
│   │       ├── +page.svelte / +page.ts          # Documentation landing
│   │       ├── user-guide/+page.svelte + +page.ts
│   │       └── technical/+page.svelte + +page.ts
│   └── tests/                          # Vitest tests: unit/ components/ integration/ contracts/
├── static/
│   ├── wasm/
│   │   ├── libdedx.mjs                 # Emscripten ES module glue (built artifact, ~13 KB)
│   │   └── libdedx.wasm                # WASM binary (built artifact, ~457 KB — data compiled in, no .data sidecar)
│   ├── favicon.svg                     # Vector icon — modern browsers; scales to any size
│   ├── favicon.ico                     # Legacy fallback (combined 16×16 + 32×32 ICO)
│   ├── apple-touch-icon.png            # iOS home screen shortcut (180×180 px)
│   └── site.webmanifest                # Web App Manifest — name, theme color, icon list
├── wasm/
│   ├── dedx_extra.h                    # Thin shim: exposes internal libdedx data
│   ├── dedx_extra.c                    # Implementation of dedx_extra shims
│   ├── build.sh                        # Emscripten build script; outputs to wasm/output/ (dev) → static/wasm/ (Stage 4+)
│   ├── verify.mjs                      # 67-check contract verification script (node wasm/verify.mjs)
│   └── output/                         # gitignored — build artifacts consumed by verify.mjs
├── libdedx/                            # Git submodule — upstream C library
├── tests/
│   └── e2e/                            # Playwright E2E tests (need built WASM in static/wasm/)
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
<link rel="icon" href="%sveltekit.assets%/favicon.ico" sizes="32x32" />
<link rel="icon" href="%sveltekit.assets%/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png" />
<link rel="manifest" href="%sveltekit.assets%/site.webmanifest" />
```

`%sveltekit.assets%` resolves to the correct base path at build time —
required because GitHub Pages may serve the app from a sub-path
(e.g., `/dedx_web/`). Hardcoding `/favicon.ico` would break sub-path deployments.

`site.webmanifest` declares the app name, `theme_color`, `background_color`,
and icon references for Android home screen and PWA install prompts.

---

### Naming conventions

| Pattern                           | Description                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.svelte.ts`                     | State modules — TypeScript files containing `$state` runes. Named with `.svelte.ts` so that `svelte-check` and `eslint-plugin-svelte` apply rune-aware rules. |
| `+layout.svelte` / `+page.svelte` | SvelteKit route files — must use the `+` prefix convention.                                                                                                   |
| `__mocks__/`                      | Vitest manual mocks — co-located with the module they mock.                                                                                                   |

---

## 2. Routing

### Route map

| URL path           | File                                      | Purpose                    |
| ------------------ | ----------------------------------------- | -------------------------- |
| `/`                | `src/routes/+page.svelte`                 | Redirects to `/calculator` |
| `/calculator`      | `src/routes/calculator/+page.svelte`      | Calculator page (landing)  |
| `/plot`            | `src/routes/plot/+page.svelte`            | Plot page                  |
| `/docs`            | `src/routes/docs/+page.svelte`            | Documentation landing      |
| `/docs/user-guide` | `src/routes/docs/user-guide/+page.svelte` | User guide                 |
| `/docs/technical`  | `src/routes/docs/technical/+page.svelte`  | Technical reference        |

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
[`01-project-vision.md` §4.4](01-project-vision.md)). It lives in `src/lib/state/ui.svelte.ts`
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
              ├─► static/wasm/libdedx.mjs   (fetch, ~13 KB)
              └─► static/wasm/libdedx.wasm  (fetch in parallel, ~457 KB — no .data sidecar)
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

Re-exports all types from [`06-wasm-api-contract.md`](06-wasm-api-contract.md):

```ts
export type { EnergyUnit, StpUnit, RangeUnit } from "./contract";
export type { LibdedxEntity, ParticleEntity, ProgramEntity, MaterialEntity } from "./contract";
export type { CalculationResult, InverseStpResult, InverseCsdaResult } from "./contract";
export type {
  AdvancedOptions,
  AggregateState,
  MstarMode,
  InterpolationScale,
  InterpolationMethod,
} from "./contract";
export type { CustomCompound, CompoundElement } from "./contract";
export { LibdedxError } from "./contract";
export type { LibdedxService } from "./contract";
```

#### `src/lib/wasm/loader.ts`

```ts
import { base } from "$app/paths";

let service: LibdedxService | null = null;

export async function getService(): Promise<LibdedxService> {
  if (service) return service;
  const factory = await import(`${base}/wasm/libdedx.mjs`);
  const module = await factory.default({
    locateFile: (f: string) => `${base}/wasm/${f}`,
  });
  service = new LibdedxServiceImpl(module);
  await service.init();
  return service;
}
```

The `locateFile` override tells Emscripten where to find `libdedx.wasm`
relative to the deployment base path. Using `$app/paths.base` rather than a
hardcoded `/wasm/…` prefix ensures the loader works correctly under sub-path
hosting (e.g. GitHub Pages at `/dedx_web/`). No `.data` sidecar exists —
all stopping-power tables are compiled into `libdedx.wasm` as static C arrays
(confirmed by Stage 2.6 Phase 2: 44/44 checks PASS with no `--preload-file`).

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

| Operation                      | WASM calls                   | Estimated block |
| ------------------------------ | ---------------------------- | --------------- |
| Calculator: single calculation | 1 × `get_stp_table(500 pts)` | < 20 ms         |
| Plot: add 1 series             | 1 × `get_stp_table(500 pts)` | < 20 ms         |
| Plot: 8-series re-render       | 8 × `get_stp_table(500 pts)` | < 160 ms        |
| Init (compat matrix)           | ~20 synchronous calls        | < 5 ms total    |

At 500 points per call, each `get_stp_table` is a single WASM call that fills a
buffer — not 500 individual calls. The 300 ms debounce (§4.3) absorbs rapid
user input so WASM is never called on every keystroke.

For the current workload the main-thread blocking is within the 300 ms
threshold at which jank becomes perceptible, and within the 500 ms target for
plot re-render (see [`09-non-functional-requirements.md` §3](09-non-functional-requirements.md#3-performance)). **Web Worker
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
// Built once by buildCompatibilityMatrix() (state/compatibility-matrix.ts),
// invoked from AppInitState.init() after WASM init.
// WASM calls: 1× getParticles + 1× getMaterials per program = 2P total
const compat: CompatibilityMatrix = new Map();
for (const prog of programs.value) {
  const particles = service.getParticles(prog.id); // one WASM call
  const materials = service.getMaterials(prog.id); // one WASM call — hoisted outside particle loop
  for (const p of particles) {
    compat.set(
      `${prog.id}:${p.id}`,
      materials.map((m) => m.id),
    );
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

The matrix (and its external-store overlay in `external-compatibility.ts`) is
consumed by `entity-availability.svelte.ts`, which the entity-picker components
(`components/entity-selection/`) read to grey out incompatible combinations
without additional WASM calls per render.

---

## 4. Reactive State Topology

All application state lives in `.svelte.ts` modules under `src/lib/state/`.
These are plain TypeScript files that use Svelte 5 runes (`$state`, `$derived`).
They are **not** Svelte components.

The codebase uses **two complementary patterns**:

1. **Module-level singletons** — for genuinely app-wide state shared across
   pages and never instantiated more than once: `ui.svelte.ts` (`wasmReady`),
   `advanced-mode.svelte.ts` (`isAdvancedMode`), `advanced-options.svelte.ts`,
   `custom-compounds.svelte.ts`, `stp-unit.svelte.ts`, and the `appInit`
   singleton in `app-init.svelte.ts`. These export the `{ value: T }` wrapper
   (or a small class instance) described below.

2. **Factory functions** — for page-scoped state graphs that an orchestrator
   creates once per page mount: `createEntitySelectionState()`,
   `createCalculatorState()`, `createInverseLookupState()`, `createPlotState()`,
   `createEnergyInputState()`. Each returns an object whose fields are backed by
   closure-local `$state`, exposed through getters/setters. The
   page orchestrators (`calculator-page-orchestrator.svelte.ts`,
   `plot-page-orchestrator.svelte.ts`) wire these together with the singletons
   and the URL-sync modules. This keeps per-page lifecycles explicit and avoids
   leaking calculator-only state into the plot page and vice-versa.

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

**Compute functions instead of `$derived` exports.** Svelte 5 prohibits
exporting `$derived` values directly from `.svelte.ts` modules (compiler error:
`Cannot export derived state from a module`). Instead, export a plain compute
function that reads `$state` values. Each component that needs the computed
value wraps the call in a local `$derived`:

```ts
// .svelte.ts module — export a compute function
export function computeX(): T {
  return someState.value + otherState.value;
}

// Component — local $derived wraps the call; tracks $state deps automatically
const x = $derived(computeX());
```

Calling a compute function inside `$derived` or `$effect` registers its `$state`
dependencies with Svelte's tracker exactly as if the `$state` were read directly.
This pattern was validated in Spike 3 (see `prototypes/svelte5-state/`).

### 4.1 Entity lists & compatibility — `app-init.svelte.ts` + `compatibility-matrix.ts`

The `appInit` singleton (`AppInitState` in `app-init.svelte.ts`) owns the
one-time bootstrap: it loads the WASM service, fetches the entity lists
(programs / particles / materials), builds the compatibility matrix via
`buildCompatibilityMatrix()` (`compatibility-matrix.ts`), merges any loaded
external `.webdedx` stores via `buildExternalCompatibilityContext()`
(`external-compatibility.ts`), and creates the shared `EntitySelectionState`.
These values are set once and treated as read-only thereafter.

```ts
export class AppInitState {
  service = $state<LibdedxService | null>(null);
  compatibilityMatrix = $state<CompatibilityMatrix | null>(null);
  entityState = $state<EntitySelectionState | null>(null);
  // …isInitializing / error / external-source bookkeeping
}
export const appInit = new AppInitState();
```

### 4.2 Entity selection — `entity-selection.svelte.ts`

`createEntitySelectionState(matrix)` returns the user's current
program / particle / material selection plus the auto-select logic. The
factory's state is shared across Calculator and Plot via the orchestrators, so
navigating between the pages preserves the selection. Availability
(greying-out) derivations live in `entity-availability.svelte.ts`; custom
compounds and external entities are folded into the same selection surface.
The default material is Water (`WATER_ID`); `CUSTOM_MATERIAL_ID` /
string ids flag custom or external materials.

```ts
export function createEntitySelectionState(matrix: CompatibilityMatrix): EntitySelectionState {
  let selectedProgramId = $state<number | null>(null);
  let selectedParticleId = $state<number | null>(null);
  let selectedMaterialId = $state<number | string | null>(WATER_ID);
  // …getters/setters + auto-select-best-program (01-project-vision.md §4.3)
}
```

### 4.3 Calculation — `calculator.svelte.ts` + `calculator-engine.svelte.ts`

`createCalculatorState()` holds the energy input rows (`energy-rows.svelte.ts`),
the active energy unit, the STP/range output units, and the derived
`CalculatedRow[]`. The actual WASM dispatch — choosing between `calculate()`,
`calculateCustomCompound()`, multi-entity / multi-program fan-out, and external
data lookups — lives in `calculator-engine.svelte.ts`, which reads the
`advanced-options.svelte.ts` and `advanced-mode.svelte.ts` singletons.

Live calculation is triggered by a debounced `$effect` in the calculator page
orchestrator that watches the parsed energies, the resolved program, the
selected particle/material, and the advanced options. The effect uses
`setTimeout` + the cleanup return to debounce:

```ts
$effect(() => {
  // Reading the reactive state registers it as a dependency
  const energies = calc.parsedEnergies;
  const programId = entity.resolvedProgramId;
  const particle = entity.selectedParticleId;
  const material = entity.selectedMaterialId;
  const options = advancedOptions.value;

  const timer = setTimeout(() => {
    runCalculation(energies, programId, particle, material, options);
  }, 300);

  return () => clearTimeout(timer); // cancel on next dependency change
});
```

**Why this is correct debounce behavior.** When any dependency changes,
Svelte runs the cleanup (`clearTimeout`) before re-running the effect. Only
the last timer survives to fire. Multiple rapid changes — user typing, or
`computeResolvedProgram()` and `computeParsedEnergies()` returning new values
in separate ticks — each restart the 300 ms window; the WASM call runs only
after a 300 ms quiet period. If both values change in the **same** reactive
tick, Svelte batches them and the effect runs once with the combined new
values — correct.

**Why the debounce is NOT a utility function created inside the effect.** A
`debounce()` call inside the effect creates a NEW debounced function on every
run, discarding the previous timer state. The `setTimeout` + cleanup pattern
above does not have this problem.

### 4.4 `ui.svelte.ts` and `advanced-mode.svelte.ts`

```ts
// ui.svelte.ts
export const wasmReady = $state({ value: false }); // set true after WASM init
export const wasmError = $state<{ value: Error | null }>({ value: null });

// advanced-mode.svelte.ts
export const isAdvancedMode = $state({ value: storedValue }); // persisted to localStorage + URL
```

`isAdvancedMode` lives in its own module and is hydrated from `localStorage`
on module load so a `?mode=advanced` share link does not flash Basic mode
before the URL is parsed. The URL parameter still takes precedence over
`localStorage` when opening a shared link. `toggleAdvancedMode()` also applies
the Basic-mode fallback logic when switching back down.

### 4.5 URL synchronization — layered parser + per-page sync modules

URL handling is split into a **pure parsing layer** (`src/lib/utils/`) and
**reactive sync modules** (`src/lib/state/`):

- **Parsing layer (no runes).** A Peggy grammar (`url-grammar.peggy`) compiles
  to a parser that produces an AST (`url-ast.ts`) via `parseQuery`
  (`url-parse.ts`); shared helpers live in `url-shared.ts` and span-accurate
  diagnostics in `url-diagnostics.ts`. Semantic resolvers turn the AST into
  calculator/plot state. Encoders live in `calculator-url.ts` and `plot-url.ts`.
  Version negotiation (`url-version.ts`) rejects unsupported `urlv` values with
  a warning banner rather than silently migrating them.
- **Reactive sync (runes).** `calculator-url-sync.svelte.ts`,
  `plot-url-sync.svelte.ts`, and `plot-url-restore.svelte.ts` are wired by the
  page orchestrators. The sync writers run in an `$effect` that calls
  `replaceState()` (from `$app/navigation`) only when the query string would
  actually change; the restore step hydrates page state from the URL once on
  load before the writer is armed.

The canonical ordering and versioning rules are specified in
[`04-feature-specs/shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md)
and the published grammar at `/docs/technical`. The current emitted version is
`urlv=2`; `urlv=1` links are rejected (not migrated).

**Why there is no infinite loop.** `replaceState()` from `$app/navigation`
_does_ update SvelteKit's reactive `page` store (it assigns a fresh
`page.state` object reference), so a naive writer would re-trigger itself. The
sync modules avoid the loop with three safeguards (see
`calculator-url-sync.svelte.ts` / `plot-url-sync.svelte.ts`):

1. The current URL is read from `window.location.pathname`/`.search` rather than
   `page.url`, so the effect never registers a reactive dependency on the `page`
   store that `replaceState` mutates.
2. A no-op guard (`next === current`) skips writing when the query string would
   not change.
3. `replaceState(next, page.state)` is wrapped in `untrack()` so reading
   `page.state` at write time does not register a dependency either.

Restore runs before the writer is armed, so the first writer pass at most
canonicalizes the incoming URL.

---

## 5. Component Tree

Inline nav-bar markup, the Advanced toggle, and the footer live directly in
`+layout.svelte`; only the export modal and build badge are extracted.

```
+layout.svelte
│   (inline nav bar + Basic·Advanced toggle + Share / Export menu)
│   CsvExportModal.svelte
│   build-info-badge.svelte
│
├── calculator/+page.svelte
│   │   entity-selection/entity-selection.svelte   ← tabbed picker (particle/material/program)
│   │   │   ├── tab-bar · particle-tab · material-tab · program-tab
│   │   │   ├── advanced-toolbar · search-input · picker-sheet
│   │   │   ├── particle-list-view / particle-grid-view · grouped-result-list
│   │   │   └── compound-editor-modal.svelte  (+ compound-editor/ parts, mobile sheet)
│   │   ├── external-sources-panel.svelte · load-external-modal.svelte
│   │   ├── selection-live-region.svelte   (aria-live announcements)
│   │   ├── results/unit-anchor-strip.svelte      (energy unit radiogroup)
│   │   ├── results/compare-across-strip.svelte · results/quantity-toggle.svelte
│   │   ├── results/table-basic · table-advanced · table-multi · table-inverse-stp
│   │   │   └── result-table/ cell + header partials; results/stp-unit-header-menu.svelte
│   │   ├── calculator/advanced-hint.svelte · calculator/shared-compound-alert.svelte
│   │   ├── advanced-options-panel.svelte  (accordion, hidden in Basic mode)
│   │   ├── url-version-warning-banner.svelte
│   │   └── layout/page-error-fallback.svelte
│   │
├── plot/+page.svelte
│   │   entity-selection/entity-selection.svelte   ← same picker, always expanded
│   │   ├── series-strip.svelte  (add/remove/reorder series; routes/plot/)
│   │   ├── jsroot-plot.svelte   ← JSROOT DOM owner
│   │   ├── advanced-options-panel.svelte
│   │   ├── external-sources-panel.svelte
│   │   └── url-version-warning-banner.svelte
│   │
└── docs/+page.svelte · docs/user-guide · docs/technical
    └── (static Svelte content, no WASM interaction)
```

The tabbed `entity-selection/` subtree is the sole picker entry point on both
pages. The earlier combobox/panel-based picker that preceded it was removed in
#688 (it was no longer rendered once the tabbed picker shipped).

### jsroot-plot.svelte — DOM ownership contract

JSROOT draws into a `<div>` element that it owns completely. Svelte must not
reconcile or re-render the contents of this element.

```svelte
<script lang="ts">
  import { untrack } from "svelte";
  let container: HTMLDivElement;
  let painter: any = null;

  $effect(() => {
    // series is a reactive dependency; re-draw when it changes
    untrack(() => {
      if (painter) painter.cleanup?.();
    });
    if (!series.length) return;
    drawPlot(container, series).then((p) => {
      painter = p;
    });

    return () => {
      painter?.cleanup?.();
    };
  });
</script>

<div bind:this={container} class="jsroot-container w-full h-full"></div>
```

`untrack()` prevents the cleanup call from registering `painter` as a reactive
dependency (which would create a re-run loop). The `drawPlot` helper is a local
async function inside `jsroot-plot.svelte` that constructs `TMultiGraph` and
calls `JSROOT.draw()`. No `onMount` is needed — `$effect` runs after the DOM is
mounted and handles both the initial draw and subsequent re-draws when `series`
changes.

`painter` is typed `any` — a deliberate compromise. JSROOT ships TypeScript
declarations for its public draw API but not for internal frame-painter methods.
The type boundary is contained to `jsroot-plot.svelte`.

### Scroll and touch behavior

JSROOT's default wheel handler calls `evnt.preventDefault()` unconditionally,
which consumes scroll events and zooms the plot axes when the user intends to
scroll the page. Per
[`04-feature-specs/plot.md` §Disabled Interactions](04-feature-specs/plot.md),
wheel zoom and touch zoom must be disabled.

`jsroot-plot.svelte` sets the relevant JSROOT settings **before** calling
`JSROOT.draw()`:

```ts
import JSROOT from "jsroot";

export async function drawPlot(container: HTMLDivElement, series: Series[]): Promise<unknown> {
  // Disable wheel zoom: plain scroll must scroll the page, not zoom the plot.
  // See docs/decisions/002-keep-jsroot.md — Disabled Interactions.
  JSROOT.settings.ZoomWheel = false;

  // Disable touch zoom on coarse-pointer devices so swipe scrolls the page.
  if (window.matchMedia("(pointer: coarse)").matches) {
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
energy-rows.svelte.ts  →  rows (CalculatorState, calculator.svelte.ts)
                                │
                       parsed energies ($derived)
                                │
                         $effect (debounced 300ms, in page orchestrator)
                                │
                    ┌───────────┴───────────────────────┐
                    │ entity-selection.svelte.ts         │
                    │  resolvedProgramId                 │
                    │  selectedParticleId                │
                    │  selectedMaterialId                │
                    └───────────────────────────────────┘
                                │
                     calculator-engine.svelte.ts  ← dispatches to LibdedxService
                                │
                         CalculationResult
                                │
                         CalculatedRow[] (calculator.svelte.ts)
                                │
                         results/table-*.svelte  ←  unit conversion utilities
                                │
                         [ display + live update ]
```

### Unit conversion in the data flow

The `CalculationResult` from WASM always contains:

- `energies` in MeV/nucl
- `stoppingPowers` in MeV·cm²/g
- `csdaRanges` in g/cm²

The results tables (`results/table-basic.svelte`, `table-advanced.svelte`, …)
call the unit-conversion helpers in `utils/` (`energy-conversions.ts`,
`unit-conversions.ts`) to display values in the user's selected unit. Conversion
is purely JavaScript — the WASM result is cached as-is; re-rendering with a new
unit (e.g. via the `unit-anchor-strip` or the STP header menu) does not trigger
a new WASM call.

---

## 7. Data Flow: Plot Page

```
User adds a series (program + particle + material)
        │
        ▼
series-strip.svelte  →  PlotState.series[] (plot.svelte.ts, via createPlotState)
        │
        ▼
$effect: for each series, calc 500 pts (plot-preview-calc.svelte.ts → LibdedxService)
        │
        ▼
CalculationResult[] (one per series)
        │
        ▼
jsroot-plot.svelte: TMultiGraph construction
  ├── TGraph per series (energies × stoppingPowers)
  ├── Color assigned from palette (perceptually distinct, colorblind-safe)
  └── JSROOT.draw(container, multiGraph, 'AP')
```

The Plot page owns its own `PlotState` (created by `createPlotState()` in the
plot page orchestrator) because it can hold multiple series simultaneously,
whereas Calculator operates on a single (program, particle, material) at a time.
The entity selection itself is still shared, so a series can be seeded from the
current picker.

---

## 8. Custom Compounds

Custom compounds require the stateful `dedx_config` WASM API path. The flow:

1. User defines a compound in the `compound-editor-modal.svelte` modal (desktop)
   or the `compound-editor/mobile-sheet.svelte` (phones).
2. The compound is stored in `localStorage` as a `StoredCompoundInternal`
   (with UUID, phase, timestamp — managed by `custom-compounds.svelte.ts`; see
   [`04-feature-specs/custom-compounds.md`](04-feature-specs/custom-compounds.md)).
3. When selected as the active material, `selectedMaterialId` is set to the
   custom sentinel (`CUSTOM_MATERIAL_ID`); see `utils/custom-compound-material.ts`.
4. `calculator-engine.svelte.ts` detects the custom material via `isCustomMaterial()`
   and routes to `service.calculateCustomCompound()` instead of `service.calculate()`.
5. The `CustomCompound` passed to WASM is stripped of localStorage metadata
   (UUID, phase, timestamp) — it contains only `name`, `elements`, `density`,
   and optional `iValue`.

---

## 9. URL State Synchronization

URL sync follows the canonical algorithm in
[`04-feature-specs/shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md)
and the layered parser described in §4.5. Key points:

- **Read on load**: each page orchestrator hydrates state from the URL once on
  mount (`plot-url-restore.svelte.ts`; the calculator restore path lives in
  `calculator-page-orchestrator.svelte.ts`) before the sync writer is armed.
- **Write on change**: `calculator-url-sync.svelte.ts` / `plot-url-sync.svelte.ts`
  run in a `$effect` whenever URL-relevant state changes, calling
  `replaceState()` (from `$app/navigation`) — no page reload, no history entry.
- **Share button**: Copies the current URL to the clipboard. The URL already
  contains all state — no additional serialization is needed.
- **`urlv=2` sentinel**: Always included in the emitted URL. `urlv=1` links are
  rejected with a warning banner (`url-version-warning-banner.svelte`) rather
  than migrated — see [`04-feature-specs/shareable-urls.md` §3.1](04-feature-specs/shareable-urls.md).

---

## 10. SSG / Static Adapter Constraints

| Constraint                             | Implication                                                                                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All routes are pre-rendered            | No `load()` functions may call a network API. Data comes from WASM only.                                                                                                                                                         |
| WASM not available at build time       | `+page.ts` and `+layout.ts` `load()` functions must not call `getService()`. `+layout.ts` should return `{}` during prerender; WASM init happens client-side in `+layout.svelte` via a non-blocking `$effect`.                   |
| `export const prerender = true`        | Every route file must set this. If omitted, the static adapter will not output an `index.html` for that route.                                                                                                                   |
| No `fetch()` to same-origin API routes | GitHub Pages has no server. Do not rely on SvelteKit's server fetch hook.                                                                                                                                                        |
| `localStorage` access                  | Only safe inside `$effect` or event handlers — not in `+page.ts` load functions that run during SSG prerender.                                                                                                                   |
| CORS for external data                 | User-hosted `.webdedx` Zarr stores must be served with `Access-Control-Allow-Origin: *`. All files in the store (zarr.json, shard files) must be CORS-accessible. This is documented in the user guide, not enforced by the app. |

### SSG safety — why no `browser` guard is needed

`$effect` in `+layout.svelte` is inherently browser-only. SvelteKit's SSG
prerender pass evaluates `.ts` `load()` functions in Node.js, but it never
runs Svelte effects — those only execute inside a mounted component in a real
browser context. Therefore `+layout.ts` needs no browser guard and no WASM
call:

```ts
// +layout.ts
export function load() {
  return {}; // Nothing. WASM init happens in +layout.svelte $effect.
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
the C library returns a non-zero error code. Caught in the calc orchestration
(`calculator-engine.svelte.ts` / `inverse-calc.svelte.ts`) and stored in the
`CalculatorState` error fields. The results tables (`results/table-*.svelte`)
render a human-friendly message; a "Show details" toggle reveals the raw C
error code.

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

Errors are handled at two levels:

| Mechanism                                                 | Catches                                                                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/routes/+error.svelte`                                | Top-level route load errors — displays a generic "something went wrong" page with a reload button                       |
| `<svelte:boundary>` + `layout/page-error-fallback.svelte` | Per-page render errors on Calculator/Plot — keeps the nav bar visible and offers a reset, in place of a full-page crash |

The Calculator and Plot pages wrap their interactive content in a Svelte 5
error boundary that renders `page-error-fallback.svelte`; the project does not
use per-route `+error.svelte` files for these pages. WASM errors and input
validation errors are handled in-component (see above) and do NOT reach either
boundary — those only fire for unexpected JavaScript exceptions (bugs, null
dereferences, type errors) that escape component handling.

### Input validation errors

Energy input parsing (`parseEnergyInput()`, `utils/energy-parser.ts`) returns
per-line validation errors, tracked per row in `energy-rows.svelte.ts`. These
are rendered inline on each energy row as red borders + messages — not as
`LibdedxError` instances (they are JS-level, not C-level errors).

---

## 12. Performance Considerations

| Area                       | Strategy                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WASM binary size           | `libdedx.wasm` **457 KB** + `libdedx.mjs` 13 KB (~200 KB gzip total) — no `.data` sidecar (all data compiled in). Served from `static/wasm/` as un-hashed filenames. GitHub Pages applies `Cache-Control: max-age=600`; subsequent visits send conditional requests (ETag) and receive 304 if unchanged. See [`09-non-functional-requirements.md` §3.1](09-non-functional-requirements.md#31-browser-caching). |
| JSROOT bundle              | ~500 kB gzipped — lazy-loaded only when Plot page is first visited (`import('jsroot')`).                                                                                                                                                                                                                                                                                                                       |
| Main-thread computation    | All WASM calls are synchronous. The 300 ms debounce absorbs rapid input; single-series calculations complete in < 20 ms. Worst case (8-series plot re-render) is < 160 ms — within the 500 ms plot budget. Web Worker offloading is deferred (see §3 Web Worker strategy).                                                                                                                                     |
| Calculation debounce       | 300 ms debounce on energy input `$effect` prevents WASM calls on every keystroke.                                                                                                                                                                                                                                                                                                                              |
| Entity list caching        | Programs / particles / materials fetched once at init by `app-init.svelte.ts`; compat matrix cached in `compatibility-matrix.ts`. No per-render WASM calls.                                                                                                                                                                                                                                                    |
| Plot data points           | 500 points per series is the default; computed once per series add. Re-rendered by JSROOT — no JS-side re-computation on zoom/pan.                                                                                                                                                                                                                                                                             |
| `noUncheckedIndexedAccess` | TypeScript compiler flag; prevents accidental undefined access in hot WASM result array paths.                                                                                                                                                                                                                                                                                                                 |

---

## 13. Accessibility Architecture

- All interactive controls use native HTML elements (`<button>`, `<select>`,
  `<input>`, `<textarea>`); no custom ARIA role hacks.
- The results tables (`results/table-*.svelte`) render semantic `<table>`s with
  `<thead>` / `<tbody>`; screen readers announce column headers.
- `jsroot-plot.svelte` wraps the canvas with `role="img"` and an
  `aria-label` describing the current series (e.g., "Stopping power vs
  energy: proton in water, PSTAR"). Export to SVG provides an accessible
  alternative for screen-reader users.
- Color palette for plot series is colorblind-safe (Okabe-Ito 8-color sequence).
- Selection changes are announced via `selection-live-region.svelte` (an
  `aria-live` region); the tabbed picker (`entity-selection/`) uses native
  buttons and roving focus for keyboard accessibility.

See [`09-non-functional-requirements.md`](09-non-functional-requirements.md) for the full WCAG 2.1 AA checklist.

---

## 14. Related Documents

| Document                                                                               | Purpose                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------- |
| [02-tech-stack.md](02-tech-stack.md)                                                   | Library versions and rationale              |
| [decisions/001-sveltekit-over-react.md](decisions/001-sveltekit-over-react.md)         | SvelteKit ADR                               |
| [decisions/002-keep-jsroot.md](decisions/002-keep-jsroot.md)                           | JSROOT ADR                                  |
| [decisions/003-wasm-build-pipeline.md](decisions/003-wasm-build-pipeline.md)           | WASM build ADR                              |
| [06-wasm-api-contract.md](06-wasm-api-contract.md)                                     | TypeScript types + LibdedxService interface |
| [04-feature-specs/shareable-urls-formal.md](04-feature-specs/shareable-urls-formal.md) | URL canonicalization algorithm              |
| [04-feature-specs/entity-selection.md](04-feature-specs/entity-selection.md)           | Tabbed entity picker spec                   |
| [04-feature-specs/calculator.md](04-feature-specs/calculator.md)                       | Calculator page spec                        |
| [04-feature-specs/plot.md](04-feature-specs/plot.md)                                   | Plot page spec                              |
| [09-non-functional-requirements.md](09-non-functional-requirements.md)                 | WCAG, performance budgets                   |
