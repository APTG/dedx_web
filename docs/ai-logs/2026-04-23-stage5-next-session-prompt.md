# Stage 5 Next Session Prompt

**Branch:** `qwen/stage-5-tdd`  
**Date written:** 2026-04-23  
**Purpose:** Self-contained briefing for next implementation session

---

## Context: What Has Been Done

Stage 5 entity selection is **GREEN** on this branch:

- 184 unit tests pass (compatibility-matrix, entity-selection-state, entity-selection-comboboxes)
- 35 E2E tests pass (Playwright against real WASM on Calculator + Plot pages)

Core files:
- `src/lib/state/compatibility-matrix.ts` — bidirectional matrix built at WASM init
- `src/lib/state/entity-selection.svelte.ts` — reactive state with `$state` runes
- `src/lib/components/entity-combobox.svelte` — **custom** 165-line combobox (NOT shadcn)
- `src/lib/components/entity-selection-comboboxes.svelte` — wires state → three comboboxes (Calculator page)
- `src/lib/components/entity-selection-panels.svelte` — full panel mode (Plot page, currently shows "coming soon")
- `src/routes/calculator/+page.svelte` — uses real WASM service via `getService()`

The tests are GREEN but the implementation has bugs and gaps described below.

---

## Session Goals (Priority Order)

### PRIORITY 1 — Fix Bugs (No New Tests Needed; Bugs Covered by Existing Tests)

#### Bug 1: `resolveAutoSelect` variable scope error

**File:** `src/lib/state/entity-selection.svelte.ts:62`

The variable `particlePrograms` is declared inside the `else if (particleId === 6)` block but referenced in the next `else if` clause, where it is out of scope. This means the "other heavy ions → ICRU 73" resolution path never runs.

**Current (broken):**
```typescript
} else if (particleId === 6) {
  const particlePrograms = matrix.programsByParticle.get(particleId);
  if (particlePrograms?.has(90)) return 90;
  if (particlePrograms?.has(73)) return 73;
  if (particlePrograms?.has(72)) return 72;
} else if (particlePrograms) {   // ← BUG: not in scope; condition always false
  const particlePrograms = matrix.programsByParticle.get(particleId);
  if (particlePrograms?.has(73)) return 73;
  if (particlePrograms?.has(72)) return 72;
}
```

**Fix:** Change `else if (particlePrograms)` to `else`. Consider also simplifying with a data-driven lookup table instead of hardcoded if-else chains with magic IDs — see §Simplifications below.

#### Bug 2: Combobox shows only compatible particles (hides incompatible instead of greying out)

**File:** `src/lib/components/entity-selection-comboboxes.svelte` — `particleItems` and `materialItems` derived state

The component maps over `state.availableParticles` (already filtered to compatible ones). The spec requires ALL particles to be shown, with incompatible ones greyed out. The `isAvailable` flag is computed but never used correctly:

```typescript
// BUG: maps over availableParticles → incompatible particles never shown
const particleItems = $derived.by(() => {
  return state.availableParticles.map((particle) => {
    const isAvailable = state.availableParticles.some(p => p.id === particle.id); // always true!
    return { entity: particle, available: particle.id !== 1001, ... }; // isAvailable ignored
  });
});
```

**Fix:**
1. Expose `allParticles` and `allMaterials` on the `EntitySelectionState` interface in `entity-selection.svelte.ts` (the compatibility matrix already has them).
2. Map over `allParticles`/`allMaterials` instead of `availableParticles`/`availableMaterials`.
3. Set `available: state.availableParticles.some(p => p.id === particle.id) && particle.id !== 1001`.

Also affects `entity-selection-panels.svelte` (Bug 3 below).

#### Bug 3: `entity-selection-panels.svelte` accesses non-existent interface properties

**File:** `src/lib/components/entity-selection-panels.svelte:24`

```typescript
const particleItems = $derived.by(() => {
  return state.allParticles.map(...); // ← allParticles not on EntitySelectionState interface
```

This is a latent bug (Plot page shows "coming soon"). Fix it together with Bug 2 — once `allParticles`/`allMaterials` are added to the interface both bugs are resolved at the same time.

#### Bug 4: Auto-select disappears from program dropdown once user picks a concrete program

**File:** `src/lib/components/entity-selection-comboboxes.svelte` — `programItems` derived state

```typescript
const autoSelect = state.selectedProgram;
if (autoSelect.id === -1) {        // ← only added when currently selected
  result.push({ ... label: "Auto-select →", ... });
}
```

**Fix:** Always push Auto-select at the top of the program list regardless of `state.selectedProgram.id`. The selected state is tracked separately via `selectedId` prop on the combobox.

---

### PRIORITY 2 — Install `@testing-library/user-event` and Switch Component Library

The current `entity-combobox.svelte` is a custom 165-line component that bypasses shadcn-svelte and Bits UI entirely. The reason was a jsdom compatibility issue: Bits UI uses `onpointerdown`/`onpointerup` for item selection, and jsdom's `fireEvent.click()` does not dispatch pointer events.

**The fix is in the test layer, not the component layer:**

```
pnpm add -D @testing-library/user-event
```

Then convert component tests from:
```typescript
fireEvent.click(item);
await new Promise(r => setTimeout(r, 50)); // timing hack
```
to:
```typescript
const user = userEvent.setup();
await user.click(item);
```

`userEvent.click()` fires the full pointer event sequence (pointerdown → pointerup → click), which makes Bits UI work correctly in jsdom.

**After the test fix, replace `entity-combobox.svelte`** with a shadcn-svelte Combobox built on Bits UI primitives (per ADR 005). This gives keyboard navigation, `aria-activedescendant` tracking, and focus management for free — the custom component does none of these.

Reference the shadcn-svelte source at `vendor/shadcn-svelte/` (local git submodule) and Bits UI source at `vendor/bits-ui/`.

The heterogeneous flat array pattern (discriminated union `SectionHeader | EntityItem`) in the derived state was a workaround for the custom combobox. Bits UI's `<Combobox.Group>` accepts group labels natively — replace the flat array with grouped items once the component is switched.

**TDD: write keyboard/ARIA tests first (RED), then replace the component.**

---

### PRIORITY 3 — Fix Layout (Calculator Page)

**File:** `src/lib/components/entity-selection-comboboxes.svelte:136`

Current:
```html
<div class={cn("space-y-3", className)}>
```

`space-y-3` stacks all three comboboxes vertically. The spec (§ Layout — Compact Mode) requires:

> Entity selectors are searchable dropdown comboboxes in a **horizontal flex row**.
> Desktop (≥900px): Particle and Material on the first line; Program on the second line.
> Particle/Material comboboxes ~240px wide; Program ~180px (narrower — less frequently used).
> Max-width ~720px, centered horizontally (`mx-auto`).
> Mobile (<600px): stack vertically, each full width.

**Fix:** Replace `space-y-3` with `flex flex-wrap gap-3` and set `max-width` + `mx-auto` on the wrapper. Add responsive breakpoints for mobile stacking.

**Write viewport E2E tests first (RED)** — check layout at ≥900px and <600px before changing classes.

---

### PRIORITY 4 — Fill Missing Test Coverage (TDD: RED First)

The acceptance criteria from `docs/04-feature-specs/entity-selection.md` that have NO tests yet, in priority order:

| Priority | Missing Test | Where to Add |
|----------|--------------|--------------|
| HIGH | Text filter: alias matching ("proton" → Hydrogen, "alpha" → Helium) | component + E2E |
| HIGH | Text filter: greyed-out items matching filter remain **visible** (not hidden) | component |
| HIGH | Text filter: non-matching items hidden | component |
| HIGH | Toggle deselect: clicking selected particle/material deselects it | component + E2E |
| HIGH | Greyed-out items shown in-place (not removed from DOM/list) | component |
| MEDIUM | ARIA: `aria-selected`, `aria-disabled`, `role="searchbox"` on trigger | component |
| MEDIUM | Program label enrichment: "ICRU 90" not raw "ICRU" in display | unit + E2E |
| MEDIUM | Auto-select always at top of program list (even after selecting concrete program) | component |
| MEDIUM | "Reset all" link restores Proton / Water / Auto-select | E2E |
| LOW | Electron appears greyed-out with tooltip (currently absent from WASM data) | component (mock) |
| LOW | Gas-default material visual indicator (icon + badge) | component |
| LOW | Keyboard navigation (Arrow/Enter/Escape in dropdown list) | component (after shadcn switch) |
| LOW | Screen reader count announcement ("3 of 12 particles available") | component |
| LOW | Loading skeleton shown while WASM initializes | E2E |
| LOW | Error state with retry on WASM failure | component |
| LOW | Shared state persists across page navigation (Calculator → Plot → Calculator) | E2E |

---

### PRIORITY 5 — Add Explanatory Code Comments

The owner wants explanatory WHY comments (not what-the-code-does) in the TypeScript source. Priority files:

#### `src/lib/state/entity-selection.svelte.ts` — `resolveAutoSelect` function

Add a comment citing the spec §7 resolution chain:
```
// Resolution chain per entity-selection.md §"Auto-select program resolution":
// Proton → ICRU 90 (id=90) → PSTAR (id=1)
// Alpha → ICRU 90 → ICRU 49 (id=7)
// Carbon → ICRU 90 → ICRU 73 (id=6) → ICRU 73old (id=5)
// Other heavy ions → ICRU 73 → ICRU 73old
// Electron (id=1001) → N/A (ESTAR not implemented)
```

#### `src/lib/state/compatibility-matrix.ts` — `EXCLUDED_FROM_UI`

```typescript
// DEDX_ICRU (id=9) is the internal auto-selector in libdedx — it picks the best
// ICRU dataset for the current particle/material at the C layer. The frontend
// implements its own "Auto-select" entry that resolves the same chain, making
// DEDX_ICRU redundant as a UI option. Showing both would confuse users.
const EXCLUDED_FROM_UI = new Set([9]);
```

#### `src/lib/components/entity-combobox.svelte` — `hidden={!open}`

```
// Content always mounted (not {#if open}) so getByText finds items synchronously
// in jsdom tests without waiting for DOM insertion.
```

#### `src/lib/components/entity-combobox.svelte` — `$effect` document listener

```
// Click-outside-to-close requires listening from document root: the dropdown
// is a sibling of the trigger (not a child), so a click listener on rootEl
// alone would fire for the trigger too and toggle open/close incorrectly.
```

---

### PRIORITY 6 — Refactor: Extract Shared Test Fixture

`MockLibdedxService` is copy-pasted three times across:
- `src/tests/unit/compatibility-matrix.test.ts`
- `src/tests/unit/entity-selection-state.test.ts`
- `src/tests/unit/entity-selection-comboboxes.test.ts`

`MockLibdedxServiceWithElectron` (electron variant) appears twice.

**Extract to:** `src/tests/fixtures/mock-libdedx-service.ts`

Export:
```typescript
export class MockLibdedxService { ... }
export class MockLibdedxServiceWithElectron extends MockLibdedxService { ... }
```

Import in all three test files. This also surfaces any data discrepancies between the three copies (the current copies have slightly different particle/material data, which may hide bugs).

---

## Spec Details Worth Knowing (Compact Mode)

From `docs/04-feature-specs/entity-selection.md` § Compact Mode:

- Material dropdown uses **section headers** within a single dropdown list (Elements / Compounds), NOT two side-by-side columns (too narrow for a combobox)
- Program combobox trigger shows resolved label: `Auto-select → ICRU 90`
- ARIA on combobox trigger: `role="combobox"`, `aria-expanded`, `aria-activedescendant`
- ARIA on dropdown: `role="listbox"`, items `role="option"`, `aria-selected`, `aria-disabled="true"` on greyed-out

## Spec Details Worth Knowing (Full Panel Mode — Stage 6)

From the spec § Full Panel Mode (Plot Page):
- Two-column sub-grid for Particle + Material; Program below at full width
- Material panel: two **independently scrollable** sub-lists (Elements / Compounds) with ONE shared filter input
- Elements: IDs 1–98 sorted by ID; Compounds: IDs 99+ sorted alphabetically
- `aria-controls` on the filter references **both** sub-list IDs

Full panel mode (`entity-selection-panels.svelte`) is deferred to Stage 6. Fix Bug 3 now (interface mismatch) but do not implement the full panel layout yet.

---

## Known Accepted Spec Deviations

| Spec requirement | Actual behaviour | Status |
|-----------------|-----------------|--------|
| Electron greyed out in particle list | Electron absent (WASM returns empty `getParticles(ESTAR)`) | Accepted; E2E test documents actual behavior |
| Notifications on auto-fallback | Not implemented | Deferred to Stage 8 (Sonner/toast per ADR 005) |

---

## Simplification Opportunity: `resolveAutoSelect`

The current if-else chain with magic particle IDs and program IDs is error-prone (Bug 1 is evidence). Consider replacing with a data-driven priority table after fixing Bug 1:

```typescript
// Priority table: particleId → ordered list of program IDs to try
const AUTO_SELECT_CHAIN: Record<number, number[]> = {
  [PROTON_ID]:   [90, 1],       // ICRU 90 → PSTAR
  [HELIUM_ID]:   [90, 7],       // ICRU 90 → ICRU 49
  [CARBON_ID]:   [90, 6, 5],    // ICRU 90 → ICRU 73 → ICRU 73old
};
const DEFAULT_CHAIN = [6, 5];   // other heavy ions: ICRU 73 → ICRU 73old

function resolveAutoSelect(matrix, particleId, materialId): number | null {
  if (particleId === ELECTRON_ID) return null; // ESTAR not implemented
  const chain = AUTO_SELECT_CHAIN[particleId] ?? DEFAULT_CHAIN;
  const progs = matrix.programsByParticle.get(particleId);
  for (const programId of chain) {
    if (progs?.has(programId)) return programId;
  }
  return null;
}
```

---

## Real WASM Program IDs (for Reference)

From runtime verification (Stage 2.6):

| Program | ID |
|---------|-----|
| ASTAR | 1 |
| PSTAR | 2 |
| ESTAR | 3 (returns `DEDX_ERR_ESTAR_NOT_IMPL` for all calculations) |
| MSTAR | 4 |
| ICRU73_OLD | 5 |
| ICRU73 | 6 |
| ICRU49 | 7 |
| ICRU (DEDX_ICRU, excluded from UI) | 9 |
| DEFAULT | 100 |
| BETHE_EXT00 | 101 |

---

## Files to Read Before Starting

In order:
1. `docs/04-feature-specs/entity-selection.md` — full acceptance criteria (source of truth)
2. `src/lib/state/entity-selection.svelte.ts` — state + `resolveAutoSelect` (Bug 1)
3. `src/lib/components/entity-selection-comboboxes.svelte` — layout + Bug 2, Bug 4
4. `src/lib/components/entity-selection-panels.svelte` — Bug 3
5. `src/lib/components/entity-combobox.svelte` — custom combobox to be replaced
6. `src/tests/unit/entity-selection-comboboxes.test.ts` — tests to update when switching to user-event
7. `vendor/shadcn-svelte/` — reference for shadcn-svelte Combobox component template
