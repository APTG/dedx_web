# opencode / Qwen — UX Review Open Issues (2026-04-25)

> **Branch:** `fix/ux-review-open-issues-2` (create from `master`)  
> **Model:** Qwen  
> **Attribution line for AI log entries:** `(Qwen via opencode)`

---

## Context

This is a **SvelteKit + Svelte 5 (runes only)** project — TypeScript strict, Tailwind CSS v4,
shadcn-svelte + Bits UI components, pnpm package manager.  
The calculator computes stopping power / CSDA range via a libdedx C library compiled to WASM.

**Critical Svelte 5 rules (never break these):**
- Use `$state`, `$derived`, `$effect`, `$props`, `$bindable` — **never** `export let`, `$:`, `onMount`, stores, `createEventDispatcher`.
- Double quotes, semicolons, 2-space indent (Prettier).

**Key source files for these tasks:**
- `src/lib/state/calculator.svelte.ts` — `CalculatorState`, `CalculatedRow`, WASM call logic
- `src/lib/components/result-table.svelte` — table rendering, per-row error alerts, electron guard
- `src/lib/components/energy-input.svelte` — energy row input, `formatNumber()` at lines ~151-158
- `src/lib/units/unit-conversions.ts` — `formatSigFigs`, `convertEnergyToMeVperNucl`
- `src/lib/state/entity-selection.svelte.ts` — `EntitySelectionState`, `selectionSummary`
- `tests/e2e/complex-interactions.spec.ts` — existing complex E2E tests
- `src/tests/unit/calculator-state.test.ts` — unit tests for calculator state
- `src/tests/components/result-table.test.ts` — component tests for result table
- `docs/04-feature-specs/calculator.md` — calculator feature spec
- `docs/04-feature-specs/entity-selection.md` — entity-selection feature spec
- `docs/04-feature-specs/shareable-urls.md` — shareable URLs spec
- `CHANGELOG-AI.md` — AI session changelog (prepend a row at the start of your session)
- `docs/ai-logs/` — session log files (create one at the start of your session)

**Build / test commands:**
```sh
pnpm test          # Vitest unit + integration (405 tests currently passing — do not regress)
pnpm exec playwright test  # E2E (requires WASM in static/wasm/ — skip if not available)
pnpm lint
pnpm format
```

---

## Before you start

1. Read `CHANGELOG-AI.md` (top rows) to understand recent history.
2. Read `docs/ux-reviews/2026-04-25-calculator-full-review.md` — the source document.
3. Create branch: `git checkout -b fix/ux-review-open-issues-2`
4. Create your AI session log at `docs/ai-logs/2026-04-25-ux-review-open-issues.md`
   and prepend a row to `CHANGELOG-AI.md`.  Commit: `docs: start AI session log for open UX issues`.

---

## Working process (for ALL tasks)

- **TDD strictly**: write a failing test first (RED), implement the fix (GREEN), refactor if needed.
- **Commit after every completed task** using Conventional Commits
  (`fix:`, `refactor:`, `test:`, `docs:`).
- **Update your AI session log** (`docs/ai-logs/2026-04-25-ux-review-open-issues.md`) after each task.
- Use **shadcn-svelte** components where applicable (Button, Badge, Alert, etc.) — do not roll custom UI from scratch.
- Do **not** break any of the 405 currently passing tests.

---

## Tasks

### Task 1 — Replace `formatNumber` in `energy-input.svelte` with `formatSigFigs` (Issue #13)

**What:** `energy-input.svelte` has a local `formatNumber()` helper (around lines 151-158) that
formats display values differently from `formatSigFigs` in `unit-conversions.ts`.  Both table
components must agree on number output.

**Steps:**
1. Write a unit test (in `src/tests/unit/energy-input-format.test.ts` or extend an existing file)
   that asserts: for a given numeric value, the energy-input display string equals what
   `formatSigFigs(value, 4)` returns.  Run — it should fail.
2. In `energy-input.svelte`, import `formatSigFigs` from `$lib/units/unit-conversions` and replace
   the local `formatNumber` usage with `formatSigFigs(value, 4)`.
3. Run tests — all green.
4. Commit: `fix: replace local formatNumber in energy-input with formatSigFigs (#13)`

---

### Task 2 — Add debug logging for subnormal WASM values (Issue #7)

**What:** WASM sometimes returns physically nonsensical stopping-power values (~10⁻³¹⁴).  
The `formatSigFigs` crash fix masks this; we need visibility.

**Steps:**
1. In `calculator.svelte.ts`, inside `performCalculation()` (wherever raw WASM results are
   stored), add a `console.warn` when any result value is subnormal
   (`Math.abs(v) > 0 && Math.abs(v) < Number.MIN_VALUE * 1e10` or `!isFinite(v)`):
   ```
   console.warn("[dedx] subnormal/invalid WASM output", { programId, energyMevNucl, rawValue: v });
   ```
2. Write a unit test in `src/tests/unit/calculator-state.test.ts` that stubs the WASM call to
   return a subnormal value and asserts the warning is logged (use `vi.spyOn(console, 'warn')`).
3. Run — green.
4. Commit: `fix: warn on subnormal WASM output in performCalculation (#7)`

---

### Task 3 — Refactor `calculationResults` from `Map<number, …>` to `Map<rowId, …>` (Issue #10)

**What:** `calculator.svelte.ts` lines ~49-51 and ~121, ~196 key the results map on the
floating-point `normalizedMevNucl` value.  This risks float-key collisions and blocks Inverse STP
(which needs two energies per input STP value).  Refactor to key on the row's stable string `id`.

**Steps:**
1. Read `src/lib/state/calculator.svelte.ts` fully before making any changes.
2. Write tests (extend `src/tests/unit/calculator-state.test.ts`) that:
   - Assert two rows with the same `normalizedMevNucl` but different `id`s both have their results stored independently.
   - Assert that adding a new row (with `id`) stores its result under that `id`.
   Run — they should fail.
3. In `calculator.svelte.ts`:
   - Change `calculationResults: Map<number, CalculationResult>` → `Map<string, CalculationResult>` where the key is `CalculatedRow.id`.
   - Update all reads (`calculationResults.get(row.normalizedMevNucl)`) to use `calculationResults.get(row.id)`.
   - Update all writes similarly.
4. Run all tests — green (unit + component tests must not regress).
5. Commit: `refactor: key calculationResults by rowId instead of float energy (#10)`

---

### Task 4 — Extract `result-table.svelte` columns into a `columns: ColumnDef[]` prop (Issue #11)

**What:** `result-table.svelte` has 5 hard-coded `<th>` / `<td>` columns.  Multi-program and inverse
calculator tabs each need a different column set.  Extract column definitions into a typed
`ColumnDef[]` prop so the same component renders any column layout.

**Steps:**
1. Read `src/lib/components/result-table.svelte` in full.
2. Define a `ColumnDef` TypeScript interface (in a new `src/lib/types/column-def.ts` or inline at top of result-table):
   ```ts
   interface ColumnDef {
     id: string;
     header: string;
     getValue: (row: CalculatedRow) => string | number | null;
     unit?: string;
     align?: "left" | "right";
   }
   ```
3. Write a component test in `src/tests/components/result-table.test.ts` that:
   - Renders `ResultTable` with a custom 2-column `ColumnDef[]` (e.g., just energy + STP).
   - Asserts the rendered `<th>` headers match the custom column names.
   Run — should fail because the prop doesn't exist yet.
4. Refactor `result-table.svelte`:
   - Accept `columns: ColumnDef[]` as a `$props()` field (with a sensible default that matches the current 5 columns so existing usage doesn't break).
   - Replace the hard-coded `<thead>` and `<tbody>` column rendering with a `{#each columns as col}` loop.
5. Run all tests — green.  Verify the calculator page still renders correctly.
6. Commit: `refactor: extract column definitions into ColumnDef[] prop in result-table (#11)`

---

### Task 5 — Lift electron-unsupported guard into `EntitySelectionState` (Issue #12)

**What:** `result-table.svelte` lines ~133-134 contain a hard-coded `ELECTRON_UNSUPPORTED_MESSAGE`
guard.  The inverse calculator spec explicitly states electrons ARE supported via ESTAR for inverse
tabs.  Reusing this component would falsely suppress electron rows.

**Steps:**
1. Read `src/lib/state/entity-selection.svelte.ts` (especially `EntitySelectionState` and `isComplete`).
2. Write a unit test that asserts: when `selectedParticle` is the electron and `isComplete` is `false`,
   a new `selectionStatus` derived field on `EntitySelectionState` equals `"electron-unsupported"`.
   Also write a test for a non-electron particle that asserts it returns `"ready"` or `"incomplete"`.
   Run — should fail.
3. Add a `selectionStatus: "ready" | "incomplete" | "no-program" | "electron-unsupported"` derived
   field to `EntitySelectionState` (use `$derived`).
4. In `result-table.svelte`, remove the hard-coded electron check.  Instead, accept
   `selectionStatus` as a prop (or read it from the singleton state) and show the unsupported
   message only when `selectionStatus === "electron-unsupported"`.  Pass `selectionStatus` from
   `+page.svelte`.
5. Run all tests — green.
6. Commit: `refactor: lift electron-unsupported guard into EntitySelectionState.selectionStatus (#12)`

---

### Task 6 — E2E tests for heavy-ion (Carbon, Helium) calculations (Issue #8)

**What:** All E2E tests currently use Proton+Water.  Carbon and Helium exercise different code paths:
per-row unit selector (`massNumber > 1`), different auto-select chain (ICRU73 → MSTAR), and
`convertEnergyToMeVperNucl` with `A > 1`.

**Steps:**
1. In `tests/e2e/complex-interactions.spec.ts`, add a `describe("heavy-ion calculations")` block with:
   - Test: select Carbon, select Water, enter `"100"` MeV/nucl → assert result table shows a
     numeric STP value (not `"—"`) and no JS console error is thrown.
   - Test: select Helium, select Water, enter `"50"` MeV/nucl → same assertions.
   - Test: select Carbon, change per-row unit to `"MeV/nucl"` → assert the `→ MeV/nucl` column
     shows the entered value (12 → 12.0).
   - Test: switch particle from Proton to Carbon while a value is entered → assert no crash and
     auto-select resolves to a non-null program name.
2. Run Playwright tests (if WASM not available, mark as `test.skip` with a note but still commit).
3. Commit: `test(e2e): add heavy-ion Carbon and Helium calculation E2E tests (#8)`

---

### Task 7 — E2E / unit test for MeV/u and MeV/nucl column display (Issue #6)

**What:** Entering `"12MeV/u"` or `"12 MeV/nucl"` shows nothing in the `→ MeV/nucl` column.
The parser and converter are correct; the bug is likely a Svelte 5 reactivity miss.

**Steps:**
1. Write a unit test in `src/tests/unit/calculator-state.test.ts` that creates a `CalculatorState`,
   adds a row with raw input `"12MeV/u"` and proton as particle (massNumber=1, atomicMass≈1.008),
   and asserts `row.normalizedMevNucl` is approximately `12.096` (12 × 1.008 / 1).
   Run — note whether it passes or fails.
2. Write a unit test for `"12 MeV/nucl"` → `normalizedMevNucl ≈ 12.0`.
   Run — note.
3. If both unit tests pass but the E2E fails, add a Playwright test in
   `tests/e2e/complex-interactions.spec.ts`:
   - Enter `"12MeV/u"` for proton+water → assert `→ MeV/nucl` cell shows `~12`.
   - Enter `"12 MeV/nucl"` for proton+water → assert `→ MeV/nucl` cell shows `12`.
4. If unit tests fail, fix `parseRow()` / `computeRows()` in `calculator.svelte.ts` so
   `normalizedMevNucl` is computed for `MeV/u` and `MeV/nucl` inputs, then re-run.
5. Commit: `fix: MeV/u and MeV/nucl inputs now populate → MeV/nucl column (#6)` (or
   `test: add unit+E2E tests revealing MeV/u column display bug (#6)` if fix is deferred).

---

### Task 8 — Spec updates (Issue #9)

**What:** Three spec files need updating to match the code that was already merged.

**Steps (update docs only, no code changes):**

**8a. `docs/04-feature-specs/calculator.md`**
- Add an "Extreme magnitude fallback" subsection to the Number Formatting section (around line 378-381):
  - NaN / Infinity → `"—"` (em-dash).
  - `|magnitude| ≥ 15` OR `magnitude < −(sigFigs + 5)` → `toPrecision(sigFigs)` (scientific notation).
  - State which columns are exempt from the existing "no scientific notation" rule (none — the fallback
    overrides the rule only for physically nonsensical values).
- In the Empty State section (around lines 399-406, 467-471), replace the single generic message
  with the three context-aware branches now implemented:
  1. Electron selected → "Electron (ESTAR) is not yet supported by libdedx v1.4.0."
  2. Particle + material selected but no program → "No program supports **X** in **Y**. Change the particle or material selection to continue."
  3. Neither selected → "Select a particle and material to calculate."

**8b. `docs/04-feature-specs/entity-selection.md`**
- In the "Auto-select program resolution" section (around lines 306-322), document the new
  generic fallback step: after the preferred chain fails, the first program returned by
  `getAvailablePrograms(matrix, particleId, materialId)` is used.  Note the trade-off (MSTAR
  accuracy) and that the resolved name is shown in the selection summary.

**Steps:**
1. Make the spec edits above.
2. Commit: `docs: update calculator.md and entity-selection.md for post-fix spec compliance (#9)`

---

### Task 9 — Document auto-select fallback in shareable URLs (Issue #14)

**What:** The auto-select fallback is not recorded in the URL.  The same
`?program=auto&particle=H&material=Urea` resolves to different programs across libdedx versions
with no warning.

**Steps:**
1. In `docs/04-feature-specs/shareable-urls.md`, add a note in the `program` parameter section:
   - When `program=auto` and the resolved program is a fallback (not from the preferred chain),
     the resolved program ID should be appended as `program=auto:MSTAR` (or similar notation).
   - Alternatively, surface a "Fallback used" badge in the UI.
   - Mark this as a known gap with a TODO for the next shareable-URLs implementation session.
2. In `result-table.svelte` or `+page.svelte`, if a `selectionStatus` badge area already exists,
   add a subtle shadcn `Badge` component (variant `outline` or `secondary`) that shows
   "Auto → [ProgramName]" when the resolved program came from the fallback path.
   Use `EntitySelectionState.selectedProgram` (narrowed to `AutoSelectProgram`) to determine
   whether `resolvedProgram` differs from the primary chain.
   **Only add the badge if the UI integration is clean and non-disruptive** — if it needs
   significant layout work, defer the UI change and do the spec update only.
3. Write a unit test asserting that when `selectedProgram.type === "auto"` and
   `resolvedProgram` is a fallback, `selectionSummary` contains `"Auto-select → [name]"`.
   (This may already be tested — check first.)
4. Commit: `docs: document auto-select fallback in shareable-urls spec (#14)` and optionally
   `feat: show auto-select fallback badge in result table (#14)`.

---

### Task 10 — Final: update AI session log and CHANGELOG-AI.md

After all tasks are done:
1. Complete `docs/ai-logs/2026-04-25-ux-review-open-issues.md` with a narrative and task list.
2. Update the `CHANGELOG-AI.md` row you created at the start with a full description.
3. Update `docs/ux-reviews/2026-04-25-calculator-full-review.md` — change the Status column
   for issues #6, #7, #8, #9, #10, #11, #12, #13, #14 from `🔍 OPEN` to `✅ FIXED` or
   `📝 SPEC` as appropriate.
4. Commit: `docs: complete AI session log for UX review open issues`

---

## Order of execution

Work through tasks in order.  Tasks 1-5 are refactors/fixes that are independent of each other
but should all be done before Task 6-7 (E2E tests) so the E2E tests exercise the refactored code.
Task 8-9 are docs-only and can be interleaved.

**Stop and ask before proceeding** if you encounter:
- A test that you cannot make pass without a breaking change to the public API.
- A Svelte 5 reactivity issue you cannot diagnose within 2 attempts.
- Anything in `entity-selection.svelte.ts` that would require restructuring `EntitySelectionState`
  significantly — that touches many components and should be agreed first.

---

## Acceptance criteria

- `pnpm test` passes with **≥ 405 tests** (ideally more from the new ones).
- `pnpm lint` and `pnpm format --check` pass.
- No Svelte 4 patterns introduced.
- All 9 open issues from the UX review are either fixed, tested, or documented (spec updated).
- AI session log and CHANGELOG row are complete.
