# ADR 009 — No Autofocus on Cold Load

**Status:** Accepted (2026-05-23)

**Context:** Calculator-table redesign (#526 / #555). Early prototypes and
the legacy CRA app focused the first energy input automatically when the page
loaded. This is a common pattern for input-centric pages (search boxes, login
forms). The question is whether the Calculator page should behave the same way.

---

## Decision

Do not set `autofocus` on any energy input cell or picker field on cold load
(i.e., the first page load without URL parameters that pre-select state).

---

## Rationale

### The Calculator is a result-viewer, not an input form

The primary value proposition of the redesigned Calculator is that it shows a
meaningful result — proton stopping power in water at 100 MeV — **before the
user touches any control**. Pre-populating the table and triggering calculation
on mount satisfies this goal.

Autofocus on the energy input would immediately steal keyboard focus from the
result. On mobile, it would also invoke the software keyboard, obscuring the
result that just appeared. The user came to _see a result_, not to fill in a
form.

### Mobile scroll side-effect

When an input element receives `autofocus` on mobile browsers, the viewport
scrolls to bring the focused input into view. Since the energy table is below
the picker, this scroll pushes the pre-calculated result partially off-screen
at the moment the user first sees the page — the opposite of the intent.

### Accessibility

Screen readers announce the focused element immediately on page load. Focusing
an energy input cell causes the reader to announce something like "100, edit
text, Energy (MeV)" — which is less informative than letting the user explore
the heading structure and result table naturally.

### Telemetry-informed future change

If analytics data shows that the majority of users' first action is to modify
the energy input, autofocus could be reconsidered. The decision is not
permanent; it is the safe default given the "result first" design principle.

---

## Consequences

- No `autofocus` attribute on energy inputs in `table-basic.svelte`,
  `table-advanced.svelte`, or `table-inverse-stp.svelte`.
- No programmatic `focus()` call on any input during the initial mount
  `$effect`.
- E2E tests assert that no input is focused on cold load
  (`tests/e2e/cold-load-defaults.spec.ts`).
- The `autofocus` behaviour _may_ be enabled for URL-parameter-driven loads
  where the user explicitly navigated to the Calculator with a pre-built URL,
  but this is a separate future decision.

---

## References

- `docs/04-feature-specs/calculator.md` — Calculator default-state spec
- Issue #555 — Cold-load defaults E2E tests
- `tests/e2e/cold-load-defaults.spec.ts` — E2E assertions
