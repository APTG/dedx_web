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
   program's result cell shows a tooltip:
   `"Δ = {absolute} {unit} ({sign}{pct}% vs {default program name})"`.
   Default program cells and error ("—") cells never show a tooltip.
   Must be keyboard-accessible via `aria-describedby`.

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
   - Entry 12 (`waitForTimeout()` ban in E2E — use `expect.poll` instead)
   - Entry 25 (`$state(null)` nullable-wrap pattern)
   - Entry 27 (E2E coverage must mirror spec, not the easier implementation)
3. `docs/04-feature-specs/multi-program.md` Final v3 — read these sections fully:
   - § "Delta / % Difference Tooltip"
   - § "Drag-and-Drop Column Reordering"
   - § Accessibility (keyboard reorder announce, delta tooltip via `aria-describedby`)
   - § Acceptance Criteria — subsections "Drag-and-Drop Column Reordering" and
     "Delta Tooltip"
4. `src/lib/state/multi-program.svelte.ts` — study `reorderPrograms()` (lines
   ~211-233). **Do not modify this file** unless a trivial type fix is needed.
5. `src/lib/components/result-table.svelte` — **primary target**. Study:
   - Row 2 "Program sub-headers" `<tr>` block (search `Row 2: Program sub-headers`)
   - Comparison STP cell block (`data-testid="stp-cell-{programId}-{i}"`)
   - Comparison CSDA cell block (`data-testid="range-cell-{programId}-{i}"`)
   - `visibleProgramIds`, `defaultProgramId`, `getProgramName` at the top of
     `<script>`
   - `autoScaleLengthCm`, `formatSigFigs` — both already imported

Key source files:

- `src/lib/components/result-table.svelte` — both features land here
- `src/lib/state/multi-program.svelte.ts` — `reorderPrograms()` ready to call

Test files:

- `src/tests/unit/multi-program-state.test.ts` — `reorderPrograms` tests
  **already exist** in a `describe("reorderPrograms")` block (lines ~177-200);
  verify they are green before starting, but **do not rewrite them**.
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
(AI Session Logging section). Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

---

## Task 1 — Delta / % difference tooltip on comparison cells

> **Depends on nothing.** Pure computation helper + inline tooltip rendering in
> result-table only.

**Spec:** `multi-program.md` Final v3 § "Delta / % Difference Tooltip",
§ Accessibility (delta tooltip keyboard access via `aria-describedby`),
§ Acceptance Criteria "Delta Tooltip".

**Tooltip label format** (from spec):
`"Δ = −0.84 keV/µm (−1.8% vs ICRU 90)"` — note:
- Units are included in the label (e.g. `keV/µm`, `MeV·cm²/g`, `cm`).
- `−` is U+2212 MINUS SIGN for negative, `+` for positive/zero.
- Absolute delta: `formatSigFigs(Math.abs(delta), 3)` (3 sig-figs).
- Percentage: `Math.abs(pct).toFixed(1)` (1 decimal place).

### Acceptance criteria

**`computeDelta` function** — export from `src/lib/utils/delta.ts` (new file):

```typescript
export function computeDelta(
  displayValue: number | null,
  defaultDisplayValue: number | null,
  unit: string,
  defaultName: string,
): { delta: number; pct: number; label: string } | null
```

- Returns `null` when `displayValue` is `null`, `defaultDisplayValue` is `null`,
  or `defaultDisplayValue === 0` (avoids divide-by-zero).
- `delta = displayValue - defaultDisplayValue`
- `pct = (delta / defaultDisplayValue) * 100`
- Label format (U+2212 minus sign `−` for negative, `+` for positive/zero):
  ```
  "Δ = +0.840 keV/µm (+1.8% vs ICRU 90)"   // positive
  "Δ = −0.840 keV/µm (−1.8% vs ICRU 90)"   // negative
  ```
  Constructed as:
  ```typescript
  const sign = delta >= 0 ? "+" : "−"; // U+2212
  const absDelta = formatSigFigs(Math.abs(delta), 3);
  const absPct = Math.abs(pct).toFixed(1);
  const label = `Δ = ${sign}${absDelta} ${unit} (${sign}${absPct}% vs ${defaultName})`;
  ```

**Helper functions** — add as non-exported functions in `result-table.svelte`
(they depend on the component's `state` and `entitySelection` props):

```typescript
// Returns the STP display value (already unit-converted) for a given result
// row, or null if the row energy doesn't match.
function getStpDisplayValue(
  result: CalculationResult,
  mevNucl: number,
  density: number,
  displayUnit: string,
): number | null {
  const idx = result.energies.findIndex((e) => Math.abs(e - mevNucl) < 0.0001);
  if (idx === -1) return null;
  const mass = result.stoppingPowers[idx] ?? null;
  if (mass === null) return null;
  if (displayUnit === "keV/µm") return (mass * density) / 10;
  if (displayUnit === "MeV/cm") return mass * density;
  return mass; // MeV·cm²/g
}

// Returns the CSDA range value in cm for a given result row, or null.
function getCsdaDisplayCm(
  result: CalculationResult,
  mevNucl: number,
  density: number,
): number | null {
  const idx = result.energies.findIndex((e) => Math.abs(e - mevNucl) < 0.0001);
  if (idx === -1) return null;
  const gcm2 = result.csdaRanges[idx] ?? null;
  if (gcm2 === null) return null;
  return density > 0 ? gcm2 / density : gcm2;
}
```

**In `result-table.svelte`** — add component-level state and derived values:

```typescript
import { computeDelta } from "$lib/utils/delta.js";

let hoveredCell = $state<string | null>(null);

// Derived once — used in both STP and CSDA delta computations
const defaultProgramName = $derived(
  defaultProgramId !== null ? getProgramName(defaultProgramId) : "",
);
```

**STP comparison cell** — wrap existing content to add tooltip. Key pattern
(add inside the `{#if stpIndex !== -1}` block, after computing `stpMass`):

```svelte
{@const stpDisplay = getStpDisplayValue(result, row.normalizedMevNucl, density, state.stpDisplayUnit)}
{@const defaultResult = defaultProgramId !== null ? comparisonResults?.get(defaultProgramId) : undefined}
{@const defaultStpDisplay = defaultResult && !(defaultResult instanceof LibdedxError) && row.normalizedMevNucl !== null
  ? getStpDisplayValue(defaultResult, row.normalizedMevNucl, density, state.stpDisplayUnit)
  : null}
{@const delta = programId !== defaultProgramId && stpDisplay !== null
  ? computeDelta(stpDisplay, defaultStpDisplay, state.stpDisplayUnit, defaultProgramName)
  : null}
```

Add to the `<td>` wrapping the STP cell:
- `class="... relative"` (for absolute-positioned tooltip)
- `aria-describedby={delta ? `delta-desc-${programId}-${i}` : undefined}`
- `onmouseenter={() => { hoveredCell = `${programId}-${i}`; }}`
- `onmouseleave={() => { hoveredCell = null; }}`
- `onfocus={() => { hoveredCell = `${programId}-${i}`; }}`
- `onblur={() => { hoveredCell = null; }}`

After the existing cell content, inside the `<td>`:
```svelte
{#if delta}
  <span id="delta-desc-{programId}-{i}" class="sr-only">{delta.label}</span>
  {#if hoveredCell === `${programId}-${i}`}
    <div
      data-testid="delta-tooltip-{programId}-{i}"
      role="tooltip"
      class="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1
             rounded bg-popover text-popover-foreground text-xs shadow-md
             whitespace-nowrap border pointer-events-none"
    >
      {delta.label}
    </div>
  {/if}
{/if}
```

**CSDA comparison cell** — mirror the same pattern using `getCsdaDisplayCm`.
For the delta unit use `"cm"` (raw cm values for both cells):

```svelte
{@const csdaCm = getCsdaDisplayCm(result, row.normalizedMevNucl, density)}
{@const defaultCsdaCm = defaultResult && !(defaultResult instanceof LibdedxError) && row.normalizedMevNucl !== null
  ? getCsdaDisplayCm(defaultResult, row.normalizedMevNucl, density)
  : null}
{@const csdaDelta = programId !== defaultProgramId && csdaCm !== null
  ? computeDelta(csdaCm, defaultCsdaCm, "cm", defaultProgramName)
  : null}
```

Use `data-testid="delta-tooltip-{programId}-{i}"` for the CSDA tooltip as well
(the E2E test only checks the STP tooltip; CSDA follows the same pattern).

### Step 1a — tests first (`src/tests/unit/delta-tooltip.test.ts`)

```typescript
import { computeDelta } from "$lib/utils/delta.js";

test("positive delta: correct delta, pct, and label with unit", () => {
  const r = computeDelta(45.76 + 0.84, 45.76, "keV/µm", "ICRU 90");
  expect(r).not.toBeNull();
  expect(r!.delta).toBeCloseTo(0.84, 3);
  expect(r!.pct).toBeCloseTo(1.836, 2);
  expect(r!.label).toMatch(/^Δ = \+/);
  expect(r!.label).toContain("keV/µm");
  expect(r!.label).toContain("ICRU 90");
  expect(r!.label).toContain("%");
});

test("negative delta uses U+2212 minus sign (not ASCII hyphen)", () => {
  const r = computeDelta(44.92, 45.76, "keV/µm", "ICRU 90");
  expect(r).not.toBeNull();
  expect(r!.delta).toBeCloseTo(-0.84, 3);
  expect(r!.pct).toBeCloseTo(-1.836, 2);
  expect(r!.label).toMatch(/^Δ = −/); // U+2212, not "-"
  expect(r!.label).toContain("keV/µm");
  expect(r!.label).toContain("ICRU 90");
});

test("null displayValue returns null", () => {
  expect(computeDelta(null, 45.76, "keV/µm", "ICRU 90")).toBeNull();
});

test("null defaultDisplayValue returns null", () => {
  expect(computeDelta(44.92, null, "keV/µm", "ICRU 90")).toBeNull();
});

test("zero default returns null (avoid divide-by-zero)", () => {
  expect(computeDelta(1.0, 0, "keV/µm", "ICRU 90")).toBeNull();
});

test("label precision: 3 sig-figs for delta, 1dp for pct", () => {
  const r = computeDelta(44.92, 45.76, "keV/µm", "ICRU 90");
  // formatSigFigs(0.84, 3) = "0.840"; toFixed(1) of 1.836... = "1.8"
  expect(r!.label).toContain("0.840");
  expect(r!.label).toContain("1.8%");
});

test("unit is included in label for non-STP units", () => {
  const r = computeDelta(0.95, 1.0, "cm", "ICRU 90");
  expect(r).not.toBeNull();
  expect(r!.label).toContain("cm");
});
```

### Step 1b — implement

1. Create `src/lib/utils/delta.ts` with `computeDelta` per spec above.
2. In `result-table.svelte`:
   - Import `computeDelta` from `"$lib/utils/delta.js"`.
   - Add `getStpDisplayValue`, `getCsdaDisplayCm` as local functions (non-exported).
   - Add `let hoveredCell = $state<string | null>(null)` and `defaultProgramName` derived.
   - Wire up STP comparison cells per the template pattern above.
   - Wire up CSDA comparison cells with the same pattern.

### Done when

`pnpm test` green; then commit:

```
feat(result-table): add delta/% difference tooltip on comparison cells
```

---

## Task 2 — Drag-and-drop + keyboard column reorder in result-table

> **Depends on Task 1** only via the shared `hoveredCell` slot; otherwise
> fully independent.

**Spec:** `multi-program.md` Final v3 § "Drag-and-Drop Column Reordering",
§ Accessibility (keyboard reorder `aria-live` announce, `aria-disabled` on
default header), § Acceptance Criteria "Drag-and-Drop Column Reordering".

### Acceptance criteria

- Each **non-default** program sub-header `<th>` in the STP group:
  - `draggable="true"`, `tabindex="0"`, `cursor-grab` style
  - `data-testid="program-col-header-stp-{programId}"`
  - `ondragstart`, `ondragover`, `ondrop`, `ondragend` handlers wired
- Each **default** program sub-header `<th>` in the STP group:
  - `draggable="false"`, `tabindex="0"`, `aria-disabled="true"`
  - `data-testid="program-col-header-stp-{programId}"`
- Same pattern with `data-testid="program-col-header-csda-{programId}"` for
  CSDA group.
- **Drag constraint:** `ondragover` / `ondrop` do nothing when the target is
  the default program.
- **Drag reorder:** `ondrop` calls `multiProgramState!.reorderPrograms(draggedId,
  targetIndex)` where `targetIndex` is `programDisplayOrder.indexOf(targetProgramId)`.
  `reorderPrograms` interprets this as the desired **array index** in
  `programDisplayOrder` (default is always index 0; additional programs are
  indices 1..n).
- **Sync:** Both groups share `programDisplayOrder`, so reordering in one group
  automatically reorders the other — no extra logic needed.
- **Visual feedback during drag:**
  - Dragged header: `opacity-50` when `draggingProgramId === programId`.
  - Drop target header: `border-l-2 border-blue-400` when
    `dragOverProgramId === programId && programId !== defaultProgramId`.
- **Keyboard reorder (Alt+← / Alt+→):**
  - `handleColumnKeydown(e, programId)` fires on `onkeydown` of sub-header `<th>`.
  - Returns immediately if `programId === defaultProgramId` or `!e.altKey`.
  - `Alt+ArrowLeft`: move left (skip if already at index 1, the first
    additional-program position).
  - `Alt+ArrowRight`: move right (skip if already at the last index).
  - Each valid move calls
    `multiProgramState!.reorderPrograms(programId, currentIndex + delta)`.
  - After each move fires an `aria-live="polite"` announcement:
    `"{program name} moved to position {N} of {total}"` where N is
    `newIndex` (the array index of the moved program, 1-based among additional
    programs: `newIndex - 1 + 1 = newIndex`) and `total` is
    `programDisplayOrder.length - 1` (excluding the pinned default).
- **URL persistence:** `programDisplayOrder` is already synced to the `programs`
  URL param via the existing reactive URL sync in `+page.svelte`. No extra URL
  code needed in result-table.
- `pnpm test` and `pnpm build` exit 0.

### Step 2a — verify existing unit tests

Run `pnpm test src/tests/unit/multi-program-state.test.ts` and confirm the
`describe("reorderPrograms")` block is green. If tests pass, skip to Step 2b.
If they fail, fix only the failing assertion (do not rewrite).

### Step 2b — E2E tests first (`tests/e2e/calculator-advanced.spec.ts`)

Add to the existing file (after the last existing test), using the
`checkWasmAvailable` helper already present in the file (or define it once
if absent):

```typescript
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

      await page.locator('[data-testid="stp-cell-2-0"]').hover();
      const tooltip = page.locator('[data-testid="delta-tooltip-2-0"]');
      await expect(tooltip).toBeVisible({ timeout: 2000 });
      await expect(tooltip).toContainText("Δ =");
      // Must include a unit string and the default program name
      await expect(tooltip).toContainText("%");
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
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
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
  const dragged = draggingProgramId;
  draggingProgramId = null;
  if (!dragged || dragged === targetId || targetId === defaultProgramId) return;
  const order = multiProgramState!.programDisplayOrder;
  const targetIndex = order.indexOf(targetId);
  if (targetIndex > 0) {
    multiProgramState!.reorderPrograms(dragged, targetIndex);
  }
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
  const step = e.key === "ArrowLeft" ? -1 : 1;
  const newIndex = currentIndex + step;
  // index 0 is always the pinned default; can't go before it or past the end
  if (newIndex < 1 || newIndex >= order.length) return;
  multiProgramState!.reorderPrograms(programId, newIndex);
  const additionalTotal = order.length - 1;
  const additionalPos = newIndex; // 1-based position among additional programs
  reorderAnnouncement = `${getProgramName(programId)} moved to position ${additionalPos} of ${additionalTotal}`;
}
```

**4. Sub-header `<th>` markup** — modify the Row 2 STP sub-headers:
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
  class={[
    "px-2 sm:px-4 py-2 font-medium text-center border-b border-l whitespace-nowrap select-none",
    programId !== defaultProgramId ? "cursor-grab" : "",
    programId === defaultProgramId ? "font-bold bg-blue-50 border-l-2 border-l-blue-500" : "bg-background",
    draggingProgramId === programId ? "opacity-50" : "",
    dragOverProgramId === programId && programId !== defaultProgramId ? "border-l-2 border-l-blue-400" : "",
  ].filter(Boolean).join(" ")}
>
  {getProgramName(programId)}
  {#if programId === defaultProgramId}
    <span aria-hidden="true">◆</span>
  {/if}
</th>
```

Apply the same attributes with `data-testid="program-col-header-csda-{programId}"` to
the CSDA group sub-headers.

**5. Aria-live region** — add once, just inside the `<div class="overflow-x-auto ...">` wrapper:
```svelte
<div aria-live="polite" aria-atomic="true" class="sr-only">{reorderAnnouncement}</div>
```

### Done when

`pnpm lint && pnpm test` green; all four new E2E tests pass or are
`test.skip`-ed with the WASM-absent guard. Then commit:

```
feat(result-table): drag-and-drop and keyboard column reorder for multi-program table
```

---

## Cross-task notes

- Task 1 (delta tooltip) is simpler — start here to verify the test scaffolding
  before adding drag complexity.
- Both tasks modify `result-table.svelte`. Commit Task 1 first to keep diffs
  readable.
- After both tasks: write the `CHANGELOG-AI.md` entry and session log
  `docs/ai-logs/2026-05-11-stage6-12-multi-program-polish.md` per AI Logging
  rules in `AGENTS.md`.
- Mark Stage 6.12 ✅ in `docs/00-redesign-plan.md` (the 6.12 table row).
- Run `pnpm lint && pnpm format` before every commit.
- **Do not push** unless explicitly requested. Output the manual push command
  in your `TASK DONE` message.
- Add `src/lib/utils/delta.ts` to the prompts index in
  `docs/ai-logs/prompts/README.md` once the PR is ready (leave as a note).

---

## Out of scope / deferred

- Plot-page multi-program overlays (Stage 7+).
- Multi-program CSV filename / wide PDF layout — Stage 6.11 shipped the basic
  CSV modal; multi-program PDF layout details are deferred to Stage 6.13+.
- Touch drag-and-drop (long-press) — Stage 7 accessibility pass.
- External data (`external-data.md`) — Stage 7.
- Stage 6.13 (formal URL parser / ABNF conformance) — next stage after 6.12.
