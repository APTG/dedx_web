# 2026-07-04 — Basic hero-row value alignment (#823)

## Session Narrative

### Prompt 1: Numbers not horizontally aligned in the hero row

The user reported (with a screenshot) that in the Basic single-energy hero row the
three values — the kinetic-energy input (`123`), the CSDA range (`11.14 cm`), and the
stopping power (`0.6262`) — were not on the same horizontal level: the input sat
higher than the two results. The requirement: regardless of what is shown in the
optional hint/message slot (e.g. "type a unit too …"), both the top labels
("Kinetic energy", "CSDA Range", …) and the value line (input + results) must be
aligned on the same level.

**AI response**: Diagnosed the cause in `results/table-basic.svelte`:

- The two result cells were `flex flex-col` with the value pinned to the **bottom**
  of the stretched cell via `mt-auto` (added earlier so the two results stay aligned
  when one label wraps).
- The input cell was a plain block: label → input → hint slot, so the input sat at
  the **top**, right under its label — not bottom-pinned like the results.
- Even if bottom-pinned, the input lives in a bordered box with `py-2`, which lifts
  its text ~0.5rem above the plain (unboxed) result text.

Fix — make all three cells share one baseline:

1. Input cell is now `flex flex-col` and the input gets `mt-auto`, so the
   input+hint block is bottom-pinned like the results.
2. Each result cell gained a bottom spacer mirroring the input's fixed-height hint
   slot (`mt-1.5 min-h-[1.25rem]`), so whatever appears in the input's hint/message
   slot never shifts the shared baseline.
3. The plain result values got `border border-transparent py-2` so their line box
   matches the boxed input's line box → the glyphs land on exactly the same level.

Verified in the running dev server with a throwaway Playwright script: the three
value boxes (`energy-input-0`, `range-cell-0`, `stp-cell-0`) report identical
`top`/`center`/`bottom` (439 / 464 / 489), and the alignment holds both when the
input is blurred (hint hidden) and focused (hint shown).

## Tasks

### Align the three hero-row values on one baseline

- **Status**: completed
- **Stage**: calculator (#823 follow-up)
- **Files changed**:
  - `src/lib/components/results/table-basic.svelte`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-07-04-issue-823-hero-row-alignment.md`
- **Decision**: Kept the bottom-pinning (`mt-auto`) approach — it is what keeps the
  two result values aligned when one label wraps to more lines than the other — and
  extended it to the input, rather than switching to top-alignment (which would
  reintroduce the wrap misalignment). Used a transparent-bordered `py-2` box on the
  plain result values to match the boxed input's line-box metrics so the actual
  glyphs (not just the cell edges) sit on one baseline.
- **Issue**: none. Lint clean (the single ESLint warning is in generated
  `coverage/`), Prettier clean, full Vitest suite 1924 passed.
