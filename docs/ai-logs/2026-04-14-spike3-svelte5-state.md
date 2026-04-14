# 2026-04-14 — Spike 3: Module-Level `$state` Reactivity in `.svelte.ts`

## Session Narrative

### Prompt 1: Run Spike 3 (svelte5-state) prototype
**AI response**: opencode (with Qwen3.5-397B) scaffolded a fresh SvelteKit 2 +
Svelte 5 project in `prototypes/svelte5-state/` on branch `spike/svelte5-state`.
The agent implemented:

- `src/lib/state/counter.svelte.ts` — module-level `$state` with `{ value: T }`
  wrapper for `selectedValue`, `inputText`, `items`; attempted `$derived` exports
  for `parsedNumbers` and `computedResult`.
- `src/lib/state/ui.svelte.ts` — module-level `$state` for `isAdvancedMode` and
  `computationCount`.
- `src/lib/InputPanel.svelte` — writer component mutating shared state.
- `src/lib/ResultPanel.svelte` — reader component with debounced `$effect`.
- `src/routes/+page.svelte` — composes both panels.
- `VERDICT.md` — 7 of 9 acceptance criteria PASS; criteria 2 and 3 FAIL.

### Key finding: `$derived` cannot be exported from `.svelte.ts` modules

Svelte 5 raises a compiler error when a `.svelte.ts` module exports a `$derived`
value:

> `Cannot export derived state from a module. To expose the current derived
> value, export a function returning its value`
> (https://svelte.dev/e/derived_invalid_export)

The architecture document (`03-architecture.md §4`) contained two such exports:

```ts
// selection.svelte.ts — INVALID in Svelte 5
export const resolvedProgramId = $derived(autoSelectProgram(...));

// calculation.svelte.ts — INVALID in Svelte 5
export const parsedEnergies = $derived(parseEnergyInput(...));
```

### Working alternative (validated in Spike 3)

Export compute functions instead of `$derived` values. Each component that
needs the computed value wraps the call in a local `$derived`:

```ts
// .svelte.ts module — export a compute function
export function computeParsedEnergies(): number[] {
  return parseEnergyInput(energyInputText.value, energyUnit.value);
}

// Component — local $derived wraps the call
const parsedEnergies = $derived(computeParsedEnergies());
```

Calling a compute function inside `$derived` or `$effect` registers its
`$state` dependencies with Svelte's tracker automatically. The behavior is
functionally identical to the originally specified `$derived` export pattern.

### Prompt 2 (implicit): verify and commit
**AI response**: committed the prototype as `chore: prototype — svelte5-state`
on branch `spike/svelte5-state`.

## Tasks

### Spike 3 — Module-Level `$state` Reactivity in `.svelte.ts`
- **Status**: completed (7/9 PASS; criteria 2 & 3 FAIL with validated amendment)
- **Stage**: 2.5
- **Branch**: `spike/svelte5-state`
- **Files changed**:
  - `prototypes/svelte5-state/src/lib/state/counter.svelte.ts`
  - `prototypes/svelte5-state/src/lib/state/ui.svelte.ts`
  - `prototypes/svelte5-state/src/lib/InputPanel.svelte`
  - `prototypes/svelte5-state/src/lib/ResultPanel.svelte`
  - `prototypes/svelte5-state/src/routes/+page.svelte`
  - `prototypes/svelte5-state/VERDICT.md`
  - (scaffolding: `package.json`, `pnpm-lock.yaml`, `svelte.config.js`, etc.)
- **Decision**: The `$state` + `{ value: T }` wrapper pattern for writable
  shared state is fully validated — criteria 1, 5, 6, 7 PASS. Cross-component
  reactivity, mode toggles, array append, and array bulk replacement all work
  correctly via module-level `$state`.
- **Decision**: The debounced `$effect` pattern (setTimeout + cleanup return)
  works correctly — criterion 4 PASS. Computation count increments once per 300ms
  quiet period, not on every keystroke.
- **Decision**: SSG prerender with `@sveltejs/adapter-static` works correctly for
  `.svelte.ts` state modules — criterion 9 PASS.
- **Amendment required**: `03-architecture.md §4` must replace `export const X = $derived(...)` 
  patterns with `export function computeX(): T { ... }` paired with
  component-level `const x = $derived(computeX())`. Applied in the same session.
- **Verdict**: Critical state pattern validated; compute-function alternative is
  functionally equivalent to the originally specified `$derived` export pattern.
  Architecture amended in `03-architecture.md §4`.
