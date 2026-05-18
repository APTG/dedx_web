# 2026-05-18 — Issue #534: Plotting error (Firefox + source map)

## Session Narrative

### Prompt 1: Read issue #534 and make a plan

**AI response**: Fetched issue #534 and explored the codebase. Diagnosed two problems:

1. **Runtime (user-visible):** Firefox shows "Failed to load the plot engine" on first `/plot` navigation. Root cause: the JSROOT module-evaluation race catch block in `jsroot-plot.svelte` checked only Chrome's phrasing (`reading 'jsroot'`) and missed Firefox's (`can't access property "jsroot" of undefined`).

2. **DX (developer-visible):** Stack traces showed `https://aptg.github.io/src/lib/components/jsroot-plot.svelte` (missing `/web_dev/`). Root cause: Vite's relative source map paths (6 `../`) traverse to the origin root, which doesn't include the GitHub Pages sub-path. Fixed with `sourcemapPathTransform` in `vite.config.ts`.

### Prompt 2: Make a commit and add short AI log

**AI response**: Implemented both fixes, ran all 1379 unit tests (pass), lint clean.

## Tasks

### Fix Firefox JSROOT module-race error

- **Status**: completed
- **Stage**: Stage 8 / plot
- **Files changed**: `src/lib/components/jsroot-plot.svelte`
- **Decision**: Broadened the string check from `message.includes("reading 'jsroot'")` to `message.includes("'jsroot'")` — covers Chrome, Firefox, and likely Safari with one expression.

### Fix source map URLs under BASE_PATH

- **Status**: completed
- **Stage**: Stage 8 / plot
- **Files changed**: `vite.config.ts`
- **Decision**: `sourcemapPathTransform` only activates when `BASE_PATH` env var is set (CI deploy), so local dev builds are unaffected.
