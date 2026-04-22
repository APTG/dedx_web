# Stage 5: Entity Selection — In Progress

**Status:** GREEN (unit + E2E tests pass) — implementation gaps remain  
**Tests GREEN as of:** 2026-04-22  
**Branch:** `qwen/stage-5-tdd`  
**Stage Lead:** Claude Sonnet 4.6

---

## Summary

TDD test battery written first (RED), then implementation made all tests GREEN:
- 184 unit tests pass (compatibility-matrix, entity-selection-state, entity-selection-comboboxes)
- 35 E2E tests pass (Playwright against real WASM on Calculator + Plot pages)

Core deliverables:
- `src/lib/state/compatibility-matrix.ts` — builds bidirectional matrix from WASM service
- `src/lib/state/entity-selection.svelte.ts` — reactive state with `$state` runes
- `src/lib/components/entity-combobox.svelte` — custom dropdown combobox (see §UI below)
- `src/lib/components/entity-selection-comboboxes.svelte` — wires state → three comboboxes
- `src/routes/calculator/+page.svelte` — uses real WASM service via `getService()`
- `static/wasm/libdedx.mjs` + `static/wasm/libdedx.wasm` — built via `bash wasm/build.sh`

---

## TODO for next session

### 1. Layout fix (HIGH) — spec vs implementation mismatch

**Spec says** (§ Layout — Compact Mode):
> Entity selectors are searchable dropdown comboboxes in a **horizontal flex row**.
> Desktop (≥900px): Particle and Material on the first line; Program on the second line.

**Current implementation** in `entity-selection-comboboxes.svelte:136`:
```html
<div class={cn("space-y-3", className)}>
```

`space-y-3` stacks all three comboboxes vertically. The layout should be a
flex-wrap row: Particle + Material on line 1, Program on line 2, centred at
max-width ~720px. On mobile (<600px) they stack vertically.

**TDD: write tests first** — add E2E viewport tests or component snapshot tests
before changing the Tailwind classes.

### 2. Acceptance criteria with no tests — priority order

Write tests before implementing each item:

| Priority | Criterion | Test type |
|----------|-----------|-----------|
| HIGH | Text filter: alias matching ("proton" → Hydrogen, "alpha" → Helium, Z=6) | E2E + component |
| HIGH | Text filter: greyed-out items matching filter remain visible | component |
| HIGH | Text filter: non-matching items hidden | component |
| MEDIUM | Toggle deselect: clicking selected particle/material deselects | component + E2E |
| MEDIUM | ARIA: aria-selected, aria-disabled, role=searchbox on trigger | component |
| MEDIUM | Notifications when fallback occurs (e.g. "PSTAR does not support Carbon; reset to Auto-select") | component |
| MEDIUM | Program label enrichment: "ICRU 90" not raw "ICRU" | unit + E2E |
| LOW | Electron tooltip on hover | component |
| LOW | Gas-default material visual indicator (icon + badge) | component |
| LOW | Shared state persists across page navigation | E2E |
| LOW | Loading skeleton shown while WASM initializes | E2E |
| LOW | Error state with retry on WASM failure | component |
| LOW | Keyboard navigation (Arrow/Enter/Escape in dropdown) | component |

Full panel mode (Plot page sidebar) — deferred to Stage 6, no tests needed yet.

### 3. Code comments (TODO: author request)

**The owner wants explanatory comments added to the TypeScript source.**
Not "what the code does" (that's in identifiers), but *why*: hidden invariants,
non-obvious constraints, workarounds.

Priority files:
- `src/lib/state/entity-selection.svelte.ts` — the `resolveAutoSelect` function
  has a multi-branch priority chain (ICRU 90 → PSTAR for proton, etc.) that
  directly encodes the spec §7 resolution chain. A comment citing the spec
  section would help future readers.
- `src/lib/state/compatibility-matrix.ts` — why `EXCLUDED_FROM_UI` contains
  id=9 (DEDX_ICRU internal selector, covered by Auto-select; showing both
  would confuse users).
- `src/lib/components/entity-combobox.svelte` — why `hidden={!open}` instead
  of `{#if open}`: items must be in the DOM for `getByText` to find them
  synchronously in jsdom tests.
- `src/lib/components/entity-combobox.svelte` — why `$effect` registers a
  document-level click listener: the outside-click close behavior requires
  event delegation from document root since the dropdown is a sibling of the
  trigger, not a child.

---

## UI component: shadcn-svelte vs custom combobox

**ADR 005** adopted shadcn-svelte + Bits UI for all interactive components.
`bits-ui` is in `package.json`. However, `entity-combobox.svelte` is a
**custom implementation** (165 lines), not a shadcn-svelte/Bits UI component.

**Why the custom component was written:**

Bits UI's `<Combobox>` uses `onpointerdown`/`onpointerup` internally for item
selection. jsdom (Vitest's DOM environment) does not dispatch pointer events
when you call `fireEvent.click()` from `@testing-library/svelte`. This meant
the component tests couldn't select items.

The custom implementation uses `onclick` directly, which jsdom handles
correctly. This unblocked all 184 unit tests.

**Consequence — what the custom combobox is missing vs Bits UI:**

| Feature | Bits UI combobox | Current custom combobox |
|---------|-----------------|------------------------|
| Keyboard navigation (Arrow/Enter/Escape) | ✅ built in | ❌ not implemented |
| Focus management (auto-focus search input on open) | ✅ | ❌ |
| aria-activedescendant tracking | ✅ | ❌ |
| Outside-click close | ✅ | ✅ (manual `$effect`) |
| WCAG 2.1 AA keyboard compliance | ✅ | ❌ |

**Options for next session:**

A. **Keep custom, add keyboard support manually** — add `onkeydown` handler to
   the listbox div; intercept Arrow/Enter/Escape. Straightforward but duplicates
   what Bits UI already does.

B. **Switch back to Bits UI, fix test strategy** — use `fireEvent.pointerdown` +
   `fireEvent.pointerup` instead of `fireEvent.click` in tests, or use
   `@testing-library/user-event` which fires the full pointer event sequence.
   This restores full ARIA/keyboard behaviour and stays consistent with ADR 005.

**Recommendation:** Option B. The ADR was right — accessible keyboard behaviour
is non-trivial to reimplement. Use `userEvent.click()` from `@testing-library/user-event`
(which fires pointer events) in component tests, then restore Bits UI's
`<Combobox>` or a shadcn-svelte combobox primitive. Write the keyboard tests
first (RED), then switch the implementation.

---

## Known spec deviations (accepted for now)

| Spec requirement | Actual behaviour | Why accepted |
|-----------------|-----------------|--------------|
| Electron appears greyed out in particle list | Electron absent — ESTAR returns empty particle list from real WASM | libdedx v1.4.0 doesn't populate electron in the ion list; spec was written before runtime verification. E2E test documents actual behavior. |
| Notifications on auto-fallback | Not implemented | No notification system yet (Sonner/toast deferred to Stage 8 per ADR 005 §Integration plan) |

---

## References

- [Entity selection spec](../04-feature-specs/entity-selection.md) — acceptance criteria
- [ADR 005 — shadcn-svelte + Bits UI](../decisions/005-shadcn-svelte-components.md)
- [Stage 5 TDD RED phase log](../ai-logs/2026-04-22-stage5-tdd-entity-selection.md)
- [Stage 5 component test log](../ai-logs/2026-04-22-stage5-tdd-component-tests.md)
