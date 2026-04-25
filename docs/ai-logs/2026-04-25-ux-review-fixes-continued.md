# 2026-04-25 — UX Review Fixes (Entity Selector & Energy Input) — Continued

## Session Narrative

### Prompt: implement remaining UX review issues
**AI response:** Implemented 2 UX fixes from the priority list:

**Issue 17** — Error and parsed-value share unstable layout slot:
- Added `min-h-[1.25rem]` container to wrap both error text and parsed-value arrow display in `energy-input.svelte`
- Consolidated duplicate snippet code that was causing compilation errors
- Used conditional rendering (`{:else}`) to show either error OR parsed value, not both simultaneously
- No new tests needed — visual stability fix
- All 12 energy-input tests passing

**Issue 24** — Mobile dropdown overflow risk:
- Added `max-w-[calc(100vw-2rem)]` and `overflow-x-hidden` Tailwind classes to the combobox dropdown content container in `entity-combobox.svelte`
- Prevents dropdown from overflowing viewport on narrow screens (e.g., 375px mobile)
- No new tests needed — defensive fix
- All 17 entity-combobox tests passing

## Tasks

### Issue 17 — Error and parsed-value share unstable layout slot
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/energy-input.svelte`, `docs/ux-review-entity-selector-energy-input.md`
- **Decision:** Used `min-h-[1.25rem]` wrapper div with conditional rendering (error OR parsed value) rather than showing both simultaneously
- **Tests:** 12 energy-input tests pass

### Issue 24 — Mobile dropdown overflow risk
- **Status:** completed
- **Stage:** 5.3
- **Files changed:** `src/lib/components/entity-combobox.svelte`, `docs/ux-review-entity-selector-energy-input.md`
- **Decision:** Added `max-w-[calc(100vw-2rem)]` to prevent horizontal overflow on narrow viewports
- **Tests:** 17 entity-combobox tests pass

## Summary

- **Issues completed:** 2 (17, 24)
- **Total tests:** 335 passing
- **Branch:** `fix/ux-review-entity-energy`
- **Model:** Qwen3.5-122B-A10B via opencode
