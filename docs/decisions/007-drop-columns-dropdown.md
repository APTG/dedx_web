# ADR 007 — Drop the Columns Dropdown

**Status:** Accepted (2026-05-24)

**Context:** Calculator-table redesign (#526 / #561). In the original
multi-program advanced mode spec (`multi-program.md` v1–v3), a **"Columns…"**
button in the table toolbar allowed users to hide or show individual program
columns independently of the picker selection. Column visibility was serialised
in the URL as `hidden_programs=`. This mechanism was modelled on Excel's
hidden-column feature.

The redesign introduces a **tabbed entity picker** where program selection is
done directly in the picker, not inside the results table. The result: column
membership and picker membership are the same set. A separate column-visibility
layer is redundant.

---

## Decision

Remove the "Columns…" dropdown and the `hidden_programs=` URL parameter. Column
visibility is determined solely by picker selection.

---

## Rationale

### Entity selection _is_ column selection

In the redesigned advanced mode, the program tab in the entity picker shows a
multi-list (selected programs + available programs). Adding or removing a
program from the picker immediately adds or removes its column from the results
table. There is no intermediate "hidden but still selected" state.

This collapses two orthogonal states (what is selected vs what is visible) into
one. Users don't need to manage two places to control what they see.

### No increase in cognitive overhead

In the old design, a user wanting to remove a program from view had two paths:
(a) deselect it in the picker, or (b) hide it via "Columns…". Two paths for
the same intent is a usability smell.

### Serialisation simplification

Removing `hidden_programs=` from the URL eliminates a v1 → v2 migration edge
case. Old URLs with `hidden_programs=` are silently ignored on load: all
selected columns become visible. The user can deselect programs in the picker
if they want fewer columns.

---

## Consequences

- The `Columns…` button is removed from the table toolbar.
- `columnVisibility` and `programDisplayOrder` are removed from
  `MultiProgramState`.
- `hidden_programs=` is dropped from canonical v2 URL output. The v2 parser
  silently ignores it when reading v1 URLs.
- The "thin collapsed-column indicator" affordance (the `▐` marker) described
  in `multi-program.md` v1–v3 is no longer needed and is removed.
- `multi-program.md` is updated to reflect this decision in issue #563.

---

## References

- `docs/04-feature-specs/multi-program.md` — multi-program comparison spec
- `docs/04-feature-specs/shareable-urls.md` — v2 URL schema (no `hidden_programs=`)
- ADR 006 — URL Schema v2 (§1: Drop `hidden=` / `hidden_programs=`)
- Issue #561 (compare-across strip, drop Columns dropdown)
