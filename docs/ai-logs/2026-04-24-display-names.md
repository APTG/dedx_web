# 2026-04-24 — Human-friendly particle & program display names

**Model:** (Claude Sonnet 4.6 via Copilot)

## Session Narrative

### Prompt 1: particle and program name improvements

User asked to improve the display of particles and programs to have a similar
human-readable form as materials received in the previous session. Specifically:
- Particle labels showed "Z=1 Hydrogen (H)" — user wanted the simpler "Hydrogen (H)".
- Program labels showed "PSTAR — 1.2" (raw version string) or "ICRU 49 — ICRU Report 49 D"
  (redundant: name and version both say "ICRU 49"). User wanted short, non-redundant
  descriptions like "PSTAR — protons (NIST)".
- All config data should live in small wrapper files next to the WASM layer.

**AI response:**

**Particle names** (`src/lib/config/particle-names.ts` — new):
- Added `formatParticleName(rawName)`: simple title-case (element names are single
  words, no underscore splitting needed).
- Added `PARTICLE_NAME_OVERRIDES` map: currently only id=1001 → "Electron" (the C API
  returns `""` for `dedx_get_ion_name(1001)`).
- Added `getParticleFriendlyName(id, rawName)` — override-first, falls back to formatter.
- Updated `libdedx.ts` to use `getParticleFriendlyName` instead of the inline
  `id === 1001 ? "Electron" : formatMaterialName(runtimeName)` one-liner.

**Program names** (`src/lib/config/program-names.ts` — updated):
- Added `PROGRAM_DESCRIPTIONS` map with short human-readable descriptions for all
  known programs (e.g., id=2 → "protons (NIST)", id=7 → "protons & α particles").
- Added `getProgramDescription(id)` exported function.
- Name overrides already covered in the previous session (ICRU73_OLD → "ICRU 73 (old)",
  DEFAULT → "Default (Bethe)", etc.) were retained unchanged.

**Combobox display** (`entity-selection-comboboxes.svelte` — updated):
- `getParticleLabel`: removed "Z=" prefix; now returns "Hydrogen (H)" format.
  Atomic number Z stays in `searchText` so users can still type "z=6" to find Carbon.
- Program items: label is now `${program.name} — ${desc}` where `desc` comes from
  `getProgramDescription()`. The raw `program.version` remains in `searchText` for
  backward compatibility but is no longer shown. Falls back to `program.name` alone
  for programs without a description entry.

**Tests** updated:
- `entity-selection-comboboxes.test.ts`: updated mock program id=7 from "ICRU49" to
  "ICRU 49" (to match what `getProgramFriendlyName` produces); updated assertions for
  the particle trigger text ("Z=1 Hydrogen (H)" → "Hydrogen (H)"), carbon item
  ("Z=6 Carbon" → "Carbon (C)"), and Auto-select resolved label ("ICRU49" → "ICRU 49").
- Added `src/tests/unit/particle-names.test.ts` (new, 12 tests).
- Added `src/tests/unit/program-names.test.ts` (new, 16 tests).

**Spec** (`docs/04-feature-specs/entity-selection.md`) updated:
- Particle display format: `Z=N Name (Symbol)` → `Name (Symbol)`; added note that Z
  stays as a search keyword only.
- Program display format example updated: "PSTAR — protons (NIST)", "ICRU 49 — protons
  & α particles".
- Search matching table: program now searches `name`, `description`, `version`.
- All wireframes updated: "Z=1 Proton (H)" → "Hydrogen (H)", "ICRU49" → "ICRU 49".
- Acceptance criteria updated accordingly.

## Tasks

### particle-names.ts config wrapper
- **Status**: completed
- **Stage**: Stage 5 (entity selection)
- **Files changed**: `src/lib/config/particle-names.ts` (new),
  `src/lib/wasm/libdedx.ts`, `src/tests/unit/particle-names.test.ts` (new)
- **Decision**: Single-word element names from C only need first-letter capitalisation
  (no underscore splitting). Override table reserved for the electron and potential
  future mass-specific ions (e.g., "CARBON12").

### PROGRAM_DESCRIPTIONS + program label overhaul
- **Status**: completed
- **Stage**: Stage 5 (entity selection)
- **Files changed**: `src/lib/config/program-names.ts`,
  `src/lib/components/entity-selection-comboboxes.svelte`,
  `src/tests/unit/entity-selection-comboboxes.test.ts`,
  `src/tests/unit/program-names.test.ts` (new)
- **Decision**: Descriptions are kept intentionally short (≤ 30 chars) so they fit
  on one line in the compact combobox. Raw version string is preserved in `searchText`
  so existing searches ("1.2", "2005/06") still work.

### Particle label format change
- **Status**: completed
- **Stage**: Stage 5 (entity selection)
- **Files changed**: `src/lib/components/entity-selection-comboboxes.svelte`,
  `docs/04-feature-specs/entity-selection.md`
- **Decision**: "Z=N" prefix removed from label; retained in `searchText` (Z, z=N, N)
  so users can still search by atomic number. Electron stays as "Electron" (consistent
  with the name in `PARTICLE_NAME_OVERRIDES`).
