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
session log and updated CHANGELOG-AI.md.

### Prompt 9: Commit hash for legacy code reference
**User** provided `git log master --oneline -1` output: `0330233`.

**AI response**: Recorded commit hash `0330233` in redesign plan §11.

### Prompt 10: Auto-select refinement and context-aware units
**User** clarified: auto-select should not always show DEDX_ICRU — it should adapt
per ion/material. Also: MeV/nucl should not appear for protons (A=1, it's redundant);
MeV/u is advanced-mode only.

**AI response**: Updated vision §4.1 (context-aware unit selector: A=1 → MeV only,
A>1 → MeV + MeV/nucl, MeV/u advanced). Updated §4.3 (program auto-selection is a
webdedx-level layer on top of libdedx DEDX_ICRU, configurable, always adapts).

### Prompt 11: Cross-check, update logs, merge
**User** asked to cross-check all docs for consistency, update AI logs, merge.

**AI response**: Found and fixed 4 inconsistencies:
1. Vision §3.1/§3.2 hardcoded "(DEDX_ICRU)" in default state → removed
2. Redesign plan §10 referenced stale `redesign/planning` branch → made generic
3. Redesign plan §10 had duplicate step "5" → renumbered
4. Vision §11 linked to non-existent `09-non-functional-requirements.md` → marked "(planned)"
Updated this session log with prompts 9–11.

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
- **Decision**: Default program uses adaptive auto-selection (webdedx layer on top
  of libdedx DEDX_ICRU), not a fixed program. Adapts per ion/material combination.
- **Issue**: None

### Update redesign plan
- **Status**: completed
- **Stage**: Stage 1
- **Files changed**:
  - `docs/00-redesign-plan.md` — added missing docs to §4 tree, added Stage 9
    (Legacy Code Removal), recorded commit hash `0330233` in §11, fixed §10
    (stale branch ref, duplicate step number)
- **Decision**: Old code removal is a separate stage (Stage 9), done after new app
  is verified working. Last commit hash recorded: `0330233`.
- **Issue**: None

### Cross-check and consistency fixes
- **Status**: completed
- **Stage**: Stage 1
- **Files changed**:
  - `docs/01-project-vision.md` — removed hardcoded DEDX_ICRU from §3.1/§3.2 defaults,
    marked §11 NFR link as "(planned)"
  - `docs/00-redesign-plan.md` — fixed §10 stale branch reference and step numbering

### Create AI session log
- **Status**: completed
- **Stage**: Stage 0
- **Files changed**:
  - `docs/ai-logs/2026-04-03-project-vision.md` — this file
  - `CHANGELOG-AI.md` — new entry added
