# ADR 008 — Drop the Unit Button Between Picker and Results

**Status:** Accepted (2026-05-23)

**Context:** Calculator-table redesign (#526 / #558). In the v1–v8 Calculator
spec, a standalone **"Energy Unit Selector"** (`energy-unit-selector.svelte`)
sat between the entity-selection row and the results table. It was a segmented
control (radio buttons) showing particle-dependent unit options (e.g., MeV,
MeV/nucl for heavy ions). In Advanced mode, separate `<select>` dropdowns for
Range → and STP → unit selection appeared in the same intermediate row.

This layout had two problems:

1. **Visual fragmentation.** The unit control was spatially disconnected from
   both the picker above it and the table below it. Users had to scan the
   intermediate row before understanding the table headers.
2. **Scaling.** In Advanced mode, adding per-tab unit selectors to the
   intermediate row created a cluttered second row of controls. The spec noted
   this was a future upgrade path.

---

## Decision

Remove the standalone unit button row between the picker and the results table.
Replace it with a **unit-anchor strip** (`unit-anchor-strip.svelte`) — a pill
radiogroup inside the table toolbar or header area. The default unit for energy
input is displayed in the column header. For Advanced mode, the anchor strip
renders in the Advanced toolbar above the tab strip.

---

## Rationale

### Unit selection belongs near the data it affects

Placing the unit selector inside the table toolbar (or as a table-header
control) puts the affordance immediately adjacent to the data it governs. Users
who read the column header "Energy (MeV)" see the unit and the selector in the
same visual group.

### Reduced vertical real estate cost

Removing the intermediate row recovers ~48px of vertical space on desktop and
reduces the margin between picker and table on mobile. This space was reserved
for an input control that a majority of users never changed from its default.

### MeV/u support for proton in Advanced mode

The new unit-anchor strip adds MeV/u as a valid energy unit for proton in
Advanced mode (the standalone selector did not expose this). An `(≠MeV)` badge
on the MeV/u option explains that MeV/u ≠ MeV for proton (A=1 but rest mass
differs from 1 atomic mass unit).

### Component deletion

`energy-unit-selector.svelte` is deleted. Its responsibilities are split:

- **Basic mode**: unit anchor in `table-basic.svelte`'s header or toolbar.
- **Advanced mode**: unit-anchor-strip rendered in the Advanced toolbar.
- **Range → / STP →**: unit selector is internal to the respective table
  components (`table-inverse-stp.svelte`, calculator range sub-component).

---

## Consequences

- `energy-unit-selector.svelte` is deleted (issue #559 / #563).
- `unit-anchor-strip.svelte` is the new reusable primitive for unit selection
  (usable on both Calculator and Plot pages).
- `uanchor=` URL parameter carries the unit anchor value in v2 URLs (replaces
  `eunit=` in v1). See ADR 006.
- `calculator.md` §2 (Energy Unit Selector) is updated in issue #563.

---

## References

- `docs/04-feature-specs/calculator.md` — Calculator spec (§2 energy unit)
- `docs/04-feature-specs/unit-handling.md` — unit handling rules
- ADR 006 — URL Schema v2 (`uanchor=` replaces `eunit=`)
- Issue #558 (mode tab rename + unit-anchor strip)
- Issue #563 (spec update)
