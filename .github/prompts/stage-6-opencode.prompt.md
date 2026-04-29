---
description: "Stage 6 Feature Pages — opencode/Qwen implementation guide. Covers Calculator URL sync, CSV/PDF export, multi-program mode, and Stage 5 polish."
---

# Stage 6 — Feature Pages (opencode/Qwen session prompt)

> **Model:** Qwen/Qwen3.6-35B-A3B via opencode
> **Branch:** `qwen/stage-6` (one branch, one commit per sub-task)
> **Reference:** `docs/00-redesign-plan.md` §8 Stage 6

---

## Read first (do this before writing any code)

```
docs/00-redesign-plan.md       # Stage 6 overview and rules
docs/03-architecture.md        # Component tree, data flow
docs/06-wasm-api-contract.md   # LibdedxService interface + types
docs/progress/stage-5.md       # What Stage 5 delivered and what Stage 6 picks up
docs/ux-reviews/2026-04-28-stage5-completion-and-stage6-readiness.md  # Open items
```

Then read only the spec files listed under the sub-task you are about to implement.

---

## Project rules (non-negotiable)

- **Svelte 5 only** — `$state`, `$derived`, `$effect`, `$props`, `$bindable`.
  Never: `export let`, `$:`, `createEventDispatcher`, `onMount`/`onDestroy` from
  `svelte`, `svelte/store`.
- **TypeScript strict** — no `any` except at WASM boundaries with explicit casts.
- **Tailwind CSS v4** — styling via CSS classes; no inline styles or new CSS files.
- **shadcn-svelte + Bits UI** — use existing UI primitives from
  `src/lib/components/ui/`. Do not add new UI libraries.
- **WASM via service** — all libdedx calls go through `LibdedxService` in
  `src/lib/wasm/libdedx.ts`. Never call Emscripten directly from components.
- **Prettier / ESLint** — double quotes, semicolons, 2-space indent.
  Run `pnpm lint && pnpm format` and fix all issues before each commit.
- **Tests required** — every acceptance criterion must have a Vitest unit or
  component test. Mock `LibdedxService` in unit tests. Real WASM only in E2E.
- **Conventional commits** — `feat:`, `fix:`, `test:`, `chore:`, `docs:`.

---

## What is already done (do NOT reimplement)

| Already shipped | Location |
|---|---|
| Calculator page (entity selection, unified table, debounce, KE conservation) | `src/routes/calculator/+page.svelte`, `src/lib/state/calculator.svelte.ts` |
| Plot page with JSROOT, multi-series, color pool | `src/routes/plot/+page.svelte`, `src/lib/state/plot.svelte.ts` |
| URL encode/decode for calculator (full implementation) | `src/lib/utils/calculator-url.ts` |
| URL encode/decode for plot (full implementation) | `src/lib/utils/plot-url.ts` |
| CSV generate + download helpers (partial — schema wrong, see Task 3) | `src/lib/export/csv.ts` |
| App toolbar shell: Export PDF (disabled), Export CSV (disabled), Share URL | `src/routes/+layout.svelte` |
| Share URL button (copies `window.location.href`) | `src/routes/+layout.svelte` |

---

## Sub-tasks (implement in order, one commit each)

### Task 1 — Stage 5 polish: material phase badge + three desktop open items

**Spec:** `docs/04-feature-specs/calculator.md` §1 "Material Phase Badge"
**UX source:** `docs/ux-reviews/2026-04-28-stage5-completion-and-stage6-readiness.md` §3 items D1–D3

**What to do:**

1. **Material phase badge** — add a phase indicator ("gas" / "liquid" / "solid") next to
   the Material combobox in compact mode (`entity-selection-comboboxes.svelte`).
   `MaterialEntity.isGasByDefault` → gas (true) / solid or liquid (false).
   Use a small `Badge` or `<span>` styled via Tailwind, placed inside or adjacent
   to the material combobox trigger.

2. **D1 – Resolved program label** — below the entity selection row on the Calculator
   page, show "Results calculated using {programName} (auto-selected)" when program
   is `Auto-select`. Source: `calculator.md` §Output "Resolved Program Label".
   The resolved program is available from `entitySelection.resolvedProgramId`.

3. **D2 – Valid energy range label** — below the result table, show
   "Valid range: {min}–{max} {unit} ({programName}, {particleName})".
   Source: `calculator.md` §Behavior "Energy Range Display".
   Use `LibdedxService.getMinEnergy()` / `getMaxEnergy()`.

4. **D3 – WASM loading spinner** — while `!wasmReady.value` the calculator page
   currently shows nothing useful. Show a loading state: disable all controls
   and show "Initialising calculation engine…" above the table.
   Source: `calculator.md` §Output "Empty States" — WASM not yet loaded row.

**Tests:** unit tests for the phase badge label logic; component test verifying
the resolved-program label renders when `entitySelection.resolvedProgramId` is set.

**Commit:** `feat: add material phase badge, resolved-program label, energy range, WASM loading state`

---

### Task 2 — Wire Calculator URL sync

**Spec:** `docs/04-feature-specs/shareable-urls.md` §4, `docs/04-feature-specs/calculator.md`
§ "URL State Encoding"

**What to do:**

The encode/decode logic in `src/lib/utils/calculator-url.ts` is complete. This task
wires it to the running page state.

1. **On page load** — in `src/routes/calculator/+page.svelte` (or `+page.ts`),
   read `page.url.searchParams`, call `decodeCalculatorUrl(params)`, and
   restore: `particleId`, `materialId`, `programId` into the entity selection
   state; `rows` and `masterUnit` into the calculator state.
   If any param is invalid, fall back to defaults silently (already handled by
   the decoder).

2. **On state change** — use `$effect` to watch the canonical calculator state
   and call `replaceState(calculatorUrlQueryString(state))` to keep the URL in sync
   as the user types / changes selections. Throttle to at most once per 300ms
   to avoid flooding the history stack.

3. **Share URL button** — the button in `+layout.svelte` already copies
   `window.location.href`. After this task, the URL bar is kept up to date, so
   the Share URL button automatically shares the canonical state. No additional
   wiring needed. Add a visual "URL updated" notification: after state changes,
   briefly show a "↺ Updated" badge next to the Share URL button. See
   `shareable-urls.md` §8.4 for button states (ready / copied / updated).

4. **Clean up** — if `src/lib/state/url-sync.ts` still exists and is unwired,
   delete it. It was a placeholder superseded by `calculator-url.ts`.

**Tests:** unit tests for encode/decode round-trips (already partially present —
check `src/tests/` before writing new ones). Add component integration test:
load page with `?particle=1&material=276&program=auto&energies=100,200&eunit=MeV`,
verify entity selection + rows are restored.

**Commit:** `feat: wire calculator URL sync — state ↔ URL on load and change`

---

### Task 3 — CSV export (fix schema + wire toolbar button)

**Spec:** `docs/04-feature-specs/export.md` §2 (Calculator CSV), §5.1 (toolbar placement)

**What to do:**

The existing `src/lib/export/csv.ts` uses a 3-column schema. The spec requires 5 columns
in a specific order and with specific header labels.

1. **Rewrite `generateCsv`** to produce the 5-column Calculator CSV per `export.md` §2:
   - Column order: `Normalized Energy (MeV/nucl)`, `Typed Value`, `Unit`,
     `CSDA Range`, `Stopping Power ({active unit})`.
   - `Stopping Power` header unit must match the active display unit
     (e.g., `keV/µm` for non-gas, `MeV·cm²/g` for gas).
   - Omit invalid/error rows (only rows with `status === "valid"` are included).
   - Filename convention: `dedx_calculator_{particle}_{material}_{program}.csv`
     (all lowercase, spaces replaced with underscores).
   - The `downloadCsv` helper stays unchanged.

2. **Wire the "Export CSV ↓" toolbar button** in `+layout.svelte`:
   - The button must be **enabled** when at least one result row is present
     (i.e. `calculatorState` has ≥1 row with `stoppingPower !== null`), and
     **disabled** otherwise.
   - On click: call `generateCsv` with the current rows and `downloadCsv`.
   - The toolbar is shared across pages; enable the button only on the Calculator
     page (detect via `page.url.pathname`). On the Plot page the CSV export is
     a separate future task — keep the button disabled there for now.

3. **Expose calculator state to layout** — the toolbar in `+layout.svelte` needs
   access to the calculator result rows. Use a module-level `$state` singleton in
   a new file `src/lib/state/export.svelte.ts`:
   ```typescript
   // writable from the calculator page, readable in the layout
   export const exportState = { value: { rows: [], stpUnit: "keV/µm", ... } };
   ```
   The calculator page updates this on every recalculation. The layout reads it.

**Tests:** unit tests for `generateCsv` — verify column order, header unit substitution,
error-row exclusion, filename generation. Test the 5-column output against a known fixture.

**Commit:** `feat: implement 5-column CSV export and wire toolbar button`

---

### Task 4 — PDF export (basic mode)

**Spec:** `docs/04-feature-specs/export.md` §3 (basic mode), §6.1 (Calculator PDF layout)

**What to do:**

1. **Add jsPDF** — `pnpm add jspdf`. Check the license (MIT) and add to `package.json`.
   Use dynamic import (`import('jspdf')`) to avoid bundling it in the initial chunk.

2. **Implement `src/lib/export/pdf.ts`** with a single exported function:
   ```typescript
   export async function downloadCalculatorPdf(rows: EnergyRow[], meta: PdfMeta): Promise<void>
   ```
   Basic-mode PDF content per `export.md` §6.1:
   - Header: app name ("webdedx"), particle name, material name, program name.
   - Timestamp: "Generated: {ISO UTC timestamp}".
   - Clickable URL: current `window.location.href`.
   - Results table: same 5 columns as the CSV (Normalized Energy, Typed Value, Unit,
     CSDA Range, Stopping Power). Valid rows only.
   - Portrait A4, reasonable margins, 10pt body font.
   - No advanced metadata block in basic mode (no build info, no Z/A, no density).

3. **Wire the "Export PDF" toolbar button** in `+layout.svelte`:
   - Enable when `exportState` has ≥1 valid result row (same condition as CSV).
   - On click: call `downloadCalculatorPdf`.
   - Show a brief loading indicator on the button while the PDF generates
     (dynamic import takes ~50ms on first call).

**Tests:** unit test for `downloadCalculatorPdf` — mock `jspdf` and verify it is
called with the correct rows and metadata. Test that invalid rows are excluded.
Do not snapshot the PDF binary.

**Commit:** `feat: implement basic-mode PDF export and wire toolbar button`

---

### Task 5 — Multi-program comparison mode (Advanced)

**Spec:** `docs/04-feature-specs/multi-program.md` (read in full before starting)

This is the largest task. Break your work into these increments and commit after each:

#### 5a — Basic/Advanced mode toggle

- Add a "Basic / Advanced" segmented control to the app toolbar (top-right, leftmost
  position in the action cluster).
- Use `src/lib/state/ui.svelte.ts` to store `advancedMode: boolean` (module-level
  `$state` wrapper).
- In Advanced mode, display an onboarding hint once (localStorage flag
  `dedx_advanced_hint_shown`): "Advanced mode: compare results across multiple
  programs. Select programs below."
- **Commit:** `feat: add Basic/Advanced mode toggle to toolbar`

#### 5b — Multi-program selector in Calculator (Advanced mode only)

- When Advanced mode is active, show a program multi-select control below the entity
  selection row on the Calculator page (hidden in Basic mode).
- Uses a checkbox list of available programs for the current particle/material pair,
  sourced from the compatibility matrix.
- Default: all compatible programs selected.
- Show/hide individual programs without removing them from the selection.
- **Commit:** `feat: add multi-program selector to calculator advanced mode`

#### 5c — Multi-program calculation and grouped columns

- Call `LibdedxService.calculateMulti()` when Advanced mode is active, passing all
  selected programs.
- Expand the unified table with extra columns grouped **by quantity**:
  - Group 1 — Stopping Power: one column per selected program.
  - Group 2 — CSDA Range: one column per selected program.
- Column headers show the program name (abbreviated if needed).
- The "default" (auto-selected) program's columns are visually highlighted
  (e.g., bold header or accent border).
- Partial failures (one program errors, others succeed): show "—" in that program's
  columns; show a subtle warning badge on the column header.
- Drag-and-drop column reordering within each group (reorder syncs between STP and
  CSDA groups). Use HTML5 drag-and-drop events.
- **Commit:** `feat: multi-program grouped columns with calculateMulti`

#### 5d — Quantity-focus control + delta tooltip

- Add a "Both / STP only / CSDA only" segmented control (quantity-focus) to the
  Calculator page in Advanced mode. Hides the CSDA or STP columns entirely.
  Default: "Both".
- On hover over a non-default program's cell: show a tooltip with
  `Δ = {value} ({percent}%)` relative to the default program's value.
- **Commit:** `feat: quantity-focus control and delta tooltip in multi-program mode`

#### 5e — URL encoding for Advanced mode

- Advanced-mode URL params per `multi-program.md` §URL:
  `mode=advanced`, `programs={id1},{id2}`, `hidden_programs={id3}`, `qfocus=both|stp|csda`.
- Extend `calculator-url.ts`: `encodeCalculatorUrl` and `decodeCalculatorUrl` already
  handle basic mode; add the advanced-mode params.
- Wire to `replaceState` in the same `$effect` as Task 2.
- **Commit:** `feat: URL encoding for advanced multi-program mode`

---

## AI logging (MANDATORY — do after ALL tasks are done)

### 1. Prepend to `CHANGELOG-AI.md`

```
| 2026-04-29 | 6 | Stage 6 feature pages: material phase badge, calculator URL sync, CSV export, PDF export, multi-program mode (Qwen/Qwen3.6-35B-A3B via opencode) | [log](docs/ai-logs/2026-04-29-stage-6.md) |
```

Replace the date with the actual date. If you only complete some tasks in this session,
list only those tasks in the description.

### 2. Create `docs/ai-logs/YYYY-MM-DD-stage-6.md`

```markdown
# YYYY-MM-DD — Stage 6 Feature Pages

## Session Narrative

### Task 1: Stage 5 polish
**AI response**: <what was done, key decisions>

### Task 2: Calculator URL sync
...

## Tasks

### Stage 5 polish (material phase badge, D1–D3)
- **Status**: completed
- **Stage**: 6
- **Files changed**: ...
- **Decision**: ...

### Calculator URL sync
- **Status**: completed
- **Stage**: 6
- **Files changed**: ...
```

---

## Verification checklist (run before each commit)

```sh
pnpm lint          # ESLint — must pass with 0 errors
pnpm format        # Prettier — fix any formatting
pnpm test          # Vitest — all tests must pass
pnpm build         # SvelteKit build — must succeed
```

If any check fails, fix it before committing. Do not use `--no-verify`.

---

## Fall-back rule

If this task stalls and `pnpm lint && pnpm test && pnpm build` does not pass within the
time-box (suggested: one working day per sub-task), do NOT merge. Create a closing log
entry at `docs/ai-logs/YYYY-MM-DD-qwen-stage-6-attempt.md` with what worked and what
failed. Abandon the branch. Resume on `master` with GitHub Copilot.
