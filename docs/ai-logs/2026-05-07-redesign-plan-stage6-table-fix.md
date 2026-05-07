# 2026-05-07 — redesign-plan.md: Stage 6 table consolidation + Stage 7 external data

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Fix Stage 6 table and add external data to Stage 7

**User request:** Fix the Stage 6: Feature Pages table in `docs/00-redesign-plan.md` by
merging the "Completed sub-stages" and "Remaining sub-stages" tables into a single unified
table. Ensure consistency (spec version numbers, status marks). Note that Stage 7 should
mention external data support as referenced in `stage-6-13-url-parser.md`.

**AI response:**

Three changes made to `docs/00-redesign-plan.md`:

#### 1. Stage 6 status intro updated

The introductory Status bullet was stale — it listed "Build Info" as still remaining
(⏳) even though Stage 6.7 was completed in the previous session. Updated to:
"Sub-stages 6.1–6.8 are ✅ complete. Sub-stages 6.9–6.13 remain ⏳."

#### 2. Two split tables merged into one unified table

The original design used two separate tables with different schemas:
- "Completed sub-stages": columns `#`, `Feature`, `Status`, `PR(s)`, `Spec / Log`
- "Remaining sub-stages": columns `#`, `Feature`, `Status`, `Spec`, `Notes`

Problems with the split:
- 6.7 (Build Info badge) was ✅ complete but listed in "Remaining" — confusing
- Different column schemas made cross-reference awkward
- "Notes on deferred items" section duplicated info already captured per-row

Replacement: single `#### Sub-stages` table with columns `#`, `Feature`, `Status`,
`Spec`, `Notes / PR(s)`. Key fixes in the merge:
- 6.7 moved to correct position (between 6.6 and 6.8), status ✅
- 6.9 spec version updated Final v4 → Final v6 (updated in this session)
- 6.10 spec version updated Final v1 → Final v3 (updated in previous session)
- Notes column for pending items condensed (key facts + dependency references kept)
- "Notes on deferred items" bullet list removed; its content distributed across:
  - The Notes/PR(s) cells for 6.11 ("Deferred from 6.6") and 6.12 ("Deferred from 6.3")
  - The new deferred-to-Stage-7 blockquote at the end of the table

The "Recommended implementation order" line updated from
`6.7 (standalone) → 6.9 → 6.11 → 6.10 → 6.12 → 6.13` to
`6.9 → 6.11 → 6.10 → 6.12 → 6.13` (6.7 is done).

A brief blockquote at the end of the table now points to Stage 7 for external data.

#### 3. Stage 7 updated with External Data task

`stage-6-13-url-parser.md` explicitly defers two items to Stage 7:
- External data (`external-data.md`, Zarr v3 `.webdedx` format)
- `extdata=` URL param and `ext-ref` entity grammar in `shareable-urls-formal.md`

The previous Stage 7 description ("E2E Tests & Polish") had no mention of this.
Updated the heading to "External Data + E2E Tests & Polish" and added an
External data bullet referencing `external-data.md`, the ABNF grammar link, and
the Spike 4 gate (must produce `VERDICT.md` before implementation begins).

## Tasks

### Task 1: Redesign plan Stage 6 table consolidation

- **Status**: completed
- **Stage**: docs (plan maintenance)
- **Files changed**: `docs/00-redesign-plan.md`
- **Decision:** Single 5-column table rather than two mismatched schemas. Notes for
  completed items include PR links; notes for pending items include key deps and
  brief scope reminders. The "Notes on deferred items" bullet section is removed —
  its information is either in the Notes/PR(s) column or in the new Stage 7 text.
- **Issue:** None.
