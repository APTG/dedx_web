# 2026-05-16 — Mobile nav/material polish review follow-up

## Session Narrative

### Prompt 1: Apply PR review thread fixes for `material-tab.svelte` on PR #525

**AI response**: Implemented the requested follow-up changes from the review thread in `material-tab.svelte`: added mobile full-screen sheet accessibility behavior (body scroll lock, initial focus on close button, Tab focus trap, Escape/close focus restore to the `⤢` trigger), and made bottom fade overlays conditional on real scrollability (and hidden at scroll bottom). Added/updated a focused unit test in `entity-selection-tabbed.test.ts` to validate scroll-lock and focus-restore behavior. Re-ran lint, targeted tests, full tests, and build.

## Tasks

### Material sheet accessibility + fade overlay review fixes

- **Status**: completed
- **Stage**: Stage 8 / mobile
- **Files changed**:
  - `.opencode/lessons-learned.md`
  - `src/lib/components/entity-selection/material-tab.svelte`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-05-16-mobile-nav-material-review-followup.md`
- **Decision**: Kept the fix localized to the reviewed component by handling dialog focus/scroll behavior directly in `material-tab.svelte`, and used per-list overflow checks for fade visibility to avoid introducing new shared abstractions.
- **Issue**: No unresolved functional issues in this follow-up. Local preview still shows expected WASM-missing warning outside this scope when `static/wasm/libdedx.mjs` is absent.
