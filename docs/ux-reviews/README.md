# UX Reviews

Periodic UX reviews of the webdedx calculator interface.  Each review
documents issues found, their severity, and implementation status.

> **Note:** These are historical, point-in-time reviews. For current
> intended behavior, the specs under `docs/04-feature-specs/` are
> authoritative.

> **Note for future readers:** these review files are point-in-time
> narratives. They may reference behavior, group names, or wording that
> was later changed. For the **current** behavior, the per-feature spec
> under `docs/04-feature-specs/` is authoritative.

## Convention

- One file per review session, named `YYYY-MM-DD-<scope>.md`.
- Each issue has a **Status** line updated when fixed.
- The priority table at the bottom is the canonical tracking view.
- Cross-reference to `CHANGELOG-AI.md` for the implementation session.

## Index

| File | Date | Scope | Open Issues |
|------|------|-------|-------------|
| [2026-04-28-stage5-completion-and-stage6-readiness.md](2026-04-28-stage5-completion-and-stage6-readiness.md) | 28 Apr 2026 | Critical UX review (desktop + mobile) of all Stage 5 sub-items 5.1–5.5; Stage 6 readiness assessment; calculator + plot routes | 11 open (3 desktop polish, 8 mobile/Stage 7) |
| [2026-04-26-stage5-completion-and-ke-conservation.md](2026-04-26-stage5-completion-and-ke-conservation.md) | 26 Apr 2026 | Stage 5 completion audit, kinetic-energy conservation on particle/unit switching, add-row affordance, master unit selector, debounce, dead code | 0 open (all closed by PRs #378–#394) |
| [2026-04-24-entity-selector-energy-input.md](2026-04-24-entity-selector-energy-input.md) | 24 Apr 2026 | Entity selector comboboxes, entity panels, EnergyInput component | 0 (all fixed) |
| [2026-04-25-calculator-full-review.md](2026-04-25-calculator-full-review.md) | 25 Apr 2026 | Full calculator page — auto-select UX, result table, energy input, error handling, E2E coverage, spec compliance, inverse-calculator reusability | 9 open |
