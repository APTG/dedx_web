# Prototyping Spikes — Risk Reduction Before Stage 3

> **Status:** Draft v1 (14 April 2026)
>
> Defines three time-boxed prototyping spikes that must be completed before
> full implementation begins. Each spike validates a high-risk architectural
> assumption made in Stage 2 documents. Spikes produce throwaway code in a
> `prototypes/` directory — not production code.
>
> **Purpose of this document:** Hand this file to an AI coding agent with the
> instruction *"Implement the spike described in §N."* Each section is
> self-contained and independently executable.

---

## Motivation

The Stage 2 architecture ([`03-architecture.md`](03-architecture.md)) and ADRs
([`decisions/`](decisions/)) were designed on paper. Three integration points
carry enough technical risk that a failed assumption would require significant
architectural rework:

| Risk | Specified in | What could go wrong |
|------|-------------|---------------------|
| JSROOT 7 inside Svelte 5 `$effect` | [03-architecture.md §5](03-architecture.md#5-component-tree), [ADR 002](decisions/002-keep-jsroot.md) | DOM ownership conflict; `untrack` pattern insufficient; JSROOT cleanup not idempotent; memory leaks on re-draw |
| Emscripten `--preload-file` on GitHub Pages | [ADR 003](decisions/003-wasm-build-pipeline.md), [03-architecture.md §3](03-architecture.md#3-wasm-service-layer) | `.data` file not served with correct MIME type; CORS or path resolution errors; regression from legacy `--embed-file` |
| Module-level `$state` in `.svelte.ts` files | [03-architecture.md §4](03-architecture.md#4-reactive-state-topology) | Reactivity lost across module boundaries; `{ value: T }` wrapper pattern not tracked by Svelte's proxy; `$derived` at module scope not re-evaluated |

Each spike is designed to be completable by an AI coding agent in a single
session with no human intervention beyond reviewing the output.

---

## General Rules for All Spikes

1. **Throwaway code.** All prototype code goes in `prototypes/<spike-name>/`.
   It is not imported by `src/` and will be deleted after evaluation.
2. **Minimal dependencies.** Each spike installs only the packages it tests.
   Use a local `package.json` inside the prototype directory if needed, or
   install in the project root as devDependencies.
3. **Pass/fail verdicts.** Each spike has explicit acceptance criteria.
   The agent must print a summary at the end:
   `PASS: <criterion>` or `FAIL: <criterion> — <reason>`.
4. **No production code changes.** Do not modify the production `src/`,
   `static/`, `docs/`, or `wasm/` directories at the repository root. All
   prototype changes must be confined to `prototypes/`.
5. **Commit the prototype.** The agent should commit each spike separately
   with `chore: prototype — <spike-name>`.

---

## Spike 1: JSROOT 7 in Svelte 5 `$effect`

### Goal

Prove that JSROOT 7's `TGraph` / `TMultiGraph` can be rendered inside a
Svelte 5 component using `$effect` for lifecycle management, with correct
cleanup on reactive data changes and no DOM ownership conflicts.

### Background

- [ADR 002](decisions/002-keep-jsroot.md) chose JSROOT 7 for physics-standard
  log-log plotting.
- [03-architecture.md §5](03-architecture.md#5-component-tree) describes a
  `JsrootPlot.svelte` wrapper that uses `$effect` + `untrack` + a cleanup
  return to manage JSROOT's direct DOM writes.
- The old code ([`src/Components/Pages/Plot/JSRootGraph.js`](../src/Components/Pages/Plot/JSRootGraph.js))
  used React class components with `componentDidMount` / `componentDidUpdate`.
- Risk: JSROOT writes into a container `<div>` directly; Svelte 5 may attempt
  to reconcile those DOM nodes; `painter.cleanup?.()` may not be the correct
  JSROOT 7 API; repeated draw/cleanup cycles may leak memory.

### Scope

Create a minimal SvelteKit app that:

1. Has a single page with a `JsrootPlot.svelte` component.
2. The component renders a `TMultiGraph` with 2 `TGraph` series (dummy sine
   data, 100 points each) on log-log axes.
3. A button adds a third series reactively — the `$effect` re-draws the plot.
4. A button removes all series — the `$effect` cleans up the plot.
5. A button changes the data of the first series — verifying re-draw without
   full cleanup.
6. Verify that wheel zoom is disabled (`JSROOT.settings.ZoomWheel = false`)
   and the page scrolls normally when the mouse is over the plot.

### Exact Steps for the Agent

```
1. mkdir -p prototypes/jsroot-svelte5
2. cd prototypes/jsroot-svelte5
3. npm create svelte@latest . -- --template minimal --types ts
4. npm install
5. npm install jsroot@^7
6. npm install -D tailwindcss @tailwindcss/vite
```

Create the following files:

**`prototypes/jsroot-svelte5/src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import JsrootPlot from "$lib/JsrootPlot.svelte";

  // Reactive series state
  let series = $state<{ x: number[]; y: number[]; label: string }[]>([
    {
      label: "Series A",
      x: Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.1),
      y: Array.from({ length: 100 }, (_, i) => Math.sin(0.01 + i * 0.1) + 2),
    },
    {
      label: "Series B",
      x: Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.1),
      y: Array.from({ length: 100 }, (_, i) => Math.cos(0.01 + i * 0.1) + 3),
    },
  ]);

  function addSeries() {
    series = [
      ...series,
      {
        label: `Series ${String.fromCharCode(65 + series.length)}`,
        x: Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.1),
        y: Array.from({ length: 100 }, (_, i) => 1.5 + Math.random()),
      },
    ];
  }

  function removeAll() {
    series = [];
  }

  function mutateFirst() {
    if (series.length === 0) return;
    series = [
      {
        ...series[0],
        y: series[0].y.map((v) => v * (0.8 + Math.random() * 0.4)),
      },
      ...series.slice(1),
    ];
  }
</script>

<h1>JSROOT 7 + Svelte 5 Spike</h1>

<div style="margin-bottom: 1rem;">
  <button onclick={addSeries}>Add series</button>
  <button onclick={removeAll}>Remove all</button>
  <button onclick={mutateFirst}>Mutate first series</button>
  <span>Series count: {series.length}</span>
</div>

<div style="width: 800px; height: 500px; border: 1px solid #ccc;">
  <JsrootPlot {series} />
</div>

<div style="height: 2000px; background: linear-gradient(white, #eee);">
  <p>Scroll area — verify wheel scrolls the page, not the plot.</p>
</div>
```

**`prototypes/jsroot-svelte5/src/lib/JsrootPlot.svelte`**

Implement the wrapper following the pattern from
[`03-architecture.md §5`](03-architecture.md#5-component-tree):

```svelte
<script lang="ts">
  import { untrack } from "svelte";

  interface SeriesData {
    x: number[];
    y: number[];
    label: string;
  }

  let { series }: { series: SeriesData[] } = $props();

  let container: HTMLDivElement;
  let currentPainter: unknown = null;

  $effect(() => {
    // `series` is tracked here — $effect re-runs when it changes.
    const seriesSnapshot = series;

    // Cleanup previous draw without tracking `currentPainter`.
    untrack(() => {
      cleanupPlot();
    });

    if (seriesSnapshot.length === 0) return;

    drawPlot(container, seriesSnapshot).then((painter) => {
      currentPainter = painter;
    });

    // Cleanup on effect disposal (component unmount or next re-run).
    return () => {
      cleanupPlot();
    };
  });

  function cleanupPlot() {
    if (currentPainter && typeof (currentPainter as any).cleanup === "function") {
      (currentPainter as any).cleanup();
    }
    currentPainter = null;
    // Also clear the container's innerHTML as a fallback.
    if (container) container.innerHTML = "";
  }

  async function drawPlot(
    el: HTMLDivElement,
    data: SeriesData[],
  ): Promise<unknown> {
    const JSROOT = await import("jsroot");

    // Disable wheel zoom so page scrolls normally.
    JSROOT.settings.ZoomWheel = false;

    const mg = JSROOT.createTMultiGraph();

    for (const s of data) {
      const gr = JSROOT.createTGraph(s.x.length, s.x, s.y);
      gr.fTitle = s.label;
      gr.fLineWidth = 2;
      mg.fGraphs.Add(gr);
    }

    mg.fTitle = "Spike: JSROOT in Svelte 5";

    // 'AP' = axes + polyline. 'logx logy' for log-log axes.
    return JSROOT.draw(el, mg, "AP logx logy");
  }
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
```

### Acceptance Criteria

Run the dev server (`npm run dev`) and manually verify in the browser.
Print verdict for each criterion:

| # | Criterion | How to test |
|---|-----------|-------------|
| 1 | **Initial render:** Two series visible on log-log axes | Visual inspection on page load |
| 2 | **Add series:** Click "Add series" — third curve appears; first two remain | Click button, observe |
| 3 | **Remove all:** Click "Remove all" — canvas clears, no console errors | Click button, check DevTools console |
| 4 | **Mutate first:** Click "Mutate first series" — curve changes, others unchanged | Click button, observe |
| 5 | **Rapid clicks:** Click "Add series" 5× rapidly — no error, 7 series shown | Rapid clicks, observe |
| 6 | **Wheel scroll:** Mouse over plot, scroll wheel — page scrolls, plot does NOT zoom | Scroll over plot |
| 7 | **No memory leak:** In DevTools Performance monitor, repeated add/remove cycles do not grow JS heap monotonically over 10 iterations | DevTools → Performance monitor → JS Heap |
| 8 | **No Svelte DOM warnings:** Console shows no "hydration mismatch" or DOM reconciliation warnings | DevTools console |
| 9 | **JSROOT cleanup API exists:** `painter.cleanup` (or equivalent) is callable without error | Confirmed by criterion 3 |

### What to Do if a Criterion Fails

- **Criteria 1–5 fail:** The `$effect` + `untrack` pattern from the architecture
  doc is insufficient. Document the failure mode and try alternative approaches:
  (a) use `{#key series}` block to force full re-mount; (b) use `JSROOT.cleanup(container)`
  instead of `painter.cleanup()`; (c) call `JSROOT.redraw(container, mg)`.
  Report which alternative works.
- **Criterion 6 fails:** `JSROOT.settings.ZoomWheel = false` may not work in
  JSROOT 7. Check JSROOT 7 API docs for the correct setting name.
- **Criterion 7 fails:** JSROOT may leak DOM nodes. Check if `container.innerHTML = ""`
  is needed in addition to `painter.cleanup()`.
- **Criteria 8–9 fail:** Document the exact error and propose a fix.

### Deliverables

- Working code in `prototypes/jsroot-svelte5/`.
- A `prototypes/jsroot-svelte5/VERDICT.md` file with pass/fail for each criterion.
- If any criterion failed: the alternative approach that worked, and a specific
  amendment to propose for [`03-architecture.md §5`](03-architecture.md#5-component-tree).

---

## Spike 2: WASM `--preload-file` on SvelteKit Static Adapter

### Goal

Prove that libdedx compiled with `--preload-file` (producing a `.data` sidecar)
loads correctly when served by SvelteKit's dev server and by a static file
server simulating GitHub Pages, including sub-path deployment.

### Background

- [ADR 003](decisions/003-wasm-build-pipeline.md) switches from `--embed-file`
  (legacy) to `--preload-file`. The legacy [`build_wasm.sh`](../build_wasm.sh)
  has a comment explaining that `--preload-file` caused fetch errors previously.
- The ADR states that the `locateFile` override in `loader.ts` resolves the
  path issue, but this has not been tested.
- Risk: GitHub Pages may not serve `.data` files with the correct MIME type;
  `locateFile` may not correctly locate the `.data` file in sub-path deployments
  (e.g., `https://user.github.io/dedx_web/wasm/libdedx.data`).

### Scope

Build the real libdedx WASM module using both `--embed-file` and
`--preload-file`, then serve each from a SvelteKit static build to compare.

**Prerequisites:**
- Docker installed (for `emscripten/emsdk` image).
- The `libdedx/` submodule initialized (`git submodule update --init`).

### Exact Steps for the Agent

**Step 1: Build WASM with `--preload-file` (primary) and `--embed-file` (fallback)**

```bash
mkdir -p prototypes/wasm-preload
cd prototypes/wasm-preload

# Build libdedx.a inside Docker
docker run --rm -v "$(pwd)/../../libdedx:/src/libdedx" \
  -v "$(pwd):/src/output" \
  -w /src/libdedx \
  emscripten/emsdk:3.1.64 \
  bash -c '
    emcmake cmake . -B build-wasm
    cmake --build build-wasm
    cp build-wasm/libdedx/libdedx.a /src/output/libdedx.a
  '

# Build WASM with --preload-file
docker run --rm -v "$(pwd)/../../libdedx:/src/libdedx" \
  -v "$(pwd):/src/output" \
  -w /src/output \
  emscripten/emsdk:3.1.64 \
  bash -c '
    mkdir -p preload embed
    emcc libdedx.a \
      -I /src/libdedx/include \
      -o preload/libdedx.mjs \
      -s "EXPORTED_FUNCTIONS=[_dedx_fill_program_list,_dedx_get_program_name,_malloc,_free]" \
      -s "EXPORTED_RUNTIME_METHODS=[ccall,cwrap,UTF8ToString]" \
      -s ENVIRONMENT=web \
      -s EXPORT_ES6=1 \
      -s MODULARIZE=1 \
      -s WASM=1 \
      -s ALLOW_MEMORY_GROWTH=1 \
      --preload-file /src/libdedx/data@/data

    # Also build with --embed-file for comparison
    emcc libdedx.a \
      -I /src/libdedx/include \
      -o embed/libdedx.mjs \
      -s "EXPORTED_FUNCTIONS=[_dedx_fill_program_list,_dedx_get_program_name,_malloc,_free]" \
      -s "EXPORTED_RUNTIME_METHODS=[ccall,cwrap,UTF8ToString]" \
      -s ENVIRONMENT=web \
      -s EXPORT_ES6=1 \
      -s MODULARIZE=1 \
      -s WASM=1 \
      -s ALLOW_MEMORY_GROWTH=1 \
      --embed-file /src/libdedx/data@/data
  '
```

**Step 2: Create a minimal SvelteKit app that loads the WASM module**

```bash
cd prototypes/wasm-preload
npm create svelte@latest app -- --template minimal --types ts
cd app
npm install
npm install -D @sveltejs/adapter-static
```

Configure `svelte.config.js` for static adapter with a configurable base path:

```js
import adapter from "@sveltejs/adapter-static";

export default {
  kit: {
    adapter: adapter({ fallback: "404.html" }),
    paths: {
      // Simulate GitHub Pages sub-path: /dedx_web/
      base: process.env.BASE_PATH || "",
    },
  },
};
```

Copy the preload build output into `app/static/wasm/`:

```bash
mkdir -p app/static/wasm
cp ../preload/libdedx.mjs app/static/wasm/
cp ../preload/libdedx.wasm app/static/wasm/
cp ../preload/libdedx.data app/static/wasm/  # .data sidecar from --preload-file
```

Create `app/src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { base } from "$app/paths";

  let status = $state("Loading...");
  let programs = $state<string[]>([]);
  let wasmFileSize = $state("");

  $effect(() => {
    loadWasm();
  });

  async function loadWasm() {
    try {
      const factory = await import(`${base}/wasm/libdedx.mjs`);
      const module = await factory.default({
        locateFile: (f: string) => `${base}/wasm/${f}`,
      });

      // Call dedx_fill_program_list to verify the data files loaded
      const bufSize = 20;
      const ptr = module._malloc(bufSize * 4);
      module.ccall(
        "dedx_fill_program_list",
        null,
        ["number"],
        [ptr],
      );

      // Read program IDs until -1 terminator
      const heap = new Int32Array(module.HEAP32.buffer, ptr, bufSize);
      const ids: number[] = [];
      for (let i = 0; i < bufSize; i++) {
        if (heap[i] === -1) break;
        ids.push(heap[i]!);
      }
      module._free(ptr);

      // Get program names
      const names: string[] = [];
      for (const id of ids) {
        const namePtr = module.ccall(
          "dedx_get_program_name",
          "number",
          ["number"],
          [id],
        );
        names.push(module.UTF8ToString(namePtr));
      }

      programs = names;
      status = `OK — ${names.length} programs loaded`;

      // Report file sizes
      const wasmResp = await fetch(`${base}/wasm/libdedx.wasm`);
      const wasmBytes = (await wasmResp.blob()).size;
      wasmFileSize = `WASM: ${(wasmBytes / 1024).toFixed(0)} KB`;
    } catch (e) {
      status = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
      console.error("WASM load error:", e);
    }
  }
</script>

<h1>WASM Preload Spike</h1>
<p>Status: <strong>{status}</strong></p>
<p>{wasmFileSize}</p>
{#if programs.length > 0}
  <h2>Programs from libdedx:</h2>
  <ul>
    {#each programs as p}
      <li>{p}</li>
    {/each}
  </ul>
{/if}
```

**Step 3: Test in three deployment scenarios**

```bash
cd app

# Scenario A: Dev server (root path)
npm run dev
# → Open http://localhost:5173, verify programs load

# Scenario B: Static build, root path
npm run build
npx serve build -l 4000
# → Open http://localhost:4000, verify programs load

# Scenario C: Static build, sub-path (simulating GitHub Pages /dedx_web/)
BASE_PATH=/dedx_web npm run build
# Serve from a subdirectory:
mkdir -p /tmp/ghpages/dedx_web
cp -r build/* /tmp/ghpages/dedx_web/
npx serve /tmp/ghpages -l 4001
# → Open http://localhost:4001/dedx_web/, verify programs load
```

**Step 4: Verify `.data` file is fetched**

In each scenario, open DevTools → Network tab and confirm:
- `libdedx.data` is fetched (not 404).
- Its content type is acceptable (any binary MIME type, or `application/octet-stream`).
- The `locateFile` override correctly produces the full path.

**Step 5 (if Scenario B or C fails): Repeat with `--embed-file` build**

Replace `app/static/wasm/` contents with the `embed/` build output (which has
no `.data` file) and repeat Scenarios B and C.

### Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|---------------|
| 1 | **Dev server loads** | Status shows "OK — N programs loaded" (N ≥ 5); program names visible |
| 2 | **Static build (root path) loads** | Same as above, served by `npx serve build` |
| 3 | **Static build (sub-path) loads** | Same as above, served at `/dedx_web/` sub-path |
| 4 | **`.data` file fetched** | DevTools Network shows `libdedx.data` request with 200 status in all scenarios |
| 5 | **No CORS errors** | DevTools Console has no CORS-related errors |
| 6 | **`locateFile` paths correct** | The URLs for `.wasm` and `.data` in DevTools Network match the expected base path |

### What to Do if a Criterion Fails

- **Criteria 1–3 (preload fails):** Rebuild with `--embed-file` and verify it
  works. If embed works but preload doesn't, document the specific error
  (404? MIME type? CORS?) and recommend that
  [ADR 003](decisions/003-wasm-build-pipeline.md) be amended to keep
  `--embed-file` or use a different data packaging strategy.
- **Criterion 4 (`.data` not fetched):** Check if Emscripten embeds the data
  into the `.mjs` file instead; verify with file size comparison.
- **Criterion 5 (CORS):** This would indicate a fundamental problem with
  `--preload-file` on static hosting. Document and recommend `--embed-file`.
- **Criterion 6 (`locateFile` wrong):** Fix the `locateFile` callback and
  document the correct pattern for [03-architecture.md §3](03-architecture.md#3-wasm-service-layer).

### Deliverables

- Working code in `prototypes/wasm-preload/`.
- A `prototypes/wasm-preload/VERDICT.md` with pass/fail per criterion, the
  Network tab screenshot descriptions, and file sizes for both builds.
- If `--preload-file` fails: a concrete amendment for
  [ADR 003](decisions/003-wasm-build-pipeline.md) recommending the fallback.

---

## Spike 3: Module-Level `$state` Reactivity in `.svelte.ts`

### Goal

Prove that the module-level `$state` + `{ value: T }` wrapper pattern from
[`03-architecture.md §4`](03-architecture.md#4-reactive-state-topology) is
reactive across multiple Svelte components, supports `$derived` at module
scope, and works correctly with the debounced `$effect` calculation pattern.

### Background

- [03-architecture.md §4](03-architecture.md#4-reactive-state-topology)
  specifies that all shared state uses module-level `$state` with a
  `{ value: T }` wrapper in `.svelte.ts` files.
- `$derived` at module scope reads these `$state` values.
- An `$effect` in a page component watches multiple `$state` / `$derived`
  values and debounces a computation (simulating the WASM call).
- Risk: module-level `$state` may not trigger reactivity when mutated from
  one component and read in another; the `{ value: T }` proxy tracking may
  behave differently at module scope than inside a component; `$derived` at
  module scope may not re-evaluate.

### Scope

Create a minimal SvelteKit app with two state modules and three components
that simulate the Calculator data flow:

```
state/counter.svelte.ts  — $state + $derived (simulates selection + calculation)
state/ui.svelte.ts       — $state for mode toggle

+page.svelte             — reads state, renders two child components
InputPanel.svelte        — writes to state (simulates EntityDropdown + EnergyInput)
ResultPanel.svelte       — reads state and $derived (simulates ResultTable)
```

### Exact Steps for the Agent

```bash
mkdir -p prototypes/svelte5-state
cd prototypes/svelte5-state
npm create svelte@latest . -- --template minimal --types ts
npm install
```

Create the following files:

**`prototypes/svelte5-state/src/lib/state/counter.svelte.ts`**

```ts
// Simulates: selection.svelte.ts + calculation.svelte.ts

// Module-level $state with { value: T } wrapper
export const selectedValue = $state<{ value: number }>({ value: 0 });
export const inputText = $state<{ value: string }>({ value: "" });

// $derived at module scope — should re-evaluate when dependencies change
export const parsedNumbers = $derived(
  inputText.value
    .split("\n")
    .map((line) => parseFloat(line.trim()))
    .filter((n) => !isNaN(n)),
);

// $derived depending on another $state
export const computedResult = $derived(
  parsedNumbers.map((n) => n * (selectedValue.value + 1)),
);

// Array state — test bulk replacement
export const items = $state<{ value: string[] }>({ value: [] });
```

**`prototypes/svelte5-state/src/lib/state/ui.svelte.ts`**

```ts
// Simulates: ui.svelte.ts

export const isAdvancedMode = $state<{ value: boolean }>({ value: false });
export const computationCount = $state<{ value: number }>({ value: 0 });
```

**`prototypes/svelte5-state/src/lib/InputPanel.svelte`**

```svelte
<script lang="ts">
  import { selectedValue, inputText, items } from "./state/counter.svelte.ts";
  import { isAdvancedMode } from "./state/ui.svelte.ts";

  function increment() {
    selectedValue.value += 1;
  }

  function decrement() {
    selectedValue.value -= 1;
  }

  function toggleMode() {
    isAdvancedMode.value = !isAdvancedMode.value;
  }

  function addItem() {
    items.value = [...items.value, `Item ${items.value.length + 1}`];
  }

  function replaceAllItems() {
    items.value = ["Replaced A", "Replaced B", "Replaced C"];
  }
</script>

<div style="border: 1px solid blue; padding: 1rem; margin: 1rem;">
  <h2>InputPanel (writer)</h2>

  <div>
    <button onclick={decrement}>-</button>
    <span>Selected: {selectedValue.value}</span>
    <button onclick={increment}>+</button>
  </div>

  <div>
    <label>
      Energy input (one number per line):
      <textarea
        value={inputText.value}
        oninput={(e) => { inputText.value = (e.target as HTMLTextAreaElement).value; }}
        rows="4"
        cols="30"
      ></textarea>
    </label>
  </div>

  <div>
    <button onclick={toggleMode}>
      Toggle mode (current: {isAdvancedMode.value ? "Advanced" : "Basic"})
    </button>
  </div>

  <div>
    <button onclick={addItem}>Add item</button>
    <button onclick={replaceAllItems}>Replace all items</button>
  </div>
</div>
```

**`prototypes/svelte5-state/src/lib/ResultPanel.svelte`**

```svelte
<script lang="ts">
  import {
    selectedValue,
    parsedNumbers,
    computedResult,
    items,
  } from "./state/counter.svelte.ts";
  import { isAdvancedMode, computationCount } from "./state/ui.svelte.ts";

  // Debounced $effect — simulates the Calculator page calculation effect.
  // Watches parsedNumbers and selectedValue; fires after 300ms quiet.
  $effect(() => {
    // Read reactive dependencies
    const nums = parsedNumbers;
    const sel = selectedValue.value;

    const timer = setTimeout(() => {
      // Simulate a WASM call
      console.log(
        `[debounced effect] Computing with ${nums.length} numbers, selected=${sel}`,
      );
      computationCount.value += 1;
    }, 300);

    return () => clearTimeout(timer);
  });
</script>

<div style="border: 1px solid green; padding: 1rem; margin: 1rem;">
  <h2>ResultPanel (reader)</h2>

  <p>Selected value: <strong>{selectedValue.value}</strong></p>
  <p>Mode: <strong>{isAdvancedMode.value ? "Advanced" : "Basic"}</strong></p>
  <p>Debounced computation count: <strong>{computationCount.value}</strong></p>

  <h3>Parsed numbers ({parsedNumbers.length})</h3>
  <ul>
    {#each parsedNumbers as n}
      <li>{n}</li>
    {/each}
  </ul>

  <h3>Computed result (n × (selected + 1))</h3>
  <ul>
    {#each computedResult as r}
      <li>{r.toFixed(4)}</li>
    {/each}
  </ul>

  <h3>Items ({items.value.length})</h3>
  <ul>
    {#each items.value as item}
      <li>{item}</li>
    {/each}
  </ul>
</div>
```

**`prototypes/svelte5-state/src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import InputPanel from "$lib/InputPanel.svelte";
  import ResultPanel from "$lib/ResultPanel.svelte";
</script>

<h1>Svelte 5 Module-Level $state Spike</h1>

<div style="display: flex; gap: 1rem;">
  <InputPanel />
  <ResultPanel />
</div>
```

### Acceptance Criteria

| # | Criterion | How to test |
|---|-----------|-------------|
| 1 | **Cross-component reactivity:** Clicking +/- in InputPanel updates the "Selected value" shown in ResultPanel in real time | Click buttons, observe ResultPanel |
| 2 | **`$derived` at module scope:** Typing "10\n20\n30" in the textarea shows `[10, 20, 30]` in ResultPanel's "Parsed numbers" list | Type in textarea, observe list |
| 3 | **Chained `$derived`:** "Computed result" updates when either `inputText` or `selectedValue` changes; values are correct (n × (selected + 1)) | Change selected to 2, type "5\n10"; expect [15, 30] |
| 4 | **Debounced `$effect`:** "Computation count" increments once after 300ms of quiet, NOT on every keystroke | Type rapidly, observe count stays stable; wait 300ms, count increments by 1 |
| 5 | **Mode toggle cross-component:** Clicking "Toggle mode" in InputPanel updates the "Mode" display in ResultPanel | Click button, observe |
| 6 | **Array bulk replacement:** "Replace all items" replaces the entire array; ResultPanel shows ["Replaced A", "Replaced B", "Replaced C"] | Click button, observe |
| 7 | **Array append:** "Add item" appends to the array; ResultPanel shows the new item | Click button, observe |
| 8 | **No console errors:** DevTools Console has no runtime errors or warnings related to reactivity | Check console throughout all tests |
| 9 | **SSG prerender works:** `npm run build` completes without error (static adapter) | Run build |

### What to Do if a Criterion Fails

- **Criterion 1 fails (no cross-component reactivity):** The `{ value: T }`
  wrapper pattern is broken at module scope. Try alternatives: (a) use a
  class with `$state` fields; (b) use `$state` inside a function that returns
  getter/setter; (c) use `svelte/store` with `get`/`set` wrappers.
  Document which alternative works and propose an amendment to
  [`03-architecture.md §4`](03-architecture.md#4-reactive-state-topology).
- **Criterion 2–3 fail:** `$derived` at module scope is broken. Try wrapping
  in a function that is called inside a component's `$derived`.
- **Criterion 4 fails:** The `setTimeout` + cleanup debounce pattern does not
  work as specified. Try `queueMicrotask` or a `tick()` guard.
- **Criterion 9 fails:** There may be a server-side `$state` evaluation error.
  Check if `.svelte.ts` files are being processed during SSG.

### Deliverables

- Working code in `prototypes/svelte5-state/`.
- A `prototypes/svelte5-state/VERDICT.md` with pass/fail per criterion.
- If any criterion failed: the alternative approach that worked, and a specific
  amendment to propose for [`03-architecture.md §4`](03-architecture.md#4-reactive-state-topology).

---

## Spike Execution Order

The spikes are independent and can be run in parallel. However, if a single
agent is doing them sequentially, the recommended order is:

| Order | Spike | Reason |
|-------|-------|--------|
| 1 | **Spike 3** (Svelte 5 `$state`) | Fastest to complete (no Docker, no WASM). Validates the most fundamental architecture assumption (shared reactive state). |
| 2 | **Spike 1** (JSROOT + Svelte 5) | Requires only `npm install jsroot`. Validates the Plot page's core dependency. |
| 3 | **Spike 2** (WASM `--preload-file`) | Requires Docker + libdedx submodule. Validates the build pipeline. |

---

## Integration with the Redesign Plan

These spikes slot into the existing stage plan from
[`00-redesign-plan.md §8`](00-redesign-plan.md#8-implementation-stages):

```
Stage 1: Requirements & Specifications  ✅ Complete
Stage 2: Technical Architecture          ✅ Complete
  └─ Stage 2.5: Prototyping Spikes      ← THIS DOCUMENT
Stage 3: WASM Build Pipeline Redesign
Stage 4: Project Scaffolding
...
```

**Gate rule:** Stage 3 must not begin until all three spike verdicts are
`PASS` for their critical criteria, or the relevant architecture documents
have been amended to reflect the validated alternative approach.

After all spikes pass, the `prototypes/` directory should be deleted
(or `.gitignore`'d) before Stage 3 begins.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| [03-architecture.md](03-architecture.md) | Target architecture — spikes validate §3 (WASM), §4 (state), §5 (JSROOT) |
| [decisions/002-keep-jsroot.md](decisions/002-keep-jsroot.md) | JSROOT choice — Spike 1 validates |
| [decisions/003-wasm-build-pipeline.md](decisions/003-wasm-build-pipeline.md) | `--preload-file` — Spike 2 validates |
| [06-wasm-api-contract.md](06-wasm-api-contract.md) | LibdedxService types — Spike 2 uses a minimal subset |
| [02-tech-stack.md](02-tech-stack.md) | Version pins — all spikes must use the pinned versions |
| [00-redesign-plan.md](00-redesign-plan.md) | Stage plan — spikes are Stage 2.5 |
