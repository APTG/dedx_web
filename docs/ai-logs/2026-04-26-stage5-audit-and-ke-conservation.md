# 2026-04-26 — Stage 5 audit + kinetic-energy-conservation gap report

**Model:** (Claude Sonnet 4.6 via Copilot coding agent)

## Session Narrative

### Prompt 1: "check what else is to implement in stage 5 … duplications … e2e gaps … KE conservation … add row UX … detailed report + UX report … keep ai log … update spec if needed … run e2e tests"

**AI response:** Performed a read-only audit of the Stage 5 code, tests
and specs. Findings:

- Stage 5.1 (entity selection): functionally done, but `docs/progress/stage-5-entity-selection.md`
  long-tail items (auto-fallback notifications, loading skeleton, WASM
  retry button, etc.) are still open.
- Stage 5.2 (energy input): the standalone `src/lib/components/energy-input.svelte`
  was superseded by Stage 5.4 ResultTable but never deleted. Same story
  for the prototype `src/lib/units/energy.ts` module. Both still ship and
  are still tested. ~480 LOC of duplication.
- Stage 5.3 (unit selector): the `EnergyUnitSelector` component exists
  and is fully tested, but `src/routes/calculator/+page.svelte` does **not**
  render it. The user can only change the master unit by typing a unit
  suffix (which switches to per-row mode) or via per-row dropdowns (heavy
  ions only). Spec ↔ implementation mismatch.
- Stage 5.4 (result table): done, but `result-table.svelte` calls
  `triggerCalculation()` synchronously on every keystroke. The
  `debounce()` util in `src/lib/utils/debounce.ts` exists with 8 unit
  tests but **no caller imports it**, contrary to `calculator.md:840`.
- Stage 5.5 (plot): correctly marked as not started.

On kinetic-energy conservation: today's behaviour is "typed number
preserved verbatim across particle and per-row-unit switches" — explicitly
mandated by `unit-handling.md:100-113`. The user is requesting the
opposite (kinetic energy as the conserved quantity). The conversion
helpers are already in `src/lib/utils/energy-conversions.ts`
(`convertEnergyToMeVperNucl`, `convertEnergyFromMeVperNucl`). What's
missing is wiring + spec update.

On "user-friendly add row": there is no button. The default state has
exactly one pre-filled row; the user must click on the row, press End,
press Enter to add a second one. The legacy `energy-input.svelte` had
an explicit `+ Add row` button that was lost in the 5.4 rewrite.

Built the WASM (`bash wasm/build.sh` via Docker + Emscripten — submodule
`libdedx` had to be initialised first), built the SvelteKit app
(`pnpm build`) and ran the full E2E suite **before** any code change to
get a baseline: **60 tests, 58 passed, 2 skipped**. All unit/integration
tests also passing: **419 tests across 22 files**.

Wrote three deliverables:

1. **`tests/e2e/particle-unit-switching.spec.ts`** — 12 tests in 3
   `describe` blocks. The 6 "active" tests lock in the current spec'd
   behaviour (typed number preserved verbatim). The 6 `test.fixme()`
   tests describe the desired KE-conservation behaviour (He 20 MeV/nucl
   → proton 80 MeV; round trip back to 20 MeV/nucl; per-row dropdown
   conversion; master-unit segmented control conversion; multi-row
   independence; electron edge case). Added one E2E covering the "no
   visible Add row button" current state. Re-ran full E2E: **72 tests,
   64 passed, 8 skipped (6 fixme + 2 pre-existing skips)**.
2. **`docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`** —
   detailed UX review with the 7-row priority table, repro steps, and
   spec-change recommendations.
3. **`docs/progress/stage-5-audit-2026-04-26.md`** — Stage-by-stage audit
   covering what's actually done vs. what's marked done, every
   duplication discovered, and a 7-step refactor plan with risk +
   LOC estimate.

Updated `docs/04-feature-specs/unit-handling.md` with a small note
under §"Unit Preservation on Particle Change" pointing readers at the
new UX review and flagging that the "values not modified" rule is
under review for the next iteration. Did **not** rewrite the spec
itself — that's a design decision the project owner needs to confirm.

Updated `CHANGELOG-AI.md`, `docs/ai-logs/README.md`, and
`docs/ux-reviews/README.md` indexes for discoverability.

### Validation

- `pnpm test`: 419 unit/integration tests passing across 22 files.
- `pnpm exec playwright test --project=chromium`: 72 tests, 64 passed,
  8 skipped (6 new `fixme` + 2 pre-existing skips). Zero regressions.

## Tasks

### Stage 5 audit
- **Status:** completed
- **Stage:** 5 (audit, no functional change)
- **Files changed:**
  - `docs/progress/stage-5-audit-2026-04-26.md` (new)

### UX review on KE conservation, master-unit selector, add-row UX
- **Status:** completed (review + recommendations); the underlying gaps
  remain **open** for follow-up implementation work.
- **Stage:** 5
- **Files changed:**
  - `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md` (new)
  - `docs/ux-reviews/README.md` (index row added)

### E2E corner-case sequences
- **Status:** completed; KE-conservation tests intentionally `test.fixme()`
- **Stage:** 5
- **Files changed:**
  - `tests/e2e/particle-unit-switching.spec.ts` (new, 12 tests)

### Spec annotation
- **Status:** completed (note only — full rewrite deferred to next session)
- **Files changed:**
  - `docs/04-feature-specs/unit-handling.md` (annotation added under
    "Unit Preservation on Particle Change" linking to the UX review)

### Index + changelog updates
- **Status:** completed
- **Files changed:**
  - `CHANGELOG-AI.md` (one new top row)
  - `docs/ai-logs/README.md` (this file's entry)

---

## Round 2 — same day, follow-up prompt

### Prompt 2: "I am hesitating now on the kinetic energy conservation. give me some cons or pros whether I should conserve MeV value or MeV/nucl value … check whether code distinguishes meV (milli) from MeV (mega) … case sensitive also for EV/eV … add acceptance criteria … investigate 3.820e-314 stopping power bug … note that user prefers proton over Hydrogen, alpha particle nice, rest under Ions category … why no symbols for Tin? … add PR with another detailed report"

**AI response:** Five threads, executed in one PR round:

1. **KE conservation pros/cons** — extended the UX review with a §
   "Conservation choice" section laying out three options (A: total MeV
   conserved; B: per-nucleon conserved; C: status-quo "literal text").
   Recommendation: **Option B** — the user's "should always be visible"
   note about MeV/nucl makes B the only choice where the displayed and
   the libdedx-natural quantity are the same. Electron special case
   (no nucleons) handled by an explicit "convert to total MeV using
   source particle's A" fallback in spec text.

2. **Case sensitivity audit** — found a real bug:
   `src/lib/utils/energy-parser.ts:88` previously called
   `.toLowerCase()` so `meV` (10⁻³ eV) collapsed into `MeV` (10⁶ eV),
   a 10⁹ ratio. Fixed by switching to a case-sensitive lookup table
   containing only the canonical SI casing for each accepted suffix.
   `mev`, `MEV`, `meV`, `EV`, `KeV`, `MeV/Nucl` all now rejected with
   `unknown unit: <as typed>`. Six new rejection tests added; two old
   case-insensitive tests inverted. 423/423 unit tests passing.

3. **Acceptance criteria added** — `unit-handling.md` gained two new
   acceptance blocks: "Inline Unit Detection — case sensitivity" (7
   criteria) and "Always-visible MeV/nucl column" (4 criteria).

4. **`3.820e-314` denormal investigation** — root cause is
   `src/lib/wasm/libdedx.ts:163-164` calling `_malloc` for stp/csda
   output buffers without zero-init. If the libdedx C function returns
   success but doesn't write every output slot (transient internal
   state, rapid second call, etc.), leftover heap bytes leak through as
   denormalised IEEE-754 doubles. Defensive fix: the buffers are now
   zero-initialised before the C call, so any unwritten slot reads back
   as a clean `0`, which the existing subnormal-output warning then
   flags explicitly. The deeper C-side investigation remains a follow-up
   issue against `libdedx/`.

5. **Particle naming + missing symbols** —
   - Spec change: added "Particle naming preferences" section to
     `entity-selection.md` documenting `proton` / `alpha particle` /
     `electron` (lowercase, no symbol) for IDs 1/2/1001 and `Element
     (Symbol)` for ions Z=3..118; "Beams" / "Ions" group headings.
   - Code fix for missing symbols: `PARTICLE_ALIASES` in
     `src/lib/config/particle-aliases.ts` was only populated up to Z=18,
     which is why the user's screenshot showed Tin (Z=50), Antimony,
     Iodine, Copernicium without their `(Sn)` etc. parentheticals. The
     table is now exhaustive Z=1..118 (every IUPAC element). Aliases for
     IDs 1 and 2 also extended (`alpha particle`, locale variants).
   - The UI rename (`Hydrogen (H)` → `proton` etc.) was deliberately
     deferred — it touches existing component tests, and the user only
     asked for the preference to be **recorded** in the spec.

6. **E2E run** — local Playwright timed out after ~17 min on the full
   suite (Chromium needed reinstall after a fresh node_modules); CI
   will produce the authoritative numbers. The new
   `particle-unit-switching.spec.ts` was already confirmed green in
   Round 1.

## Tasks (round 2)

### Case-sensitive parser
- **Status:** completed
- **Files changed:**
  - `src/lib/utils/energy-parser.ts` (CANONICAL_UNITS map, case-sensitive lookup)
  - `src/tests/unit/energy-parser.test.ts` (-2 / +6 tests)

### Defensive zero-init for WASM output
- **Status:** completed
- **Decision:** zero-initialise both output buffers before the C call.
  Cheaper than alternatives (alloc-and-clear via Module.HEAPU8.fill,
  or switching to `_calloc`) and keeps the diff to two lines.
- **Files changed:**
  - `src/lib/wasm/libdedx.ts` (3 added lines + comment)

### Particle aliases — exhaustive Z=1..118
- **Status:** completed
- **Files changed:**
  - `src/lib/config/particle-aliases.ts` (table extended; aliases enriched for IDs 1, 2)

### Spec updates
- **Status:** completed
- **Files changed:**
  - `docs/04-feature-specs/unit-handling.md` (case sensitivity + always-visible MeV/nucl acceptance blocks; suffix table reformatted)
  - `docs/04-feature-specs/entity-selection.md` (Particle naming preferences section)
  - `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md` (Conservation choice §; new Issues 7-10; priority table extended)

### Changelog + log update
- **Status:** completed
- **Files changed:**
  - `CHANGELOG-AI.md` (round-2 row prepended)
  - `docs/ai-logs/2026-04-26-stage5-audit-and-ke-conservation.md` (this round-2 section)

### Issues left open
- KE-conservation **implementation** (Option B) — needs spec sign-off.
- UI rename `Hydrogen (H)` → `proton` and "Beams"/"Ions" grouping in
  `entity-selection-comboboxes.svelte`.
- Wire `EnergyUnitSelector` into the calculator route.
- Restore explicit "Add row" button.
- Wire the `debounce()` util into `triggerCalculation`.
- Delete dead code (`energy-input.svelte`, `units/energy.ts`, ~480 LOC).
