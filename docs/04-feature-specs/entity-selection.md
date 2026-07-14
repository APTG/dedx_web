# Feature: Entity Selection (Particle → Material → Program)

> **Status:** Production (2026-05-15) — the tabbed picker is the only
> entity-selection UI on both the Calculator and Plot pages.
>
> Covers the entity selection component used on both the
> Calculator and Plot pages. This is the primary interaction point
> for choosing _what_ to calculate.

---

## Tabbed picker

> **The compatibility-matrix data model and bidirectional filtering rules**
> described later in this document still apply — only the rendering layer
> changed when the tabbed picker shipped. Acceptance criteria around
> defaults, persistence, search, ARIA, and error handling carry over
> verbatim unless noted.

### Entity-selector chrome rework (2026-05-16)

The recipe bar (`particle → material → program`) was removed. The header
chrome is now a single tab strip per page; the currently-selected value for
each tab is rendered inline in the tab button. Reset and the Advanced-mode
affordances moved into a dedicated `advanced-toolbar.svelte` that renders
above the tab strip in Advanced mode only.

**State model** (`EntitySelectionState`, see
`src/lib/state/entity-selection.svelte.ts`):

- `activeTarget: "particle" | "material" | "program"` — which tab the search
  bar and the coral underline are bound to. Settable via `setActiveTarget`.
- `expanded: boolean` — whether the list panel below the tab strip is
  visible. Settable via `setExpanded`.
- `across: "particle" | "material" | "program"` — Compare-across dimension
  (Advanced only; forced to `"program"` in Basic). Settable via
  `setAcross` which also seeds `multiSelected[newAcross]` from the current
  single value, sets `activeTarget`, and expands the panel.
- `multiSelected: { particle, material, program: (number|string)[] }` —
  ordered selection arrays. Element 0 is the "default" used for the
  primary single-value calculation; subsequent entries drive multi-program
  comparison results. Toggle via `toggleMulti(dim, id)` — element 0 cannot
  be deselected without first reordering.

**Active-target rules**

- A. User actions
  1. Click a tab title → `setActiveTarget(tab); setExpanded(true)`.
  2. Focus the search input → `setExpanded(true)` (target unchanged).
  3. Select a row in the list → calls `selectParticle / selectMaterial /
selectProgram`, then `afterSelection` advances `activeTarget` to the
     next empty tab in `① → ② → ③` order with `expanded = true`.
  4. If all three tabs are non-empty after a selection: `activeTarget`
     stays put. On Calculator (`collapsible=true`) the panel collapses;
     on Plot it stays open.
  5. Clearing a value (via the existing selected-pill `× clear` button
     inside the panel) sets `activeTarget` back to that tab and
     `expanded = true`.
  6. The Advanced toolbar `↺` button calls `resetAll()` which restores
     proton/Water/Auto and re-targets the Particle tab.
  7. Pressing Esc while focus is inside the picker blurs the focused
     element and (on Calculator) collapses the panel.
- B. Initial render
  - Calculator (`collapsible=true`): `expanded = !isComplete` on first mount.
  - Plot (`collapsible=false`): `expanded = true` always.

**Tab styling**

- The currently-active tab keeps its existing background-swap treatment.
- The `activeTarget` tab additionally renders the coral "squiggle"
  underline from the wireframes — an SVG wave (`squiggle-underline.svelte`)
  drawn with a tiling `<pattern>` so the wave period stays constant
  regardless of tab width. It is decorative (`aria-hidden`, static).
- An empty tab — particle/material null, or `Auto-select` with no
  resolved program — gets a red dashed border and a small `!` badge with
  `data-testid="picker-tab-{id}-empty"` so E2E tests can assert it.

**Advanced toolbar**

`advanced-toolbar.svelte` renders above the tab strip when `isAdvancedMode`
is true **and** the host page opts in via `showAdvancedToolbar`. The prop
defaults to `collapsible`, but both the Calculator and Plot pages opt in
(Plot passes `showAdvancedToolbar` explicitly so the toolbar shows in
Advanced mode regardless of viewport). Contents:

- **Compare-across strip** (`compare-across-strip.svelte`) — a visible
  4-button pill radiogroup replacing the earlier dropdown:
  `[Programs ●]  [Materials]  [Particles]  [Single]`. The active
  dimension has a filled pill. `AcrossDimension` accepts
  `"program" | "material" | "particle" | "single"`. See
  [ADR 011](../decisions/011-compare-across-visible-strip.md).
- `🔗 Load external` — opens the load-external modal. The button is enabled
  when the page passes an `onLoadExternal` handler; both the Calculator and Plot
  pages wire it. (The compatibility-overlay `⊞ Explore compat` affordance is
  not present yet — it will be (re-)introduced by the compatibility-overlay
  issue when that lands.)
- `↺` reset — calls `state.resetAll()` and, on Calculator, also collapses
  the panel (defaults are complete after reset).

**Multi-list rendering (deferred)**

The original wireframes drew a SELECTED + AVAILABLE multi-list on the
Program tab when `across === "program"` in Advanced. That rendering
branch is **not shipped in this PR** because nothing consumes
`multiSelected.program` yet — multi-program comparison is still driven
by `MultiProgramState` above the Calculator results table. The state
setters (`setAcross`, `toggleMulti`, `multiSelected.*`) remain wired so
the follow-up issue can light up the UI without re-deriving the data
model. See follow-up issue "Compare across — Programs end-to-end".

**Custom-material pill**

The Material tab renders a coral `+ New custom material` pill **below**
the Elements / Compounds / Custom columns in Advanced mode (less
prominent than the columns themselves; the columns are the primary
selection path, the pill is a less-common "create new" affordance).

**Follow-up items.** Several items originally deferred from the
chrome+state rework PR have since shipped during Stage 6–8 and are noted
here for history:

1. _(Done)_ Persistent picker-level search row with chevron + dynamic
   placeholder. A single `search-input.svelte` lives in `entity-selection.svelte`
   (shared `query`, per-tab placeholder, cleared on tab change) and feeds all
   three tabs; the chevron `▲/▼` toggles the panel.
2. _(Done)_ `external-sources-panel.svelte` now lives under
   `src/lib/components/entity-selection/` with per-source attribution and
   remove buttons.
3. _(Done)_ `load-external-modal.svelte` (URL paste + drag-drop file +
   localStorage recents) is built and wired to the `Load external` button on
   both the Calculator and Plot pages (`onLoadExternal` passed). The Plot page
   passes `showAdvancedToolbar` explicitly so the affordance is reachable in
   Advanced mode on any viewport.
4. _(Deferred)_ Complete interactive list reorder (drag + `Alt+ArrowUp/Down`)
   with `aria-live` announcements.
5. _(Done)_ `Compare across = Materials` / `Particles` is wired end-to-end
   through the calculation (`multi-entity-calc.svelte.ts`) and plot pipelines.
6. _(Done)_ The legacy in-panel pill and the standalone multi-program picker
   components were removed once the tab-bar inline display replaced them.
7. _(Partly done)_ Mobile Material-tab card polish — bounded scrolling
   (`max-h-52 overflow-auto`) and the bottom fade shadow (`showBottomFade`)
   ship in `material-tab.svelte`. The explicit `⤢` full-screen-sheet promotion
   affordance is still deferred (on mobile the full-screen `picker-sheet.svelte`
   already opens by tapping the search field).
8. _(Done)_ Active-target tab "squiggle" underline — `squiggle-underline.svelte`
   renders the coral SVG wave (see **Tab styling** above).

### Collapsible panel (Calculator only)

On the Calculator page the tab panel auto-collapses once all three selections
are complete, recovering vertical space for the results table. Clicking any tab
re-expands the panel. The Plot page keeps panels always
expanded. The `collapsible` prop on `<EntitySelection>` controls this:

```svelte
<!-- Calculator — panel auto-collapses when complete -->
<EntitySelection selectionState={entityState} collapsible={true} />

<!-- Plot — always expanded -->
<EntitySelection selectionState={entityState} />
```

### Particle list Z display

Atomic number is shown inline within the particle name rather than as a
separate far-right column:

- Proton → `proton (Z=1)`
- Alpha → `alpha particle (Z=2)`
- Ions with symbol bracket → `Lithium (Li, Z=3)`

The selected-pill label also includes Z inline (no separate `meta` prop).

### Mobile tab layout

At narrow viewports (`< sm / 640px`) the selected-value in each tab button
is stacked below the tab title rather than inline to the right:

```
① Particle
proton (Z=1)
```

At `sm:` and above it reverts to the inline format `① Particle: proton (Z=1)`.

---

### Adaptive Picker Kit (PR A — 2026-05-17)

> **Issue #530 — PR A:** Adaptive Picker Kit + Particle/Material/Program Rework.
> Shipped in branch `feat/issue-530-mobile-picker-part-a`.
> Plot page left untouched (collapsible=false path is unchanged).

#### Adaptive size-bucket system

Each picker tab renders differently depending on the count of available items
(`computeBucket` in `src/lib/components/entity-selection/size-bucket.ts`):

| Bucket   | Count  | Behavior                                      |
| -------- | ------ | --------------------------------------------- |
| `tiny`   | ≤ 10   | Flat tap list, no search, no scroll container |
| `medium` | 11–150 | Scrollable list with search                   |
| `large`  | > 150  | Same as medium (future: virtualisation)       |

The Program tab uses this: ≤ 10 programs → renders `<ProgramInlineList>` (no
search bar, no scroll wrapper); more → existing auto-hero + scrollable `<ul>`.

Particle (~30 items) → always `medium`. Material (~195 items) → always `large`.

#### Particle tab — flat Z-sorted list

Builtin and external-only particles form a single flat list sorted globally by
Z with no section headers and no special treatment for any particle.

Each row renders `getParticleListLabel(p, z)` — Z is embedded in the name
(`proton (Z=1)`, `Carbon (C, Z=6)`) with no separate right-aligned Z column.

`data-testid="picker-particle-list"` on the `<ul>` (no sub-sections).

Electron (id 1001) remains excluded until ESTAR ships.

#### Particle tab — periodic-grid scan view (Advanced)

Shipped in PR #614 (issue #599). In **Advanced** mode the particle tab
exposes a list/grid toggle so users can scan particles by Z directly on
the periodic table. The toggle is suppressed in Basic mode, and the view
is force-reset to `"list"` when the user drops out of Advanced mode.

Layout — `data-testid="picker-particle-grid"`:

- 18-column CSS grid (`grid-template-columns: repeat(18, minmax(0, 1fr))`)
  with rows `repeat(7, auto) 0.35rem repeat(2, auto)`. Row 8 is an
  intentional gap separating the main table from the lanthanide /
  actinide rows (9 and 10).
- Each builtin renders as a square tile with `Z` in the top-left corner
  and the element `symbol` centered, wrapped in a `<button role="option">`.
- Tile testid: `picker-particle-tile-{id}`. Availability is exposed as
  `data-available="0|1"`. Unavailable tiles are `disabled` and rendered
  at `opacity-40`; search non-matches dim to `opacity-30`.
- Two `aria-hidden` indicator cells sit at row 6 col 3 and row 7 col 3
  showing `57-71` / `89-103`, pointing to the lanthanide / actinide rows
  below.
- External-only particles render below the grid as a wrap row
  (`data-testid="picker-particle-grid-external"`) of chip-style buttons
  `picker-particle-ext-tile-{id}` showing `🔗 symbol Z=N`.
- View toggle: `data-testid="picker-particle-view-toggle"` with
  `picker-particle-view-list` (☰) and `picker-particle-view-grid` (▦)
  buttons; both expose `aria-pressed` mirroring the active view.
- `<div data-testid="picker-particle-tab" data-view="list|grid">` on the
  outer wrapper lets tests assert the active view without hitting the
  toggle.

Selection, highlight, multi-select, anchor, and keyboard navigation
behave identically to the list view — the grid is purely a rendering
alternative for the same underlying state.

#### Particle tab — component decomposition (PR #617)

`particle-tab.svelte` is a thin orchestrator. The two renderers live in
sibling components and receive already-derived arrays + per-particle
callbacks via Svelte 5 `$props()`:

- `particle-list-view.svelte` — owns the `picker-particle-list` listbox.
- `particle-grid-view.svelte` — owns the `picker-particle-grid` grid and
  the `picker-particle-grid-external` chip row. Built-in props are typed
  `ParticleEntity[]` (not the wider `Particle` union) since the
  periodic-table grid only renders builtins.
- `particle-tab-helpers.ts` — pure helpers shared by all three:
  `Particle` type alias, `isExternal`, `atomicNumber`,
  `periodicPosition` (atomic-number → row/column mapping).

The orchestrator retains: filter/match (`z=N` operator), view-mode
state, `PickerSummaryBar`, view toggle, multi-select bookkeeping, and
registration of the picker-level `onArrowKey` / `onEnterKey` keyboard
handlers (`$bindable` slots).

#### Material tab — sub-tab pill controls

Replaced the three side-by-side columns with a single active list plus
pill buttons switching between sub-tabs:

- **Order**: Compounds · Elements · Custom (Custom only in Advanced mode)
- **Default active sub-tab**: `"compounds"`
- **Persistence**: `localStorage["webdedx.materialSubtab"]` — survives reload
- **Scroll memory**: each sub-tab's scroll position is saved/restored on switch
- **Auto-switch**: when the _selected material itself changes_ (e.g. picked
  from a list, restored from a URL) and lands in a different sub-tab, the
  tab silently switches to show it. This is keyed off the selection's
  identity, not the active sub-tab — clicking a pill by hand never gets
  silently reverted while the same material stays selected (#847).
- **Attract highlight**: when the active sub-tab's search query has zero
  matches and another sub-tab has matches, that other pill (or pills) gets
  an accent highlight (`data-attract="true"`) to draw the eye — the switch
  itself is always manual, never automatic. No highlight when the query is
  empty or the active sub-tab already has matches.
- **Bottom fade**: a gradient fade at the bottom of the list hints at overflow

Test IDs:

- Sub-tab pills: `material-subtab-compounds`, `material-subtab-elements`, `material-subtab-custom`
  (each also carries `data-attract="true"|"false"`)
- Active list: `picker-material-list-{activeSubTab}`
- Add compound: `picker-material-add-compound` (unchanged for backward compat)

#### Full-screen search sheet (mobile)

On mobile (≤ 640px), the picker-level search field is a tap-target `<button>`
rather than a real `<input>`. Tapping it opens a full-screen overlay
(`picker-sheet.svelte`) with:

- Autofocused `<input data-testid="picker-sheet-input">`
- A Clear (×) button (`data-testid="picker-sheet-clear"`) that appears **only
  when the field has text** (#812) — a persistent × beside an empty field reads
  as a close affordance and misleads. The input suppresses the browser's native
  `::-webkit-search-cancel-button`, so a filled field never shows two ×'s.
- Full focus trap (Tab cycling, Escape to close)
- Body scroll lock (`document.body.style.overflow = "hidden"`) while open
- Hardware Back support (`history.pushState` + `popstate` listener)
- Done button (`data-testid="picker-sheet-done"`) in multi-select Advanced mode
- Results mirror the main tab's logic: flat particles, grouped materials, flat programs

Mobile detection uses `window.matchMedia("(max-width: 640px)")` with a jsdom
guard (`if (!window.matchMedia) return;`) in both `search-input.svelte` and
`entity-selection.svelte`.

State: `selectionState.sheetOpen` (boolean) + `setSheetOpen(open)`.

No mobile autofocus: on tab change, `searchInputRef?.focus()` is only called
when `!isMobile` to avoid invoking the software keyboard unexpectedly.

### Why this redesign

1. Three side-by-side panels overwhelm on mobile — all three lists fight
   for the same vertical space.
2. No sense of progress — order `Particle → Material → Program` only
   exists in the labels, not in the interaction.
3. External / Custom items get buried as an "External" group at the end of
   long lists.
4. "Tabulated / Analytical / External" grouping in the Program panel is
   categorical, not physics-meaningful — adds three section headers to a
   list of ~6 rows.

### Goals

- Recover mobile screen estate for results.
- Keep keyboard- and search-first interaction on desktop.
- Soft `① ② ③` ordering — visualised but never enforced.
- Preserve existing behaviour: bidirectional filtering, greying out, fallback,
  Auto-select, shareable URL encoding.
- First-class External (`🔗`) and Custom items, surfaced where they belong
  rather than as orphan groups.
- Move custom-compound editing out of an inline panel and into a modal —
  the previous inline editor competed with the picker for space.

### Non-goals (deferred)

- **Electron / ESTAR support.** Drop the greyed-out electron row entirely.
  Re-add once ESTAR ships in libdedx ≥ 2.0.
- **Isotope selection.** Particles are elements (Z) + the named common
  particles (proton, alpha).
- **Multi-program toggle as a runtime switch.** Multi-select is always on
  in Advanced mode; never offered in Basic.

### The shape

One tabbed picker is used on both pages:

- Calculator page = compact tabbed picker on its own row.
- Plot page = same tabbed picker plus a persistent series list beneath.

The two pages share the same `EntitySelectionState` store and tabbed
component; only the surrounding chrome differs.

### Anatomy

```
┌─ RECIPE  proton → Water (liquid) → ICRU 49 ───── reset · [⊞ explore compat]* ─┐
├─[① Particle: proton]─[② Material: Water ★]─[③ Program: Auto → ICRU 49]──────┤
│                                                                              │
│  ⟨selected pill — full metadata for the active tab's selection⟩              │
│                                                                              │
│  🔍 search                                                         ↑↓ ↵ /    │
│                                                                              │
│  ⟨the active list — Common / Ions for Particle;                              │
│   side-by-side Elements / Compounds / Custom columns for Material;           │
│   flat list with inline DATA/FN/EXT tags for Program⟩                        │
└──────────────────────────────────────────────────────────────────────────────┘
   * "⊞ explore compat" link only visible in Advanced mode
```

- The **recipe bar** at the top is the single fixed reference to the full
  selection. Clicking any segment activates the matching tab.
- **Tabs**: each tab label is `① Particle: <current value>`. Switching tabs
  is keyboard-driven via `Tab`/`Shift+Tab` or arrow keys, or mouse.
- **Selected pill**: the first row of every tab shows the current selection
  for that dimension with full metadata. Clicking it clears the selection
  (toggle behaviour).
- **Search**: focused by default on tab change. `↵` selects the highlighted
  result and auto-advances to the next non-empty tab.

### Soft ordering

`① ② ③` chips on the tab labels are a hint, not a gate. All three tabs are
clickable at any time. We do not prevent the user from picking Program
first.

### Basic vs Advanced mode

The Basic/Advanced toggle is the existing global control in the layout
header — the picker does not own a separate mode switch. The table below
lists what Advanced unlocks inside the picker.

| Feature                                               | Basic | Advanced       |
| ----------------------------------------------------- | ----- | -------------- |
| Particle tab — list with Common + Ions sections       | ✅    | ✅             |
| Particle tab — periodic-grid scan view (Z layout)     | —     | ✅             |
| Material tab — Elements + Compounds columns           | ✅    | ✅             |
| Material tab — **Custom** column + editor entry point | —     | ✅             |
| Program tab — shown at all                            | — ¹   | ✅             |
| Program tab — single-program selection                | —     | ✅             |
| Program tab — multi-program (for plot comparison)     | —     | ✅ (always on) |
| Compatibility overlay (`⊞ explore compat` link)       | —     | ✅             |
| Advanced filter syntax in search (`z=6`, `v=2013`)    | —     | ✅             |

> ¹ **Program tab removed from Basic mode (issue #816).** Basic mode shows only
> the Particle and Material tabs (`① ②`). The program is auto-selected behind
> the scenes using the existing default logic (unchanged); its identity is
> surfaced as a small "Calculated with **PSTAR**" annotation near the results on
> both the Calculator and Plot pages (the Calculator appends "(auto-selected)";
> the Plot only names the program — see those specs for why), rather than as a
> control the user must operate. **Basic mode always auto-selects:** any program
> the user pinned in Advanced mode is discarded on the way back, so a
> Basic → Advanced → Basic round-trip returns to Auto-select rather than
> silently keeping a hidden explicit choice the user can no longer see or
> change. Keyboard tab-cycling, next-empty-tab advance, and the mobile search
> sheet all scope to the two visible tabs in Basic mode. Advanced mode keeps the
> full three-tab picker unchanged. Switching Advanced → Basic while the Program
> tab is active retargets to a visible tab.

Mode persistence:

- **`localStorage`** (`dedx_advanced_mode`) — tracks the user's preferred mode
  across sessions on the same device.
- **URL** — in v2 (`urlv=2`), picker mode is explicit:
  `mode=basic|advanced`. Singular anchors (`particle=`, `material=`,
  `program=`) are always emitted for Calculator; advanced comparison lists
  (`particles=`, `materials=`, `programs=`) are emitted only when `across=`
  selects that axis. See [`shareable-urls.md`](shareable-urls.md) §3.3 and §7.1.

### Particle tab

Display rules:

| ID     | Label              | Notes                                                   |
| ------ | ------------------ | ------------------------------------------------------- |
| 1      | `proton`           | lowercase, no symbol                                    |
| 2      | `alpha particle`   | lowercase, no symbol                                    |
| 3..118 | `Element (Symbol)` | e.g. `Carbon (C)`, `Tin (Sn)`                           |
| 1001   | —                  | **omitted** — electron not selectable until ESTAR ships |

**Current implementation (as of issue #622):** Flat Z-sorted list with no
section headers and no special styling for any particle. Z is embedded in the
name label: `proton (Z=1)`, `Carbon (C, Z=6)`. See the "Adaptive Picker Kit"
section for full details.

External-only particles use the `🔗 <name>` prefix and sort into the flat
list by Z; they do NOT form an "External" group.

Search supports name, symbol, alias, bare Z, and advanced operator syntax:

| Syntax         | Meaning                                 |
| -------------- | --------------------------------------- |
| `z=N`          | Exact atomic-number match               |
| `z>N` / `z>=N` | Atomic number greater than / at least N |
| `z<N` / `z<=N` | Atomic number less than / at most N     |

### Material tab

**Current implementation (as of PR A, 2026-05-17):** Sub-tab pill controls
replace the three-column layout. See the "Adaptive Picker Kit" section above
for full details.

Sub-tabs: Compounds (id ≥ 99 or 906 + external), Elements (id 1..98),
Custom (Advanced only). Only one sub-tab is visible at a time; pills
(`material-subtab-*`) switch between them.

Inline indicators: gas materials carry an inline `(≋)` glyph next to the
name (no coloured badge — colour-blind friendly). Density is shown beside
the material name as `(ρ=... g/cm³)` to keep name+density visually grouped.

Custom sub-tab (Advanced only): lists user-defined compounds with per-row
edit action and a clearly visible `+ New custom material` pill button that
opens the Custom Compound Editor modal.

Search supports name, ID, and advanced density operator syntax:

| Syntax         | Meaning                                          |
| -------------- | ------------------------------------------------ |
| `ρ>N` / `ρ>=N` | Density greater than / at least N g/cm³          |
| `ρ<N` / `ρ<=N` | Density less than / at most N g/cm³              |
| `ρ=N`          | Density approximately equal to N g/cm³ (±0.0001) |
| `rho>N` (etc.) | ASCII alias for `ρ` — same operators apply       |

External-only materials without a declared density are excluded by any `ρ` operator.

### Program tab

> **Advanced-only (issue #816).** The Program tab renders only in Advanced
> mode. In Basic mode it is hidden entirely — the program is auto-selected
> behind the scenes and shown as a "Calculated with …" annotation near the
> results. Basic mode always auto-selects, so a program pinned here in Advanced
> mode is discarded on returning to Basic (a Basic → Advanced → Basic round-trip
> comes back to Auto-select). Everything below describes the Advanced-mode tab.

No section headers — each row carries its own inline tag:

| Tag    | Glyph | Meaning                                           |
| ------ | ----- | ------------------------------------------------- |
| `DATA` | `▦`   | Tabulated data (interpolated from libdedx tables) |
| `FN`   | `∫`   | Analytical model (e.g. Bethe-Bloch)               |
| `EXT`  | `🔗`  | External (loaded from a `.webdedx` file)          |

Tags render as small pill badges at the right of each row. A legend strip
below the list seeds the mapping for first-time users.

Search supports name, version substring, and advanced operator syntax:

| Syntax                 | Meaning                                              |
| ---------------------- | ---------------------------------------------------- |
| `tag=fn`               | Show only analytical-model programs (FN badge)       |
| `tag=tab` / `tag=data` | Show only tabulated-data programs (TAB/DATA badge)   |
| `tag=ext`              | Show only external programs (EXT badge)              |
| `v=<string>`           | Show only programs whose version contains `<string>` |

Tag matching is case-insensitive. `tag=data` is an alias for `tag=tab`.

Auto-select hero card sits at the top of the list, larger and visually
prominent, showing the resolved program (`✦ Auto-select → ICRU 49 [DATA]`).

Advanced mode replaces the single-selection list with a `SELECTED + drag
to reorder` + `AVAILABLE` checkbox list (the standalone multi-program
dropdown picker is removed). The first program in `SELECTED` is the
default for the Calculator result table and Plot primary series.

### Custom Compound Editor (modal)

Custom compound definition lives in a focus-trapped modal. Defining a
compound has its own cognitive load (composition + density + I-value) and
deserves a full-focus surface.

Two input modes: atom counts (default) and % by mass — switching converts
in place via atomic masses. % mode shows a live sum tracker (green ±0.5%
of 100, red otherwise); Save is disabled when red with an `auto-rescale
to 100%` one-click fix. Duplicate-Z detection flags both rows red with
a Merge / Remove banner.

Quick-start helpers: paste-formula tokenizer (`[A-Z][a-z]?\d*`), preset
seeds (Water, A-150, Bone, Muscle, Lung, Air), `.csv` / `.json` import.
Autosave to `localStorage.webdedx.customCompounds.v1` (250ms debounce).

Mobile = full-screen sheet in two steps (Basics → Composition).

### Recipe bar

Always-visible strip above the tabs:

```
RECIPE  proton  →  Water (liquid)  →  ICRU 49    reset · ⊞ explore compat*
```

`reset` restores defaults (proton / Water / Auto). `⊞ explore compat`
opens the adaptive compatibility overlay (Advanced only).

### Plot page differences

The Plot page wraps the tabbed picker with a series list beneath it.
"Add series" pushes the current `EntitySelectionState` into the series
array and seeds a fresh selection. No sidebar, no full-panel mode.

### Acceptance criteria

#### Layout

- [ ] Calculator page renders a single tabbed picker (no inline
      combobox row).
- [ ] Plot page renders `tabbed picker + series list` above the canvas.
- [ ] Recipe bar visible on both pages.
- [ ] Each tab label displays current selection.
- [ ] One list visible at a time inside the tabbed picker.

#### Particle

- [ ] Electron (id 1001) does not appear in any list, periodic-grid,
      or search result.
- [ ] Advanced mode renders the periodic-grid scan view.
- [x] Filter syntax `z=N`, `z>N`, `z>=N`, `z<N`, `z<=N` work (#609).

#### Material

- [ ] Material tab renders side-by-side Elements and Compounds columns.
- [ ] Gas materials show `(≋)` inline; no coloured badge.
- [ ] Density is rendered next to material name as `(ρ=... g/cm³)`.
- [ ] Advanced reveals Custom column; Basic hides it.
- [ ] `+ Add compound` and `edit` action open the modal editor.
- [x] Density operators `ρ>N`, `ρ>=N`, `ρ<N`, `ρ<=N`, `ρ=N` (and ASCII `rho`) work (#609).

#### Program

- [x] Basic mode hides the Program tab entirely; the program is auto-selected
      and shown as a "Calculated with …" annotation near the results on the
      Calculator and Plot pages (#816).
- [x] Basic mode always auto-selects: a program pinned in Advanced mode is reset
      to Auto-select on returning to Basic (Basic → Advanced → Basic round-trip)
      (#816).
- [ ] No "Tabulated / Analytical / External" section headers.
- [ ] Each row shows a DATA / FN / EXT tag with hover tooltip.
- [x] Search operators `tag=fn`, `tag=tab`, `tag=data`, `tag=ext`, `v=<string>` work (#609).
- [ ] Auto-select row is visually prominent and shows resolved program.
- [ ] Advanced mode renders the multi-program checkbox list + SELECTED
      group with drag-handle reorder.

#### Mode + persistence

- [ ] Basic / Advanced toggle preference persists in `localStorage`. In the URL
      (v2 / `urlv=2`) picker mode is explicit as `mode=basic|advanced`; plural
      comparison lists are valid only in advanced mode with matching `across=`
      (see [`shareable-urls.md`](shareable-urls.md) §3.3).
- [ ] Compatibility overlay, multi-program, periodic-grid, Custom
      sub-tab, **Program tab** — none are available in Basic.

### Cross-spec touch points

- `calculator.md` — inline-combobox wireframe replaced by the
  tabbed-picker recipe-bar wireframe.
- `plot.md` — series-list section above plot canvas.
- `custom-compounds.md` — inline editor section replaced by the modal editor.
- `multi-program.md` — Advanced mode multi-select moves into the Program
  tab itself; the standalone multi-program-picker dropdown is removed.
- `unit-handling.md` — unchanged.
- `06-wasm-api-contract.md` — unchanged.

---

## Historical changelog

> Pre-tabbed-picker history is kept for context. The behaviours referenced
> below — always-visible scrollable panels, inline comboboxes, full-panel
> sidebar — are no longer rendered. The compatibility-matrix and behavioural
> sections that follow remain authoritative for the shared
> `EntitySelectionState` model.

- **v2:** Reversed visual/logical order to Particle → Material → Program.
  Added bidirectional filtering via a compatibility matrix and the
  "program-first" workflow via independent unselect. See
  [libdedx#79](https://github.com/APTG/libdedx/issues/79).
- **v3:** Adopted always-visible scrollable list panels. Unavailable items
  greyed out rather than hidden. Material panel split into two
  independently scrollable sub-lists (Elements / Compounds) sharing one
  text filter.
- **v4:** Split into full-panel mode (Plot) and compact mode (Calculator
  inline dropdown comboboxes). Shared state persists across page
  navigation.
- **v5:** Marked as final after cross-review with `calculator.md`,
  `06-wasm-api-contract.md`, and `01-project-vision.md`.
- **v7 (27 April 2026):** "Beams" particle group heading replaced by
  **"Common particles"** (project owner decision). The second group
  remains "Ions". Display name overrides: proton → "proton",
  alpha → "alpha particle", electron → "electron" (lowercase).
- **Tabbed picker (15 May 2026):** Three-panel layout retired in favour
  of the tabbed picker described above. The legacy combobox/panel
  components were no longer rendered after this change and were deleted
  in #688.

> **Terminology:** The libdedx C library uses the term "ion" everywhere —
> including for the electron (ID 1001) — even though calling an electron an
> "ion" is physically incorrect. This is a legacy naming convention in the C
> API (functions like `dedx_fill_ion_list`, `dedx_get_ion_name`, etc.).
>
> In **dedx_web** and in all web-app specs we use the correct term
> **"particle"** (or "charged particle") to refer to any projectile:
> protons, alpha particles, heavy ions, and electrons. The TypeScript type
> is `ParticleEntity`. The C API's "ion" naming is confined to the WASM
> wrapper layer that directly calls C functions.
>
> See also: [`docs/10-terminology.md`](../10-terminology.md) — glossary of physics and developer terms.

---

## User Story

**As a** radiation physicist,
**I want to** first choose my particle (like proton, alpha particle, heavy ion
or electron) and target (material, like Silicon), then see which stopping-power
programs can serve that combination,
**so that** I follow the natural mental model of a physics experiment: pick the
beam, pick the target, _then_ pick the data source — rather than memorizing
which programs exist.

**As a** data quality researcher,
**I want to** select a specific program first, then see which particles and materials
it covers,
**so that** I can audit data availability per database.

---

## Compatibility Matrix

### Why it is needed

The libdedx C API exposes only program-centric queries:
`dedx_fill_ion_list(program)` and `dedx_fill_material_list(program)`.
There is no reverse lookup (e.g., "which programs support Carbon on Water").
See [libdedx#79](https://github.com/APTG/libdedx/issues/79) — a native
`dedx_get_programs_for_ion_material()` function is requested but not yet
available. Until it is, the frontend must derive valid combinations itself.

### How it is built

At WASM init time, the service iterates over every program returned by
`getPrograms()` and calls `getParticles(programId)` + `getMaterials(programId)`
for each. The results are stored in an in-memory compatibility matrix:

```typescript
/**
 * Pre-computed at init. Enables O(1) lookups in any direction:
 *   "which programs support particle X?" / "which materials does program P have?"
 *   / "which programs support particle X + material Y?"
 */
interface CompatibilityMatrix {
  /** programId → Set of particle IDs supported by that program. */
  particlesByProgram: Map<number, Set<number>>;
  /** programId → Set of material IDs supported by that program. */
  materialsByProgram: Map<number, Set<number>>;
  /** particleId → Set of program IDs that support this particle. */
  programsByParticle: Map<number, Set<number>>;
  /** materialId → Set of program IDs that support this material. */
  programsByMaterial: Map<number, Set<number>>;
  /** All known particles (union across all programs). */
  allParticles: ParticleEntity[];
  /** All known materials (union across all programs). */
  allMaterials: MaterialEntity[];
  /** All known programs. */
  allPrograms: ProgramEntity[];
}
```

The matrix is built once (< 20 programs × ~120 particles × ~280 materials per
program = manageable). The data is static for the lifetime of the page.

> **Performance note**: Building the matrix requires ~20 `getParticles()` +
> ~20 `getMaterials()` calls at init. These are synchronous in-memory
> lookups into the compiled WASM data tables, expected to complete in < 100 ms
> total. If profiling shows otherwise, the matrix can be built lazily on
> first use of each program.

> **Stage 2.6 particle-count clarification (runtime-verified):**
>
> | Program             | Particles via `dedx_get_ion_list()` | Notes                                                                                                             |
> | ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
> | ASTAR               | 1 (alpha, Z=2)                      | Tabulated helium only                                                                                             |
> | PSTAR               | 1 (proton, Z=1)                     | Tabulated proton only                                                                                             |
> | ESTAR               | 1 (electron, ID=1001)               | Runtime ion list contains electron, but ESTAR calculations are disabled/unimplemented (`DEDX_ERR_ESTAR_NOT_IMPL`) |
> | MSTAR               | 17 (Z=2–18)                         | Runtime list only; parametric polynomial extends to Z≥1; use Z=1–98 for the UI                                    |
> | ICRU 49, 73, 73new  | varies (4–16)                       | Tabulated specific ions available in libdedx v1.4.0                                                               |
> | DEFAULT / Bethe-ext | **112** (Z=1–112)                   | Bethe parametric path covers Z=1–112                                                                              |
>
> The "~240 particles" figure cited in earlier specs applies to the combined
> union of all programs (including MSTAR parametric extension). The actual
> `allParticles` union in the `CompatibilityMatrix` is 113 entries (Z=1–112
> from DEFAULT, plus electron ID=1001).
>
> **MSTAR special case:** `dedx_get_ion_list(MSTAR)` returns only Z=2–18 (17
> ions with hardcoded polynomial coefficients). The TypeScript wrapper must
> supplement this with the full Z=1–98 range — any Z not in the runtime list
> still works via the general polynomial in `dedx_mpaul.c`.

---

## Inputs

### 1. Particle Selector (primary — top / left)

| Property                | Detail                                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type                    | Always-visible scrollable list panel with text filter input                                                                                                                                                                                                                                           |
| Data source             | Derived from `CompatibilityMatrix.allParticles` plus loaded external-only particles from the external compatibility context                                                                                                                                                                           |
| Display format          | See **§ Particle naming preferences** below — `proton`, `alpha particle`, `electron`, plus `Element (Symbol)` for every other ion. The atomic number Z is **not shown** in the label; it remains a search keyword so users can type "z=6" or "6" to find Carbon.                                      |
| Search aliases          | Match on `name`, `symbol`, `aliases` (e.g., "proton" → ID 1, "alpha" → ID 2, "Sn" → ID 50), atomic number Z, mass number A                                                                                                                                                                            |
| Default                 | **proton** (ID 1) — highlighted on page load                                                                                                                                                                                                                                                          |
| Available / unavailable | All particles are always shown. Particles incompatible with the current material+program selection are **greyed out** (reduced opacity, non-interactive). Compatible particles are shown at full contrast.                                                                                            |
| Selected state          | The selected particle has a **dark background highlight** (accent colour) with white text. Clicking a selected particle deselects it (toggle).                                                                                                                                                        |
| Special                 | Particle ID 1001 = electron — always present in the particle list but **always greyed out** (ESTAR is not implemented in libdedx v1.4.0; `dedx.c:587` returns `DEDX_ERR_ESTAR_NOT_IMPL` for all calculations). Show a tooltip on hover: _"Electron stopping powers not available in libdedx v1.4.0."_ |
| Clearable               | Yes — clicking the selected item again toggles it off, or a clear (×) button in the panel header                                                                                                                                                                                                      |

#### Particle naming preferences (added 2026-04-26)

Physicists do not normally talk about a "Hydrogen beam" — they talk about
a **proton beam**. Likewise the ⁴He²⁺ ion is universally called an
**alpha particle**. The dropdown labels and (where shown) section
headings should match this language so users find what they expect at
first glance.

Display labels:

| Particle ID | Display label      | Notes                                                                |
| ----------- | ------------------ | -------------------------------------------------------------------- |
| 1           | `proton`           | lowercase, no chemical symbol — `(H)` is unfamiliar in this context  |
| 2           | `alpha particle`   | lowercase, no chemical symbol — `(He)` is unfamiliar in this context |
| 1001        | `electron`         | lowercase, no chemical symbol                                        |
| 3..118      | `Element (Symbol)` | e.g. `Carbon (C)`, `Tin (Sn)` — Title-cased element name             |

Group headings in the dropdown:

```
Common particles
  proton
  alpha particle
  electron        (greyed out — ESTAR unsupported)

Ions
  Carbon (C)
  Magnesium (Mg)
  Tin (Sn)
  Antimony (Sb)
  Iodine (I)
  …
```

Notes:

- The **"Common particles"** / **"Ions"** group headings are Title Case
  (HTML `optgroup`-style headings). The items inside "Common particles"
  are lowercase because they are common nouns. The items inside "Ions"
  keep the canonical Title Case for the chemical element name.
- Search keywords stay broad: typing `hydrogen` still finds `proton`,
  `helium` still finds `alpha particle`, `H` and `He` still match. See
  `src/lib/config/particle-aliases.ts:PARTICLE_ALIASES`.
- The chemical symbol is shown for ions because the symbol _is_ how a
  physicist disambiguates `Tin (Sn)` from `Antimony (Sb)`; dropping it
  would force users to memorise element ordering. The symbol is **not**
  shown for `proton`, `alpha particle`, `electron` because the parenthetical
  `(H)`, `(He)`, `(e⁻)` adds visual noise without adding information for
  a physicist who already knows what these particles are.
- Every ion ID 3..118 must have a chemical symbol in
  `PARTICLE_ALIASES`. A regression caught on 2026-04-26 (Tin / Antimony /
  Iodine / Copernicium displayed without a symbol) was caused by the
  table only covering Z=1..18; that has been fixed but the test suite
  should assert non-empty `chemicalSymbol` for every entry.
- **Both pages share these labels** — the calculator and plot pages
  both render the tabbed `entity-selection/` picker, whose particle
  labels come from the shared helper `getParticleLabel()` in
  `src/lib/utils/particle-label.ts`. The plot page also uses this label
  for series names so legends read "proton in Water" instead of
  "Hydrogen in Water".

### 2. Material Selector (second — middle)

The material selector is **wider** than the other two panels because it
contains a split layout with two independently scrollable sub-lists.

| Property                | Detail                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type                    | Always-visible **split panel**: one shared text filter on top, two side-by-side scrollable sub-lists below ("Elements" on the left, "Compounds" on the right)                                                                                                                                                                                                                      |
| Data source             | Derived from `CompatibilityMatrix.allMaterials` plus loaded external-only materials from the external compatibility context                                                                                                                                                                                                                                                        |
| Display format          | `Name` — e.g., "Water (liquid)". The numeric material ID is **not shown** in labels or triggers; it remains available as a search keyword so users can still type "276" to find water. Names use the app's friendly-name formatting layer, including human-friendly overrides for known materials (e.g., "WATER" → "Water (liquid)", "WATERVAPOR" → "Water Vapor").                |
| Search                  | A single text filter input at the top filters **both** sub-lists simultaneously. Match on `name`, material ID (numeric, e.g. "276" finds Water), common aliases (e.g., "water" → "Water (liquid)"). The ID is a search keyword only — it is not shown in the label.                                                                                                                |
| Default                 | **Water (liquid)** (ID 276) — highlighted on page load                                                                                                                                                                                                                                                                                                                             |
| Available / unavailable | All materials are always shown. Materials incompatible with the current particle+program selection are **greyed out** (reduced opacity, non-interactive). Compatible materials shown at full contrast.                                                                                                                                                                             |
| Selected state          | Dark background highlight with white text (same style as particle/program). Toggle off by clicking again.                                                                                                                                                                                                                                                                          |
| Split layout            | **Elements** (material IDs 1–98, i.e. pure chemical elements) in the left sub-list, sorted by ID (= atomic number). **Compounds** (IDs 99–278 + 906 Graphite, i.e. mixtures, tissues, plastics, etc.) in the right sub-list, sorted alphabetically by name. Loaded external-only materials appear in an **External** group. Each sub-list has its own independent scroll position. |
| Special                 | Gas-default materials (29 entries) shown with a gas indicator icon/badge                                                                                                                                                                                                                                                                                                           |
| Clearable               | Yes — click selected item to toggle off, or clear (×) button in the panel header                                                                                                                                                                                                                                                                                                   |

### 3. Program Selector (last — bottom / right)

| Property                | Detail                                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type                    | Always-visible scrollable list panel with text filter input                                                                                                                                                                                                                                   |
| Data source             | Derived from `CompatibilityMatrix.allPrograms` plus compatible programs from loaded external `.webdedx` sources                                                                                                                                                                               |
| Display format          | `name — description` (e.g., "PSTAR — protons (NIST)", "ICRU 49 — protons & α particles"). Descriptions come from `getProgramDescription()` in `src/lib/config/program-names.ts`. The raw version string from `dedx_get_program_version()` is kept in `searchText` but not displayed.          |
| Grouping                | Built-in programs use labelled dividers: **"Tabulated data"** (ASTAR, PSTAR, MSTAR, ICRU family) and **"Analytical models"** (Bethe-Bloch variants). Loaded external programs appear in an **"External"** group. Matches demo layout.                                                         |
| Default                 | **“Auto-select”** — a virtual entry at the top, always available, resolves to the best ICRU dataset for the current particle/material (see §4.3 of 01-project-vision.md)                                                                                                                      |
| Hidden programs         | **`DEDX_ICRU`** (ID 9) and **`DEDX_AUTO`** (ID 10, added in libdedx#144) are **excluded** from the program panel. Both are internal auto-selectors whose function is covered by "Auto-select"; showing either would confuse users. Neither appears as a selectable option (see dedx_web#844). |
| Available / unavailable | All _visible_ programs are always shown. Programs incompatible with the current particle+material selection are **greyed out**. “Auto-select” is never greyed out.                                                                                                                            |
| Selected state          | Dark background highlight with white text. Toggle to deselect; deselecting any program resets to "Auto-select".                                                                                                                                                                               |
| Clearable               | No explicit clear — deselecting returns to "Auto-select"                                                                                                                                                                                                                                      |

---

## Behavior

### Bidirectional Filtering

Unlike v1, there is **no single root selector**. All three selectors filter
each other bidirectionally via the compatibility matrix:

```
Particle ←→ Material ←→ Program
 ↑                    ↑
 └────────────────────┘
```

When any selector changes, the available options in the other two selectors
are recomputed. The filtering logic is:

```typescript
// Pseudocode for deriving available options:
function getAvailablePrograms(particle?: number, material?: number): ProgramEntity[] {
  let candidates = matrix.allPrograms;
  if (particle != null) {
    const progs = matrix.programsByParticle.get(particle);
    candidates = candidates.filter((p) => progs?.has(p.id));
  }
  if (material != null) {
    const progs = matrix.programsByMaterial.get(material);
    candidates = candidates.filter((p) => progs?.has(p.id));
  }
  return candidates;
}

function getAvailableParticles(program?: number, material?: number): ParticleEntity[] {
  let candidates = matrix.allParticles;
  if (program != null) {
    const particles = matrix.particlesByProgram.get(program);
    candidates = candidates.filter((i) => particles?.has(i.id));
  }
  if (material != null) {
    // particles that share at least one program with this material
    const materialProgs = matrix.programsByMaterial.get(material);
    candidates = candidates.filter((i) => {
      const particleProgs = matrix.programsByParticle.get(i.id);
      return particleProgs && materialProgs && [...particleProgs].some((p) => materialProgs.has(p));
    });
  }
  return candidates;
}

// getAvailableMaterials is symmetric to getAvailableParticles
```

### Step-by-Step Flow

1. **On WASM init (page load):**
   - Fetch all programs via `getPrograms()`.
   - For each program, fetch particles and materials to build the `CompatibilityMatrix`.
   - Insert a synthetic **"Auto-select"** entry at the top of the program list
     (this is a frontend construct, not from libdedx).
   - Set defaults: Particle = Proton (ID 1), Material = Liquid Water (ID 276),
     Program = "Auto-select".
   - Compute available options for each selector based on defaults.

2. **User changes particle (typical first step):**
   - Update the selected particle.
   - Recompute available materials: only materials that share at least one
     program with the new particle.
   - Recompute available programs: only programs that support the new particle
     (and the current material, if one is selected).
   - **Preserve current material** if it is still in the available list.
     Otherwise, fall back to Liquid Water if available, else the first material.
   - **Preserve current program** if still compatible. Otherwise, reset to
     "Auto-select".
   - Show a brief notification if material or program was changed
     (e.g., "PSTAR does not support Carbon; program reset to Auto-select").
   - If the selected particle is a proton (`massNumber === 1`) or electron
     (ID 1001), the energy unit selector should show only “MeV”.
     For heavy ions (`massNumber > 1`), show “MeV” and “MeV/nucl”.
     See `docs/04-feature-specs/unit-handling.md` for the full rules.

3. **User changes material (typical second step):**
   - Update the selected material.
   - Recompute available particles: only particles that share at least one program with
     the new material.
   - Recompute available programs: only programs that support the new material
     (and the current particle, if one is selected).
   - **Preserve current particle** if still available. Otherwise, fall back to
     Proton if available, else the first particle.
   - **Preserve current program** if still compatible. Otherwise, reset to
     "Auto-select".
   - Show notification if particle or program was auto-changed.

4. **User changes program (typical third step, or "program-first" workflow):**
   - Update the selected program.
   - Recompute available particles: only particles supported by the new program (and
     compatible with the current material, if set).
   - Recompute available materials: only materials supported by the new program
     (and compatible with the current particle, if set).
   - **Preserve current particle** if still available. Otherwise, fall back to
     Proton if available, else the first particle.
   - **Preserve current material** if still available. Otherwise, fall back to
     Liquid Water if available, else the first material.
   - Show notification for any auto-changed selections.

5. **User clears particle (unselects):**
   - Remove the particle filter.
   - Recompute available materials and programs based only on the remaining
     selections (material and/or program).
   - The material and program lists expand to show all compatible options.
   - The program selection is preserved. This allows the "program-first"
     workflow: select a program, clear the particle, and see all available
     particles/materials for that program.

6. **User clears material (unselects):**
   - Symmetric to clearing particle. Programs and particles recalculated without
     material constraint.

7. **Auto-select program resolution (display):**
   - When "Auto-select" is active, after any particle or material change, resolve
     the concrete program that would be used for the current combination.
   - Display the resolved program name, e.g., _"Auto-select → ICRU 49"_.
   - Resolution uses `DEDX_ICRU` internally; the resolution chain is:
     - Proton: ICRU 49 → PSTAR
     - Alpha: ICRU 49 → ASTAR
     - Carbon: ICRU 73 → ICRU 73 (old) → MSTAR
     - Other heavy ions: ICRU 73 → ICRU 73 (old)
     - Electron (ID 1001): N/A — ESTAR not implemented in libdedx v1.4.0;
       Electron is permanently greyed out and cannot be used in calculations
       > [!NOTE]
       > **Runtime note (libdedx v1.4.0):** wireframes below still show
       > `"Auto-select → ICRU 90"` as historical aspirational text, but runtime data
       > currently does not contain ICRU 90 (`data/wasm_runtime_stats.json`).
       > The highest runtime ICRU dataset is ICRU 49 (id=7), so proton/alpha
       > Auto-select resolves through ICRU 49 first.
   - **Fallback behavior:** If none of the preferred programs in the chain are
     available for the selected particle+material combination, the first program
     returned by `getAvailablePrograms(matrix, particleId, materialId)` is used
     as a fallback. This ensures calculation can proceed rather than blocking
     the user. The resolved program name is shown in the selection summary
     (e.g., _"Auto-select → MSTAR"_). Trade-off: the fallback program may have
     lower accuracy (e.g., MSTAR instead of ICRU 73 for Carbon), but provides
     a result when no preferred chain member is available.
   - Future: a webdedx-level auto-selection layer may extend this (e.g., prefer
     MSTAR for specific heavy-ion/material combos). This is out of scope for v1
     but the data model should not preclude it.

### "Program-first" Workflow (Reverse Order)

Users may also want to explore data availability per program. This workflow
is supported without any mode toggle:

1. Clear particle and material (or start fresh).
2. Select a specific program (e.g., MSTAR).
3. The particle list shows only particles MSTAR supports. The material list shows
   only materials MSTAR supports.
4. Select a particle from the filtered list → material list narrows further.
5. Select a material → ready to calculate.

This is the reverse of the default flow but uses the same bidirectional
filtering logic. The visual order (Particle → Material → Program) remains
constant — only the user's interaction order changes.

### Text Filter Behavior

Each panel has a text filter input above its scrollable list(s):

- Typing filters the list in real time (case-insensitive substring match).
- For the material panel, the single filter applies to **both** the Elements
  and Compounds sub-lists simultaneously.
- Matching text in the results is **not** hidden — non-matching items are
  hidden, but greyed-out (unavailable) items that match the filter remain
  visible in their greyed-out state. This lets users see that an item exists
  but is currently incompatible.
- If the filter matches zero items in a list, show "No results" in that list.
- Clearing the filter input restores the full list.
- Arrow keys navigate the visible (non-hidden) items; Enter selects; Escape
  clears the filter text.
- The filter input has a small clear (×) icon when non-empty.

### Selection & Deselection Behavior

- **Clicking an available item** selects it (dark background highlight).
- **Clicking the currently selected item** deselects it (toggle behaviour),
  removing that entity's filtering constraint from the other panels.
- **Clicking a greyed-out item** does nothing (pointer events disabled).
- When an entity is deselected, other panels immediately recalculate which
  items are available/greyed-out based on the remaining selections.
- The Program panel has no explicit deselect — deselecting always returns
  to "Auto-select".
- A "Reset all" link above the panels clears all selections back to defaults
  (Proton / Liquid Water / Auto-select).

### Greyed-Out (Disabled) Items

Unavailable items are shown **greyed out** in-place rather than hidden:

- Reduced opacity (~0.4) and `pointer-events: none`.
- They maintain their position in the list so the layout doesn't jump.
- This communicates _what exists_ in libdedx even when it's not compatible
  with the current selection — useful for discoverability.
- The text filter can still match greyed-out items (they remain visible
  but non-interactive).

> **Rationale:** The demo (`libdedx_demo.html`) showed that greying out
> items works well even for the ~280-item material list. Users can see the
> full data landscape and understand why certain items are unavailable.

### Search Matching Rules

| Entity   | Searchable fields                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Program  | `name`, `description`, `version` (version kept for search only, not displayed)                                                                    |
| Particle | `name`, `aliases` (e.g., "proton", "alpha", "deuteron", "electron"), `Z` (atomic number as string), `A` (mass number as string; N/A for Electron) |
| Material | `name`, `id` (as string), common aliases                                                                                                          |

For particles, the `aliases` field from `ParticleEntity` provides human-friendly names:

| Particle ID | Name     | Aliases        |
| ----------- | -------- | -------------- |
| 1           | Hydrogen | proton, p, H-1 |
| 2           | Helium   | alpha, α, He-4 |
| 6           | Carbon   | C-12           |
| 1001        | Electron | e⁻, e-, beta   |

> The alias list is a frontend configuration, not from libdedx. It should be
> defined as a static lookup table in `src/lib/config/particle-aliases.ts`.

### Loading States

- While WASM is initializing and the compatibility matrix is being built,
  all entity selectors show a loading skeleton/spinner.
- If WASM init fails, show an error banner with a retry button. Entity
  selectors are disabled.

> **Note:** After init, all filtering is done in-memory against the
> compatibility matrix. There are no subsequent async fetches when the user
> changes a selector — the UI updates synchronously.

### Error States

| Error                                                                                | Handling                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| WASM init failure                                                                    | Error banner, all selectors disabled, retry button                                              |
| Compatibility matrix contains a program with zero particles or materials             | Omit that program from `allPrograms` (data issue in libdedx, not actionable by user)            |
| Previously selected particle/material unavailable after a change in another selector | Auto-fall-back + notification                                                                   |
| All three selectors cleared to a state with zero compatible programs                 | Show inline warning: "No program supports this combination" (should not happen with valid data) |

---

## Output

The entity selection component does not produce user-visible output on its own.
It provides the **selected state** to parent components (Calculator, Plot):

```typescript
interface EntitySelectionState {
  /** The selected program (or the "Auto-select" virtual entry). */
  program: ProgramEntity | AutoSelectProgram;
  /** The resolved program ID for C API calls (always a real program ID). */
  resolvedProgramId: number;
  /** The selected particle (proton, heavy ion, or electron), or null if cleared. */
  particle: ParticleEntity | null;
  /** The selected material, or null if cleared. */
  material: MaterialEntity | null;
  /**
   * True when all three selections are made and the combination is valid
   * for calculation. Parent components should disable "Calculate" / "Plot"
   * buttons when this is false.
   */
  isComplete: boolean;
  /** Available options for each selector given the current constraints. */
  availablePrograms: ProgramEntity[];
  availableParticles: ParticleEntity[];
  availableMaterials: MaterialEntity[];
}

/** The synthetic "Auto-select" program entry. */
interface AutoSelectProgram {
  id: -1; // sentinel value, never sent to C API
  name: "Auto-select";
  /** The concrete program it resolves to for the current particle/material. */
  resolvedProgram: ProgramEntity | null; // null when particle or material is cleared
}
```

This state is exposed via Svelte 5 `$props` / `$bindable` or a shared runes-based
store (architecture TBD in `docs/03-architecture.md`).

---

## UI Layout

### Design Rationale — Two Layout Modes

The entity selection component is used on both the Calculator and Plot pages,
but the **primary activity** on each page is different:

| Page           | Primary activity                                 | Entity selection role                    | Screen budget                           |
| -------------- | ------------------------------------------------ | ---------------------------------------- | --------------------------------------- |
| **Calculator** | Enter energy values, read numeric results        | Setup (done once, then mostly stable)    | Shared with energy input + result table |
| **Plot**       | Explore data: add/compare series, inspect curves | Repeated (new series = new entity combo) | Shared with the JSROOT canvas           |

**UX best practices applied:**

- **Context-appropriate density** (Nielsen Norman Group): exploration views
  (Plot) benefit from persistent, always-visible controls; task-completion
  views (Calculator) benefit from focused input→output flow.
- **Fitt's Law**: on the Calculator page the energy input is the most frequent
  target, so entity selectors should not dominate. On the Plot page, entity
  selection is the frequent target (adding series), so it deserves permanent
  real estate.
- **Progressive disclosure** (§4.4 of project vision): the Calculator shows
  a compact selector by default; the Plot shows full panels because
  exploration _is_ the task.
- **F-pattern scanning**: entity selection (setup) on the left; output
  (results/plot) on the right or center — matching the natural reading flow.

The component therefore has **two layout modes** consuming the same underlying
`EntitySelectionState` and `CompatibilityMatrix`:

| Mode            | Used on         | Layout                                          |
| --------------- | --------------- | ----------------------------------------------- |
| **Full panels** | Plot page       | Always-visible scrollable list panels (sidebar) |
| **Compact**     | Calculator page | Searchable dropdown comboboxes (inline form)    |

Both modes share all behavior described in the Behavior section above
(bidirectional filtering, greying out, preserve/fallback, Auto-select
resolution). Only the visual presentation differs.

### Visual Order (both modes)

The selectors always appear in this order, reflecting the natural physics
workflow (beam → target → data source):

1. **Particle** (projectile)
2. **Material** (target)
3. **Program** (data source / database)

Users are free to interact with them in any order. The visual order is a
hint, not an enforcement.

---

### Full Panel Mode (Plot Page)

Used on the **Plot page** where entity selection is a repeated, exploratory
activity. The panels live in a **left sidebar**; the JSROOT plot canvas
occupies the remaining right-hand space.

#### Panel Style

Each panel is a **card** with:

- A header: numbered label (e.g., “① Particle”), accent colour.
- A text filter input below the header.
- A scrollable list body (fixed height, ~400px on desktop, adapts on mobile).
- A rounded border, subtle shadow, white background.

The selected item has a **dark accent background** (`#0d7377` or Tailwind
equivalent) with white text. Greyed-out items use `opacity: 0.4`.

> Design reference: `libdedx_demo.html` — the card + list + filter + highlight
> pattern from that prototype is the target aesthetic.

#### Desktop (≥900px) — Sidebar + Canvas

The page is split into a **sidebar** (entity selection + "Add Series" button)
and a **main area** (plot canvas + series list).

The sidebar uses a **two-column layout for Particle + Material** with the
**Program panel below, narrower** — reflecting that most users never change
the program (Alternative A layout):

```
┌─── SIDEBAR (≈30%) ───────────────────────────┐ ┌── MAIN (≈70%) ─────────┐
│                                                │ │                        │
│ ┌─────────────┐ ┌────────────────────────────┐ │ │                        │
│ │ ① Particle  │ │ ② Target Material          │ │ │    JSROOT Plot Canvas  │
│ │ [Filter.. ] │ │ [Filter...               ] │ │ │                        │
│ │ ┌─────────┐ │ │ ┌──────────┬─────────────┐ │ │ │                        │
│ │ │ Proton  │ │ │ │ ELEMENTS │ COMPOUNDS        │ │ │                        │
│ │ │ Alpha   │ │ │ │ Hydrogen │ Water (liquid)   │ │ │                        │
│ │ │ Lithium │ │ │ │ Helium   │ A-150 Tissue-Eq. │ │ │                        │
│ │ │ ...  ↕  │ │ │ │ ...  ↕   │ ...   ↕     │ │ │ │                        │
│ │ └─────────┘ │ │ └──────────┴─────────────┘ │ │ ├────────────────────────┤
│ └─────────────┘ └────────────────────────────┘ │ │ Series list / legend   │
│                                                │ │ ● Proton Water ICRU    │
│ ┌────────────────────────────────────────────┐ │ │ ● Carbon Water MSTAR   │
│ │ ③ Program        Auto-select → ICRU 49    │ │ │                        │
│ │ [Filter... ]                               │ │ │ [Export CSV] [Export…] │
│ │ ┌────────────────────────────────────────┐ │ │ └────────────────────────┘
│ │ │ ── Tabulated ──                        │ │ │
│ │ │ ASTAR · PSTAR · MSTAR · ICRU 49 · …   │ │ │
│ │ │ ── Analytical ──                       │ │ │
│ │ │ Bethe-Bloch · Bethe-Ext               │ │ │
│ │ └────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│               [ ＋ Add Series ]                 │
│               [ Reset all ]                    │
└────────────────────────────────────────────────┘
```

- Page grid: `grid-template-columns: minmax(360px, 3fr) 7fr`.
- Inside the sidebar, Particle and Material are in a **sub-grid row**:
  `grid-template-columns: 1fr 2fr` — Particle takes ~⅓, Material takes ~⅔
  (it has two sub-lists).
- The Program panel spans the full sidebar width below Particle+Material but
  has a **shorter list height** (~150px) since there are only ~10 programs.
  This de-emphasizes it visually.
- The sidebar is scrollable if the viewport is too short for all three panels.

#### Tablet (600–899px) — Stacked sidebar above canvas

On tablet-width screens, the sidebar folds **above** the plot canvas:

```
┌────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌────────────────────────────┐ │
│ │ ① Particle  │ │ ② Material                 │ │
│ │ [Filter]    │ │ [Filter]                   │ │
│ │ Proton ↕    │ │ Elem ↕  │  Comp ↕          │ │
│ └─────────────┘ └────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │ ③ Program   Auto → ICRU  [Filter] ↕       │ │
│ └────────────────────────────────────────────┘ │
│ [ ＋ Add Series ]    [ Reset all ]              │
├────────────────────────────────────────────────┤
│                                                │
│              JSROOT Plot Canvas                 │
│                                                │
└────────────────────────────────────────────────┘
```

List heights reduced to ~250px for Particle/Material, ~120px for Program.

#### Mobile (<600px) — Stacked vertical

All panels stack vertically, full width. Material sub-lists remain
side-by-side. The plot canvas scrolls below.

```
┌──────────────────────────────────────┐
│ ① Particle                           │
│ [Filter...                        ]  │
│ ┌──────────────────────────────────┐  │
│ │ Hydrogen (H)                     │  │
│ │ Helium (He)          scroll ↕   │  │
│ └──────────────────────────────────┘  │
├──────────────────────────────────────┤
│ ② Target Material                    │
│ [Filter...                        ]  │
│ ┌────────────────┬───────────────────┐│
│ │ ELEMENTS       │ COMPOUNDS         ││
│ │ Hydrogen       │ Water (liquid)    ││
│ │ ...  scroll ↕  │ ...    scroll ↕   ││
│ └────────────────┴───────────────────┘│
├──────────────────────────────────────┤
│ ③ Program  Auto → ICRU              │
│ [Filter]  PSTAR · ASTAR · …    ↕    │
├──────────────────────────────────────┤
│ [ ＋ Add Series ]   [ Reset all ]    │
├──────────────────────────────────────┤
│          JSROOT Plot Canvas          │
│                                      │
└──────────────────────────────────────┘
```

---

### Compact Mode (Calculator Page)

Used on the **Calculator page** where the primary activity is entering
energy values and reading results. Entity selection is a "configure once"
step — most users pick Proton + Water and only change the energy.

#### Design Principles

- **Minimal vertical footprint**: entity selectors are a single horizontal
  row of comboboxes, not tall panels.
- **Center-stage results**: the result table and/or key numeric output
  (e.g., CSDA range) is prominently centered, not pushed to a sidebar.
- **Same data, different chrome**: the compact selectors use the same
  `CompatibilityMatrix`, bidirectional filtering, and Auto-select logic.
  Greyed-out items appear in the dropdown lists but are non-interactive.

#### Selector Widgets

Each entity selector is a **searchable dropdown combobox**:

- A single-line input showing the current selection (e.g., "Hydrogen (H)").
- Clicking or focusing opens a dropdown panel with a filtered list.
- Typing in the input filters the dropdown (same matching rules: aliases,
  Z, A, name, ID).
- Item styling in the dropdown matches the full panel mode: available items
  at full contrast, unavailable items greyed out.
- Material dropdown shows "Elements" and "Compounds" as section headers
  within the single dropdown list (not two columns — too narrow).
- Program dropdown shows the resolved label inline:
  `Auto-select → ICRU 49` as the default display value.

ARIA: `role="combobox"`, `aria-expanded`, `aria-activedescendant`,
`role="listbox"` on the dropdown, `role="option"` on items,
`aria-disabled="true"` on greyed-out items.

#### Page Layout

**Wireframe:** see [`calculator.md §Page Layout Overview`](calculator.md#page-layout-overview) — the Calculator
spec owns the compact-mode wireframe. Anything here is a derived view.

---

### Switching Between Modes

The two layout modes are **not runtime-switchable** by the user. They are
determined by the page route:

- `/calculator` → compact mode
- `/plot` → full panel mode

Both modes bind to the same shared `EntitySelectionState` store. If the
user selects "Carbon" on the Calculator page, navigates to the Plot page,
the Plot page shows Carbon pre-selected in the full panel. Similarly,
the URL encodes the selection identically for both pages (see
`shareable-urls.md`).

---

## Accessibility

- Each panel has a visible heading (`<h2>` or `<label>`) associated with its list.
- The text filter input has `role="searchbox"` and `aria-controls` pointing to
  the list(s) it filters. For the material panel, `aria-controls` references
  both sub-lists.
- Each scrollable list has `role="listbox"`; each item has `role="option"`.
- Greyed-out items have `aria-disabled="true"`.
- The selected item has `aria-selected="true"`.
- Arrow keys navigate the visible (non-hidden) items within a focused list;
  Enter selects; Escape clears the filter text.
- Screen readers announce the number of available (non-greyed) results
  (e.g., "3 of 12 particles available").
- Color is not the sole indicator for gas-default materials (icon + text badge).
- Greyed-out state is communicated via both opacity and `aria-disabled`,
  not colour alone.

---

## Acceptance Criteria

### Layout & Panels — Full Panel Mode (Plot Page)

- [ ] Three panels are displayed in the sidebar: Particle, Material, Program — in that visual order.
- [ ] On desktop (≥900px), Particle and Material are in a sub-grid row (1fr + 2fr); Program spans full sidebar width below, with shorter list height (~150px).
- [ ] The sidebar takes ≈30% of the page width; the JSROOT canvas takes ≈70%.
- [ ] On tablet (600–899px), the sidebar folds above the canvas; panels stack horizontally then canvas below.
- [ ] On mobile (<600px), all panels stack vertically; material sub-lists remain side-by-side.
- [ ] The Material panel contains two independently scrollable sub-lists: Elements (IDs 1–98) and Compounds (IDs 99+).
- [ ] Each sub-list has a sticky group header ("Elements" / "Compounds").

### Layout — Compact Mode (Calculator Page)

- [ ] Entity selectors are searchable dropdown comboboxes in a horizontal flex row.
- [ ] Particle and Material comboboxes are wider (~240px) than Program (~180px) — visual hierarchy.
- [ ] On desktop, the form is centered (max-width ~720px) with the result table as visual centerpiece.
- [ ] On mobile (<600px), comboboxes stack vertically at full width.
- [ ] Material dropdown shows Elements and Compounds as section headers within a single dropdown list.

### Shared State

- [ ] Both modes share the same `EntitySelectionState` store; selection persists across page navigation.
- [ ] Layout mode is determined by page route, not a user toggle.

### Defaults & Init

- [ ] On page load, entity selectors populate from WASM data within 2 seconds (after WASM init).
- [ ] Default state is Proton / Water (liquid) / Auto-select with no user interaction required.
- [ ] The compatibility matrix is built at init from all programs' particle/material lists.

### Bidirectional Filtering

- [ ] Selecting a particle greys out incompatible materials and programs.
- [ ] Selecting a material greys out incompatible particles and programs.
- [ ] Selecting a program greys out incompatible particles and materials.
- [ ] Greyed-out items have reduced opacity (~0.4) and are non-interactive (`pointer-events: none`).
- [ ] Greyed-out items remain in their original list position (no layout shift).
- [ ] Deselecting (toggling off) an entity removes its filtering constraint; other panels update immediately.

### Preserve / Fallback

- [ ] Changing a selector preserves the current selections in other panels if they remain compatible.
- [ ] If a previously selected particle or material becomes incompatible, the selector falls back to the default (Proton / Water) if available, else the first available entry, and a notification is shown.

### Text Filter

- [ ] Typing in any panel's filter input filters that panel's list with case-insensitive substring matching.
- [ ] The Material panel's single filter input filters both Elements and Compounds sub-lists simultaneously.
- [ ] Particle filter matches on name, aliases ("proton", "alpha"), Z, A, and chemical symbol.
- [ ] Material filter matches on name and numeric ID.
- [ ] Greyed-out items that match the filter remain visible (greyed out, not hidden).
- [ ] Non-matching items are hidden from view.

### Selection UX

- [ ] Clicking an available item selects it with a dark accent background and white text.
- [ ] Clicking the selected item again deselects it (toggle).
- [ ] Clicking a greyed-out item does nothing.
- [ ] The "Auto-select" program displays the resolved concrete program name (e.g., "Auto-select → ICRU 49").
- [ ] Resolved program updates when particle or material changes while "Auto-select" is active.
- [ ] A "Reset all" link restores defaults (Proton / Water / Auto-select).

### Program Panel

- [ ] Programs are grouped into "Tabulated data" and "Analytical models" with labelled dividers.
- [ ] "Auto-select" is always shown at the top and never greyed out.
- [ ] `DEDX_ICRU` (ID 9) is **not** shown in the program panel; its function is covered by "Auto-select".
- [ ] The resolved program label uses frontend-enriched names (e.g., "ICRU 49") not raw C library names (e.g., "ICRU").

### Keyboard & Accessibility

- [ ] Each panel is keyboard-navigable (Tab to filter, Arrow keys to navigate list, Enter to select, Escape to clear filter).
- [ ] ARIA attributes: `role="listbox"`, `role="option"`, `aria-selected`, `aria-disabled`, `role="searchbox"` on filters.
- [ ] Screen readers announce available item counts.
- [ ] Loading state is shown while WASM initializes.
- [ ] Error state with retry is shown if WASM init fails.

### Special Cases

- [ ] Electron (particle ID 1001) appears in the particle list but is always greyed out (ESTAR not implemented in libdedx v1.4.0). A tooltip on hover reads "Electron stopping powers not available in libdedx v1.4.0."
- [ ] Gas-default materials are visually indicated with an icon and text badge, not colour alone.

---

## Dependencies

- `LibdedxService` interface (see [docs/06-wasm-api-contract.md](../06-wasm-api-contract.md)):
  `getPrograms()`, `getParticles(programId)`, `getMaterials(programId)`
- Particle alias configuration: `src/lib/config/particle-aliases.ts` (to be created)
- Svelte 5 runes for reactive state (`$state`, `$derived`, `$effect`)
- Tailwind CSS for layout and responsive breakpoints

---

## Open Questions

1. **Auto-select resolution visibility:** Should the resolved program be shown
   only as a subtle label, or also as a tooltip on the program selector?
   _Current decision: subtle label below the program list inside the panel._

2. ~~**Material grouping**~~ **Resolved.** Materials are split into two
   side-by-side sub-lists (Elements / Compounds) with a shared text filter.
   Each sub-list scrolls independently.

3. **Panel scroll height:** ~400px on desktop, ~300px on tablet, ~200px on
   mobile. Exact values to be refined during implementation.
   _Inspired by `libdedx_demo.html` which uses `height: 400px`._

4. **Graphite (ID 906):** This is a special allotrope of Carbon (element 6)
   with its own material ID. Should it appear in the Elements sub-list
   (alongside Carbon) or in the Compounds sub-list? The demo places it at
   the end of the full list.
   _Current decision: place in Compounds sub-list (ID ≥ 99 rule), with a
   note "(allotrope of Carbon)" in the display name._

5. **Sort order within Elements sub-list:** By atomic number (= material ID)
   or alphabetically? _Current decision: by ID (= atomic number), matching
   periodic table order, as in the demo._
