# ADR 011 — Compare-Across Visible Strip (4-Button Recipe Bar)

**Status:** Accepted (2026-05-24)

**Context:** Calculator-table redesign (#526 / #561). The original multi-program
spec (`multi-program.md` v1–v3) exposed the "compare across" dimension through a
dropdown inside the Advanced toolbar (labelled `Compare across:` with options
`Programs`, `Materials`, `Particles`). Only `Programs` was enabled; `Materials`
and `Particles` had "ships in a follow-up" tooltips.

Issue #561 shipped end-to-end support for comparing across all three entity
dimensions plus a "single entity" mode. The question was: how should the user
control which dimension to compare across?

---

## Decision

Replace the dropdown with a **visible 4-button strip** (pill radiogroup) on the
recipe bar, always present in Advanced mode:

```
[Programs ●]  [Materials]  [Particles]  [Single]
```

The active dimension has a filled/highlighted pill. Clicking a pill sets
`across` in `EntitySelectionState` and seeds the multi-selected array from the
current single selection.

---

## Rationale

### Visibility over discoverability

A dropdown labelled "Compare across: Programs ▾" hides the available options
behind a click. Users who have not explored the dropdown do not know that
material or particle comparison is possible.

A 4-button strip makes all four modes simultaneously visible. The cost
(horizontal real estate) is acceptable: the strip fits in one line on desktop
and wraps gracefully on mobile.

### Greyed-out options signal capability

In the dropdown implementation, disabled options (`Materials`, `Particles`) had
tooltips but no visual prominence. In the strip, a muted pill with a
`(coming soon)` or disabled state is just as visible as an active pill —
communicating future capability without implying it is available today.

### Single-entity mode is first-class

Adding a `Single` pill makes the transition back to single-entity mode an
explicit, named action rather than an implicit consequence of deselecting all
multi-selected entities. This is important on touch devices where accidentally
deselecting an entity in a multi-list is a common error.

---

## Consequences

- The `Compare across:` dropdown is removed from `advanced-toolbar.svelte`.
- The 4-button strip (`compare-across-strip.svelte`) is added to the
  Advanced toolbar area on the Calculator page.
- `AcrossDimension` type gains `"single"` in addition to `"particle"`,
  `"material"`, `"program"`.
- `entity-selection.md` is updated in issue #563 to reflect this.
- The `across=` URL parameter accepts `program | material | particle | single`
  (see `shareable-urls.md`).

---

## References

- `docs/04-feature-specs/entity-selection.md` — entity selection spec
- `docs/04-feature-specs/shareable-urls.md` — `across=` URL parameter
- `src/lib/components/entity-selection/compare-across-strip.svelte`
- Issue #561 — compare-across 4-button strip, multi-entity table, drop Columns
