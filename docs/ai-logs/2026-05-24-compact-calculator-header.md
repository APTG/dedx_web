# 2026-05-24 — Compact calculator page header for mobile

## Session Narrative

### Prompt 1: Fix issue #570 — reduce dead space above entity selection on mobile

**AI response**: Applied three targeted CSS-only changes across two files to reduce ~58px of vertical dead space on 390px-wide phones, with `sm:` variants restoring the original layout at ≥640px. No TypeScript or logic changes; build passes, 1427/1430 tests pass (3 pre-existing git-signing failures unrelated to this change).

## Tasks

### Compact calculator header for mobile (issue #570)

- **Status**: completed
- **Stage**: Stage 8 / UI polish
- **Files changed**:
  - `src/routes/+layout.svelte` — `py-6` → `pt-3 pb-6 sm:py-6` on `<main>` (saves ~12px top padding on mobile)
  - `src/routes/calculator/+page.svelte` — three changes:
    1. Outer wrapper `space-y-6` → `space-y-3 sm:space-y-6` (saves ~12px between header and entity panel)
    2. Merged heading + description into one `<div>`: `text-3xl font-bold` → `text-xl sm:text-2xl font-semibold`; description is `hidden min-[400px]:block text-xs sm:text-sm text-muted-foreground` (saves ~26px: font size + eliminated inter-element gap)
    3. Inner content wrapper `space-y-6` → `space-y-4 sm:space-y-6` (saves ~8px between entity panel sections)
- **Decision**: Description is hidden below 400px (very small phones only see the heading) and restores at 400px as `text-xs`, then grows to `text-sm` at 640px+. This matches the spec exactly.
- **Issue**: none
