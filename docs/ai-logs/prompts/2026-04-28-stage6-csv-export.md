# opencode task prompt — 2026-04-28 Stage 6 — CSV Export (basic mode)

> **Model:** Qwen3.5-397B-A17B-FP8  
> **Session type:** Single-feature implementation. Work through the tasks **in
> order**. After each task is complete and `pnpm test` is green, commit with
> a Conventional Commits message and **stop so the user can run `/compact`**
> before the next task.  
> **MCPs available:** `playwright` (run / inspect E2E tests),
> `tailwind` (Tailwind CSS class lookup).  
> **TDD rule:** Write the failing test(s) first (`pnpm test` must fail on the
> new test), then write the minimal implementation to make them pass, then
> run `pnpm test` again to confirm green. No implementation without a test.

---

## Branch

```
qwen/stage-6-csv-export
```

Create and check out this branch from the current `master` before doing anything else:

```sh
git checkout master && git pull
git checkout -b qwen/stage-6-csv-export
```

---

## Context — read at session start

Read these files **in order** before writing a single line of code:

1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging rules
2. `docs/04-feature-specs/export.md` — **the normative spec for this session**;
   read the full file. Pay special attention to:
   - §0 Toolbar placement (shared buttons across Calculator and Plot)
   - §1.1 Advanced-mode modal (NOT needed this session — skip for now)
   - §2 Button states (enabled/disabled rules)
   - §3 Calculator CSV format — column order, header comment rows, filename convention
3. `docs/04-feature-specs/calculator.md` — understand the five-column unified
   table structure (typed value, normalized energy, per-row unit, stopping power,
   CSDA range)
4. `docs/04-feature-specs/shareable-urls.md` §4.1 — master unit token list
   (needed for CSV unit header strings)
5. `src/lib/state/ui.svelte.ts` — global state pattern (`wasmReady`, `wasmError`,
   `isAdvancedMode`); this session extends the same file with an export-callback
   pattern
6. `src/lib/state/calculator.svelte.ts` — `CalculatorState` interface and
   `CalculatedRow` type; understand every field before implementing the formatter
7. `src/lib/state/entity-selection.svelte.ts` — `EntitySelectionState` interface;
   you need `selectedParticle`, `selectedMaterial`, `resolvedProgram` for the
   CSV header comment block
8. `src/routes/+layout.svelte` — current toolbar with the two disabled
   Export buttons; you will modify this file
9. `src/routes/calculator/+page.svelte` — current calculator page; you will
   add export wiring here
10. `src/lib/utils/unit-conversions.ts` — `formatSigFigs`, `autoScaleLengthCm`
    and related helpers; the CSV formatter reuses them

Key test files to read before adding yours:

- `src/tests/unit/` — existing unit tests; add `export-csv.test.ts` here
- `tests/e2e/calculator.spec.ts` — existing E2E spec; add the download test here

---

## Data model summary (do not re-read if you already read the sources above)

`CalculatedRow` (from `calculator.svelte.ts`):

| Field | Type | Meaning |
|-------|------|---------|
| `rawInput` | `string` | What the user typed |
| `normalizedMevNucl` | `number \| null` | Normalized energy in MeV/nucl (null if invalid) |
| `unit` | `EnergyUnit` | Effective unit for this row (detected suffix or master unit) |
| `status` | `'valid' \| 'invalid' \| 'out-of-range' \| 'empty'` | Row validity |
| `stoppingPower` | `number \| null` | Computed STP in g/cm² display unit |
| `csdaRangeCm` | `number \| null` | Computed CSDA range in cm (always cm; format on display) |

`CalculatorState.stpDisplayUnit` (`StpUnit`) — the current display unit for
stopping power (e.g. `"keV/µm"` or `"MeV·cm²/g"`).

`CalculatorState.masterUnit` (`EnergyUnit`) — the active master energy unit.

---

## AI Logging (MANDATORY — do not skip)

Before writing any code, create the AI log file at:

```
docs/ai-logs/2026-04-28-stage6-csv-export.md
```

Use this template:

```markdown
# 2026-04-28 — Stage 6: CSV Export (basic mode)

## Session Narrative

### Prompt 1: CSV export basic mode
**AI response**: <fill in as you complete tasks>

## Tasks

### Task 1 — formatCalculatorCsv() pure function + unit tests
- **Status**: in progress
- **Stage**: 6 (CSV export)
- **Files changed**: src/lib/utils/export-csv.ts, src/tests/unit/export-csv.test.ts
- **Decision**: <fill in>
- **Issue**: <fill in>

### Task 2 — Global export callback wiring (ui.svelte.ts)
- **Status**: in progress
...

### Task 3 — Calculator page registers export callback
- **Status**: in progress
...

### Task 4 — Layout: enable Export CSV button
- **Status**: in progress
...

### Task 5 — E2E test for CSV download
- **Status**: in progress
...
```

After all tasks are done:

1. Fill in the session narrative (what you did, key decisions, outcome).
2. Prepend a row to the **top** of the `CHANGELOG-AI.md` table body:

```
| 2026-04-28 | 6 | **Stage 6 CSV export (basic mode)** (Qwen3.5-397B-A17B-FP8 via opencode): <one-sentence summary of what was done> | [log](docs/ai-logs/2026-04-28-stage6-csv-export.md) |
```

3. Add a one-line pointer to `docs/ai-logs/README.md`.

---

## Task 1 — `formatCalculatorCsv()` pure function + unit tests

**Spec reference:** `docs/04-feature-specs/export.md` §3 (read the full section
before starting — especially the column order, header comment block format, and
filename convention).

### Step 1a — failing tests first

Create `src/tests/unit/export-csv.test.ts`. The file must fail before you write
any implementation (confirm with `pnpm test`).

Write tests for `formatCalculatorCsv(rows, particle, material, program, stpUnit, masterUnit)`:

```typescript
import { describe, it, expect } from "vitest";
import { formatCalculatorCsv, csvFilename } from "$lib/utils/export-csv";
// Import mock types / fixtures as needed

describe("formatCalculatorCsv", () => {
  // --- Header comment block ---
  it("includes a '# webdedx' header line as the first row", () => { ... });
  it("includes '# Particle: proton' comment line", () => { ... });
  it("includes '# Material: Liquid Water' comment line", () => { ... });
  it("includes '# Program: PSTAR' comment line", () => { ... });
  it("includes a '# Generated: YYYY-MM-DD' line matching today", () => { ... });

  // --- Column headers ---
  it("emits the correct column header row in the right order per spec", () => {
    // Expected: Normalized Energy [MeV], Typed Value, Stopping Power [keV/µm], CSDA Range [cm]
    // (the exact column names and unit tokens come from export.md §3 — read the spec)
    ...
  });

  // --- Data rows ---
  it("emits one data row per valid CalculatedRow", () => { ... });
  it("skips rows with status !== 'valid'", () => { ... });
  it("formats stopping power with formatSigFigs(value, 4)", () => { ... });
  it("formats CSDA range with autoScaleLengthCm and formatSigFigs(value, 4)", () => { ... });
  it("uses rawInput as the Typed Value column", () => { ... });
  it("uses normalizedMevNucl converted to the master unit for Normalized Energy", () => { ... });

  // --- Edge cases ---
  it("returns only header lines when no valid rows exist", () => { ... });
  it("handles null stoppingPower / csdaRangeCm as empty string in CSV", () => { ... });
});

describe("csvFilename", () => {
  it("returns a filename matching '{particle}_{material}_YYYY-MM-DD.csv' pattern", () => {
    const name = csvFilename("proton", "Liquid Water");
    expect(name).toMatch(/^proton_Liquid_Water_\d{4}-\d{2}-\d{2}\.csv$/);
  });
  it("replaces spaces with underscores in particle and material names", () => { ... });
});
```

> **Do not guess the exact column order or header format.** Read
> `docs/04-feature-specs/export.md` §3 in full to get the canonical column
> order, separator, line endings (CRLF per spec), and comment row format
> before writing the column-header test.

Run `pnpm test` — the new tests must fail (import errors or assertion failures).
Do not proceed to Step 1b until you see red.

### Step 1b — implement `src/lib/utils/export-csv.ts`

Create the file with two exported functions:

```typescript
/**
 * Formats calculator results as a CSV string per export.md §3.
 * Returns CRLF line endings as required by RFC 4180.
 */
export function formatCalculatorCsv(
  rows: CalculatedRow[],
  particle: ParticleEntity,
  material: MaterialEntity,
  programName: string,
  stpUnit: StpUnit,
  masterUnit: EnergyUnit,
): string { ... }

/**
 * Returns the download filename: `{particle}_{material}_YYYY-MM-DD.csv`.
 * Spaces replaced with underscores.
 */
export function csvFilename(particleName: string, materialName: string): string { ... }
```

Implementation notes:

- Use CRLF (`\r\n`) line endings (RFC 4180 requirement — specified in the spec).
- Header comment rows start with `#` as per the spec.
- Column headers must match the spec's exact wording (check export.md §3 again).
- Use `formatSigFigs(value, 4)` from `$lib/utils/unit-conversions` for all
  numeric cells.
- For CSDA range: call `autoScaleLengthCm(csdaRangeCm)` to get the scaled value
  and unit string; use the scaled value in the data cell and the unit in the
  column header. **Important:** the unit in the column header is the *most
  common* unit across all rows, not per-row. For simplicity in basic mode, use
  `cm` as the fixed column header unit and output raw `csdaRangeCm` values
  (see export.md §3 for whether auto-scaling applies to CSV — read the spec).
- For Normalized Energy: if `normalizedMevNucl` is `null`, output an empty cell.
  Otherwise, convert from MeV/nucl back to the `masterUnit` for display.
  For proton and electron (massNumber = 1 or id = 1001), MeV/nucl = MeV total.
  For heavy ions, multiply by massNumber to get total MeV, then convert.
  Use the existing conversion helpers from `$lib/utils/energy-conversions.ts`.
- For null `stoppingPower` or `csdaRangeCm`: output an empty string (`""`), not
  `"0"` or `"—"`.
- Skip rows where `status !== 'valid'`.

Run `pnpm test` — all new tests must be green before committing.

```sh
pnpm test
```

Commit:
```
feat(export): add formatCalculatorCsv() and csvFilename() utility functions
```

---

## Task 2 — Global export callback in `ui.svelte.ts`

The Export CSV button lives in `+layout.svelte` (the app shell), but the data
it needs lives in the Calculator page's local state. The cleanest approach that
follows the existing global state pattern (`wasmReady`, `wasmError`,
`isAdvancedMode`) is to expose a callback slot in `ui.svelte.ts`.

### Step 2a — failing test first

Add to `src/tests/unit/ui-state.test.ts` (create the file if it does not exist):

```typescript
import { describe, it, expect } from "vitest";
import { csvExportHandler } from "$lib/state/ui.svelte";

describe("csvExportHandler", () => {
  it("is null initially", () => {
    expect(csvExportHandler.value).toBeNull();
  });
  it("can be assigned a function and called", () => {
    let called = false;
    csvExportHandler.value = () => { called = true; };
    csvExportHandler.value?.();
    expect(called).toBe(true);
    csvExportHandler.value = null; // cleanup
  });
});
```

Run `pnpm test` — expect a red import error. Do not proceed until you see it.

### Step 2b — implement

In `src/lib/state/ui.svelte.ts`, append:

```typescript
/**
 * Registered by the currently active page that supports CSV export.
 * Null when no exportable page is active (e.g. Plot page not yet implemented,
 * or when the page has unmounted).
 * Layout reads this to enable/disable the Export CSV toolbar button.
 */
export const csvExportHandler = $state<{ value: (() => void) | null }>({ value: null });
```

Run `pnpm test` — green. Commit:

```
feat(ui): add csvExportHandler global state slot for toolbar CSV button
```

---

## Task 3 — Calculator page registers the export callback

### Step 3a — failing test first

In `src/tests/unit/` create (or extend an existing file for the calculator page
if one exists) `src/tests/unit/calculator-page-export.test.ts`:

> If testing the Svelte page component directly is complex, use an integration
> style test that verifies `csvExportHandler.value` is non-null after mount and
> null after unmount. Use `@testing-library/svelte` as used in other component
> tests in this repo. If the test infrastructure does not support mounting the
> full page (requires WASM), write a simpler test that verifies the export
> function produces correct output when called directly with fixture data
> (delegating mounting coverage to the E2E test in Task 5).

The minimum test to write here:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { formatCalculatorCsv } from "$lib/utils/export-csv";
import type { CalculatedRow } from "$lib/state/calculator.svelte";
// ... import mock particle/material fixtures from existing test helpers

describe("calculator CSV export function", () => {
  it("produces a non-empty CSV string for a valid row", () => {
    const row: CalculatedRow = {
      id: 1,
      rawInput: "100",
      normalizedMevNucl: 100,
      unit: "MeV",
      unitFromSuffix: false,
      status: "valid",
      stoppingPower: 7.289,
      csdaRangeCm: 7.71,
    };
    const csv = formatCalculatorCsv(
      [row],
      { id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.008, aliases: [] },
      { id: 1, name: "Liquid Water", density: 1.0, isGasByDefault: false },
      "PSTAR",
      "keV/µm",
      "MeV",
    );
    expect(csv).toContain("PSTAR");
    expect(csv).toContain("proton");   // particle label, not raw name
    expect(csv).toContain("100");      // energy value
    expect(csv).toContain("7.289");    // stopping power
  });
});
```

Run `pnpm test` — must be red (import errors or assertion failures).

### Step 3b — implement in `src/routes/calculator/+page.svelte`

Import `csvExportHandler` from `$lib/state/ui.svelte` and the new functions from
`$lib/utils/export-csv`. Add a `$effect` that registers and cleans up the export
callback:

```svelte
<script lang="ts">
  import { csvExportHandler } from "$lib/state/ui.svelte";
  import { formatCalculatorCsv, csvFilename } from "$lib/utils/export-csv";
  // ... other existing imports

  $effect(() => {
    csvExportHandler.value = () => {
      const rows = calcState.rows;
      const particle = entitySelection.selectedParticle;
      const material = entitySelection.selectedMaterial;
      const program = entitySelection.resolvedProgram?.name ?? "Unknown";

      if (!particle || !material) return;

      const csv = formatCalculatorCsv(
        rows,
        particle,
        material,
        program,
        calcState.stpDisplayUnit,
        calcState.masterUnit,
      );

      const filename = csvFilename(
        particle.name,  // or use getParticleLabel(particle) from particle-label.ts
        material.name,
      );

      triggerCsvDownload(csv, filename);
    };

    return () => {
      // Cleanup: unregister when the calculator page unmounts.
      csvExportHandler.value = null;
    };
  });

  /**
   * Triggers a browser file download for the given CSV string.
   * Uses a temporary <a> element; cleans up immediately after click.
   */
  function triggerCsvDownload(content: string, filename: string): void {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>
```

> For `getParticleLabel`: it is already exported from
> `$lib/utils/particle-label.ts` — use it to get the human-friendly name
> (e.g. `"proton"` instead of `"Hydrogen"`) for the filename and CSV header.

Run `pnpm test` — green. Commit:

```
feat(calculator): register CSV export callback via csvExportHandler on mount
```

---

## Task 4 — Enable Export CSV button in `+layout.svelte`

### Step 4a — failing test first

There are no unit tests for the layout shell directly (it requires full mount).
Instead, write the assertion as a Vitest component test **or** defer to E2E
(Task 5). For a quick unit-level guard, add to `src/tests/unit/ui-state.test.ts`:

```typescript
it("csvExportHandler.value is null initially (button should be disabled)", () => {
  // Reset between test runs — already covered in Task 2 tests.
  // This test documents the initial-null invariant that drives the disabled state.
  expect(csvExportHandler.value).toBeNull();
});
```

This is a documentation-style test — it is likely already green from Task 2.
The real behaviour is verified in Task 5 E2E.

### Step 4b — implement in `src/routes/+layout.svelte`

Import `csvExportHandler` from `$lib/state/ui.svelte`. Replace the hard-coded
`disabled` on the Export CSV button with a dynamic disabled binding, and add an
`onclick` handler:

```svelte
<script lang="ts">
  import { csvExportHandler } from "$lib/state/ui.svelte";
  // ... other existing imports
</script>

<!-- Replace the existing static Export CSV button -->
<Button
  variant="outline"
  size="sm"
  disabled={csvExportHandler.value === null}
  onclick={() => csvExportHandler.value?.()}
  class="hidden sm:inline-flex"
>
  Export CSV ↓
</Button>
```

Leave Export PDF with its existing `disabled` (no onclick yet — that is Task E
in a future session).

Run `pnpm test` — green (layout changes are not unit-tested; green = no regressions). Commit:

```
feat(layout): wire Export CSV toolbar button to csvExportHandler
```

---

## Task 5 — E2E test for CSV download

**Requires:** WASM binaries in `static/wasm/`. If they are absent locally, mark
the test `test.skip` and leave a comment:
```typescript
// Skipped when WASM binary absent. CI downloads artifact before running E2E.
```

### Step 5a — add to `tests/e2e/calculator.spec.ts`

Add a new `test` block (or a new `describe("CSV export")` block at the end of
the file):

```typescript
import { test, expect } from "@playwright/test";

// Use the WASM_TIMEOUT constant already defined in the file.

test.describe("CSV export", () => {
  test("Export CSV button is disabled on initial load before WASM is ready", async ({ page }) => {
    await page.goto("/calculator");
    const button = page.getByRole("button", { name: /Export CSV/i });
    await expect(button).toBeDisabled();
  });

  test("Export CSV button is enabled once the calculator has results", async ({ page }) => {
    await page.goto("/calculator");
    // Wait for WASM and at least one result row
    await expect(page.getByRole("button", { name: /Export CSV/i })).toBeEnabled({
      timeout: WASM_TIMEOUT,
    });
  });

  test("clicking Export CSV triggers a file download with .csv extension", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("button", { name: /Export CSV/i })).toBeEnabled({
      timeout: WASM_TIMEOUT,
    });

    // Listen for the download event
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export CSV/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
```

Run:

```sh
pnpm exec playwright test tests/e2e/calculator.spec.ts --grep "CSV export"
```

Use the `playwright` MCP to inspect failures interactively if needed.

Commit:

```
test(e2e): add CSV export button enable/disable and download tests
```

---

## Final checklist before handing back

After all 5 tasks are complete:

- [ ] `pnpm test` green — all Vitest unit + integration tests pass
- [ ] `pnpm exec playwright test tests/e2e/calculator.spec.ts` green (or CSV
      tests skipped with a clear comment if WASM absent)
- [ ] `pnpm lint` clean — no new ESLint errors
- [ ] `pnpm build` completes without errors (run a production build to catch
      TypeScript / import errors missed by the test runner)
- [ ] Each task has its own Conventional Commit
- [ ] `docs/ai-logs/2026-04-28-stage6-csv-export.md` is filled in
- [ ] `CHANGELOG-AI.md` has a new row prepended at the top of the table body
- [ ] `docs/ai-logs/README.md` has a one-line pointer to the new log file

---

## Notes — Svelte 5

- Use `$state`, `$derived`, `$effect` — never `export let`, `$:`, `onMount`
- Cleanup in `$effect`: `return () => { ... }` — used in Task 3 to unregister the handler
- Event handlers: `onclick={fn}` not `on:click`
- Reactive objects: mutate via reassignment (`obj.value = ...`), not in-place

## Notes — shadcn-svelte / Tailwind

- Import `Button` from `$lib/components/ui/button`
- Use the `tailwind` MCP to look up any class name you are unsure about
- CSS variables for theming are in `src/app.css`

## Notes — what is NOT in scope for this session

- Advanced-mode CSV configuration modal (export.md §1.1) — deferred to after
  multi-program mode is implemented
- PDF export (export.md §5–6) — separate future session
- Plot page CSV export — separate future session
- Export CSV on the Plot page toolbar — wire only the Calculator page handler now
