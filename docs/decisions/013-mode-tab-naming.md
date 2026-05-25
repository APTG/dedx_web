# ADR 013 — Advanced Mode Tab Naming: Energy → / Range → / STP →

**Status:** Accepted (2026-05-23)

**Context:** Calculator-table redesign (#526 / #558). The Advanced mode
Calculator has three calculation sub-modes that map to three tabs. The original
spec (`calculator.md` v1–v8) labelled these tabs **Forward**, **Range**, and
**Inverse STP**.

Those names were technically accurate but had two weaknesses:

1. **"Forward"** is a physics-modelling term, not a user-facing label. Users
   who are not familiar with stopping-power modelling do not know what
   "forward" means in this context.
2. **"Inverse STP"** is two words and uses an abbreviation. On mobile at
   `<400px`, a two-word tab label either wraps or gets truncated.

---

## Decision

Rename the three Advanced mode tabs to arrow-notation labels with sublabels:

| Tab | Label    | Desktop sublabel        | Mobile glyph (< 400px) |
| --- | -------- | ----------------------- | ---------------------- |
| 1   | Energy → | → Stopping Power, Range | E→                     |
| 2   | Range →  | → Energy                | R→                     |
| 3   | STP →    | → Energy                | S→                     |

The arrow suffix makes the **input → output** direction immediately clear
without requiring physics-domain knowledge.

---

## Rationale

### Arrow notation is self-documenting

`Energy →` reads as "energy goes in, [results come out]". The user does not
need to know the term "forward calculation" to understand that they type an
energy and get stopping power and range as output.

`Range →` and `STP →` extend the same convention to the inverse modes:
"range goes in, energy comes out" and "stopping power goes in, energy comes
out".

### Short glyphs on mobile

At viewport widths below 400px (compact phones, split-screen), three tab
labels with inline arrows (`Energy →`, `Range →`, `STP →`) would overflow
their tabs. Single-character glyphs (`E→`, `R→`, `S→`) fit in the available
space while preserving the directional semantics.

The full label + sublabel combination is shown on desktop (`≥ 400px`) to give
users additional context when screen real estate permits.

### Consistency with the unit-anchor strip

The unit-anchor strip (ADR 008) uses a similar arrow/direction convention for
labelling energy units (`MeV →`, `MeV/nucl →`). Consistent use of `→` as
"this is the value that drives the calculation" creates a learnable visual
language across the page.

---

## Consequences

- Tab labels updated in `calculator.svelte` / `+page.svelte`.
- Desktop sublabels rendered below the main tab label using a smaller
  `text-xs` class.
- Mobile glyphs (`E→`, `R→`, `S→`) render when viewport width < 400px via
  a CSS breakpoint class.
- `calculator.md` §Modes is added/updated in issue #563.
- Playwright tests that match tab text strings are updated to the new labels.

---

## References

- `docs/04-feature-specs/calculator.md` — Calculator modes spec
- ADR 008 — Drop unit button (unit-anchor strip, arrow convention)
- Issue #558 — mode tab rename + unit-anchor strip
- Issue #563 — spec update (this decision documented)
