# UX Review — Stage 5 completion + kinetic-energy conservation on switches

> **Date:** 2026-04-26
> **Scope:** Calculator energy-input flow — particle/unit switching semantics,
> add-row affordance, end-of-stage refactor candidates.
> **Basis:** Read-through of `src/lib/state/`, `src/lib/components/result-table.svelte`,
> `tests/e2e/`, all `docs/04-feature-specs/*.md`. Live `pnpm exec playwright test`
> run against the WASM build (60 prior tests + 12 new tests, 64 active passing,
> 8 intentional `fixme`).
> **Reporter:** User (leszek.grzanka@gmail.com) + Claude Sonnet 4.6 via Copilot coding agent
> **Companion:** [`docs/progress/stage-5-audit-2026-04-26.md`](../progress/stage-5-audit-2026-04-26.md)

---

## Summary

Stage 5 is in a "5/6 done" state but several items marked ✅ in the redesign
plan still have visible gaps. The most user-visible gaps are:

1. **Kinetic energy is not conserved across particle / unit switches.**
2. **There is no master energy-unit selector visible on the calculator route**
   (only per-row dropdowns, only for heavy ions).
3. **There is no explicit "Add row" button** — rows auto-append. This works,
   but is undiscoverable for new users.
4. **Live calculation is not debounced**, contrary to `calculator.md:840`.
5. **The legacy `energy-input.svelte` and `units/energy.ts` modules** are dead
   code but still ship and are still tested (~480 LOC of duplication).

The Stage 5 audit document covers items 2, 4 and 5 in detail. This review
focuses on items 1 and 3 — both have direct, repeatable UX symptoms.

---

## Critical issue 1 — Kinetic energy is silently lost when switching particles

**Reported:** "Imagine we start with helium and put 20 MeV per nucleon. That
means 80 MeV total. If we switch to proton we should see 80 MeV, and then if
we again switch to helium we should again see 20 MeV per nucl. Kinetic energy
should be conserved when switching particles and units."

**Reproduction (live, on the deployed build):**

| Step | Action                                                          | Observed                                              | Expected (per the request)                            |
| ---- | --------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| 1    | Particle = Helium, type `20 MeV/nucl` in row 1                  | "→ MeV/nucl" cell shows 20; STP value shown          | OK                                                    |
| 2    | Switch particle to Hydrogen (proton)                            | Row text still `20 MeV/nucl`; "→ MeV/nucl" shows 20  | Row text becomes `80 MeV`; "→ MeV/nucl" shows 80      |
| 3    | Switch particle back to Helium                                  | Row text still `20 MeV/nucl`                         | Round-trips back to `20 MeV/nucl`                     |

**Root cause:** `selectParticle()` in `src/lib/state/entity-selection.svelte.ts:253-276`
deliberately **does not touch the energy rows** — and the
`unit-handling.md` spec at lines 100-113 explicitly mandates this:

> 2. The input values are **not modified** — numeric values stay the same.

So the current behaviour is *correct per the existing spec*, but the spec
itself encodes the wrong design. There are real UX consequences:

- A user comparing "the same beam" across particles has to do mental
  arithmetic that the app already has the data to do.
- The per-row unit dropdown's `setRowUnit()`
  (`src/lib/state/calculator.svelte.ts:297-316`) has the same problem in
  miniature: switching a row's unit from `MeV` → `MeV/nucl` re-stamps the
  suffix without converting the number, so `12 MeV` → `12 MeV/nucl`,
  silently quadrupling the kinetic energy on a Carbon ion.
- Switching to an Electron from a heavy-ion row leaves a literal
  `20 MeV/nucl` string that the parser then rejects as "MeV/nucl is not
  available for Proton/Electron" — confusing error for what was a valid
  input a moment earlier.

### Recommended path forward

Treat kinetic energy as the conserved quantity across particle and
per-row-unit switches. Concretely, change the spec **and** the
implementation:

1. **`unit-handling.md` § "Unit Preservation on Particle Change"** — replace
   bullets 1-4 with:
   > 1. The conserved quantity is the **kinetic energy** of each row.
   > 2. For each row, the parsed `(value, unit)` is converted to MeV (total)
   >    using the *previous* particle's mass number A and atomic mass m_u.
   > 3. The new particle's preferred display unit is chosen
   >    (`MeV` for proton/electron, `MeV/nucl` for heavy ions if currently in
   >    a per-nucleon unit, otherwise `MeV`), and the row text is rewritten
   >    using that unit and the converted numeric value, **preserving any
   >    explicit per-row unit suffix the user typed**.
   > 4. If the new particle does not support the row's previous unit (e.g.
   >    electron + `MeV/nucl`), use the new particle's preferred unit.
2. **`unit-handling.md` §3.8 — Per-row unit dropdown changes** — change
   "reinterprets that row's numeric value in the new unit" to "**converts**
   that row's numeric value to the new unit while keeping the kinetic
   energy fixed".
3. **`calculator.md` Acceptance Criteria** — add the He @ 20 MeV/nucl ↔
   proton @ 80 MeV ↔ He @ 20 MeV/nucl round-trip as an explicit checklist
   item.
4. Implementation:
   - Make `selectParticle(newId)` capture the previous particle's `(A, m_u)`,
     iterate over `rows`, and for each row that parses cleanly call
     `convertEnergyFromMeVperNucl(...)` (already exists in
     `src/lib/utils/energy-conversions.ts:101-129`) to rewrite the typed
     text.
   - Make `setRowUnit(index, unit)` do the analogous convert-then-stamp
     operation rather than the current regex suffix-replace.
5. Tests:
   - The new `tests/e2e/particle-unit-switching.spec.ts` ships with the
     desired sequences as `test.fixme()`. Flip them to active when the
     implementation lands. They cover six scenarios — single switch, round
     trip, per-row dropdown, master-unit segmented control, multi-row
     state, and electron edge case.
   - Add round-trip unit tests against `selectParticle()` on
     `EntitySelectionState` once it owns the energy rewrite.

**Trade-off / open question:** rewriting user-typed text on a particle
switch is a non-trivial UX promise. It must be (a) reversible by undo
(out of scope today — there is no undo), and (b) clearly indicated. A
visual cue ("converted: 20 MeV/nucl → 80 MeV") in the row may be needed
the first time it happens.

---

## Critical issue 2 — Per-row unit dropdown silently scales kinetic energy

Already covered above as a sub-symptom of issue 1; called out separately
because it has its own E2E test (`Carbon 12 MeV → toggle MeV/nucl` in
`tests/e2e/particle-unit-switching.spec.ts`) and because fixing it does
**not** require any spec change to the particle-switch flow. It can be
shipped independently as a smaller, less risky first step:

- Update `setRowUnit()` to `convertEnergyToMeVperNucl(...)` then
  `convertEnergyFromMeVperNucl(...)` to the new unit, then format
  with `formatSigFigs`.
- Existing test at `src/tests/components/result-table.test.ts:111-127`
  asserts the *current* behaviour (`expect(rawInput).toBe("120 MeV/nucl")`
  after switching from `120 MeV`); this test will need updating in lockstep.

---

## Critical issue 3 — There is no master energy-unit selector on the calculator page

The `EnergyUnitSelector` shadcn-svelte component exists and is fully tested,
but `src/routes/calculator/+page.svelte` does not render it. The only ways
to change the master unit are:

- type a unit suffix on a row (auto-switches to per-row mode), or
- use the per-row dropdown (heavy ions only).

For a proton calculation there is **no way at all** to switch the master
unit from MeV — which happens to be fine because protons only have MeV in
the spec, but the contract at `calculator.md:805-806` (`role="radiogroup"`,
"In master mode … the selector is active") is unmet.

Action: re-add the `EnergyUnitSelector` above the ResultTable in
`calculator/+page.svelte`, bound to `calcState.masterUnit` /
`calcState.setMasterUnit`. Make it visible (active for heavy ions, single
disabled "MeV" pill for proton/electron).

---

## Issue 4 — "Add row" affordance is invisible

There is no button. Rows auto-append when the user types in the last row
(see `src/lib/state/energy-input.svelte.ts:51-64`). This is consistent with
the spec (`calculator.md:190-201`: "Always-empty-row-at-bottom") but the
spec itself notes the discoverability concern at line 873-875:

> 1. **Always-empty-row vs. Add Row button:** The current design uses an
>    always-empty-row-at-bottom for natural append. This is the implementation
>    — an explicit "Add Row" button might be clearer.

**Today, the table has zero empty rows on first load.** Default state is
exactly one pre-filled "100" row (verified by the new `Add row UX` test
group). To add a second row the user must:

1. Click on the row already containing "100".
2. Press End (or click after the "100").
3. Press Enter.

This is workflow-hostile for someone who wants to enter 5 quick energy
values. The legacy `src/lib/components/energy-input.svelte:242-248`
component **does** render an explicit "Add row" button — that pattern was
lost when 5.4 replaced it with `result-table.svelte`.

### Recommended fix

Either (preferred, minimal):

- Add a small `+ Add row` button below the table in `result-table.svelte`,
  wired to `inputState.addRow()`. It is a one-line UI addition and
  immediately discoverable.

Or (more invasive but spec-aligned):

- Restore the always-empty-row-at-bottom from the original spec — the
  current `addRow()` only triggers from `updateRowText` when the user
  types in the final row, so the very first state has no sentinel.

The new E2E test `there is no explicit 'Add row' button rendered in the
result table` documents the current behaviour and will fail (deliberately,
needs to be updated) when the button is added.

---

## Issue 5 — Live calculation is not debounced

`calculator.md:840` says "Debounce interval is 300ms for input." A
`debounce()` utility ships in `src/lib/utils/debounce.ts` with 8 unit
tests, but no caller imports it. `result-table.svelte:148` calls
`state.triggerCalculation()` synchronously on every keystroke.

This is a low-impact bug today (WASM `calculate()` is sub-millisecond for
small batches) but it diverges from the spec and would matter immediately
for the inverse calculator (`inverse-lookups.md`) and multi-program
features (`multi-program.md`).

Action: tracked in §1.3 of the audit doc — wire the existing util in or
delete the requirement from the spec.

---

## Issue 6 — Code/test duplication ready for cleanup

Full list and risk assessment in
[`docs/progress/stage-5-audit-2026-04-26.md`](../progress/stage-5-audit-2026-04-26.md)
§2-3. Headline items, all low-risk:

1. Delete `src/lib/components/energy-input.svelte` + 13 dead component tests.
2. Delete `src/lib/units/energy.ts` + 30 redundant unit tests.
3. Fold `energy-input-format.test.ts` into `unit-conversions.test.ts`.

Total: roughly **~480 LOC** removed without any user-visible change.

---

## Priority Summary

| #   | Issue                                                                                            | Severity | Status        |
| --- | ------------------------------------------------------------------------------------------------ | -------- | ------------- |
| 1   | Kinetic energy not conserved on particle switch                                                  | High     | 🆕 Open — spec change required, fixme E2E ships |
| 2   | Per-row unit dropdown silently scales KE on heavy ions                                           | High     | 🆕 Open — can ship independently |
| 3   | No master energy-unit selector on calculator route                                               | Medium   | 🆕 Open — spec ↔ implementation mismatch |
| 4   | "Add row" affordance is invisible (no button, no empty sentinel on first load)                   | Medium   | 🆕 Open       |
| 5   | Live calculation is not debounced (`calculator.md:840` unmet)                                    | Low      | 🆕 Open       |
| 6   | ~480 LOC of dead/duplicated code in `energy-input.svelte`, `units/energy.ts`, format test files  | Low      | 🆕 Open — cleanup |
| 7   | Stage 5.1 nice-to-haves still open in `docs/progress/stage-5-entity-selection.md`               | Low      | Pre-existing  |

---

## Appendix — E2E tests added in this review

`tests/e2e/particle-unit-switching.spec.ts` (12 tests, 6 active + 6
`test.fixme()`):

**Active (lock down current spec'd behaviour):**

1. He 20 MeV/nucl → switch to proton: text stays `20 MeV/nucl`.
2. He 80 MeV → switch to proton: text stays `80 MeV`.
3. Proton 100 MeV → carbon → hydrogen: number unchanged.
4. Carbon 12 MeV → row dropdown to MeV/nucl: text becomes `12 MeV/nucl`
   (NUMBER unchanged → KE silently 4×).
5. Add-row UX: typing in the last row auto-appends a fresh row.
6. Add-row UX: there is no explicit "Add row" button.

**`fixme` (desired KE-conservation behaviour, will activate when spec is
updated and implementation lands):**

1. He 20 MeV/nucl → proton: row should show `80 MeV`.
2. He 20 MeV/nucl → proton → He: round-trips back to `20 MeV/nucl`.
3. Carbon 12 MeV → row dropdown MeV/nucl: should become `1 MeV/nucl`.
4. Carbon 100 MeV/nucl, master toggle MeV/nucl → MeV: should become `1200`.
5. Multi-row + particle switch: each row's KE conserved independently.
6. Heavy ion → electron: per-nucleon row remapped to MeV (no validation
   error).
