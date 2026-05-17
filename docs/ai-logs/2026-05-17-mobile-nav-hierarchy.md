# 2026-05-17 — Mobile Nav Hierarchy (issue #528)

## Session Narrative

### Prompt 1: Implement GitHub issue #528 — top-nav visual hierarchy on mobile

**AI response**: Read issue #528, which reports that users couldn't find Calculator/Plot/Docs because the Basic/Advanced toggle appeared more prominent. Audited the existing `+layout.svelte`, E2E tests (layout.spec.ts, navigation.spec.ts, toolbar.spec.ts, accessibility.spec.ts, url-parser.spec.ts), and the `advanced-mode.svelte.ts` state module.

Created branch `feat/issue-528-mobile-nav-hierarchy`. Restructured the nav into two explicit rows:

- **Row 1**: Logo + right-side controls (Export PDF/CSV desktop-only, Share URL, Basic/Advanced chip)
- **Row 2**: Full-width route tabs — Calculator | Plot | Docs — with 48 px min-height on mobile, filled active background, 2 px bottom border accent, and `aria-current="page"` on the active tab

Added `<style>` block with `.route-tab`, `.route-tab-active`, `.route-tab-inactive` classes using CSS custom properties from `app.css`. The mode toggle keeps its existing `aria-label` attributes intact so all E2E tests that click `button[aria-label="Switch to Basic mode"]` continue to work unmodified.

Ran full Playwright suite: 180 passed, 10 skipped, 1 pre-existing failure (`url-parser.spec.ts: advanced URL can switch back to Basic mode`) confirmed to fail on master too.

## Tasks

### Two-row nav restructure

- **Status**: completed
- **Stage**: Stage 8 / mobile UX
- **Files changed**: `src/routes/+layout.svelte`
- **Decision**: Kept Basic/Advanced toggle inline in row 1 (always visible) rather than implementing a popover/bottom-sheet. The issue acceptance criteria only require "two-row structure + mode toggle persists". The open design question around a settings chip popover is deferred.
- **Issue**: `url-parser.spec.ts:128` ("advanced URL can switch back to Basic mode") is a pre-existing failure on master unrelated to this change.
