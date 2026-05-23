# 2026-05-13 — Stage 8 Open Beta & User Feedback: redesign plan insertion

## Session Narrative

### Prompt 1: Where to put a user-feedback / visual polish phase in the redesign plan?

**User request**: The app will be shown to users soon who will have requests about visual
layout and bugs. Where in the redesign plan should a "collect feedback and fix issues"
phase go? The suggestion was: after all features are complete and before the APTG/web
production release, so the old v1.1.0 app is still live for comparison. Asked whether
this is the right place or whether a better structure exists.

**AI response**: Read `docs/00-redesign-plan.md` to understand the existing stage structure.
The current plan was: Stage 7 (Polish & E2E), Stage 8 (CI/CD deploy → v2.0.0), Stage 9
(Legacy Removal, already done early). The user's instinct was confirmed: the beta phase
must happen _before_ Stage 8 tags v2.0.0, because once that tag fires `APTG/web` gets
overwritten and the v1.1.0 comparison reference disappears.

Initial recommendation was to add it as Stage 7.6 to avoid renumbering.

### Prompt 2: What about renumbering stages and inserting as Stage 8?

**User request**: Suggested making it a proper Stage 8, pushing the current CI/CD deploy
stage to Stage 9.

**AI response**: Agreed this is better: a top-level stage signals the beta is a real
milestone, not a sub-task; the narrative becomes **8 Open Beta → 9 Production Release**,
which is cleaner. The only cost is updating cross-references to "Stage 8" across the docs.
Plan was approved; implementation proceeded.

### Prompt 3: Make a branch, commit, and fill AI logs

**User request**: Create a branch, commit the changes, and add proper AI logs with
prompt/response information.

**AI response**: Created branch `docs/stage8-open-beta`, made all edits listed below,
wrote this session log, updated `CHANGELOG-AI.md` and `docs/ai-logs/README.md`.

## Tasks

### Insert Stage 8 "Open Beta & User Feedback" and renumber Stage 8→9, Stage 9→10

- **Status**: completed
- **Stage**: planning / docs (no code stage)
- **Files changed**:
  - `docs/00-redesign-plan.md` — added Stage 8 block; renamed old Stage 8→9, Stage 9→10;
    updated cross-references in versioning note, Stage 3.7, and Stage 3.8 sections, and §11
  - `docs/08-deployment.md` — all 7 "Stage 8" references updated to Stage 9
  - `docs/02-tech-stack.md` — pipeline reference Stage 8→9
  - `docs/10-terminology.md` — CI/CD glossary entry Stage 8→9
  - `docs/decisions/005-shadcn-svelte-components.md` — corrected integration-plan row:
    "Stage 8 (Export + Compounds)" → "Stage 6 (Export + Compounds) ✅" (those components
    were actually shipped in Stage 6, not Stage 8)
  - `docs/progress/stage-5-entity-selection.md` — removed stale stage number from a
    Sonner/toast deferred note
- **Decision**: Top-level Stage 8 (not a 7.6 sub-stage) because it is a milestone gate
  before production release, and the comparison window (both apps live simultaneously)
  makes it time-sensitive. AI log files (`docs/ai-logs/`) were intentionally left
  unchanged — they are historical records and their stage references should not be
  retroactively edited.

### Stage 8 content summary

The new Stage 8 defines:

- **Goal**: catch visual/layout bugs before production release, while v1.1.0 is still at
  `aptg.github.io/web` for side-by-side comparison
- **Process**: share `web_dev` URL → file issues with `beta-feedback` label (critical
  ones tagged `must-fix`) → fix in `master` (auto-deploys to `web_dev`) → repeat
- **Gate**: no open `must-fix` issues; team sign-off → proceed to Stage 9 (v2.0.0 tag)
