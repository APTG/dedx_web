# 2026-04-03 — Project Vision Document

## Session Narrative

### Prompt 1: Write a feature spec (via write-spec.prompt.md)
**User** invoked the write-spec prompt, but asked for a broader project vision
document rather than a single feature spec. Requested a branch, issue, and draft PR.
Asked about the appropriate level of detail for specs.

**AI response**: Explained three levels of detail (too vague / right level / too detailed)
with examples. Gathered context by reading the redesign plan, WASM API contract, old
codebase (WASMWrapper.js, Utils.js, Calculator.js, Plot.js). Asked 6 clarification
questions about audience, inverse lookups, custom compounds, ATIMA inspiration,
offline use, and target devices.

### Prompt 2: Document structure discussion
**User** wanted clear separation between general vision and feature specs, and between
functional and non-functional documents. Asked for the branch to be created first.

**AI response**: Proposed a document taxonomy: `01-project-vision.md` (non-functional +
strategic), `09-non-functional-requirements.md` (separate), feature specs in
`04-feature-specs/` (one per feature). Asked 4 follow-up questions about NFR placement,
architecture scope, feature granularity, and previous unanswered questions.

### Prompt 3: User answers to structure questions
**User** confirmed: separate NFR doc, component tree in architecture, separate calculator
and plot specs. Answered domain questions: all audiences, inverse lookups yes, custom
compounds planned from start, ATIMA typeahead inspiration, no offline requirement,
all devices first-class.

**AI response**: Created branch `docs/project-vision-and-specs`. Summarized all decisions
in a structured table for future reference.

### Prompt 4: Draft project vision — clarification questions
**User** provided detailed context about the app: range calculator primary, plot for
stopping power comparison, inverse lookups advanced, minimum clicks philosophy,
shareable URLs, CSV/PDF export, no backend, GitHub Pages only.

**AI response**: Asked 16 targeted questions across domain/use cases, UX/naming,
output/export, and scope/priorities categories.

### Prompt 5: User requested copy-paste question format
**AI response**: Formatted all 16 questions with `→` placeholders for easy filling.

### Prompt 6: User answered all 16 questions
Key decisions captured:
- Calculator is landing page, range first; plot page for stopping power
- Default: proton/water/100 MeV/PSTAR for range
- "Best available answer" by default, overridable
- Users mostly enter one energy value
- App name: webdedx
- Three pages: Calculator, Plot, Documentation
- Segmented controls instead of dropdowns for few-option choices
- ATIMA-style typeahead with rich property display
- CSV Windows-compatible, configurable; PDF vector
- Full JSROOT interactivity
- v1/v1.5/v2 roadmap confirmed
- Human-friendly errors with technical details on demand
- Scientific-minimal visual style

**AI response**: Created `docs/01-project-vision.md` with all 11 sections. Asked 5
follow-up questions about "best available" program logic, documentation page details,
plot page defaults, and roadmap confirmation.

### Prompt 7: User answered follow-ups + libdedx investigation
**User** said to check libdedx for "best available" logic, confirmed auto-select for
plot page too, confirmed roadmap.

**AI response**: Investigated libdedx source. Found `DEDX_ICRU` meta-program in
`dedx_embedded_data.c::dedx_embedded_resolve_program()` with resolution chains:
proton→ICRU90→PSTAR, alpha→ICRU90→ICRU49, carbon→ICRU90→ICRU73→ICRU73_OLD,
heavy→ICRU73→ICRU73_OLD. Also found `dedx_get_simple_stp()` two-stage fallback
(ICRU→DEFAULT/Bethe). Updated vision doc §4.3 with these findings.

### Prompt 8: Units emphasis, AI logging, redesign plan fixes
**User** noted units are critical — input units must be explicit, output should
auto-scale (1.2 mm not 0.0012 m), plot labels must show units. Also reminded about
AI session logging, asked to check redesign plan links, and asked about old code
removal plan.

**AI response**: Added §4.1 "Correct and Clear Units" as the top design principle
(input unit selectors, auto-scaling output, plot axis label units). Reordered all
design principles (Units → Minimum Clicks → Best Available → Progressive Disclosure
→ Shareability → Export-Friendly). Updated `00-redesign-plan.md`: added missing docs
to §4 tree (inverse-lookups.md, advanced-options.md, 09-non-functional-requirements.md),
added Stage 9 (Legacy Code Removal), added commit hash placeholder to §11. Created
this session log and updated CHANGELOG-AI.md.

## Tasks

### Draft project vision document
- **Status**: completed
- **Stage**: Stage 1 (Requirements & Specifications)
- **Files changed**:
  - `docs/01-project-vision.md` — created, 11 sections covering purpose, audience,
    use cases, design principles (with units, minimum clicks, auto-select, progressive
    disclosure, shareability, export), app structure, constraints, device support,
    roadmap, error philosophy, visual identity, related documents
- **Decision**: Units promoted to design principle #1 (above "minimum clicks") because
  incorrect units in physics software is a showstopper. Auto-scaling output units
  (1.2 mm not 0.0012 m) is a firm UX requirement.
- **Decision**: Default program is `DEDX_ICRU` (libdedx auto-select), not PSTAR.
  The C library has built-in resolution logic that picks the best available dataset.
- **Issue**: None

### Update redesign plan
- **Status**: completed
- **Stage**: Stage 1
- **Files changed**:
  - `docs/00-redesign-plan.md` — added missing docs to §4 tree, added Stage 9
    (Legacy Code Removal), added commit hash placeholder to §11
- **Decision**: Old code removal is a separate stage (Stage 9), done after new app
  is verified working. Last commit hash to be recorded before removal.
- **Issue**: Commit hash needs to be filled in manually (spec-writer mode can't run git)

### Create AI session log
- **Status**: completed
- **Stage**: Stage 0
- **Files changed**:
  - `docs/ai-logs/2026-04-03-project-vision.md` — this file
  - `CHANGELOG-AI.md` — new entry added
