# 2026-07-04 — Hero-row spacing + Energy → Range → STP column order (#823)

## Session Narrative

### Prompt 1: Tighten hero-row spacing; reorder columns Energy → Range → STP

The user reported that the Basic single-energy hero row has too much empty
space — especially **above the label** and **below the input/message** — and
asked to trim it "just a bit". They also asked that the **multi-row tables** read
**kinetic energy → range → stopping power**, in that sequence, in **both Basic
and Advanced mode**, and to update the design docs.

**Scope question**: "advanced mode" also includes the program-comparison and
material/particle comparison tables, which showed Stopping Power before Range.
Asked the user whether to reorder those too; they chose **all forward tables**
for full consistency.

**AI response**:

**(1) Spacing** — trimmed the vertical padding in all three hero cells
symmetrically so the alignment (input + both results on one baseline, from the
earlier session) is preserved:

- cell padding `p-4` → `px-4 py-3`
- label `mb-1.5` → `mb-1`
- input & result-value `py-2` → `py-1.5`
- reserved hint/message slot `mt-1.5 min-h-[1.25rem]` → `mt-1 min-h-[1rem]`

Verified in-browser that the three value boxes still share identical
top/center/bottom (433/456/479), and the error state (red rectangle + "Energy
out of tabulated range") is likewise more compact.

**(2) Column order Energy → Range → STP** across every forward result table:

- `table-basic.svelte` — multi-row header + cells swapped (hero was already
  Range → STP).
- `table-advanced.svelte` — energy-mode header + cells swapped → Energy,
  [→ MeV/nucl], CSDA Range, STP.
- `table-multi-program.svelte` — swapped `stopping-power`/`csda-range` in
  `getDefaultColumns` (drives basic-header, input-row-cells slice(0,3),
  basic-result-cells slice(3)).
- `multi-program/advanced-header.svelte` + `advanced-result-cells.svelte` —
  swapped the STP/CSDA colgroup + per-program subheader blocks and the cell
  blocks.
- `multi-program/multi-entity-header.svelte` + `multi-entity-cells.svelte` —
  swapped (this both-columns path is currently test-only; the live
  material/particle comparison uses `table-multi.svelte`, a single-quantity
  toggle with no STP-vs-Range order).

The live program-comparison and material/particle tables show **one** quantity
at a time via the STP/Range `QuantityToggle` (`quantityFocus` is `"stp" | "range"`,
no "both"), so their block reorder is non-visual; it only matters for the
both-columns code paths, kept consistent. All `stp-cell-*` / `range-cell-*` /
`advanced-stp-cell-*` / `advanced-range-cell-*` test ids preserved.

**Tests/docs updated**:

- `complex-interactions.spec.ts` — Basic header-order assertion flipped to
  Energy, CSDA Range, Stopping Power; positional `td.nth(3)` STP lookups
  (fragile — shifts with the reorder and the conditional MeV/nucl column)
  switched to the stable `advanced-stp-cell-{i}` testid.
- `advanced-combined-table.spec.ts` — the 5-row `toMatchAriaSnapshot` `.aria.yml`
  updated to the new column order (pure swap; per-row autoscale units unchanged);
  descriptive comment fixed.
- `calculator.md` — Advanced-table AC column list, hero result-cell description
  (one baseline across all three cells + compact padding), and prose order.
  `calculator.md:555` already documented `Energy | CSDA Range | Stopping Power`,
  so this realigns the code with the spec.
- `multi-program.md` — grouped-header order prose.
- Export CSV/PDF order left untouched (out of scope; CSV already lists CSDA
  Range before Stopping Power).

**Verification**: `svelte-check` 0 errors; Prettier + ESLint clean (lone ESLint
warning is in generated `coverage/`); full Vitest 1924 passed; the reordered
E2E specs (`advanced-combined-table` + `complex-interactions` = 34, plus 75 more
table-related E2E) all green; live screenshots confirm Basic and Advanced
headers read Energy → CSDA Range → Stopping Power and the hero is tighter with
alignment intact.

## Tasks

### Reduce hero-row spacing

- **Status**: completed
- **Files changed**: `src/lib/components/results/table-basic.svelte`
- **Decision**: Changed padding symmetrically across all three cells so the
  earlier baseline-alignment fix keeps holding; targeted vertical padding
  (`py`) rather than horizontal so content room is unchanged.

### Reorder all forward tables to Energy → Range → STP

- **Status**: completed
- **Stage**: calculator (#823 follow-up)
- **Files changed**: `table-basic.svelte`, `table-advanced.svelte`,
  `table-multi-program.svelte`, `multi-program/advanced-header.svelte`,
  `multi-program/advanced-result-cells.svelte`,
  `multi-program/multi-entity-header.svelte`,
  `multi-program/multi-entity-cells.svelte`,
  `tests/e2e/complex-interactions.spec.ts`,
  `tests/e2e/advanced-combined-table.spec.ts` (+ aria snapshot),
  `docs/04-feature-specs/calculator.md`, `docs/04-feature-specs/multi-program.md`
- **Decision**: Reordered every forward table (user chose full consistency).
  Left CSV/PDF export column order alone (separate feature, not requested).
- **Issue**: none. The two `multi-entity.spec.ts` quantity-toggle E2E tests
  `test.skip()` locally when the comparison table doesn't render within their
  WASM timeout — a pre-existing guard, not a regression; the reordered
  components are covered by passing `table-multi-program-advanced.test.ts` unit
  tests.
