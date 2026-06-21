# Feature: Contextual Help (tooltips & "ⓘ" hints)

> **Status:** Draft v1 (2026-06-21)
>
> **Related specs:**
>
> - [`entity-selection.md`](entity-selection.md) — Program tab the first hints attach to
> - [`../10-terminology.md`](../10-terminology.md) — canonical wording source for all hint copy
> - [`unit-handling.md`](unit-handling.md) — quantity/unit hints (PR 2)
> - [`advanced-options.md`](advanced-options.md) — advanced-control hints (PR 3)

---

## Goal & User Story

Provide lightweight, in-context help so newcomers can understand dEdx's
domain-dense vocabulary without leaving the page. The mechanism is a single,
reusable, accessible affordance: a focusable "ⓘ" icon (`HelpHint`) that reveals
a short gloss on hover/focus/tap, with an optional "Learn more →" deep-link into
`/docs`. Hint copy is sourced from the glossary so it never drifts.

**As a** student, clinical physicist, or shielding engineer new to stopping-power tools,
**I want to** see a short plain-language explanation of an unfamiliar term or control where I encounter it,
**so that** I can make a correct choice (especially _which program / data source_ to use) without reading the full documentation first.

This spec is delivered in three PRs:

| PR  | Issue | Scope                                                                  |
| --- | ----- | ---------------------------------------------------------------------- |
| 1   | #769  | `HelpHint` + `help-text.ts` foundation; **Program / data-source** help |
| 2   | #770  | Quantity & unit hints — **stopping power AND CSDA range parity**       |
| 3   | #771  | Advanced-mode control & workflow hints                                 |

---

## Design

### The `HelpHint` component (`src/lib/components/help-hint.svelte`)

A focusable `<button>` rendering a Lucide `Info` icon, wrapping the existing
Bits UI tooltip primitive (`src/lib/components/ui/tooltip/`). Props:

| Prop     | Purpose                                            |
| -------- | -------------------------------------------------- |
| `term`   | Key into `help-text.ts` (supplies `text` + `href`) |
| `text`   | Inline gloss; overrides the registry text          |
| `href`   | Base-relative deep-link; overrides registry        |
| `label`  | Accessible name for the trigger button             |
| `side`   | Tooltip placement                                  |
| `testId` | `data-testid` on the trigger                       |

### Content registry (`src/lib/config/help-text.ts`)

`HELP_TEXT` maps a key → `{ text, href? }`. `text` is ≤150 chars and worded to
match `docs/10-terminology.md`. `href` is base-relative (the deployment base is
prepended by `HelpHint`) and points at a `/docs/user-guide` anchor. Keeping the
copy in one module satisfies the CLAUDE.md cross-spec consistency rule.

Program-specific "what + why" strings live in `PROGRAM_HELP` (keyed by libdedx
program id) in `src/lib/config/program-names.ts`, alongside the existing
`PROGRAM_DESCRIPTIONS` (terse subtitle) and `PROGRAM_NAME_OVERRIDES`.

### Accessibility (WCAG 2.1 AA — SC 1.4.13 Content on Hover or Focus)

The Bits UI tooltip provides the three required behaviours: the hint is
**dismissable** (Escape), **hoverable** (pointer can enter the content), and
**persistent** (stays until blur/Escape). Because the trigger is a real
focusable `<button>`, it opens on keyboard focus and on a touch tap (tap focuses
the button), so the help is reachable without a hover-capable pointer. The
"Learn more →" destination is also reachable from the `/docs` navigation, so the
hint is never the only path to the information.

### Placement decisions

- **Program concept hint** is rendered in the **Program panel** header
  (`program-tab.svelte` "Choose a data source" row), **not** inside the
  `role="tab"` button in `tab-bar.svelte`. Nesting an interactive `HelpHint`
  button inside a tab button would be an ARIA anti-pattern (interactive control
  inside interactive control). The panel is what is shown when the Program tab is
  active, so the concept help is co-located with the program list.
- **Per-program hints** are siblings of the option `<button>` inside each list
  `<li>` (not children of it), again to avoid nesting interactive controls; the
  `HelpHint` stops click propagation so it never selects the program.
- **TAB / FN / EXT badge meaning** is conveyed by the always-visible **legend**
  at the bottom of the Program panel (visible text > hover-only tooltip), so no
  per-badge tooltip is added.

---

## Acceptance Scenarios

### Scenario 1: Program data-source explainer @smoke

**Given** the user is on `/calculator` and opens the entity picker on the Program tab
**When** they focus or tap the "ⓘ" next to "Choose a data source"
(`[data-testid="picker-program-help"]`)
**Then**

- A tooltip appears explaining that a program is the data source for the result
- It contains a "Learn more →" link to `/docs/user-guide#choosing-a-program`
- Pressing `Escape` dismisses it without moving focus

### Scenario 2: Per-program hint

**Given** the Program list is visible
**When** the user focuses/taps `[data-testid="picker-program-help-2"]` (PSTAR)
**Then**

- A tooltip shows the PSTAR "what + why" text
- Activating the hint does **not** change the selected program (no propagation to the row button)

### Scenario 3: Keyboard accessibility @regression

**Given** keyboard navigation
**When** the user tabs to a `HelpHint` trigger and presses no pointer
**Then**

- The trigger is focusable and shows a visible focus ring
- The hint opens on focus and closes on `Escape`

---

## Reactive Triggers Matrix

N/A — contextual help adds no reactive calculation inputs. It does not call WASM,
does not affect results, and does not participate in the calculator/plot effect
graph.

---

## URL Round-Trip Table

N/A — contextual help has no URL state. (`tip_seen` onboarding hints are a
separate concern owned by `multi-program.md` and are out of scope here.)

---

## Cross-Page Parity Checklist

`HelpHint` is page-agnostic. The Program hints (PR 1) live in
`entity-selection/program-tab.svelte`, which is shared by both `/calculator` and
`/plot`, so they appear on both pages automatically. PRs 2 and 3 list their own
affected components. No advanced-mode gating, URL init, or persistence pillars
apply.

---

## Test Plan

### Component tests (`@testing-library/svelte`)

- `src/tests/components/help-hint.test.ts`
  - [ ] Renders a focusable trigger button with the supplied `aria-label`
  - [ ] Resolves text from `term` (registry) and from inline `text` override
  - [ ] Renders the "Learn more" link with the base-prepended `href` when present
  - [ ] Omits the link when no `href` is resolvable

### Unit tests (Vitest)

- `src/tests/unit/program-names.test.ts` (extend)
  - [ ] Every program id with a friendly name also has a `PROGRAM_HELP` entry
  - [ ] All `PROGRAM_HELP` strings are non-empty and ≤150 chars

### E2E tests (Playwright)

- `tests/e2e/contextual-help.spec.ts`
  - `@smoke` — open the Program data-source hint, assert content + "Learn more"
    link, dismiss with `Escape` (runs against the real app; no WASM mock needed —
    the hint is static)

---

## Out of Scope / Deferred

- Quantity & unit hints (stopping power + CSDA range) — **PR 2 / #770**
- Advanced-mode control & workflow hints — **PR 3 / #771**
- Onboarding tours / coach-marks and the `tip_seen` URL flag — owned by
  `multi-program.md`; not part of this spec
- Converting trivial icon-button `title=` labels (e.g. "List view") to tooltips —
  those are control labels, not concept help, and stay as-is

---

## Open Questions

None.
