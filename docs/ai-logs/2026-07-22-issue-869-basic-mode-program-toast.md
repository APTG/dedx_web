# 2026-07-22 — Basic-mode `program=` toast (#869)

## Session Narrative

### Prompt 1: Investigate an aidedx→calculator hand-off bug

The user reported that aidedx (a sister chat-assistant project) answers "The
CSDA range of 220.5 keV boron ion in silicon is 1.044 µm (MSTAR)." and then
links to `/calculator?...&particle=5&material=14&program=6&energies=220.5:keV&eunit=MeV`,
which shows "1 of 1 values excluded (1 out of range)" instead of reproducing
the MSTAR answer.

**AI response**: Delegated the investigation to an Explore agent. Root cause
was three-layered:

1. `program=6` is ICRU 73 in libdedx's canonical enum (`libdedx/include/dedx.h`);
   MSTAR is `program=4`. aidedx's link used the wrong ID for what it claimed.
2. The link has no `mode=advanced`, so it's a Basic-mode link. dedx_web's
   Basic mode always resets to Auto-select on load (issue #816,
   `calculator-page-orchestrator.svelte.ts`'s `setupModeFallbacks`) —
   **any** explicit `program=` is silently discarded, valid or not.
3. Even ignoring (1) and (2), 220.5 keV Boron-11 ≈ 0.020 MeV/nucleon sits just
   under ICRU 73's 0.025 MeV/nucleon floor for ions heavier than He — the
   auto-selected program genuinely can't serve that energy, while MSTAR
   (floor 0.001 MeV/nucleon) can.

The `energies=220.5:keV` + `eunit=MeV` combination was checked and ruled out
— the per-row `:keV` suffix correctly takes precedence over the master
`eunit`, and unit conversion to MeV/nucleon was verified correct.

Filed two issues: [APTG/aidedx#116](https://github.com/APTG/aidedx/issues/116)
(wrong program ID + missing `mode=advanced`) and
[APTG/dedx_web#869](https://github.com/APTG/dedx_web/issues/869) (the "trap"
— dedx_web gives no feedback when Basic mode silently drops a URL's
`program=`, which is what let aidedx's bug go unnoticed).

### Prompt 2: Work issue #869

**AI response**: Implemented the toast fix described in #869's "suggested
improvement" (option 1: a toast mirroring the already-spec'd-but-unimplemented
"Program not available; using auto-select." text from
`shareable-urls.md` §8.1, adapted to the Basic-mode-specific wording since the
program here isn't "unavailable" — it's simply not selectable outside
Advanced mode).

## Tasks

### Toast when a Basic-mode URL's `program=` is discarded

- **Status**: completed
- **Stage**: bug fix, not a redesign-plan stage
- **Files changed**:
  - `src/lib/components/plot-toast.svelte` → renamed to
    `src/lib/components/notice-toast.svelte` (generalized: added an optional
    `testId` prop, default `"notice-toast"`, so the same component now backs
    both the Plot page's Add-Series confirmation and the Calculator page's
    new program notice, instead of duplicating the toast's timer/live-region
    logic a second time).
  - `src/tests/components/plot-toast.test.ts` → renamed to
    `notice-toast.test.ts`, updated to the new import/testid, plus one new
    test for the `testId` override.
  - `src/routes/plot/+page.svelte` — import/usage updated to `NoticeToast`
    with `testId="plot-toast"` (no behavior change; existing e2e test
    `tests/e2e/plot-add-series.spec.ts` still queries `data-testid="plot-toast"`).
  - `src/lib/state/calculator-page-orchestrator.svelte.ts` — added
    `programFeedback` state + `announceProgramFeedback()` (same
    `{ text, token }` shape as the plot orchestrator's `seriesFeedback`).
    Wired into `setupUrlHydration()`'s existing
    `if (urlState.programId !== null) appInit.entityState.selectProgram(...)`
    branch: when `!isAdvancedMode.value`, fires
    "Basic mode ignores the link's program; using auto-select." This runs
    once per page load (the surrounding effect is gated on `!this.calcState`).
  - `src/routes/calculator/+page.svelte` — mounts `<NoticeToast>` bound to
    `orchestrator.programFeedback`, placed outside the loading/`{:else if}`
    block so it can render regardless of load state.
  - `src/tests/contracts/page-init.contract.test.ts` — added two
    string-presence contract checks (matching this file's existing style)
    asserting the orchestrator calls `announceProgramFeedback` in the
    `urlState.programId !== null` branch, and that the Calculator page mounts
    `NoticeToast` bound to `orchestrator.programFeedback`.
  - `docs/04-feature-specs/entity-selection.md` — added a note to the #816
    footnote cross-referencing #869 and the new toast text.
  - `docs/04-feature-specs/shareable-urls.md` §8.1 — added a callout
    distinguishing this Basic-mode case (any `program=`, valid or not, always
    discarded) from the pre-existing "incompatible program ID" case (that
    spec's own "Program not available; using auto-select." toast is still
    unimplemented — not addressed in this session, out of scope for #869).
- **Decision**: Did not build a full orchestrator-mounting test harness —
  none exists in this codebase yet (`CalculatorPageOrchestrator` has zero
  existing unit tests; it depends on `$app/state`'s `page.url`, `appInit`,
  and the WASM loader singleton, none of which have a mocking precedent).
  Given the disproportionate setup cost for one behavior, matched existing
  project convention instead: `page-init.contract.test.ts`'s string-presence
  contract-test style (already used for other orchestrator/page wiring
  invariants like `initAdvancedModeFromUrl`), plus a real component test for
  the toast's rendering behavior itself (the part that's actually cheap to
  test in isolation).
  - **Decision**: Chose to generalize/rename `plot-toast.svelte` rather than
  duplicate its timer/dismiss/live-region logic for a second consumer — it
  was already shaped generically (`{ text, token }` signal), just named after
  its first and only caller.
- **Issue**: The broader "Program not available; using auto-select." toast
  for genuinely-invalid program IDs against the compatibility matrix (spec'd
  in `shareable-urls.md` §8.1, referenced in its own worked example) remains
  unimplemented — flagged in the doc, not fixed here, since #869 is
  specifically about the Basic-mode-always-discards-program case.

Full Vitest (1963) + ESLint + `format:check` clean; `svelte-check` 0
errors/0 warnings (pre-existing vendor/prototype config noise unrelated to
this change). Verified end-to-end with Playwright against a real production
build (local `static/wasm/` was already present): a new
`tests/e2e/calculator-basic-mode-program-toast.spec.ts` reproduces the exact
reported URL (`?urlv=3&particle=5&material=14&program=6&energies=220.5:keV&eunit=MeV`)
and asserts the toast appears, plus two negative cases (no `program=` param;
`mode=advanced` present) confirming it does *not* fire when it shouldn't — all
3 pass, as does the pre-existing `plot-add-series.spec.ts` (confirms the
`plot-toast.svelte` → `notice-toast.svelte` rename didn't regress the Plot
page's toast). The user declined to install the Claude in Chrome extension for
manual browser verification this session; added a note to `CLAUDE.md` recording
that preference (use Playwright instead) for future sessions.

### Prompt 3: Manual local verification found the toast easy to miss

After checking out the branch locally, the user confirmed the toast fires
correctly but reported it renders at the very bottom of the screen, where
it's easy to miss.

**AI response**: Added an optional `position: "top" | "bottom"` prop to
`notice-toast.svelte` (default `"bottom"`, preserving the Plot page's
existing Add Series confirmation placement) and set the calculator page's
usage to `position="top"`. New component test covers both the default
bottom placement and the `top-4` class when `position="top"`. Full Vitest
(1969) + ESLint + `format:check` clean; re-ran both
`calculator-basic-mode-program-toast.spec.ts` and `plot-add-series.spec.ts`
against a real build — all 10 tests pass, confirming the Plot toast's
placement is unaffected.
- **Decision**: Made placement a per-consumer prop rather than moving the
  shared component's default, since the Plot page's Add Series confirmation
  is a low-urgency positive confirmation where bottom placement is fine —
  only the Basic-mode program-discard notice needed the more attention-
  grabbing position.
