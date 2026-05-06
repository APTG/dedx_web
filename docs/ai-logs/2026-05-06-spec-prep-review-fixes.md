# 2026-05-06 — Spec Prep: PR Review Fixes (Stage 6.11–6.13)

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Apply PR review comments to the Stage 6.11–6.13 companion specs

**AI response**: Applied five fixes from the `copilot-pull-request-reviewer`
review thread on PR #433, as requested by @grzanka:

1. **Grammar fix** — `stage-6-13-url-parser.md` line 56: "I want to the URL
   encode/decode…" was missing a verb. Corrected to "I want the URL
   encoding/decoding to follow…".

2. **`urlv` table inconsistency** — `stage-6-13-url-parser.md` line 224: the
   URL round-trip table column is labelled "Default (omitted)" (implying the
   param is omitted when equal to its default), but the `urlv` row's value
   read "`1` (always emitted per canonicalization step 1)". The two
   statements contradict each other. Updated the value to
   `n/a — always emitted (step 1 of canonicalization; never omitted even
   when value equals the current default)` to make the exception explicit
   without renaming the column (which applies to all other params correctly).

3. **Inconsistent `data-testid` conventions** — `stage-6-12-multi-program-polish.md`
   lines 55–69: Scenario 1 prose used name-based IDs (`mp-drag-handle-pstar`,
   `mp-column-header-bethe`) while the embedded TypeScript test and the URL
   example (`programs=3,5,8`) used numeric program IDs (5 = PSTAR, 8 = Bethe).
   Updated the prose to use numeric IDs (`mp-drag-handle-5`,
   `mp-column-header-5`, `mp-column-header-8`) and corrected the program
   description from "PSTAR (id=3 equivalent, distinct)" to "PSTAR (id=5)" to
   match the URL.

4. **Out-of-scope section reference** — `stage-6-11-export-advanced.md` line
   309–310: the sentence "This spec only adds the Calculator advanced PDF
   (§6.3)" referenced §6.3 of `export.md`, but the in-scope comment at the
   top of the file explicitly lists `§6.1 Calculator PDF button` as in-scope.
   Updated to "This spec adds the Calculator PDF button and advanced-mode
   metadata block (§6.1 of `export.md`)" for consistency with the rest of the
   doc.

5. **Missing table separator row** — `CHANGELOG-AI.md` was missing the
   `| --- | --- | --- | --- |` row between the table header and the first
   data row. Added it so GitHub renders the table correctly.

## Tasks

### Apply PR #433 review-comment fixes

- **Status**: completed
- **Stage**: spec-prep (Stage 6.11–6.13 companion docs)
- **Files changed**:
  - `docs/04-feature-specs/stage-6-13-url-parser.md`
  - `docs/04-feature-specs/stage-6-12-multi-program-polish.md`
  - `docs/04-feature-specs/stage-6-11-export-advanced.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-05-06-spec-prep-review-fixes.md` (this file)
  - `docs/ai-logs/README.md`
- **Decision**: For the `urlv` table fix, chose to keep the column header
  unchanged (it describes the other parameters correctly) and instead made the
  exception explicit in the cell value. Renaming the column would have been a
  larger change with no additional clarity benefit.
- **Issue**: none
