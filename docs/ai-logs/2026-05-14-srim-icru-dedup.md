# 2026-05-14 — SRIM ICRU material deduplication

## Session Narrative

### Prompt 1: Diagnose SRIM–libdedx material mismatch and fix converter

User asked to investigate why SRIM materials don't appear in the Calculator
program selector when using a URL like
`?extdata=srim:https://...srim-gui.webdedx/&particle=1&material=276`.
They also asked to check the Copilot comment about "Plot series not yet
supported" and whether there was something to implement.

**AI response**: Launched three parallel Explore agents covering:
1. SRIM converter script and the current `data/srim-gui.webdedx/zarr.json`.
2. Frontend external data loading, program selector, and plot page state.
3. Built-in material name definitions (libdedx C table, TypeScript overrides).

Root cause found: `assign_material_ids` used a uniqueness gate
`if icru_counts[icru_id] == 1` before assigning `icruId`. Because the SRIM
websrim Arrow export contains multiple source files that each include the same
standard material, 26 ICRU compound IDs appeared more than once. Water
(ICRU-276) appeared 5 times — so `icru_counts[276] = 5 > 1` → none of the
five entries got `icruId: 276`. Result: 56 materials with "(ICRU-NNN)" in
their names had no `icruId` in the store; the app fell back to fragile fuzzy
name matching.

Additional finding: 3 ICRU IDs appeared with genuinely different densities
(Mylar/ICRU-222, Lucite/ICRU-223, Glycerol/ICRU-469). These must not be
deduplicated — both entries should be kept but without `icruId` (they should
remain as external-only materials, not merge with the built-in list). User
explicitly confirmed this approach and asked for the density to be appended to
the material name so the user can distinguish them in the selector.

Plan was written, iterated twice on user feedback (add density check, adjust
density-variant handling), then approved.

**Decision — deduplication tolerance**: Use `round(density, 3)` for grouping.
Entries within 0.001 g/cm³ are treated as the same material (deduplication);
entries differing by ≥0.001 are distinct formulations (variant treatment).

**Decision — variant name format**: Append " (1.397 g/cm³)" as a suffix,
keeping the original "(ICRU-NNN)" in the name for human readability. Remove
`icruId` so the app does not attempt to merge them with a built-in material.

### Prompt 2: Add AI session log

User asked to log the session.

## Tasks

### Fix SRIM converter: ICRU material deduplication

- **Status**: completed
- **Branch**: `feat/srim-icru-dedup`
- **Files changed**:
  - `scripts/srim_reference_to_webdedx.py`
  - `scripts/srim-reference-requirements.txt`
  - `scripts/tests/__init__.py` (new)
  - `scripts/tests/conftest.py` (new)
  - `scripts/tests/test_srim_reference_to_webdedx.py` (new)

**Changes in `srim_reference_to_webdedx.py`**:

1. `assign_material_ids`: Removed the `icru_counts` Counter and the
   `if icru_counts[icru_id] == 1` guard. All compounds with "(ICRU-NNN)" in
   their names now get `icruId` unconditionally.

2. New `resolve_icru_duplicates(materials)`: Groups materials by `icruId`
   after `assign_material_ids` has run (materials are mutated in-place):
   - Same density (rounded to 3 dp): marks all-but-first for exclusion.
   - Different densities: removes `icruId` from ALL entries, appends
     " ({density:.3f} g/cm³)" to each name.
   Returns the set of `sourceKey` strings to exclude.

3. `SourceInfo` dataclass: Added `duplicate_material_keys: set[str]` field.

4. `collect_source_info`: Calls `resolve_icru_duplicates` after
   `assign_material_ids`; passes `duplicate_material_keys` to `SourceInfo`.

5. `kept_materials`: Changed exclusion set to
   `incomplete_material_keys | duplicate_material_keys`.

6. `source_summary`: Added `duplicateMaterialCount` key.

7. `write_source_inspection` (CSV): Added `isDuplicate` column.

8. `write_webdedx_store` srimConversion metadata: Added
   `droppedDuplicateMaterialCount`.

9. `write_webdedx_store` conversion summary: Added
   `droppedDuplicateMaterials` count.

**Tests** (20 passing, `scripts/tests/test_srim_reference_to_webdedx.py`):
- `TestAssignMaterialIds` (7 tests): verifies `icruId` always assigned, no
  uniqueness gate, elements unchanged, unique IDs generated, ICRU-099 parsed.
- `TestResolveIcruDuplicates` (9 tests): same-density dedup keeps first;
  different-density variant removes `icruId`, appends density to name;
  density rounding tolerance at 0.001 boundary; independent groups handled
  separately; elements not affected.
- `TestFullPipeline` (4 tests): five water copies → 1 with `icruId: 276`;
  Glycerol density variants → 2 entries without `icruId`; non-ICRU pass-through.

### Regenerate data/srim-gui.webdedx

- **Status**: completed (store regenerated locally; gitignored per `.gitignore`)
- **Decision**: store lives under `data/` which is gitignored (`/data/*.webdedx/`);
  user will upload the regenerated store to S3.

**Verified output**:
- Water: exactly 1 entry with `icruId: 276` ✓
- Materials with `icruId`: 144 (up from 121)
  - Previous 26 duplicate ICRU groups → 23 resolved (same density), 3 are
    density variants (Mylar, Lucite, Glycerol) → those 6 entries lose `icruId`
  - Net: 147 − 3 density-variant groups = 144 ICRU-tagged materials
- Density-tagged entries: 6 (Mylar×2, Lucite×2, Glycerol×2), no `icruId`
- 38 duplicate materials dropped from output (same density, same ICRU ID)
- Conversion summary: `shape: [92, 354, 165]`,
  `droppedDuplicateMaterials: 38`, `droppedIncompleteMaterials: 68`

### Issue: Part 4 (plot series for external programs) pending S3 upload

The plan's Part 4 — enabling plot series for external programs — is deferred
until the user uploads the regenerated store to S3 and confirms the calculator
URL works with `?material=276` selecting SRIM. Plot changes:
- `entity-selection-panels.svelte`: `available: false` → `available: true`
- `plot/+page.svelte`: wire external triplets to `ExternalDataService.getStp()`
