# UI Wireframes

> **Status:** Reference document (19 April 2026)
>
> This document gives the big-picture layout overview for the dEdx Web interface.
> Detailed ASCII wireframes and responsive breakpoint specifications live in the
> individual feature specs listed below — do not duplicate them here.

---

## 1. Application shell

The app is a two-page SvelteKit application behind a shared layout shell:

- **Nav bar** — top, full-width. Contains the page title, a Calculator / Plot
  toggle, and an Advanced Mode toggle.
- **Main content area** — fills the remaining viewport height.
- **Footer** — build info badge (commit hash, branch, date).

The Advanced Options accordion is **collapsed on first load** and inserts
content *below* the primary content area — it never pushes the results out of
view. See [09-non-functional-requirements.md §2](09-non-functional-requirements.md).

---

## 2. Calculator page

**Big picture:** A centered form with cascading entity selection
(Particle → Material → Program) above a reactive results table.
Results update as the user types (debounced 300 ms).

**Responsive behaviour:**

| Breakpoint | Layout |
|-----------|--------|
| Desktop ≥ 900 px | Form centered, max-width ~720 px; Particle + Material in a sub-grid row (1 fr + 2 fr); Program below, full width; results table as visual centrepiece below form |
| Tablet 600–899 px | Form fills viewport width; same sub-grid row for Particle + Material |
| Mobile < 600 px | All comboboxes stack vertically at full width |

**Calculator page:** See [`docs/04-feature-specs/calculator.md §Page Layout Overview`](04-feature-specs/calculator.md).

---

## 3. Plot page

**Big picture:** A two-panel layout — a left sidebar for entity selection and
series management, and a right canvas for the JSROOT log-log plot.
Multiple series can be overlaid; each is a distinct particle/material/program
combination.

**Responsive behaviour:**

| Breakpoint | Layout |
|-----------|--------|
| Desktop ≥ 900 px | Sidebar (~30%, min 360 px) and canvas (~70%) side-by-side |
| Tablet 600–899 px | Sidebar above canvas (stacked) |
| Mobile < 600 px | Entity panels collapsed by default (accordion); canvas, controls, and series list visible without scrolling |

**Canvas sizing:**
- Desktop: `height: min(60vh, 600px)`
- Mobile: `height: 50vh` (min 300 px)

Touch-based zoom/pan on the JSROOT canvas is **disabled** on mobile/tablet
to preserve native page scrolling.

**Normative wireframes:**
- [entity-selection.md — Desktop full-panel mode wireframe](04-feature-specs/entity-selection.md#desktop-900px--sidebar--canvas)
- [plot.md — full page layout](04-feature-specs/plot.md)

---

## 4. Component hierarchy (summary)

```
+layout.svelte                    ← shell: nav bar, Advanced toggle, footer; starts WASM
├── /calculator/+page.svelte      ← Calculator page
│   ├── EntityDropdown.svelte     ← compact combobox × 3 (Particle, Material, Program)
│   ├── ResultsTable.svelte       ← reactive data grid
│   └── AdvancedOptions.svelte    ← collapsed accordion
└── /plot/+page.svelte            ← Plot page
    ├── EntityPanel.svelte        ← scrollable full panel × 3
    ├── SeriesList.svelte         ← added series with colour/style indicators
    ├── JsrootPlot.svelte         ← TMultiGraph on log-log axes via $effect
    └── AdvancedOptions.svelte    ← collapsed accordion
```

Full component tree with file paths:
[03-architecture.md §5](03-architecture.md).

---

## 5. Cross-references

| Topic | Canonical location |
|-------|--------------------|
| Compact mode (Calculator) entity dropdowns | [entity-selection.md §Compact Mode](04-feature-specs/entity-selection.md) |
| Full panel mode (Plot) entity panels | [entity-selection.md §Full Panel Mode](04-feature-specs/entity-selection.md) |
| Results table layout | [calculator.md](04-feature-specs/calculator.md) |
| JSROOT canvas sizing and interactions | [plot.md](04-feature-specs/plot.md) |
| Export button placement | [export.md](04-feature-specs/export.md) |
| Shareable URL badge position | [shareable-urls.md](04-feature-specs/shareable-urls.md) |
| Advanced Options accordion | [advanced-options.md](04-feature-specs/advanced-options.md) |
| Build info badge (footer) | [build-info.md](04-feature-specs/build-info.md) |
| Accessibility requirements (focus, contrast, reflow) | [09-non-functional-requirements.md §1](09-non-functional-requirements.md) |
| Content priority (results always first) | [09-non-functional-requirements.md §2](09-non-functional-requirements.md) |
| Responsive breakpoint targets | [09-non-functional-requirements.md §5](09-non-functional-requirements.md) |
