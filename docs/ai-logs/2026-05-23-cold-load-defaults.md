# 2026-05-23 — Cold-load defaults E2E tests (issue #555)

## Session Narrative

### Prompt 1: Check if issue #555 is already implemented

**AI response**: Inspected the source code and found all core requirements from the issue
are already in the codebase:

- `src/lib/state/energy-rows.svelte.ts:27` — `DEFAULT_ROWS = ["100"]` initialises row 1
  with "100" on first render; no user input needed.
- `src/lib/state/entity-selection.svelte.ts:164–165` — `selectedParticleId` and
  `selectedMaterialId` are initialised to `PROTON_ID` and `WATER_ID` respectively.
- Program defaults to `AUTO_SELECT_PROGRAM`; auto-select chain for proton resolves to
  ICRU-49 (line 157).
- `src/lib/utils/calculator-url.ts` — URL `energies=` param takes precedence; the `100`
  fallback is only used when the decoded row list is empty.
- No `autofocus` attribute or programmatic `.focus()` call exists in
  `src/routes/calculator/+page.svelte`.

The user's screenshot confirmed the feature works: 100 MeV pre-filled, results (0.7286
keV/µm STP, 7.721 cm range) shown on first paint. Posted findings as a comment on
issue #555.

### Prompt 2: Open a PR with the missing Playwright test; add AI logs

**AI response**: Created `tests/e2e/cold-load-defaults.spec.ts` with four tests covering
every acceptance criterion from the issue:

1. `@smoke` — row 1 value is `"100"` after cold load (no query string).
2. `@smoke` — STP and CSDA cells are non-empty without any user interaction.
3. `@responsive` — `document.activeElement` is `<body>` after mount effects settle
   (tagged `@responsive` so the test also runs on the `mobile-chrome` and `tablet`
   Playwright projects, verifying the on-screen keyboard does not auto-appear).
4. `@regression` — `/calculator?energies=250` shows `250`, not `100`.

The 500 ms real-world performance budget from the issue cannot be enforced in CI
(machines are slower); instead the test uses a 5 s poll consistent with the existing
suite. A Lighthouse CI check on the deployed build is the right tool for the
timing budget.

## Tasks

### Add Playwright E2E test for cold-load defaults

- **Status**: completed
- **Stage**: Foundations (#555 follow-up)
- **Files changed**:
  - `tests/e2e/cold-load-defaults.spec.ts` (new)
  - `docs/ai-logs/2026-05-23-cold-load-defaults.md` (this file)
  - `CHANGELOG-AI.md` (prepended row)
  - `docs/ai-logs/README.md` (prepended log entry)
- **Decision**: Tagged the autofocus test `@responsive` so it runs on both the
  `chromium` and `mobile-chrome`/`tablet` Playwright projects without duplicating the
  test body. All other tests are untagged (chromium only) or `@smoke`/`@regression`.
- **Issue**: The 500 ms performance budget is a real-world target. CI timing is too
  variable to enforce it in the poll timeout — a Lighthouse step on the deployment is
  the right guard.
