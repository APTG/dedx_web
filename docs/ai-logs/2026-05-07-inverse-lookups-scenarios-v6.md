# 2026-05-07 — inverse-lookups.md v6: expanded acceptance scenarios

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Add acceptance scenarios covering Inverse STP primary flow, non-standard units, invalid input, and multi-program mode

**User request:** Expand the acceptance scenarios in `inverse-lookups.md` to:

1. Add a scenario that directly exercises the third user story ("entering a stopping power value, seeing both energies") — use 30 keV/µm for protons in liquid water on the default (PSTAR) program.
2. Improve Range tab coverage with non-standard length units — include 30 m for protons in air as a primary test case.
3. Add out-of-bounds and nonsense input validation scenarios for both tabs.
4. Add a multi-program mode scenario covering both Range and Inverse STP tabs.
5. Follow the spec template. Update AI logs.

**AI response:**

Bumped the spec to **Final v6** and made four targeted additions:

#### Scenario 5: Inverse STP — dual-branch energies (primary flow) @smoke

- Tagged `@smoke` because it exercises the core user story.
- URL: `?particle=1&material=276&imode=stp&ivalues=30&iunit=kev-um&advanced=1` pre-loads the tab so the smoke test doesn't require UI navigation.
- Asserts both `inverse-stp-result-low-0` and `inverse-stp-result-high-0` contain numeric values and are distinct.
- Extends into the no-solution case within the same test: changing the input to 85 keV/µm (above the proton/water Bragg peak ≈ 80–90 keV/µm) switches both cells to `"—"` with no row highlighting.

#### Scenario 6: Range tab — non-standard length unit (30 m, proton in air) @regression

- Tests the `m` (metre) suffix — the largest standard suffix in the supported list.
- Physical rationale: 30 m of dry air ≈ 120–130 MeV for protons, a well-known range in accelerator physics.
- Also tests `0.03 km` rejection: `km` is not in the supported suffix set, so `inverse-range-row-error-0` must appear with text containing `"km"`.
- Includes a note that the Air (Dry) material ID must be verified against `LibdedxService.getMaterials(1)` at implementation time (the spec uses 104 as a placeholder with a `TODO` comment).
- Verifies per-row mode activation: after typing a suffix, `inverse-range-unit` master selector becomes disabled.

#### Scenario 7: Invalid input — out-of-range and non-numeric rejection @regression

- **Range tab:** negative (`-5`) → error containing `"positive"`; non-numeric (`abc`) → error containing `"numeric"`; excessively large (`1000000` cm) → out-of-range row highlight (⚠️, not ❌) with valid-range hint.
- **Inverse STP tab:** zero (`0`) → error containing `"positive"`; non-numeric (`xyz`) → error containing `"numeric"`.
- Structured as a multi-part Given/When/Then to keep the scenario readable without splitting into too many separate test functions.

#### Scenario 8: Multi-program mode — one column per program @regression

- **Range tab:** typing `7.718 cm` with PSTAR + ICRU 90 selected → at least two `[data-testid^="inverse-range-result-0-"]` cells.
- **Inverse STP tab:** typing `30` keV/µm → at least two `[data-testid^="inverse-stp-result-low-0-"]` and two `[data-testid^="inverse-stp-result-high-0-"]` cells.
- Playwright tests use `locator('^=')` prefix matching so they remain agnostic to the actual program IDs and still pass if a third program is later added.
- The multi-program setup step is left as a comment placeholder for the implementer (the exact UI interaction for enabling multi-program depends on implementation details not yet finalized).

#### New data-testid anchors added to Appendix

- `inverse-range-row-error-{i}` — inline validation error for Range tab row `i`; absent when row is valid.
- `inverse-stp-row-error-{i}` — inline validation error for Inverse STP tab row `i`; absent when row is valid.

## Tasks

### Task 1: inverse-lookups.md v6

- **Status**: completed
- **Stage**: spec-prep (docs only, no code changes)
- **Files changed**: `docs/04-feature-specs/inverse-lookups.md`
- **Decision:** Scenario 5 tagged `@smoke` because it exercises the core user story and is a cheap test to run — it pre-loads via URL and just waits for WASM results. The 85 keV/µm above-Bragg-peak sub-case is included in the same test rather than a separate scenario, since it is logically inseparable from the dual-branch flow.
- **Decision:** Air material ID left as `/* TODO: verify */ 104` in the Playwright stub. The spec should not embed magic numbers that may differ between WASM builds; the implementer must look it up from the entity list.
- **Decision:** Scenario 8 multi-program setup steps are stubs. The exact UI path for enabling multi-program (and the program IDs) are not yet finalized in the spec; adding rigid steps now would couple the E2E test to an unstable detail.
- **Issue:** None.
