# 2026-04-07 — Unified Table Redesign & Output Unit Defaults

## Session Narrative

### Prompt 1: Major UX changes to output units, input behavior, and number formatting
**AI response**: User requested sweeping changes to the calculator UX. Agent asked
12 clarifying questions (Q1–Q12) covering: default stopping power unit (keV/µm for
non-gas, MeV·cm²/g for gas), CSDA range in length units, per-row independent SI
prefix auto-scaling, unified input/result table design, per-row unit detection,
master vs per-row mode, unrecognized suffix handling, URL encoding for mixed units,
material phase notification, and "Reset to single unit" advanced feature.

### Prompt 2: Writing the spec updates
**AI response**: After all Q&A completed and all relevant files read, the agent
rewrote two major spec files:

1. **unit-handling.md v1 → v2**: Rewrote §3 (per-row unit detection replaces
   master-level auto-switch), filled §5 (output unit handling — keV/µm default
   for non-gas, MeV·cm²/g for gas, CSDA range in auto-scaled length), filled §6
   (SI prefix auto-scaling rules), added §7 ("Reset to single unit" advanced
   feature), added master vs per-row mode logic to §2, expanded acceptance criteria
   for all new behavior. Resolved open questions Q2 and Q3.

2. **calculator.md v4 → v5**: Replaced textarea + separate result table with unified
   input/result table (5 columns: Typed Value, → MeV/nucl, Unit dropdown, Stopping
   Power, CSDA Range). Updated page layout overview (2 sections instead of 3).
   Added material phase badge to entity selection. Updated energy unit selector for
   master/per-row mode. Changed per-line validation to per-row validation with inline
   error indicators. Updated number formatting (SI prefixes for output, no scientific
   notation). Rewrote all 3 wireframes (desktop with master and per-row mode examples,
   tablet, mobile). Updated URL state encoding for mixed units (`value:unit` syntax).
   Rewrote state management types (`EnergyRow` replaces `ParsedEnergyLine`, added
   `perRowUnitsActive`, `stpDisplayUnit`, `materialDensity`, `materialIsGas`).
   Updated reactivity chain. Comprehensive acceptance criteria rewrite. Updated
   dependencies and open questions.

## Tasks

### Rewrite unit-handling.md to v2
- **Status**: completed
- **Stage**: 1 (Feature Specs)
- **Files changed**: docs/04-feature-specs/unit-handling.md
- **Decision**: Per-row unit detection instead of master-level auto-switch.
  Unrecognized suffix = invalid line (not ignored). Per-row mode activates
  only when mixed units detected. "Reset to single unit" is an advanced
  feature, not a confirmation dialog.
- **Issue**: None

### Rewrite calculator.md to v5
- **Status**: completed
- **Stage**: 1 (Feature Specs)
- **Files changed**: docs/04-feature-specs/calculator.md
- **Decision**: Unified input/result table replaces textarea + separate result
  table. Always-empty-row-at-bottom for input (may change after prototype).
  5-column table with horizontal scroll on mobile. Mixed-unit URL encoding
  uses `value:unit` colon syntax.
- **Issue**: Mobile UX with 5 columns needs real-device testing.

### Update CHANGELOG-AI.md
- **Status**: completed
- **Stage**: 1
- **Files changed**: CHANGELOG-AI.md
