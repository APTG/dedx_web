# 2026-04-27 — Unit Handling spec v4: KE conservation, TeV units, typo suggestions, particle group rename

## Session Narrative

### Prompt 1: Continue Copilot branch work — spec decisions on unit handling and particle naming

User asked to continue work started by GitHub Copilot on branch
`copilot/check-stage-5-implementations`. Three specific decisions provided:

1. **Particle group heading "Beams":** user dislikes the name for proton /
   alpha particle / electron. Asked for candidate names to choose from.
   Candidates presented: "Special particles", "Named projectiles",
   "Common particles", "Light particles". Decision pending user reply;
   entity-selection.md updated to v7 Draft with the open question recorded.

2. **KE conservation — MeV/nucl:** user confirmed Option B from the UX
   review pros/cons matrix: **MeV/nucl is the conserved quantity** when
   the user switches the selected particle. The previously "open question"
   in unit-handling.md §2 is now closed with a clear decision note and a
   rewritten conversion rule (5 steps → per-nucleon-first algorithm).
   The `test.fixme()` group in `tests/e2e/particle-unit-switching.spec.ts`
   should be un-skipped when implemented.

3. **TeV support:** user requested TeV, TeV/nucl, TeV/u in addition to the
   existing GeV/nucl and GeV/u. Added to the §3 supported-suffixes table
   (multiplier ×1e6 relative to MeV base).

4. **Typo suggestions:** user requested soft "did you mean X?" hints for
   common casing errors — `meV→MeV`, `MeV/Nucl→MeV/nucl`, etc. Added
   §3a to unit-handling.md specifying a case-fold-based TYPO_SUGGESTIONS
   map in `energy-parser.ts`, explicit error format, and rules for when
   to emit vs. omit a suggestion. No silent auto-correct.

**AI response**: spec-only session (no code changes); implementation
deferred to opencode as requested by user.

## Tasks

### Close KE conservation open question in unit-handling.md
- **Status**: completed
- **Stage**: 5 (unit handling)
- **Files changed**: `docs/04-feature-specs/unit-handling.md`
- **Decision**: MeV/nucl conserved on particle change (not typed number).
  Algorithm: compute E_nucl from current unit+A, then re-express in new
  particle's available unit.

### Add TeV, TeV/nucl, TeV/u to supported suffixes
- **Status**: completed
- **Stage**: 5
- **Files changed**: `docs/04-feature-specs/unit-handling.md`
- **Decision**: multiplier ×1e6 (1 TeV = 10⁶ MeV). Fits naturally into
  the existing SI-prefix table alongside GeV (×1e3).

### Add §3a Typo Suggestions spec
- **Status**: completed
- **Stage**: 5
- **Files changed**: `docs/04-feature-specs/unit-handling.md`
- **Decision**: case-fold lookup (suffix.toLowerCase() → canonical).
  Error format: `unknown unit: X — did you mean Y?`. Never silent.

### Resolve "Beams" → "Common particles" group heading
- **Status**: completed (spec closed; code change deferred to opencode)
- **Stage**: 5
- **Files changed**: `docs/04-feature-specs/entity-selection.md`
- **Decision**: project owner chose **"Common particles"** from the
  presented options. entity-selection.md updated to Final v7.
- **Code still needed** (for opencode):
  - `src/lib/components/entity-selection-comboboxes.svelte`: add
    `{ type: "section", label: "Common particles" }` before IDs 1, 2,
    1001, and `{ type: "section", label: "Ions" }` before IDs 3..118.
  - `src/lib/config/particle-names.ts`: add overrides
    `1 → "proton"`, `2 → "alpha particle"`, `1001 → "electron"` (all
    lowercase) and update `getParticleLabel` to omit the `(symbol)` for
    these three IDs.
  - Tests in `entity-selection-comboboxes.test.ts` to assert correct
    group heading names.
