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

### Prompt 5: Turn skeleton into full draft v1
**AI response**: User specified key design decisions:
- Multi-program is an advanced-mode feature (like a calculator mode button)
- Additional per-program columns appear in the table (stopping power + CSDA range per program)
- Columns can be shown/hidden like Excel hidden columns
- Default program columns are visually highlighted
- Advanced/basic mode and column visibility are URL-encoded

Rewrote the entire spec from skeleton to Draft v1 with full sections. Also expanded product vision §4.4 to define the Basic/Advanced mode concept as a project-wide principle.

## Tasks

### Multi-Program Spec Draft v1
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/multi-program.md` (full rewrite from skeleton)
  - `docs/04-feature-specs/README.md` (status updated)
  - `docs/01-project-vision.md` (§4.4 expanded to Basic/Advanced mode)
  - `CHANGELOG-AI.md` (entry updated)
  - `docs/ai-logs/2026-04-08-multi-program.md` (narrative updated)
- **Decision**: Multi-program comparison uses horizontal column expansion (not stacked sections or tabs) because it enables direct row-by-row comparison. Excel-style column hide/show handles the readability concern. Default program is always first and visually highlighted with accent tint + bold header.
- **Decision**: Advanced mode is a project-wide concept (not just multi-program). Product vision §4.4 now defines it. URL parameter `mode=advanced` is shared across features.
- **Issue**: Open questions remain around delta/percentage columns, drag-and-drop column reordering, and whether incompatible programs should be auto-unchecked or kept greyed out.