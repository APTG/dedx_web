# 2026-05-13 — Stage 7.6 Beta Stabilization Plan

## Session Narrative

### Prompt 1: Where to put user feedback / visual layout requests in the redesign plan?

User asked where to record incoming UX/bug requests once the new app is shown to users —
should it go after all features are complete but before `APTG/web` is released, so the old
app is still available as reference?

**AI response**: Confirmed the user's instinct. Recommended making it an explicit named
stage (7.6 "Beta feedback & stabilization") rather than an informal gap, placed after Stage
7 feature-complete work and before Stage 8 production deploy. Outlined the triage model:
must-fix list as a release gate, nice-to-have items deferred to a post-v2 Stage 10 backlog,
each review round stored in `docs/ux-reviews/`.

### Prompt 2: Implement the plan

User asked to implement the plan described in Prompt 1.

**AI response**: Updated `docs/00-redesign-plan.md` with:
- Stage 7.6 row added to the Stage 7 sub-stages table
- Stage 7 status line updated to mention 7.6
- Stage 8 description extended with an explicit release gate (Stage 7.6 must-fix list closed)
- Stage 10 "Post-v2 Backlog" section added after Stage 9

Updated `CHANGELOG-AI.md` with this session entry.
Created this session log file.
Updated `docs/ai-logs/README.md` index.

## Tasks

### Add Stage 7.6 "Beta feedback & stabilization"

- **Status**: completed
- **Stage**: 7 planning
- **Files changed**:
  - `docs/00-redesign-plan.md` — Stage 7.6 row, updated status line, updated Stage 8 gate, new Stage 10 section
  - `CHANGELOG-AI.md` — new row
  - `docs/ai-logs/2026-05-13-stage7-6-beta-stabilization.md` — this file
  - `docs/ai-logs/README.md` — index entry
- **Decision**: Stage 7.6 is placed as the last sub-stage of Stage 7 (after 7.5 external data)
  so it runs when all features are fully implemented and polished. Stage 8 is explicitly gated
  on 7.6 completion (must-fix list empty). Post-v2 items go into Stage 10 — a rolling backlog
  with no planned completion date — rather than bloating Stage 7.6 indefinitely.
- **Issue**: none
