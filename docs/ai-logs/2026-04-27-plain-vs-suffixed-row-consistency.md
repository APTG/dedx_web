# 2026-04-27 — Plain-vs-suffixed row consistency on particle switch

**Model:** (Claude Sonnet 4.6 via Copilot coding agent)

## Session Narrative

### Prompt 1: @grzanka — "check the behaviour of unit switching … 100 stays the same in first row. In second row I see 4000 MeV instead of 1 GeV … For end user it's hard to follow what is conserved in this scenario."

**AI response:** The reproducer is exact:

- Default state: proton row 0 = `100` (no suffix), default master unit `MeV`.
- Add row 1, type `1 GeV` → parser normalizes to `MeV` value 1000.
- Switch particle → alpha (A=4):
  - Row 0 (no suffix): kept as `100` (E_nucl 25 MeV/nucl).
  - Row 1 (`1 GeV`): re-expressed as `4000 MeV` (E_nucl 1000 MeV/nucl).

The two rows used to follow opposite rules — suffixed rows conserved
E_nucl while plain-number rows preserved the typed numeric value —
which makes the "what is being conserved?" question impossible to
answer from the UI alone.

Root cause is the early-`continue` branch in
`convertRowsForNewParticle`:

```ts
const hadExplicitSuffix = parsed.unit !== null;
if (!hadExplicitSuffix) {
  // Keep the numeric value unchanged; it represents total MeV on both particles.
  continue;
}
```

That branch was added to "be conservative" with un-suffixed numbers but
is the source of the inconsistency.

**Fix:** removed the early-continue and let plain-number rows fall
through into the same E_nucl-conservation pipeline as suffixed rows,
using `inputState.masterUnit` as the implicit unit (which is exactly
how the master selector treats them everywhere else in the
calculator). After the switch the converted row is rewritten with an
explicit suffix so the new unit is visible.

For the user's exact scenario this gives:

- Row 0 `100` (proton, master MeV) → switch to alpha → `400 MeV`
  (E_nucl 100 conserved).
- Row 1 `1 GeV` → `4000 MeV` (E_nucl 1000 conserved).

Both rows now play by one rule.

**Test changes:**

- `src/tests/unit/calculator-state.test.ts` — the existing test
  "Plain number row '100' (master unit MeV, proton) → switch to
  Carbon" used to lock in the old "preserve number" behaviour; updated
  to expect `1200 MeV` (E_nucl=100 conserved) instead.
- `tests/e2e/particle-unit-switching.spec.ts` — added a regression
  test that mirrors the user's exact reproducer (proton `100` + `1 GeV`
  → switch to alpha → `400 MeV` + `4000 MeV`).

**Spec change:** added §2 point 6 to
`docs/04-feature-specs/unit-handling.md` codifying that plain-number
rows are converted on the same rule as suffixed rows.

**Validation:** 425/425 unit + integration tests pass; `pnpm build`
clean.

## Tasks

### Make plain and suffixed rows consistent on particle switch
- **Status:** completed
- **Stage:** 5 (calculator)
- **Files changed:**
  - `src/lib/state/calculator.svelte.ts` — removed early-continue for
    unsuffixed rows; added explanatory comment citing the PR #379
    report.
  - `src/tests/unit/calculator-state.test.ts` — updated the
    plain-number test expectation.
  - `tests/e2e/particle-unit-switching.spec.ts` — added regression
    test.
  - `docs/04-feature-specs/unit-handling.md` — added §2 point 6.
- **Decision:** apply the same E_nucl-conservation rule to every row.
  The alternative ("never convert plain numbers") was rejected
  because mixing the two rules in the same table is what created the
  reported confusion.
