# 2026-06-05 — WCAG Accessibility Audit & Fixes

## Session Narrative

### Prompt 1: Audit the app for full WCAG compatibility and report what is missing

**AI response**: Surveyed the codebase for WCAG 2.1 AA coverage. Found the app
already well-instrumented: axe-core e2e test (`tests/e2e/accessibility.spec.ts`)
across all four routes running in CI, `lang`, per-page titles, an `h1` per route,
`aria-current` nav state, `aria-label`s on icon/ambiguous buttons, 29 live-region
usages plus `selection-live-region.svelte`, `role="dialog"` + focus traps on
modals, `role="img"` + description on the JSROOT plot, and 48px route-tab touch
targets. Identified gaps: **(1)** no skip link (SC 2.4.1, Level A — and not caught
by axe), **(2)** no global `:focus-visible` fallback (SC 2.4.7), **(3)** masthead
is a bare `<nav>` containing non-nav controls (SC 1.3.1), plus a coverage blind
spot (axe only ran `wcag2a`/`wcag2aa`, not `wcag22aa`) and minor hardening
(partial reduced-motion, borderline `--muted-foreground` contrast). Delivered the
report in chat.

### Prompt 2: Create issues describing what to fix and why

**AI response**: Filed four focused issues on `APTG/dedx_web`: #708 (skip link),
#709 (focus-visible), #710 (header landmark), #711 (WCAG 2.2 coverage +
hardening). Each has summary, rationale, concrete proposed fix with file paths,
acceptance criteria, and WCAG references. Only the `enhancement` label existed in
the repo, so severity was encoded in the bodies.

### Prompt 3: Work the issues (one commit each), create labels + retag, add AI log, open a PR

**AI response**: Implemented all four on `claude/wcag-compatibility-audit-CPq46`,
one commit per issue. Determined via axe-core source that `wcag22aa` adds only the
`target-size` rule (SC 2.5.8); proactively gave the two clear-override icon
buttons a 24px hit area. Verified the darkened contrast token direction with a
luminance calc. Ran `pnpm lint` (clean), `pnpm check` (0 errors), `pnpm test`
(1697 pass; the only failures are `guard-forbidden-files.test.ts`, which spawn
nested `git commit`s that hit the sandbox commit-signing server — environmental,
unrelated to these changes).

## Tasks

### #708 — Skip-to-content link (WCAG 2.4.1, Level A)

- **Status**: completed
- **Stage**: Stage 8 (accessibility hardening)
- **Files changed**: `src/routes/+layout.svelte`, `tests/e2e/accessibility.spec.ts`
- **Decision**: Off-screen-until-focused link as first focusable element targeting
  `<main id="main-content" tabindex="-1">`; `#main-content:focus { outline: none }`
  so the programmatic skip target shows no ring. Added an e2e assertion (first Tab
  focuses the link, Enter moves focus to `<main>`) because axe's `bypass` rule does
  not reliably detect a missing skip link.

### #709 — Global :focus-visible fallback (WCAG 2.4.7)

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `src/app.css`
- **Decision**: `:where(...)` selector keeps specificity at 0 so existing
  component focus styles still win; excludes `tabindex="-1"` so skip targets don't
  get a ring.

### #710 — `<header>` banner landmark, scoped `<nav>` (WCAG 1.3.1)

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `src/routes/+layout.svelte`
- **Decision**: Masthead is now `<header>` (banner); `<nav aria-label="Primary">`
  wraps only the route tabs. All `data-testid` hooks preserved; existing
  `locator("nav")` / `getByRole("navigation")` e2e checks still resolve to the
  route-tabs nav.

### #711 — WCAG 2.2 coverage + hardening

- **Status**: completed
- **Stage**: Stage 8
- **Files changed**: `tests/e2e/accessibility.spec.ts`, `src/app.css`,
  `src/lib/components/advanced-options-panel.svelte`
- **Decision**: Added `wcag22aa` to the axe tag set (adds `target-size` / SC
  2.5.8 only). Gave the clear-override buttons a 24px hit area. Added a global
  `prefers-reduced-motion` rule. Darkened `--muted-foreground` 0.47 → 0.44 for AA
  contrast headroom.
- **Issue**: e2e/axe could not be executed in this environment (no built WASM, no
  Playwright browsers), so `target-size` was validated by reasoning + proactive
  hardening rather than a live run. CI on the PR is the final verifier.
