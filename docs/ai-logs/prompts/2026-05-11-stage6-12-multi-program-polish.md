# opencode task prompt — 2026-05-11

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation (TDD)
> **Branch:** `qwen/stage6-12-multi-program-polish`
> **MCPs needed:** playwright, tailwind, svelte
> **TDD rule:** Write the failing test(s) first, then minimal impl. Fix all lint/type errors before committing.

---

## Meta-prompt

Stage 6.12 adds the two features explicitly deferred from Stage 6.3 to keep
the initial multi-program PR scope manageable:

1. **Delta / % difference tooltip** — hovering or focusing a non-default
   program's result cell shows a tooltip: "Δ = {absolute} ({pct}% vs
   {default program name})". Default program cells and error ("—") cells never
   show a tooltip. Must be keyboard-accessible via `aria-describedby`.

2. **Drag-and-drop column reordering** — users can drag additional-program
   sub-header cells to change the column order within both the STP and CSDA
   groups simultaneously. The default program column is pinned at first
   position. Keyboard alternative: Alt+← / Alt+→ on a focused column header.

The `reorderPrograms()` method in `multi-program.svelte.ts` is **already
implemented and tested** — only the UI wiring is missing. No WASM work, no
new state design, no page-level changes beyond result-table wiring. Both
features land in `src/lib/components/result-table.svelte`.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 runes, build commands, AI logging rules.
2. `.opencode/lessons-learned.md` — **MUST READ before writing any code.**
   Pay special attention to:
   - Entry 1 (snapshot reactive deps synchronously before any async call)
   - Entry 2 (nested object mutations don't re-trigger effects via ref read)
   - Entry 25 (`$state(null)` nullable-wrap pattern — reminder for $state idiom)
   - Entry 27 (E2E coverage must mirror spec, not the easier implementation)
3. `docs/04-feature-specs/multi-program.md` Final v3 — read these sections fully:
   - § "Delta / % Difference Tooltip"
   - § "Drag-and-Drop Column Reordering"
   - § Accessibility (keyboard reorder announce, delta tooltip via `aria-describedby`)
   - § Acceptance Criteria — subsections "Drag-and-Drop Column Reordering" and "Delta Tooltip"
4. `src/lib/state/multi-program.svelte.ts` — study `reorderPrograms()` (lines
   ~211-233). **Do not modify this file** unless a trivial type fix is needed.
5. `src/lib/components/result-table.svelte` — **primary target**. Study:
   - Row 2 "Program sub-headers" `<tr>` block (search `Row 2: Program sub-headers`)
   - Comparison STP cell block (`data-testid="stp-cell-{programId}-{i}"`)
   - Comparison CSDA cell block (`data-testid="range-cell-{programId}-{i}"`)
   - `visibleProgramIds` and `defaultProgramId` derived values at the top of `<script>`

Key source files:

- `src/lib/components/result-table.svelte` — both features land here
- `src/lib/state/multi-program.svelte.ts` — `reorderPrograms()` ready to call

Test files:

- `src/tests/unit/multi-program-state.test.ts` — existing state tests (pattern reference)
- `tests/e2e/calculator-advanced.spec.ts` — add new E2E tests here

Run tests:

```sh
pnpm lint && pnpm format       # must be clean before committing
pnpm test                      # Vitest unit + component tests (no WASM)
pnpm exec playwright test      # E2E (needs WASM in static/wasm/)
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` § "AI Session Logging").
Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

---

## Task 1 — Delta / % difference tooltip on comparison cells

> **Depends on nothing.** Pure computation helper + inline tooltip rendering in
> result-table only.

**Spec:** `multi-program.md` Final v3 § "Delta / % Difference Tooltip",
§ Accessibility (delta tooltip keyboard access via `aria-describedby`),
§ Acceptance Criteria "Delta Tooltip".

### Acceptance criteria

- Pure exported function `computeDelta` in `src/lib/components/result-table.svelte`
  (or extracted to `src/lib/utils/delta.ts` if cleaner — adjust import below):
  ```typescript
  export function computeDelta(
    value: number | null,
    defaultValue: number | null,
    defaultName: string,
  ): { delta: number; pct: number; label: string } | null
  ```
  - Returns `null` when `value` is `null`, `defaultValue` is `null`, or
    `defaultValue === 0` (avoids divide-by-zero).
  - `delta = value - defaultValue`; `pct = delta / defaultValue * 100`.
  - Label format:
    `"Δ = {sign}{|delta| 4 sig-figs} ({sign}{|pct| 2 dp}% vs {defaultName})"`
    where sign is `+` for positive/zero delta and `−` (U+2212 MINUS SIGN) for
    negative. Examples:
    - `"Δ = +0.2500 (+0.55% vs ICRU 90)"`
    - `"Δ = −0.8400 (−1.84% vs ICRU 90)"`
- In the result-table, each **non-default** program's STP and CSDA result cell
  that contains a numeric value (not `"—"`) shows a tooltip on `mouseenter` /
  `focus` and hides it on `mouseleave` / `blur`.
  - Tooltip element: `data-testid="delta-tooltip-{programId}-{rowIndex}"`,
    e.g. `data-testid="delta-tooltip-2-0"` for programId=2, row 0.
  - Tooltip content: the `label` string from `computeDelta`.
  - Tooltip must be hidden (not in DOM or `visibility:hidden`) for "—" cells,
    for the default program's cells, and for error cells.
  - Keyboard accessibility: add a visually-hidden `<span id="delta-desc-{programId}-{i}">` 
    containing the label text next to each comparison cell; the cell `<td>` uses
    `aria-describedby="delta-desc-{programId}-{i}"` so screen readers announce the
    delta on focus without requiring hover. The visible tooltip is a
    bonus affordance, not the only access point.
- `pnpm test` and `pnpm build` exit 0.

### Step 1a — tests first (`src/tests/unit/delta-tooltip.test.ts`)

```typescript
import { computeDelta } from "$lib/components/result-table.svelte";
// If extracted: import { computeDelta } from "$lib/utils/delta.js";

test("positive delta uses + sign and formats to 4 sig-figs + 2dp pct", () => {
  const r = computeDelta(46.01, 45.76, "ICRU 90");
  expect(r).not.toBeNull();
  expect(r!.delta).toBeCloseTo(0.25, 3);
  expect(r!.pct).toBeCloseTo(0.547, 2);
  // label starts with "Δ = +" and contains the default name
  expect(r!.label).toMatch(/^Δ = \+/);
  expect(r!.label).toContain("ICRU 90");
});

test("negative delta uses U+2212 minus sign (not ASCII hyphen)", () => {
  const r = computeDelta(44.92, 45.76, "ICRU 90");
  expect(r).not.toBeNull();
  expect(r!.delta).toBeCloseTo(-0.84, 3);
  expect(r!.pct).toBeCloseTo(-1.837, 2);
  // U+2212 "−", not "-"
  expect(r!.label).toMatch(/^Δ = −/);
  expect(r!.label).toContain("ICRU 90");
});

test("null value returns null", () => {
  expect(computeDelta(null, 45.76, "ICRU 90")).toBeNull();
});

test("null default returns null", () => {
  expect(computeDelta(44.92, null, "ICRU 90")).toBeNull();
});

test("zero default returns null (avoid divide-by-zero)", () => {
  expect(computeDelta(1.0, 0, "ICRU 90")).toBeNull();
});
```

### Step 1b — implement

In `src/lib/components/result-table.svelte` (or a new `src/lib/utils/delta.ts`):

- Add `export function computeDelta(...)` per acceptance criteria above. Use
  `toPrecision(4)` for `|delta|` and `toFixed(2)` for `|pct|`.

In `src/lib/components/result-table.svelte` comparison STP and CSDA cell blocks:

- For each non-default program cell, wrap the content in a `<td>` that has:
  ```svelte
  {@const delta = computeDelta(stpValue, defaultStpValue, defaultProgramName)}
  <td
    aria-describedby={delta ? `delta-desc-${programId}-${i}` : undefined}
    onmouseenter={() => { hoveredCell = `${programId}-${i}`; }}
    onmouseleave={() => { hoveredCell = null; }}
    onfocus={() => { hoveredCell = `${programId}-${i}`; }}
    onblur={() => { hoveredCell = null; }}
    ...existing classes...
  >
    <!-- existing cell content: formatSigFigs(...) -->
    {#if delta}
      <!-- visually-hidden accessible description (always in DOM when value present) -->
      <span
        id="delta-desc-{programId}-{i}"
        class="sr-only"
      >{delta.label}</span>
      <!-- visible tooltip, shown on hover/focus -->
      {#if hoveredCell === `${programId}-${i}`}
        <div
          data-testid="delta-tooltip-{programId}-{i}"
          role="tooltip"
          class="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1
                 rounded bg-popover text-popover-foreground text-xs shadow-md
                 whitespace-nowrap border"
        >
          {delta.label}
        </div>
      {/if}
    {/if}
  </td>
  ```
- Add `let hoveredCell = $state<string | null>(null)` at component script level.
  One shared slot is enough — only one cell can be hovered at a time.
- Add `position: relative` (Tailwind: `relative`) to the comparison cell `<td>`
  so the absolute tooltip is positioned against it.
- Mirror the same tooltip logic in the CSDA comparison cell block.
- For the `defaultStpValue` lookup: read it from `comparisonResults.get(defaultProgramId)
  ?.stoppingPowers[i]` — the `comparisonResults` prop is already passed to the component.

### Done when

`pnpm test` green; then commit:

```
feat(result-table): add delta/% difference tooltip on comparison cells
```

---

## Task 2 — Drag-and-drop + keyboard column reorder in result-table

> **Depends on Task 1** only via a shared `hoveredCell` slot; the tasks are
> otherwise independent and may be started in parallel.

**Spec:** `multi-program.md` Final v3 § "Drag-and-Drop Column Reordering",
§ Accessibility (keyboard reorder `aria-live` announce, `aria-disabled` on
default header), § Acceptance Criteria "Drag-and-Drop Column Reordering".

### Acceptance criteria

- Each **non-default** program sub-header `<th>` in the STP group:
  - `draggable="true"`
  - `tabindex="0"` (focusable for keyboard reorder)
  - `data-testid="program-col-header-stp-{programId}"`
  - `ondragstart`, `ondragover`, `ondrop`, `ondragend` handlers wired
- Each **default** program sub-header `<th>` in the STP group:
  - `draggable="false"`
  - `tabindex="0"` (still focusable for navigation)
  - `aria-disabled="true"`
  - `data-testid="program-col-header-stp-{programId}"`
- Same `data-testid="program-col-header-csda-{programId}"` pattern for CSDA group.
- **Drag constraint:** `ondragover` and `ondrop` do nothing when `targetProgramId
  === defaultProgramId`.
- **Drag reorder:** `ondrop` calls `multiProgramState!.reorderPrograms(draggedId,
  newIndex)` where `newIndex` is the position of the `targetProgramId` in
  `programDisplayOrder`.
- **Sync:** Both groups share `programDisplayOrder`, so reordering in the STP
  group automatically reorders the CSDA group — no extra logic needed.
- **Visual feedback during drag:**
  - The header being dragged gets `opacity-50` (via `draggingProgramId === programId`).
  - The header under the drag cursor gets a `border-l-2 border-blue-400` insertion
    indicator (`dragOverProgramId === programId` AND `programId !== defaultProgramId`).
- **Keyboard reorder (Alt+← / Alt+→):**
  - `handleColumnKeydown(e, programId)` fires on `onkeydown` of sub-header `<th>`.
  - Returns immediately if `programId === defaultProgramId` or `!e.altKey`.
  - `Alt+ArrowLeft`: move column one position left (skip if already at index 1).
  - `Alt+ArrowRight`: move column one position right (skip if already at last index).
  - Each move calls `reorderPrograms(programId, currentIndex ± 1)`.
  - After each move fires an `aria-live="polite"` announcement:
    `"{program name} moved to position {N} of {total}"` where N and total count
    only the additional programs (not the pinned default).
- **URL persistence:** the `programs` URL parameter already encodes
  `programDisplayOrder` via the existing reactive URL sync in `+page.svelte`.
  No extra URL code needed in result-table.
- `pnpm test` and `pnpm build` exit 0.

### Step 2a — unit tests first

Add to `src/tests/unit/multi-program-state.test.ts` (or confirm these cases
are already covered — if they are, skip writing and document "already green"):

```typescript
test("reorderPrograms: default program cannot be moved", () => {
  // Suppose state has [9, 2, 101] — programId 9 is default
  // reorderPrograms(9, 2) → order unchanged
});

test("reorderPrograms: moves additional program from index 1 to 2", () => {
  // [9, 2, 101] → reorderPrograms(2, 2) → [9, 101, 2]
});

test("reorderPrograms: moves additional program from index 2 to 1", () => {
  // [9, 101, 2] → reorderPrograms(2, 1) → [9, 2, 101]
});
```

### Step 2b — E2E tests first (`tests/e2e/calculator-advanced.spec.ts`)

Add to the existing file, after the existing tests:

```typescript
// Helper (copy from export.spec.ts pattern if not already present)
async function checkWasmAvailable(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get("/wasm/libdedx.wasm");
    return response.ok();
  } catch {
    return false;
  }
}

test.describe("Stage 6.12 — multi-program polish", () => {
  test(
    "keyboard reorder: Alt+ArrowRight moves column right and updates URL @smoke",
    async ({ page }) => {
      const wasmOk = await checkWasmAvailable(page);
      test.skip(!wasmOk, "WASM binary absent");

      // proton (1) in water (276), three programs: ICRU 90 (9), PSTAR (2), Bethe (101)
      await page.goto(
        "/calculator?mode=advanced&particle=1&material=276&programs=9,2,101&energies=100",
      );
      // Wait for calculation
      await expect
        .poll(
          async () =>
            parseFloat(
              (await page.locator('[data-testid="stp-cell-9-0"]').textContent()) ?? "",
            ),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0);

      // Focus PSTAR sub-header (STP group, programId=2) and press Alt+ArrowRight
      await page.locator('[data-testid="program-col-header-stp-2"]').focus();
      await page.keyboard.press("Alt+ArrowRight");

      // URL must now encode new order: 9,101,2
      await expect(page).toHaveURL(/programs=9(%2C|,)101(%2C|,)2/, { timeout: 3000 });
    },
  );

  test(
    "keyboard reorder: Alt+ArrowLeft moves column left @regression",
    async ({ page }) => {
      const wasmOk = await checkWasmAvailable(page);
      test.skip(!wasmOk, "WASM binary absent");

      await page.goto(
        "/calculator?mode=advanced&particle=1&material=276&programs=9,101,2&energies=100",
      );
      await expect
        .poll(
          async () =>
            parseFloat(
              (await page.locator('[data-testid="stp-cell-9-0"]').textContent()) ?? "",
            ),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0);

      // Focus Bethe (101) and move it left → 9,2,101
      await page.locator('[data-testid="program-col-header-stp-101"]').focus();
      await page.keyboard.press("Alt+ArrowLeft");
      await expect(page).toHaveURL(/programs=9(%2C|,)2(%2C|,)101/, { timeout: 3000 });
    },
  );

  test(
    "delta tooltip visible on hover over non-default STP cell @smoke",
    async ({ page }) => {
      const wasmOk = await checkWasmAvailable(page);
      test.skip(!wasmOk, "WASM binary absent");

      await page.goto(
        "/calculator?mode=advanced&particle=1&material=276&programs=9,2&energies=100",
      );
      await expect
        .poll(
          async () =>
            parseFloat(
              (await page.locator('[data-testid="stp-cell-9-0"]').textContent()) ?? "",
            ),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0);

      // Hover over PSTAR (id=2) STP cell, row 0
      await page.locator('[data-testid="stp-cell-2-0"]').hover();
      const tooltip = page.locator('[data-testid="delta-tooltip-2-0"]');
      await expect(tooltip).toBeVisible({ timeout: 2000 });
      await expect(tooltip).toContainText("Δ =");
      await expect(tooltip).toContainText("ICRU 90");
    },
  );

  test(
    "delta tooltip NOT shown on default program cell @regression",
    async ({ page }) => {
      const wasmOk = await checkWasmAvailable(page);
      test.skip(!wasmOk, "WASM binary absent");

      await page.goto(
        "/calculator?mode=advanced&particle=1&material=276&programs=9,2&energies=100",
      );
      await expect
        .poll(
          async () =>
            parseFloat(
              (await page.locator('[data-testid="stp-cell-9-0"]').textContent()) ?? "",
            ),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0);

      // Hover over ICRU 90 (default, id=9) STP cell — no tooltip should appear
      await page.locator('[data-testid="stp-cell-9-0"]').hover();
      await expect(page.locator('[data-testid*="delta-tooltip"]')).not.toBeVisible({
        timeout: 1000,
      });
    },
  );
});
```

### Step 2c — implement

In `src/lib/components/result-table.svelte`:

**1. Drag state** — add at component `<script>` level:
```typescript
let draggingProgramId = $state<number | null>(null);
let dragOverProgramId = $state<number | null>(null);
let reorderAnnouncement = $state("");
```

**2. Drag handlers:**
```typescript
function handleDragStart(e: DragEvent, programId: number) {
  draggingProgramId = programId;
  e.dataTransfer?.setData("text/plain", String(programId));
  e.dataTransfer && (e.dataTransfer.effectAllowed = "move");
}

function handleDragOver(e: DragEvent, targetId: number) {
  if (targetId === defaultProgramId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dragOverProgramId = targetId;
}

function handleDrop(e: DragEvent, targetId: number) {
  e.preventDefault();
  dragOverProgramId = null;
  if (!draggingProgramId || draggingProgramId === targetId) {
    draggingProgramId = null;
    return;
  }
  const order = multiProgramState!.programDisplayOrder;
  const targetIndex = order.indexOf(targetId);
  if (targetIndex > 0) { // never drop before the default
    multiProgramState!.reorderPrograms(draggingProgramId, targetIndex);
  }
  draggingProgramId = null;
}

function handleDragEnd() {
  draggingProgramId = null;
  dragOverProgramId = null;
}
```

**3. Keyboard handler:**
```typescript
function handleColumnKeydown(e: KeyboardEvent, programId: number) {
  if (programId === defaultProgramId) return;
  if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  e.preventDefault();
  const order = multiProgramState!.programDisplayOrder;
  const currentIndex = order.indexOf(programId);
  const delta = e.key === "ArrowLeft" ? -1 : 1;
  const newIndex = currentIndex + delta;
  if (newIndex < 1 || newIndex >= order.length) return; // clamp: can't go before default (index 0)
  multiProgramState!.reorderPrograms(programId, newIndex);
  // Aria-live announcement (position among additional programs, 1-based)
  const additionalTotal = order.length - 1;
  const additionalPos = newIndex; // 1-based: newIndex is 1..n among additional
  const name = getProgramName(programId);
  reorderAnnouncement = `${name} moved to position ${additionalPos} of ${additionalTotal}`;
}
```

**4. Sub-header `<th>` markup** — modify the Row 2 sub-headers in the STP group:
```svelte
<th
  scope="col"
  tabindex="0"
  data-program-id={programId}
  data-testid="program-col-header-stp-{programId}"
  draggable={programId !== defaultProgramId}
  aria-disabled={programId === defaultProgramId ? "true" : undefined}
  ondragstart={(e) => handleDragStart(e, programId)}
  ondragover={(e) => handleDragOver(e, programId)}
  ondrop={(e) => handleDrop(e, programId)}
  ondragend={handleDragEnd}
  onkeydown={(e) => handleColumnKeydown(e, programId)}
  class={`px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap
    cursor-grab select-none
    ${programId === defaultProgramId ? "font-bold bg-blue-50 border-l-2 border-l-blue-500" : "bg-background"}
    ${draggingProgramId === programId ? "opacity-50" : ""}
    ${dragOverProgramId === programId && programId !== defaultProgramId ? "border-l-2 border-l-blue-400" : ""}
  `}
>
  {getProgramName(programId)}
  {#if programId === defaultProgramId}
    <span aria-hidden="true">◆</span>
  {/if}
</th>
```
Apply the same attributes + `data-testid="program-col-header-csda-{programId}"` to the CSDA group sub-headers.

**5. Aria-live region** — add once at the top of the table wrapper:
```svelte
<div aria-live="polite" aria-atomic="true" class="sr-only">{reorderAnnouncement}</div>
```

### Done when

`pnpm lint && pnpm test` green; all four new E2E tests in
`calculator-advanced.spec.ts` (keyboard reorder ×2, delta tooltip ×2) pass or
are `test.skip`-ed with WASM-absent note. Then commit:

```
feat(result-table): drag-and-drop and keyboard column reorder for multi-program table
```

---

## Cross-task notes

- Task 1 (delta tooltip) is simpler — start here to verify the test
  scaffolding before adding drag complexity.
- Task 2 drag and Task 1 tooltip both modify `result-table.svelte`. If running
  sequentially commit Task 1 first to keep diffs readable.
- After both tasks: write the `CHANGELOG-AI.md` entry and
  `docs/ai-logs/YYYY-MM-DD-stage6-12-multi-program-polish.md` per AI Logging
  rules.
- Mark Stage 6.12 ✅ in `docs/00-redesign-plan.md` (the 6.12 table row).
- Run `pnpm guard:staged` before every commit.
- **Do not push** unless explicitly requested. Output the manual push command
  in your `TASK DONE` message.

---

## Out of scope / deferred

- Plot-page multi-program overlays (covered by adding multiple series in `plot.md`).
- Multi-program CSV filename / wide PDF layout — Stage 6.11 shipped the basic
  CSV modal; any multi-program PDF layout details are deferred to Stage 6.13+.
- External data (`external-data.md`) — Stage 7.
- Stage 6.13 (formal URL parser / ABNF conformance) — next stage after 6.12.
