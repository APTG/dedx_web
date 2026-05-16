# 2026-05-16 — Compare-across review follow-ups

## Session Narrative

### Prompt 1: Apply review-thread changes for PR #523

**AI response**: Implemented the requested review fixes across calculator logic, picker tabs, and result-table rendering. Multi-entity calculations now return explicit per-entity errors for unsupported external IDs, support custom-compound material columns correctly, and no longer silently skip string IDs. Multi-program background calculation is now gated to `across === "program"`. Material/particle anchor options are truly disabled (not only `aria-disabled`), and material multi-selected pills now resolve against full lists so they stay visible under active filters. Added regression tests for multi-entity headers/cells/error markers and picker anchor/filter behavior.

## Tasks

### Fix multi-entity calculation correctness and unsupported-ID handling

- **Status**: completed
- **Stage**: entity-selection
- **Files changed**: `src/routes/calculator/+page.svelte`
- **Decision**: Kept external entities selectable but emitted explicit `LibdedxError` per entity instead of silently skipping non-numeric IDs.
- **Issue**: External multi-entity WASM support is still unavailable by design.

### Fix multi-select accessibility and filtered-pill behavior

- **Status**: completed
- **Stage**: entity-selection
- **Files changed**: `src/lib/components/entity-selection/particle-tab.svelte`, `src/lib/components/entity-selection/material-tab.svelte`, `src/tests/unit/entity-selection-tabbed.test.ts`
- **Decision**: Applied real `disabled` attributes for anchors and resolved selected material pills from unfiltered sources.
- **Issue**: none.

### Fix per-material density conversion and add ResultTable regression coverage

- **Status**: completed
- **Stage**: entity-selection
- **Files changed**: `src/lib/components/result-table.svelte`, `src/tests/components/result-table-advanced.test.ts`
- **Decision**: Applied per-entity density lookup only in `across === "material"` mode; retained existing override behavior for non-material comparison modes.
- **Issue**: none.
