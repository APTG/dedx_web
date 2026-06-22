# 2026-06-21 — Contextual Help (tooltips) + "Program / data source" explainer

## Session Narrative

### Prompt 1: Should we add tooltips? Analyse complexity, where to apply, how established scientific apps do it. Write a report.

**AI response**: Explored the codebase (architecture, component tree, glossary,
existing tooltip primitive + `title=`/`aria-label` usage) and researched WCAG
1.4.13 + scientific-app tooltip conventions. Concluded tooltips are a strong fit:
the app is domain-dense, the glossary (`docs/10-terminology.md`) already supplies
authoritative copy, and a Bits UI tooltip primitive is already installed.
Recommended a tiered help system (tooltips backed by `/docs`), an info-icon
pattern, a central registry to prevent drift, and strict WCAG 1.4.13 behaviour.

### Prompt 2: "Program" confuses users — add a tab-level explainer and per-program tooltips. Decide tooltip vs ? icon. Include in plan; list actions/issues.

**AI response**: Confirmed "Program" is the worst offender (not even a glossary
§1 term). Added a decision rule (passive tooltip for existing meaningful elements
vs explicit ⓘ for abstract concepts / touch-essential help / "Learn more"
deep-links). Planned a tab-panel ⓘ explainer + per-program hints + accessible
badge legend.

### Prompt 3: Mind range parity (not just stopping power). Create issues (≤3 PRs). Start implementing the first.

**AI response**: Created three issues (#769 foundation + Program, #770 quantity &
unit hints with CSDA-range parity, #771 advanced/workflow) and implemented #769.

## Tasks

### Contextual-help foundation + Program/data-source help (#769)

- **Status**: completed (pending PR)
- **Stage**: Stage 8 (polish / UX)
- **Files changed**:
  - `src/lib/components/help-hint.svelte` (new) — accessible ⓘ HelpHint
  - `src/lib/config/help-text.ts` (new) — glossary-sourced registry
  - `src/lib/config/program-names.ts` — `PROGRAM_HELP` map + `getProgramHelp`
  - `src/lib/components/entity-selection/program-tab.svelte` — panel explainer ⓘ + per-program hints
  - `docs/10-terminology.md` — new §1 term "Program (Data Source)"; bumped to v4
  - `src/routes/docs/user-guide/+page.svelte` — "Choosing a program" section (#choosing-a-program)
  - `docs/04-feature-specs/contextual-help.md` (new) — feature spec
  - `docs/04-feature-specs/README.md` — spec table row
  - `src/tests/components/help-hint.test.ts` (new), `src/tests/unit/program-names.test.ts` (extended), `tests/e2e/contextual-help.spec.ts` (new)
- **Decision**: The Program concept ⓘ lives in the Program **panel** header, not
  inside the `role="tab"` button, to avoid nesting interactive controls. Per-program
  ⓘ hints are siblings of (not inside) the option `<button>` for the same reason;
  the hint stops click propagation so it never selects a program. TAB/FN/EXT badge
  meaning is conveyed by the always-visible legend (visible text > hover tooltip),
  so no per-badge tooltip was added.
- **Decision**: Hint copy lives in one registry (`help-text.ts`) / `PROGRAM_HELP`
  map, keyed to glossary wording, to satisfy the CLAUDE.md cross-spec consistency rule.
- **Issue**: In-tooltip "Learn more" link reachability via keyboard inside a Bits
  UI tooltip is imperfect; mitigated because the same destination is reachable from
  the `/docs` nav (no dead end). A Popover/toggletip upgrade is noted as possible
  future work.

### Follow-ups (separate PRs)

- #770 — quantity & unit hints (stopping power AND CSDA range parity)
- #771 — advanced-mode control & workflow hints
