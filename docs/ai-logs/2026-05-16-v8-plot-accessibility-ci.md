# 2026-05-16 — v8 Plot accessibility CI follow-up

## Session Narrative

### Prompt 1: fix Plot accessibility E2E failure

**AI response**: Investigated CI run `25955686881` and failing job
`76305832755` with GitHub Actions logs. The failing Plot page axe check reported
`aria-required-parent` for v8 picker `role="option"` buttons and
`scrollable-region-focusable` for the particle ion list. Updated the v8
Particle, Material, and Program tabs so option row `<li>` wrappers are
presentational and scrollable listbox containers are keyboard-focusable.

## Tasks

### Fix v8 listbox ARIA structure

- **Status**: completed
- **Stage**: entity-selection v8
- **Files changed**:
  - `src/lib/components/v8/particle-tab.svelte`
  - `src/lib/components/v8/material-tab.svelte`
  - `src/lib/components/v8/program-tab.svelte`
  - `.opencode/lessons-learned.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-05-16-v8-plot-accessibility-ci.md`
  - `docs/ai-logs/README.md`
- **Decision**: Kept the existing `role="option"` buttons for test and UI
  semantics, but marked structural `<li>` wrappers as `role="presentation"` so
  axe sees the options as owned by their listboxes. Added `tabindex="0"` to
  scrollable listbox containers to satisfy Safari keyboard accessibility.
- **Issue**: none.

### Validation

- **Status**: completed
- **Commands**:
  - `pnpm build`
  - `pnpm exec playwright test tests/e2e/accessibility.spec.ts --project=chromium --reporter=line` → 4 passed
  - `pnpm test src/tests/unit/entity-selection-v8.test.ts -- --runInBand` → 23 passed
- **Issue**: local Node is v20.20.2 while the project wants Node 24, so `pnpm`
  prints an engine warning; commands still completed successfully.
