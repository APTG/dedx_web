# 2026-04-23 — Human-friendly material names

**Model:** (Claude Sonnet 4.6 via Copilot)

## Session Narrative

### Prompt 1: Improve printing of material names. Adjust spec if needed.

**User context:** Water was displayed as "276 WATER" in the material combobox. The user wanted "Water (liquid)" — no numeric ID, no ALL-CAPS, with a descriptive qualifier for disambiguation. They also noted that human-friendly names not present in libdedx should be added via a C wrapper for future inclusion.

Additionally: verify the spec reflects the current 3-in-a-row compact layout, and check for missing spec parts.

**AI response:**

Investigated root causes by reading `dedx_program_const.h` (the C material name table), `libdedx.ts` (the TypeScript WASM wrapper), `entity-selection-comboboxes.svelte`, and the entity-selection spec (v6 Final).

**Root cause 1 — ALL-CAPS names:** `dedx_get_material_name()` returns ALL-CAPS strings (e.g., "WATER", "CARBONDIOXIDE"). The WASM API contract (§10.1) already documented that title-case must be applied by the TypeScript wrapper, but `libdedx.ts` stored raw names without any formatting.

**Root cause 2 — ID prefix in label:** `entity-selection-comboboxes.svelte` built labels as `` `${material.id}  ${material.name}` ``, producing "276 WATER". The spec's compact-mode wireframe already showed "Water (liquid)" without an ID, but the display-format table said "ID  Name". The user explicitly requested name-only display.

**Root cause 3 — Missing qualifier:** Simple title-case converts "WATER" → "Water" but not "Water (liquid)". Disambiguation between water and water vapor requires an override table. This was also the case for ~80 run-on compound names (e.g., "CARBONDIOXIDE" → "Carbon Dioxide") and ICRP/ICRU suffixed tissue names (e.g., "BLOOD_ICRP" → "Blood (ICRP)").

**Spec also confirms 3-in-a-row:** The implementation uses `lg:grid-cols-3` (all three selectors in one row). The spec's compact-mode desktop section described a 2-row layout (Particle+Material / Program+Energy). Updated spec to match the implementation.

**Actions taken:**

1. **Updated `docs/04-feature-specs/entity-selection.md`** — changed Material Display format from "ID  Name" to "Name only"; updated compact desktop wireframe to 3-column single row; updated full-panel wireframes to remove ID from example list items; clarified that ID is still a search keyword.

2. **Updated `docs/06-wasm-api-contract.md`** — added `dedx_get_material_friendly_name()` to §4.5 and §11.1; updated §10.1 to describe the new formatting strategy (override table + title-case fallback).

3. **Added C wrapper** — `wasm/dedx_extra.h` / `wasm/dedx_extra.c`: declared and implemented `dedx_get_material_friendly_name(int material)` with a comprehensive switch-table covering all ~80 compound materials that need special names. Falls back to `dedx_get_material_name()` for unmapped IDs. Intended for future inclusion in libdedx.

4. **Created `src/lib/config/material-names.ts`** — JS-side mirror of the C override table:
   - `formatMaterialName(rawName)`: title-case + underscore-to-space for elements and simple compounds
   - `MATERIAL_NAME_OVERRIDES`: `Map<number, string>` with ~80 compound overrides (matches C table exactly)
   - `getMaterialFriendlyName(id, rawName)`: override lookup + fallback to formatter

5. **Updated `src/lib/wasm/libdedx.ts`** — materials now use `getMaterialFriendlyName(id, rawName)` instead of raw C name. Particle names now use `formatMaterialName(runtimeName)` (title-case); electron (ID 1001) still hard-coded as "Electron" since C returns "".

6. **Updated `src/lib/components/entity-selection-comboboxes.svelte`** — material `label` is now `material.name` (no ID prefix); `searchText` still includes the numeric ID so users can type "276" to find Water.

7. **Wrote `src/tests/unit/material-names.test.ts`** — 22 tests covering `formatMaterialName`, `MATERIAL_NAME_OVERRIDES`, and `getMaterialFriendlyName` including edge cases (empty string, unknown ID fallback, ICRP/ICRU tissue entries, no raw ALL-CAPS in overrides).

8. **Updated `src/tests/unit/entity-selection-comboboxes.test.ts`** — removed assertion that material combobox shows "276"; added `not.toHaveTextContent("276")` assertion.

All 197 tests pass.

## Tasks

### Improve material name display

- **Status**: completed
- **Stage**: 5
- **Files changed**:
  - `docs/04-feature-specs/entity-selection.md` (spec update: display format, compact wireframe, search description)
  - `docs/06-wasm-api-contract.md` (document new C wrapper in §4.5, §10.1, §11.1)
  - `wasm/dedx_extra.h` (declare `dedx_get_material_friendly_name`)
  - `wasm/dedx_extra.c` (implement with ~80-entry override table + fallback)
  - `src/lib/config/material-names.ts` (new — JS-side formatter + override table + helper)
  - `src/lib/wasm/libdedx.ts` (apply friendly name to materials; title-case to particles)
  - `src/lib/components/entity-selection-comboboxes.svelte` (name-only label, ID kept in searchText)
  - `src/tests/unit/material-names.test.ts` (new — 22 tests, RED/GREEN cycle)
  - `src/tests/unit/entity-selection-comboboxes.test.ts` (updated assertion)
- **Decision**: Used a JS-side override table (mirrors C wrapper) rather than waiting for a WASM rebuild. The C wrapper in `dedx_extra.c` provides the canonical source of truth and is ready for the next WASM build. The JS table is kept in sync manually via comments. ID removed from display labels; retained in `searchText` only.
- **Issue**: The C wrapper is not yet in the live WASM binary (requires rebuild). Until rebuild, the TypeScript formatter handles all name formatting. The C and JS override tables must be kept in sync manually.
