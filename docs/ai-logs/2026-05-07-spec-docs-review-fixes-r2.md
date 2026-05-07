# 2026-05-07 — Spec docs: PR review fixes (round 2)

**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent

## Session Narrative

### Prompt 1: Apply second-round PR review comments from PR #433

**AI response**: Applied six fixes from the `copilot-pull-request-reviewer`
review thread (`pullrequestreview-4244062720`) on PR #433, as requested by
@grzanka:

1. **Feature-specs README version sync** — `docs/04-feature-specs/README.md`:
   updated `inverse-lookups.md` status column from "Final v5" to "Final v6"
   (matching the `> **Status:** Final v6` header in the spec itself) and
   `custom-compounds.md` from "Final v2" to "Final v3" (matching its `Final v3`
   header). Both versions had been bumped in the previous session but the README
   index was not updated.

2. **Restore Stage 6.6 Plot export log link** —
   `docs/00-redesign-plan.md` row for sub-stage 6.6: re-added the missing
   `[log](ai-logs/2026-05-04-stage6-plot-export-copilot-fixes.md)` link so the
   consolidated table points to both the Calculator export session log
   (`2026-04-29-stage6-export-and-e2e-fixes.md`) and the Plot export PR-review
   fixes log (`2026-05-04-stage6-plot-export-copilot-fixes.md`).

3. **Add `**Model:**` line to `2026-05-07-redesign-plan-stage6-table-fix.md`** —
   The session log was missing the required top-level attribution line. Added
   `**Model:** Claude Sonnet 4.6 via GitHub Copilot coding agent` after the H1.

4. **Add `**Model:**` line to `2026-05-07-inverse-lookups-scenarios-v6.md`** —
   Same fix for the inverse-lookups v6 scenarios session log.

5. **Add `**Model:**` line to `2026-05-07-custom-compounds-spec-v3.md`** — Same
   fix for the custom-compounds v3 session log.

6. **Fix `page.blur(selector)` API call** —
   `docs/04-feature-specs/inverse-lookups.md` line 927: `page.blur(selector)` is
   not a valid Playwright API; the correct form is `page.locator(selector).blur()`.
   Updated the embedded E2E snippet in Scenario 1 to use
   `await page.locator('[data-testid="inverse-range-input-0"]').blur()`.

## Tasks

### Apply PR #433 review-comment fixes (round 2)

- **Status**: completed
- **Stage**: spec-prep (Stage 6.9–6.13 docs + plan maintenance)
- **Files changed**:
  - `docs/04-feature-specs/README.md`
  - `docs/00-redesign-plan.md`
  - `docs/ai-logs/2026-05-07-redesign-plan-stage6-table-fix.md`
  - `docs/ai-logs/2026-05-07-inverse-lookups-scenarios-v6.md`
  - `docs/ai-logs/2026-05-07-custom-compounds-spec-v3.md`
  - `docs/04-feature-specs/inverse-lookups.md`
  - `docs/ai-logs/2026-05-07-spec-docs-review-fixes-r2.md` (this file)
  - `docs/ai-logs/README.md`
  - `CHANGELOG-AI.md`
- **Decision**: none — all fixes are straightforward alignments to existing
  conventions (`**Model:**` line, correct Playwright API, README version sync).
- **Issue**: none
