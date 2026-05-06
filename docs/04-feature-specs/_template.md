# Feature: [Feature Name]

> **Status:** Draft v1 (YYYY-MM-DD)
>
> **Related specs:**
>
> - Link to related spec
> - Link to WASM API contract section (if applicable): [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md) §X.Y

---

<!--
  TEMPLATE INSTRUCTIONS (remove this block before shipping the spec):

  This template is mandatory for all Stage 6.9+ feature specs.
  Every section marked [REQUIRED] must be filled in before the spec is handed
  to the implementer. Sections marked [RECOMMENDED] should be filled if
  applicable. Do not hand an incomplete spec to the implementer — it will
  produce incomplete or wrong implementations.

  See docs/ai-logs/2026-05-06-pr427-postmortem.md for the lessons that
  motivated this template.
-->

---

## Goal & User Story

[REQUIRED] One-paragraph goal. Then the canonical user-story format:

**As a** [role],
**I want to** [capability],
**so that** [outcome].

**Example (from advanced-options.md):**

**As a** researcher working with a material sample whose density differs
from the library's built-in value (e.g., PMMA machined to a non-standard density),
**I want to** enter my measured density and have it applied to both the WASM
stopping-power calculation and the keV/µm display conversion,
**so that** the linear stopping power I read off the page corresponds to the
actual sample I am working with.

---

## Acceptance Scenarios

[REQUIRED] Given/When/Then scenarios with **DOM observables** (testable assertions
on actual DOM elements). At least one scenario must be tagged `@smoke`.

### Scenario 1: [Primary scenario — tag @smoke] @smoke

**Given** the user is on `/calculator` with default selection (Proton / Water / Auto-select)
**When** [user action]
**Then**
- DOM: `[data-testid="<testid>"]` text becomes `<expected value>`
- URL: `window.location.search` contains `<param>=<value>`

**Example E2E pattern:**
```typescript
test("density 2× halves CSDA range @smoke", async ({ page }) => {
  // Read baseline CSDA value
  const rangeCell = page.locator('[data-testid="range-cell-0"]');
  const baseline = await expect
    .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 8000 })
    .toBeGreaterThan(0);

  // Change density to 2×
  await page.fill("#density-override", "2");
  await page.blur("#density-override");

  // Assert: range roughly halved (physically: 2× density → ½ range)
  await expect
    .poll(async () => parseFloat((await rangeCell.textContent()) ?? ""), { timeout: 8000 })
    .toBeLessThan(baseline * 0.6);
});
```

### Scenario 2: [URL persistence scenario]

**Given** [starting state]
**When** the user changes [input] to `<value>`
**Then**
- URL contains `<param>=<value>` within 5 s
- Reloading the page preserves [behavior] (DOM observable: `[data-testid="..."]`)

### Scenario 3: [Negative / edge case]

**Given** [starting state]
**When** the user enters an invalid value (e.g., `0` or `-1`)
**Then**
- DOM: `[data-testid="<error-testid>"]` becomes visible with text `<error message>`
- Calculation is NOT triggered (observable: [data-testid="result-table"] value unchanged)

---

## Reactive Triggers Matrix

[REQUIRED] For every new reactive input this feature adds, fill in which contexts
it affects. The implementer must verify every ✅ cell has a wired `$effect` before
declaring `TASK DONE`.

| Option / Input | Calculator (Basic) | Calculator (Advanced) | Plot preview | Plot series | Multi-prog table |
| -------------- | :----------------: | :-------------------: | :----------: | :---------: | :--------------: |
| [Input A]      | ❌ / N/A           | ✅                    | ✅           | ✅          | ✅               |
| [Input B]      | N/A                | ✅                    | N/A          | N/A         | N/A              |

Legend: ✅ = triggers recalculation / update; ❌ = should not affect; N/A = feature
does not apply to this context.

**Example (density override from advanced-options.md):**

| Option             | Calculator (Basic) | Calculator (Advanced) | Plot preview | Plot series | Multi-prog table |
| ------------------ | :----------------: | :-------------------: | :----------: | :---------: | :--------------: |
| Density override   | ❌ (guarded)       | ✅                    | ✅           | ✅          | ✅               |
| Aggregate state    | ❌ (guarded)       | ✅                    | ✅           | ✅          | ✅               |
| Interpolation scale | N/A               | ✅                    | ✅           | ✅          | N/A              |
| MSTAR mode         | N/A                | ✅                    | ✅           | ✅          | N/A              |

---

## URL Round-Trip Table

[REQUIRED if the feature adds URL state] Every URL-encoded field, its allowed
values, its TypeScript type, and the value that is omitted (default).

| Parameter | TypeScript type | Allowed values | Default (omitted) | Encode as |
| --------- | --------------- | -------------- | ----------------- | --------- |
| `param`   | `MyUnionType`   | `"a" \| "b" \| "c"` | `"b"` | `"a"` / `"c"` |

**⚠ Round-trip rule:** Every member of the TS union must be tested in a
`decode(encode(v)) === v` contract test keyed by `satisfies Record<MyUnionType, string>`
so a missing member fails the build. See `src/tests/contracts/url-codec.contract.test.ts`
for the pattern.

**Example (from advanced-options.md):**

| Parameter      | TypeScript type        | Allowed values                  | Default (omitted) | Encode as         |
| -------------- | ---------------------- | ------------------------------- | ----------------- | ----------------- |
| `density`      | `number`               | Any positive float              | unset             | JS number string  |
| `ival`         | `number`               | `0 < I ≤ 10000`                 | unset             | JS number string  |
| `mstar_mode`   | `MstarMode`            | `"a" \| "b" \| "c" \| "d" \| "g" \| "h"` | `"b"` | same as value |
| `interp_scale` | `InterpolationScale`   | `"log" \| "linear"`             | `"log"`           | `"lin-lin"` for linear |
| `interp_method`| `InterpolationMethod`  | `"linear" \| "cubic"`           | `"linear"`        | `"spline"` for cubic |

---

## Cross-Page Parity Checklist

[REQUIRED if feature touches /calculator or /plot] Explicit list of pages this
feature touches and the four pillars that must be present on each.

> **Rule:** See `.opencode/lessons-learned.md` Entries 3 and 9. If any pillar is
> missing, the reviewer must flag it as a blocker.

### Pages affected

- `src/routes/calculator/+page.svelte` — [describe what changes]
- `src/routes/plot/+page.svelte` — [describe what changes]

### Required pillars (for each affected page)

| Pillar | Calculator | Plot |
| ------ | ---------- | ---- |
| Panel gating (`isAdvancedMode.value` guard) | ✅ required | ✅ required |
| URL init (`initAdvancedModeFromUrl()` in URL `$effect`) | ✅ required | ✅ required |
| Persistence (`persistAdvancedOptions()` effect) | ✅ required | ✅ required |
| Reactive-dep snapshot (sync snapshot before `.then()`) | ✅ required | ✅ required |

---

## Test Plan

[REQUIRED]

### Unit tests (Vitest)

- `src/tests/unit/<feature>.test.ts` — [list of test cases]
  - [ ] Happy-path calculation with override
  - [ ] Default behavior when override is absent
  - [ ] Validation edge cases

### Component tests (`@testing-library/svelte`)

- `src/tests/components/<component>.test.ts`
  - **⚠ Note:** If the component uses module-level singleton state (not `$props()`),
    set the singleton in `beforeEach` and reset it in `afterEach`. Do NOT pass a prop
    that the component does not destructure in `$props()` — it will be silently ignored
    (see `.opencode/lessons-learned.md` Entry 6).

### E2E tests (Playwright)

Mark the primary acceptance scenario with `@smoke` (see playwright.config.ts §tag
taxonomy).

- `tests/e2e/<feature>.spec.ts`
  - `@smoke` — primary user flow (change input → DOM observable → URL sync)
  - `@regression` — edge cases, error states, cross-page parity

---

## Out of Scope / Deferred

[REQUIRED] Explicit list of related behavior that is **not** part of this spec.
This prevents scope creep and clarifies what to put in follow-up tickets.

- [Deferred item 1] — reason (e.g., "Custom compound density integration — tracked in
  `custom-compounds.md`")
- [Deferred item 2]

---

## Open Questions

[RECOMMENDED] Questions that must be resolved before implementation begins.
Leave empty if none.

- [ ] [Question 1] — @assignee, due: YYYY-MM-DD
