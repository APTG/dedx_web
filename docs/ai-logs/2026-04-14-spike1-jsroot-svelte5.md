# 2026-04-14 — Spike 1: JSROOT 7 + Svelte 5 $effect

## Session Narrative

### Prompt 1: Run Spike 1 (jsroot-svelte5) prototype
**AI response**: opencode (with Qwen3.5-397B) scaffolded a fresh SvelteKit 2 +
Svelte 5 project in `prototypes/jsroot-svelte5/` on branch `spike/jsroot-svelte5`.
The agent implemented:

- `src/lib/JsrootPlot.svelte` — JSROOT 7 wrapper component using the `$effect` +
  `untrack` pattern for DOM lifecycle. On cleanup the painter's `cleanup()` API is
  called followed by `container.innerHTML = ""` as a DOM-safety fallback.
  `JSROOT.settings.ZoomWheel = false` is set once per mount to disable wheel zoom.
- `src/routes/+page.svelte` — reactive demo page with `$state`-tracked series array
  and buttons: "Add series", "Remove all", "Mutate first series".
- `vite.config.ts` — Tailwind CSS plugin wired in.
- `VERDICT.md` — all 9 acceptance criteria evaluated and recorded as PASS.

### Prompt 2 (implicit): verify and commit
**AI response**: committed the prototype as `chore: prototype — jsroot-svelte5`
on branch `spike/jsroot-svelte5`.

## Tasks

### Spike 1 — JSROOT 7 + Svelte 5 $effect
- **Status**: completed
- **Stage**: 2.5
- **Branch**: `spike/jsroot-svelte5`
- **Files changed**:
  - `prototypes/jsroot-svelte5/src/lib/JsrootPlot.svelte`
  - `prototypes/jsroot-svelte5/src/routes/+page.svelte`
  - `prototypes/jsroot-svelte5/vite.config.ts`
  - `prototypes/jsroot-svelte5/VERDICT.md`
  - (scaffolding: `package.json`, `pnpm-lock.yaml`, `svelte.config.js`,
    `tsconfig.json`, `.npmrc`, `.gitignore`, `static/`, `pnpm-workspace.yaml`)
- **Decision**: `painter.cleanup()` is the correct JSROOT 7 cleanup API; combined
  with `container.innerHTML = ""` it prevents JS heap growth during rapid
  add/remove cycles (criterion 7). `untrack` ensures JSROOT's internal mutations
  never trigger a recursive Svelte effect loop.
- **Verdict**: All 9 criteria PASS — architecture validated, no amendments required.
