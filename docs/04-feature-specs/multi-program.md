# Feature: Multi-Program Mode

> **Status:** Draft skeleton (8 April 2026)
>
> This file defines the structure and decision surface for comparing the
> same particle/material/energy inputs across multiple libdedx programs on
> the Calculator page.
>
> **Related specs:**
> - Calculator page: [`calculator.md`](calculator.md)
> - Entity selection: [`entity-selection.md`](entity-selection.md)
> - Unit handling: [`unit-handling.md`](unit-handling.md)
> - Plot page: [`plot.md`](plot.md)
> - WASM API contract: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)

---

## User Story

**As a** radiation physicist,
**I want to** run the same calculation across multiple programs at once,
**so that** I can compare stopping power and CSDA range outputs without
re-entering the same inputs.

**As a** student,
**I want to** see where programs agree or differ for the same particle,
material, and energy values,
**so that** I can better understand the models and reference datasets.

---

## Related Specs / Dependencies

- TODO: Reuse Calculator compact entity-selection layout and unified table rules.
- TODO: Reuse Unit Handling parsing, normalization, and output-unit rules.
- TODO: Keep terminology and compatibility assumptions aligned with Entity Selection.
- TODO: Keep any comparison relationship to Plot non-contradictory.
- TODO: Reflect existing WASM support via `LibdedxService.calculateMulti()`.

---

## Scope

### In Scope

- TODO: Define multi-program comparison behavior on the Calculator page.
- TODO: Define how the user chooses one vs many programs.
- TODO: Define comparison rendering for stopping power and CSDA range.
- TODO: Define partial-success and partial-failure behavior.
- TODO: Define responsive behavior for the comparison layout.
- TODO: Define URL-state and export interaction at a contract level.

### Out of Scope

- TODO: Plot-page overlay behavior beyond cross-spec consistency notes.
- TODO: Inverse lookup workflows.
- TODO: Full Advanced Options behavior, except where compatibility must be stated.
- TODO: Rich export formats beyond the minimum needed to keep Calculator/export specs aligned.

---

## Inputs

### 1. Entity Selection

- TODO: Same Particle selector as Calculator compact mode.
- TODO: Same Material selector as Calculator compact mode.
- TODO: Define Program selector behavior in multi-program mode:
  - TODO: single-select by default, multi-select when comparison is enabled?
  - TODO: or one dedicated multi-select control from the start?
  - TODO: decide how Auto-select behaves in multi-program mode.

### 2. Energy Input

- TODO: Reuse the unified input/result table from Calculator.
- TODO: Same accepted formats and paste behavior.
- TODO: Same per-row unit suffix detection and debounce timing.
- TODO: Same valid-energy filtering before any WASM call.

### 3. Mode Control

- TODO: Define the entry point for enabling multi-program comparison.
- TODO: Candidate UX options:
  - TODO: "Compare programs" toggle.
  - TODO: Program combobox becomes multi-select.
  - TODO: Separate compare action after single-program results are shown.

---

## State Model

### UI State

- TODO: `comparisonMode: boolean`
- TODO: `selectedProgramIds: number[]`
- TODO: `resolvedProgramIds: number[]`
- TODO: `comparisonOrder: number[]` if display order differs from selection order
- TODO: `hasAnySuccessfulProgram: boolean`
- TODO: `hasAnyFailedProgram: boolean`

### Data State

- TODO: `comparisonResults: Map<number, CalculationResult | LibdedxError>`
- TODO: `normalizedEnergies: number[]` produced once from existing Calculator/unit logic
- TODO: `perProgramStatus: idle | loading | success | error`

### Persistence State

- TODO: Define URL encoding for multiple selected programs.
- TODO: Define restoration behavior when 0, 1, or many programs decode from URL state.

---

## Behavior

### Default Behavior

- TODO: Calculator still defaults to single-program mode.
- TODO: Multi-program mode should be an explicit user action, not the landing default.
- TODO: Decide whether one default program remains selected when comparison mode is off.

### Entering Multi-Program Mode

- TODO: User selects multiple compatible programs for the same particle/material.
- TODO: Existing typed energies remain untouched.
- TODO: Existing unit mode remains untouched.
- TODO: UI switches from standard Calculator results to comparison layout.

### Calculation Flow

- TODO: Parse and validate rows exactly as in Calculator.
- TODO: Normalize energies exactly as in Unit Handling before calculation.
- TODO: Call `LibdedxService.calculateMulti()` with:
  - TODO: `programIds`
  - TODO: `particleId`
  - TODO: `materialId`
  - TODO: `energies` in MeV/nucl
  - TODO: future compatibility note for `options`
- TODO: Keep the same debounced live-calculation model as Calculator.

### Partial Success / Partial Failure

- TODO: One failing program must not block successful programs.
- TODO: Define how per-program `LibdedxError` results appear in the UI.
- TODO: Decide whether failed programs remain selected for the next recalculation.
- TODO: Decide whether "all failed" has a special empty/error state.

### Returning to Single-Program Mode

- TODO: Define what happens when selection shrinks back to one program.
- TODO: Decide whether layout snaps back to standard Calculator view automatically.
- TODO: Preserve row order, typed values, and focus behavior.

---

## Output

- TODO: Same core result semantics as Calculator:
  - TODO: normalized energy
  - TODO: stopping power
  - TODO: CSDA range
- TODO: Multi-program mode changes comparison presentation, not physical meaning.
- TODO: Decide whether any derived comparison metrics are shown:
  - TODO: delta vs reference
  - TODO: min/max spread
  - TODO: percent difference

---

## Rendering / UI Layout

### Desktop Layout

- TODO: Keep Calculator compact selector row.
- TODO: Decide between these comparison layouts:
  - TODO: wide table with repeated program columns
  - TODO: stacked per-program result sections
  - TODO: base rows with expandable per-program details
- TODO: Specify header behavior, column naming, and scrolling rules.

### Mobile / Responsive Layout

- TODO: Define the comparison layout below tablet breakpoint.
- TODO: Candidate approaches:
  - TODO: card stack per program
  - TODO: tabs / segmented view per program
  - TODO: horizontal scroll only if justified and accessible
- TODO: Preserve editable energy input without crowding comparison output.

### Loading / Empty / Error States

- TODO: No valid rows.
- TODO: No compatible programs selected.
- TODO: Some programs loading while others have completed.
- TODO: All programs failed.

---

## Validation and Error Handling

### Input Validation

- TODO: Reuse Calculator per-row validation rules unchanged.
- TODO: Invalid rows are excluded from multi-program calculation.
- TODO: Define how invalid rows render in comparison mode.

### Program Selection Validation

- TODO: Prevent empty program sets in comparison mode.
- TODO: Define duplicate-selection handling.
- TODO: Clarify whether compatibility filtering prevents invalid program combinations earlier.

### Error Presentation

- TODO: Use WASM-contract-aligned error semantics.
- TODO: Decide whether numeric error codes are user-visible.
- TODO: Define message wording for mixed-success results.

---

## Interaction With Unit-Handling Rules

- TODO: Energy parsing and normalization must remain identical to [`unit-handling.md`](unit-handling.md).
- TODO: Multi-program mode must not introduce a second energy-unit system.
- TODO: Decide whether stopping-power display unit is shared across all compared programs.
- TODO: Keep CSDA range display and auto-scaling consistent with Calculator unless intentionally overridden.
- TODO: Clarify per-row mode behavior when multiple programs are shown for the same row.

---

## Interaction With URL State

- TODO: Extend Calculator URL state rather than inventing a parallel contract.
- TODO: Define encoding for multiple program IDs.
- TODO: Define restoration behavior for invalid, unavailable, or deprecated program IDs.
- TODO: Decide whether a single decoded program restores standard Calculator mode automatically.
- TODO: Keep this aligned with the future `shareable-urls.md` spec.

---

## Interaction With Export

- TODO: Define CSV behavior for multi-program comparison.
- TODO: Candidate schemas:
  - TODO: one wide table with program-specific columns
  - TODO: one long table with a `program` column
  - TODO: one file per program
- TODO: Keep export units aligned with [`unit-handling.md`](unit-handling.md).
- TODO: Decide filename pattern for multiple programs.
- TODO: Defer PDF specifics to the future `export.md` spec if needed.

---

## Accessibility

- TODO: Program comparison controls must be keyboard-operable.
- TODO: Comparison headers and data cells must remain screen-reader understandable.
- TODO: Per-program errors must be announced clearly.
- TODO: Loading state must not trap focus or reorder focus unpredictably.
- TODO: Mobile comparison UI must remain operable without hidden inaccessible content.

---

## Acceptance Criteria

- [ ] The Calculator can compare the same particle, material, and energy rows across multiple selected programs.
- [ ] The feature uses the WASM contract's existing `calculateMulti()` capability as its calculation primitive.
- [ ] Energy parsing, suffix handling, and normalization remain consistent with `unit-handling.md`.
- [ ] The spec defines what happens when one program succeeds and another fails.
- [ ] The spec defines a concrete comparison layout for both desktop and mobile.
- [ ] The spec defines how multi-program selection interacts with URL restoration.
- [ ] The spec defines or explicitly defers export behavior without contradicting existing Calculator/export notes.
- [ ] The spec keeps Calculator terminology consistent: particle, material, program, stopping power, CSDA range.

---

## Open Questions

- TODO: What is the exact UI control for choosing multiple programs on the Calculator page?
- TODO: Should Auto-select be disabled, expanded, or resolved before entering multi-program mode?
- TODO: What is the maximum practical compared-program count before readability breaks down?
- TODO: Should the UI highlight one reference program or treat all programs symmetrically?
- TODO: Should advanced options apply globally to all selected programs, and are there unsupported combinations?
- TODO: Which CSV schema best matches user expectations for comparison export?

---

## Cross-Spec Consistency Checks

- [ ] Align Calculator interaction and layout terminology with [`calculator.md`](calculator.md)
- [ ] Align selection and compatibility assumptions with [`entity-selection.md`](entity-selection.md)
- [ ] Align energy parsing, normalization, and display-unit rules with [`unit-handling.md`](unit-handling.md)
- [ ] Align any comparison relationship to plotting workflows with [`plot.md`](plot.md)
- [ ] Align service capabilities and error semantics with [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
- [ ] Keep naming and stage intent consistent with [`../00-redesign-plan.md`](../00-redesign-plan.md)