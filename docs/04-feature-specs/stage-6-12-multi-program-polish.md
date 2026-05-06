# Feature: Multi-Program Polish (Stage 6.12)

> **Status:** Draft v1 (2026-05-06)
>
> **Behavioral detail:** [`multi-program.md`](multi-program.md) §§5 (Drag-and-Drop
> Column Reordering) and §6 (Delta/% Difference Tooltip) (Final v3)
>
> **Related specs:**
>
> - Full multi-program spec: [`multi-program.md`](multi-program.md)
> - Export: [`export.md`](export.md) §3, §6.3 (advanced multi-program CSV/PDF)
> - WASM API contract: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md) §3

---

<!--
  Stage 6.12 adds two polish features to the already-shipped multi-program
  comparison table (6.3):

    - Drag-and-drop column reordering, synced across STP + CSDA groups
    - Delta / % difference tooltip on hover over non-default program cells

  These features were explicitly deferred from Stage 6.3 (see
  docs/ai-logs/2026-05-04-stage6-multi-program.md).

  Out of scope: multi-program CSV/PDF layout changes (part of 6.12 per the
  redesign plan §6 Stage 6.12 notes but noted below as deferred pending
  export.md clarification).
-->

---

## Goal & User Story

**As a** researcher comparing stopping powers from three programs (ICRU 90,
PSTAR, Bethe), who finds the default column order inconvenient for their
analysis,
**I want to** drag program column headers to reorder them,
**so that** I can place the two programs I am comparing side-by-side, with the
order reflected in the URL so it persists when I share the link.

**As a** researcher looking at a multi-program comparison table,
**I want to** hover over any non-default program's cell and see how its value
differs from the reference program in absolute and relative terms,
**so that** I can immediately assess the magnitude of inter-program differences
without having to compute them manually.

---

## Acceptance Scenarios

### Scenario 1: Drag column to new position — both groups update @smoke

**Given** the user is on `/calculator` in advanced mode with three programs
selected: ICRU 90 (id=3, default), PSTAR (id=5), and Bethe (id=8)

> For concreteness: assume the initial order is [ICRU 90, PSTAR, Bethe] in
> both the Stopping Power and CSDA Range groups.

**When** the user drags `[data-testid="mp-drag-handle-5"]` past
`[data-testid="mp-drag-handle-8"]` and drops it

**Then**

- DOM: the PSTAR column appears **after** the Bethe column in the Stopping
  Power group — `[data-testid="mp-column-header-5"]` has a higher DOM
  index than `[data-testid="mp-column-header-8"]` within the STP group
- DOM: the same order is mirrored in the CSDA Range group
- URL: `programs=` encodes IDs in new order within ≤ 500 ms

```typescript
test("drag-and-drop reorder syncs across STP and CSDA groups @smoke", async ({ page }) => {
  await page.goto("/calculator?advanced=1&particle=1&material=276&programs=3,5,8");
  await page.waitForSelector('[data-testid="mp-column-header-5"]');

  // Drag program 5 after program 8
  const handle5 = page.locator('[data-testid="mp-drag-handle-5"]');
  const target8 = page.locator('[data-testid="mp-drag-handle-8"]');
  await handle5.dragTo(target8);

  // Verify order in STP group
  const stpHeaders = page.locator('[data-testid^="mp-column-header-"]');
  const stpOrder = await stpHeaders.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-testid"))
  );
  const idx5 = stpOrder.indexOf("mp-column-header-5");
  const idx8 = stpOrder.indexOf("mp-column-header-8");
  expect(idx5).toBeGreaterThan(idx8);

  // Same order in CSDA group
  const csdaHeaders = page.locator('[data-testid^="mp-csda-column-header-"]');
  const csdaOrder = await csdaHeaders.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-testid"))
  );
  expect(csdaOrder.indexOf("mp-csda-column-header-5"))
    .toBeGreaterThan(csdaOrder.indexOf("mp-csda-column-header-8"));

  // URL updated
  await expect
    .poll(() => page.url(), { timeout: 3000 })
    .toContain("programs=");
});
```

---

### Scenario 2: Column order persists on reload @regression

**Given** the user has reordered columns to [ICRU 90, Bethe, PSTAR] and the
URL has updated to reflect the new order

**When** the user reloads the page

**Then**

- DOM: columns appear in [ICRU 90, Bethe, PSTAR] order (not the insertion order)
- No recalculation flicker visible (order is applied before first render)

---

### Scenario 3: Default program cannot be dragged @regression

**Given** the user is on `/calculator` with multi-program mode active and
ICRU 90 as the default program

**When** the user attempts to drag `[data-testid="mp-drag-handle-default"]`

**Then**

- The default program column does not move
- The drag handle for the default program is either absent or visually
  disabled (`cursor: not-allowed`)

---

### Scenario 4: Delta tooltip appears on hover over non-default cell @smoke

**Given** the user is on `/calculator` in advanced mode with ICRU 90 (default)
and PSTAR selected, and results are populated

**When** the user hovers over a non-default PSTAR stopping-power cell that
has a numeric value (not `—`)

**Then**

- DOM: `[data-testid="mp-delta-tooltip"]` becomes visible
- The tooltip text matches the pattern `"Δ = {number} {unit} ({sign}{pct}% vs ICRU 90)"`
  (e.g., `"Δ = −0.84 keV/µm (−1.8% vs ICRU 90)"`)

```typescript
test("delta tooltip shows on hover over non-default cell @smoke", async ({ page }) => {
  await page.goto("/calculator?advanced=1&particle=1&material=276&programs=3,5");
  // Wait for PSTAR column to have a numeric value
  await expect
    .poll(async () => {
      const cell = await page.locator('[data-testid="mp-stp-cell-0-5"]').textContent();
      return parseFloat(cell ?? "0");
    }, { timeout: 10000 })
    .toBeGreaterThan(0);

  await page.locator('[data-testid="mp-stp-cell-0-5"]').hover();
  const tooltip = page.locator('[data-testid="mp-delta-tooltip"]');
  await expect(tooltip).toBeVisible({ timeout: 3000 });
  await expect(tooltip).toContainText("Δ =");
  await expect(tooltip).toContainText("%");
});
```

---

### Scenario 5: No tooltip on default program cells @regression

**Given** the user is in multi-program mode with ICRU 90 as default

**When** the user hovers over a default ICRU 90 stopping-power cell

**Then**

- DOM: `[data-testid="mp-delta-tooltip"]` is **not** visible

---

### Scenario 6: No tooltip on error cells @regression

**Given** the user is in multi-program mode and one program shows `—` in a cell

**When** the user hovers over that `—` cell

**Then**

- DOM: `[data-testid="mp-delta-tooltip"]` is **not** visible

---

## Reactive Triggers Matrix

Drag-and-drop reordering and delta tooltips are **UI-state** changes that do
not trigger recalculation.

| Input / State | Calculator (Basic) | Calculator (Advanced) | Multi-prog table |
| ------------- | :----------------: | :-------------------: | :--------------: |
| `programDisplayOrder` (drag-drop) | N/A | ❌ (no recalculation; column reorder only) | ✅ columns re-rendered |
| Tooltip visibility (hover) | N/A | ❌ | ❌ (client-side only; no WASM call) |

Legend: ✅ = UI update triggered; ❌ = no recalculation; N/A = not applicable.

> **Note:** `programDisplayOrder` changes do update the URL, but they do not
> trigger `calculateMulti()`. The existing calculation results are simply
> re-rendered in the new column order.

---

## URL Round-Trip Table

Drag-and-drop order is persisted via the existing `programs` URL parameter
(already implemented in 6.3). This spec confirms the round-trip contract
for the reordering case.

| Parameter | TypeScript type | Allowed values | Default (omitted) | Encode as |
| --------- | --------------- | -------------- | ----------------- | --------- |
| `programs` | `number[]` | Ordered list of program IDs | Default program only | Comma-separated integers in display order |

**⚠ Round-trip rule:** After drag-and-drop, `encode(decode(url)) === url`
must hold for the `programs` parameter. Verify in a contract test in
`src/tests/contracts/url-codec.contract.test.ts`.

---

## Cross-Page Parity Checklist

> Multi-program comparison is **Calculator-only** (no Plot-page multi-program
> table). All four Advanced Mode pillars apply only to the Calculator page.

### Pages affected

- [src/routes/calculator/+page.svelte](../../src/routes/calculator/+page.svelte) —
  column drag handles added to program sub-headers; delta tooltip wired to
  non-default result cells.

### Required pillars

| Pillar | Calculator |
| ------ | ---------- |
| Panel gating (`isAdvancedMode.value` guard — drag handles absent in Basic mode) | ✅ required |
| URL init (`programs` order applied on page load before first render) | ✅ required |
| Persistence (`programs` URL param updated within 500 ms of drop) | ✅ required |
| Reactive-dep snapshot (order state read synchronously; no `.then()` dependency) | ✅ required |

---

## Test Plan

### Unit tests (Vitest)

- `src/tests/unit/multi-program-order.test.ts`
  - [ ] `reorderPrograms([1, 2, 3], fromIndex=1, toIndex=2)` → `[1, 3, 2]`
  - [ ] Default program (index 0) cannot be moved: `reorderPrograms([1, 2, 3], fromIndex=0, ...)` → unchanged
  - [ ] URL encode: `programs=[3, 8, 5]` → `"programs=3,8,5"`
  - [ ] URL decode: `"programs=3,8,5"` → `[3, 8, 5]` (order preserved)

- `src/tests/unit/delta-tooltip.test.ts`
  - [ ] `computeDelta(value=44.92, defaultValue=45.76)` → `{ delta: -0.84, pct: -1.836... }`
  - [ ] Formatting: `formatDelta(-0.84, -1.84, "keV/µm", "ICRU 90")` → `"Δ = −0.84 keV/µm (−1.8% vs ICRU 90)"`
  - [ ] `formatDelta(0, 0, ...)` → no tooltip shown (guard against divide-by-zero)
  - [ ] CSDA range delta uses the range unit, not the STP unit

### Component tests (`@testing-library/svelte`)

- `src/tests/components/MultiProgramTable.test.ts`
  - [ ] Drag-handle elements absent when `isAdvancedMode.value === false`
  - [ ] After simulated reorder, CSDA group column order matches STP group order
  - ⚠ Use `beforeEach` / `afterEach` to set and reset `isAdvancedMode.value`
    if it is a module-level singleton

### E2E tests (Playwright)

- `tests/e2e/multi-program-polish.spec.ts`
  - `@smoke` — drag column, verify both groups reorder (Scenario 1)
  - `@smoke` — delta tooltip shows on hover (Scenario 4)
  - `@regression` — order persists on reload (Scenario 2)
  - `@regression` — default column not draggable (Scenario 3)
  - `@regression` — no tooltip on default cells (Scenario 5)
  - `@regression` — no tooltip on error `—` cells (Scenario 6)

---

## Out of Scope / Deferred

- **Multi-program CSV / PDF export** with drag-reordered columns — the
  redesign plan §6 Stage 6.12 notes mention this but export.md §3 and §6.3
  do not fully specify the multi-program advanced export format. This is
  deferred until `export.md` is updated or handled in Stage 6.11 follow-up.
- **Touch drag-and-drop** (long-press + drag on mobile) — `multi-program.md`
  §9 notes this is required; it is included in the behavioral spec but testing
  on mobile viewports is a Stage 7 responsibility.
- **Keyboard reordering** (Alt+← / Alt+→) — behavioral spec in
  `multi-program.md` §5; Playwright keyboard tests deferred to Stage 7
  accessibility pass.
- **Column show/hide** (`Columns…` button) — already implemented in 6.3;
  this spec does not change that behavior.

---

## Open Questions

None. All behavioral detail is in `multi-program.md` Final v3.

---

## Appendix: data-testid Reference

| `data-testid` value | Element | Notes |
| ------------------- | ------- | ----- |
| `mp-drag-handle-{programId}` | Drag handle on program column sub-header | Absent for default program; absent in Basic mode |
| `mp-drag-handle-default` | Drag handle on default program (for testing absence) | Must be absent or `cursor: not-allowed` |
| `mp-column-header-{programId}` | Column header cell in STP group | Used to verify DOM order after drag |
| `mp-csda-column-header-{programId}` | Column header cell in CSDA group | Mirror of STP group; must stay in sync |
| `mp-stp-cell-{rowIndex}-{programId}` | Stopping-power result cell | Hover triggers delta tooltip |
| `mp-csda-cell-{rowIndex}-{programId}` | CSDA range result cell | Hover triggers delta tooltip |
| `mp-delta-tooltip` | Delta/% tooltip element | Visible on hover; must be absent for default + error cells |
