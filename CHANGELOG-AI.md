# AI Changelog

> This changelog tracks all AI-assisted coding sessions on this project.
> Each entry links to a detailed session log in `docs/ai-logs/`.
>
> **Note:** AI-assisted work on this project began on 1 April 2026 with
> the creation of the redesign plan (`docs/00-redesign-plan.md`). Those
> early planning sessions pre-date this changelog and are not recorded here.
> This log starts from 3 April 2026 when the AI changelog system was introduced.

| Date | Stage | Description | Log |
| 2026-05-05 | 6.8 | **Fix Select components — bits-ui `onValueChange` never fires in Svelte 5** (Qwen3.5-397B-A17B-FP8 via opencode): bits-ui Select's `boxWith()` binding doesn't trigger `onValueChange` or update `bind:value` in Svelte 5 despite UI updating. Root cause: bits-ui uses `boxWith(() => value!, (v) => { value = v; onValueChange(v); })` where setter is never called. Solution: replaced bits-ui Select with native `<select>` wrapped in `NativeSelect` component. Files: created `src/lib/components/ui/native-select/native-select.svelte` (47 lines, `onchange` handler, `options` prop), `index.ts`; removed `src/lib/components/ui/select/select.svelte`; updated `advanced-options-panel.svelte` (3 Select → NativeSelect); fixed `advanced-options.spec.ts` E2E test (`page.selectOption()` instead of clicking `[role="option"]`). All 96 E2E tests pass. Scale select updates URL with `interp_scale=lin-lin`, method select updates with `interp_method=spline`. Both Calculator and Plot pages verified. Lint: fixed unused imports/warnings in `advanced-options-panel.svelte`. | [log](docs/ai-logs/2026-05-05-stage6-8-select-fix.md) |
