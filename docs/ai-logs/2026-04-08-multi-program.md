# 2026-04-08 — Multi-Program

## Session Narrative

### Prompt 1: Read the redesign plan and identify which spec to write next
**AI response**: Reviewed the redesign plan, feature-spec index, changelog, and relevant spec dependencies. Recommended `multi-program.md` as the next spec because it is the next unwritten feature in the documented implementation order and already has WASM contract support through `calculateMulti()`.

### Prompt 2: Generate a prompt for the spec agent and recommend a VS Code model choice
**AI response**: Provided a reusable prompt for drafting a `multi-program.md` skeleton and recommended using Auto in VS Code, with GPT-5.4 as the manual model choice if pinned.

### Prompt 3: Draft a skeleton for `docs/04-feature-specs/multi-program.md`
**AI response**: Produced a markdown-only skeleton covering user story, scope, inputs, state model, behavior, layout, validation, unit handling, URL state, export, accessibility, acceptance criteria, open questions, and cross-spec consistency checks.

### Prompt 4: Implement that skeleton in the repository markdown file
**AI response**: Added the new spec file in `docs/04-feature-specs/`, updated the feature-spec index, and recorded the session in the changelog and AI log index.

## Tasks

### Add Multi-Program Spec Skeleton
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/multi-program.md`
  - `docs/04-feature-specs/README.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-04-08-multi-program.md`
  - `docs/ai-logs/README.md`
- **Decision**: Kept the new spec at skeleton level with explicit TODO bullets rather than drafting full normative prose, because the request was to implement the skeleton and leave unresolved UX decisions visible.
- **Issue**: The main unresolved design choice is the Calculator UI for choosing multiple programs and the resulting comparison table shape on mobile.