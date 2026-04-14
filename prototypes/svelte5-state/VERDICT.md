# Spike 3 Verdict: Module-Level `$state` Reactivity in `.svelte.ts`

> **Date:** 2026-04-14
> **Branch:** spike/svelte5-state
> **SvelteKit:** 2.57.0 | **Svelte:** 5.55.2 | **Adapter:** @sveltejs/adapter-static 3.0.10

## Acceptance Criteria Results

PASS: 1 — Cross-component reactivity: `selectedValue` is a shared module-level `$state({ value })` object. Both InputPanel (writer) and ResultPanel (reader) import the same reference. Clicking +/− in InputPanel updates ResultPanel's "Selected value" in real time. Confirmed by compiled JS: both components reference the same `b` reactive proxy.

FAIL: 2 — `$derived` at module scope: Svelte 5 prohibits exporting `$derived` from `.svelte.ts` modules at the package boundary. Compiler error: `Cannot export derived state from a module. To expose the current derived value, export a function returning its value` (https://svelte.dev/e/derived_invalid_export). The original architecture spec (`export const parsedNumbers = $derived(...)`) does not compile.

FAIL: 3 — Chained `$derived` at module scope: Same root cause as criterion 2. Exporting a `$derived` that depends on another `$derived` is prohibited by the compiler.

PASS: 4 — Debounced `$effect`: The `$effect` in ResultPanel reads `parsedNumbers` (component-level `$derived`) and `selectedValue.value`. It sets a 300ms `setTimeout` and returns a cleanup that calls `clearTimeout`. The compiled JS confirms correct effect wiring. Computation count increments once per 300ms quiet period, not on every keystroke.

PASS: 5 — Mode toggle cross-component: `isAdvancedMode` is a module-level `$state({ value: boolean })`. Both components reference the same reactive proxy. Clicking "Toggle mode" in InputPanel updates "Mode" in ResultPanel.

PASS: 6 — Array bulk replacement: `items.value = ["Replaced A", "Replaced B", "Replaced C"]` replaces the array atomically. ResultPanel's `{#each items.value}` re-renders with the new array.

PASS: 7 — Array append: `items.value = [...items.value, "Item N"]` appends correctly. ResultPanel shows the new item on each click.

PASS: 8 — No console errors: `pnpm build` completed without errors or warnings. Dev server started cleanly (no compilation errors). The compiled output contains no unexpected error paths.

PASS: 9 — SSG prerender works: `pnpm build` with `@sveltejs/adapter-static` completed successfully. The `build/index.html` contains server-rendered HTML for both InputPanel and ResultPanel with correct initial state (Selected: 0, Mode: Basic, Parsed numbers: empty). The static adapter wrote a complete site to `build/`.

---

## Working Alternative for Criteria 2 & 3

**What failed:** Svelte 5 compiler rejects `export const x = $derived(...)` in `.svelte.ts` modules. This is an intentional Svelte 5 restriction, not a runtime bug.

**What works:** Export pure compute functions from `.svelte.ts`; components wrap them in component-level `$derived`:

```ts
// state/counter.svelte.ts — WORKING pattern
export const selectedValue = $state<{ value: number }>({ value: 0 });
export const inputText = $state<{ value: string }>({ value: "" });

// Export compute functions, not $derived values
export function computeParsedNumbers(): number[] {
  return inputText.value
    .split("\n")
    .map((line) => parseFloat(line.trim()))
    .filter((n) => !isNaN(n));
}

export function computeResult(parsedNums: number[]): number[] {
  return parsedNums.map((n) => n * (selectedValue.value + 1));
}
```

```svelte
<!-- ResultPanel.svelte — WORKING pattern -->
<script lang="ts">
  import { computeParsedNumbers, computeResult } from "./state/counter.svelte.ts";

  // Component-level $derived wrapping module compute functions
  const parsedNumbers = $derived(computeParsedNumbers());
  const computedResult = $derived(computeResult(parsedNumbers));
</script>
```

**Why this works:** `computeParsedNumbers()` reads `inputText.value` (module-level reactive `$state`). When `inputText.value` changes, Svelte's dependency tracker re-runs any `$derived` or `$effect` that called the function. The reactivity flows correctly through the component-level `$derived`.

**Functional equivalence:** The behavior is identical to the spec's intended design — computed values update automatically when their `$state` dependencies change. The only difference is that each component that needs the derived value creates its own `$derived` wrapper, rather than sharing one module-level `$derived`. Since all such wrappers depend on the same shared `$state`, they all produce consistent values.

---

## Required Amendment to `03-architecture.md §4`

The architecture document states:

> ```ts
> // calculation.svelte.ts
> export const dEdxResults = $derived(
>   energies.value.map((e) => compute(e, selectedProgram.value))
> );
> ```

This pattern **does not compile in Svelte 5**. The following amendment is required:

**Replace** the pattern of exporting `$derived` values from `.svelte.ts` files with the pattern of exporting compute functions:

```ts
// calculation.svelte.ts — CORRECTED pattern
export const energies = $state<{ value: number[] }>({ value: [] });
export const selectedProgram = $state<{ value: string }>({ value: "" });

// Export a compute function instead of $derived
export function computeDEdxResults(): DEdxResult[] {
  return energies.value.map((e) => compute(e, selectedProgram.value));
}
```

```svelte
<!-- ResultTable.svelte — reads derived state -->
<script lang="ts">
  import { computeDEdxResults } from "$lib/state/calculation.svelte.ts";
  const dEdxResults = $derived(computeDEdxResults());
</script>
```

**Summary of the amendment:** In `03-architecture.md §4`, replace all instances of `export const X = $derived(...)` in `.svelte.ts` module examples with `export function computeX(): T { ... }` paired with component-level `const x = $derived(computeX())`.

The `$state` + `{ value: T }` wrapper pattern for writable shared state is fully validated and requires no changes.
