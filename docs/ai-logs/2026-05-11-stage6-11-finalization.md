# 2026-05-11 — Stage 6.11 finalization (export advanced additions)

**Model:** Claude Sonnet 4.5 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Finish what opencode/Qwen left open on `feat/stage6-11-export-advanced`

The user asked me to:

1. Move the opencode transcript `session-ses_1e92.md` from the repo root into the
   normal `docs/ai-logs/` location and update the AI-log index.
2. Read the whole transcript and extract lessons learned that should be added to
   the AI markdown scaffolding.
3. Take initiative and finish whatever Stage 6.11 work the previous session had
   not completed (the transcript ended mid-lint after a user abort).
4. Mark Stage 6.11 ✅ in `docs/00-redesign-plan.md`.
5. Make sure the E2E suite fully covers all five spec scenarios in
   `docs/04-feature-specs/stage-6-11-export-advanced.md`.

**AI response — investigation**

- Pulled the latest CI run for `fd675f1` (the tip of this branch). All four
  jobs (Workflow Guards, WASM Build, Unit & Integration Tests, E2E) were green,
  so the CSV-modal reactivity fix Qwen landed in `fd675f1` is real and shipping.
- Audited the implementation surface against the spec:
  - `CsvExportModal.svelte` exists with all required `data-testid` attributes.
  - `exportCsv()` opens the modal in advanced mode and downloads directly in
    basic mode.
  - `exportPdf()` threads `advancedMetadata` through to `generateCalculatorPdf`
    which appends the "Advanced Mode Details" block (PARTICLE/MATERIAL/PROGRAMS/
    SETTINGS/SYSTEM/BUILD).
  - Plot page exposes `export-image-png` only behind `isAdvancedMode.value`.
  - `tests/e2e/export-advanced.spec.ts` covers Scenarios 1, 3, 4, 5.
- Found one **spec compliance gap**: Scenario 2 of the stage spec says the
  CSV modal must also open on the **Plot** page in advanced mode, but
  `exportPlotCsv()` performed a direct download regardless of mode and the
  matching E2E test (`Plot CSV export in advanced mode (no modal)`) asserted
  the opposite of the spec.

**AI response — finalization**

Implemented the missing Plot-CSV modal wiring + brought the E2E test in line
with the spec, then logged the lessons.

### Prompt 2 (implicit): Verify nothing regresses

Ran the full unit suite (1044 passed), `pnpm lint` (clean), and `pnpm build`
(success) after each functional change. CI on PR will re-run the full E2E
suite (Playwright with the real WASM artifact) per the existing workflow.

## Tasks

### 1. Move opencode session transcript into `docs/ai-logs/`

- **Status:** completed
- **Stage:** housekeeping
- **Files changed:**
  - `git mv session-ses_1e92.md docs/ai-logs/2026-05-11-stage6-11-export-advanced-qwen-session.md`
  - Prepended a `Model:` line and a one-paragraph context note to the moved
    transcript explaining where the session was aborted and where it picks up.
  - Indexed in `docs/ai-logs/README.md`.
- **Decision:** Filename pattern matches the previous opencode transcript
  archive (`2026-05-10-stage6-10-opencode-orchestration-transcript.md`).

### 2. Wire Plot CSV through the shared CSV modal in advanced mode (Scenario 2)

- **Status:** completed
- **Stage:** 6.11
- **Files changed:**
  - `src/lib/state/export.svelte.ts` — added `pendingPlotCsv = $state({ value: null })`
    slot; `exportPlotCsv()` now stages plot data and opens the modal in
    advanced mode (writes `mode = "plot"` **before** `value = true`);
    `performCsvDownload()` now dispatches on `showCsvModal.mode` to either the
    Calculator CSV path or the Plot CSV path.
  - `src/lib/export/plot-csv.ts` — `downloadPlotCsv()` now accepts optional
    `CsvOptions` and a custom `filename` (defaults preserved for the basic-mode
    direct-download path).
  - `src/routes/+layout.svelte` — modal `defaultFilename` switches to
    `dedx_plot_data.csv` when `showCsvModal.mode === "plot"`.
- **Decision:** Re-used the single `CsvExportModal` instance instead of
  introducing a second component, matching the spec's "same modal as Calculator"
  language and the existing `localStorage` persistence semantics.

### 3. Update Scenario 2 E2E to match spec

- **Status:** completed
- **Stage:** 6.11
- **Files changed:** `tests/e2e/export-advanced.spec.ts` — renamed the test to
  `Plot CSV export in advanced mode opens shared CSV modal @regression` and
  assert the modal becomes visible, all separator + line-endings radios are
  visible, and confirming downloads a `.csv` file.
- **Decision:** Kept the basic-mode direct-download Plot CSV coverage where it
  already lives (`tests/e2e/export.spec.ts`).

### 4. Mark Stage 6.11 ✅ in the redesign plan

- **Status:** completed
- **Files changed:** `docs/00-redesign-plan.md` — updated the 6.11 row's
  status emoji and rewrote the description to reflect what shipped; updated
  the "remaining work" order to `6.12 → 6.13`.

### 5. Lessons learned from the opencode transcript

- **Status:** completed
- **Files changed:** `.opencode/lessons-learned.md` — appended Entries 25–27:
  - **Entry 25** — `$state(null)` cannot have properties assigned to it; nullable
    shared state must be wrapped in `{ value: T | null }`. Top-level `$state`
    exports also cannot be reassigned. Both bugs cost the orchestrator several
    iterations in the transcript before the fix landed in `fd675f1`.
  - **Entry 26** — Set modal `mode` (and any other prop the layout depends on)
    **before** flipping `open = true`, otherwise the dialog mounts with stale
    state.
  - **Entry 27** — When implementation diverges from a spec acceptance scenario,
    fix the implementation rather than rewriting the E2E to match — this is
    exactly what happened to Scenario 2 in the original session.

### 6. CHANGELOG-AI row + ai-logs README index

- **Status:** completed
- **Files changed:** `CHANGELOG-AI.md`, `docs/ai-logs/README.md`.
