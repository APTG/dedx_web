# 2026-06-17 — Entity-selection squiggle underline + #736 status sync

## Session Narrative

### Prompt 1: Work on the remaining items from #736; right-size a single PR

After the first #736 PR (#738: Explore-compat removal + Load external on Plot,
now merged), I audited the four remaining items against the actual code:

- **Shared picker-level search row (with chevron + dynamic placeholder)** —
  already implemented: a single `search-input.svelte` in
  `entity-selection.svelte` owns a shared `query`, derives a per-tab
  placeholder, clears on tab change, and the `▲/▼` chevron toggles the panel.
  The spec follow-up still listed it as deferred (stale).
- **Mobile Material-tab card polish** — bounded scrolling
  (`max-h-52 overflow-auto`) and the bottom fade shadow (`showBottomFade`)
  already ship in `material-tab.svelte`. Only the explicit `⤢`
  full-screen-sheet promotion remains (and on mobile the full-screen
  `picker-sheet.svelte` already opens by tapping the search field).
- **Interactive list reorder (drag + `Alt+ArrowUp/Down` + `aria-live`)** —
  genuinely unimplemented, but medium-large and UI-ambiguous (it depends on
  the partially-deferred multi-select ordering). Left for its own PR.
- **Active-target tab "squiggle" SVG** — genuinely unimplemented: the
  underline was a flat coral rounded bar.

I scoped this PR to the squiggle (the one self-contained, low-risk open item)
plus a spec/issue status sync for the already-shipped items.

**Implementation.** Added `squiggle-underline.svelte` — a decorative coral SVG
wave that tiles via an SVG `<pattern>` (`patternUnits="userSpaceOnUse"`) so the
wave period stays constant regardless of tab width; `preserveAspectRatio="none"`
lets the filled `<rect>` stretch. It is `aria-hidden` and static (no animation,
so `prefers-reduced-motion` is a no-op). `tab-bar.svelte` now renders it inside
the absolutely-positioned active-target underline span instead of the flat bar.
Added a unit test asserting exactly one squiggle renders and it lives inside the
active tab. Updated the **Tab styling** spec note and the **Follow-up items**
list (marked the shared-search row done, the mobile polish partly done, and
added the squiggle as done).

## Tasks

### Active-target tab squiggle underline

- **Status**: completed
- **Stage**: Stage 6–8 / entity-selection
- **Files changed**:
  - `src/lib/components/entity-selection/squiggle-underline.svelte` (new)
  - `src/lib/components/entity-selection/tab-bar.svelte`
  - `src/tests/unit/entity-selection-tabbed.test.ts`
  - `docs/04-feature-specs/entity-selection.md`
- **Decision**: tiling `<pattern>` rather than a single stretched path, so the
  wave period is width-independent. Component kept dependency-free and static.

### #736 status sync

- **Status**: completed (documentation)
- **Decision**: corrected stale "deferred" markers — the shared search row and
  the Material-tab bounded-scroll/fade were already shipped.
- **Issue**: remaining #736 work after this PR is the interactive list reorder
  and the `⤢` full-screen-sheet promotion affordance — both left for their own
  PRs.
