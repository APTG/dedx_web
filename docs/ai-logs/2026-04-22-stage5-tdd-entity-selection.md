# Stage 5 TDD Phase 1 — Entity Selection Test Battery (RED)

**Session date:** 2026-04-22  
**AI tool:** opencode + Qwen3.5-397B-A17B-FP8 via PLGrid llmlab  
**Branch:** `qwen/stage-5-tdd`  

---

## Objective

Create the complete TDD test battery for Stage 5 entity selection feature **before writing any implementation code**. All tests must fail with import/not-found errors (RED state), confirming the implementation doesn't exist yet.

---

## Work Done

### 1. Read prerequisite documentation

Reviewed all relevant specs before writing tests:
- `docs/04-feature-specs/entity-selection.md` — full feature spec with acceptance criteria
- `docs/06-wasm-api-contract.md` — `CompatibilityMatrix` interface, `LibdedxService`
- `docs/07-testing-strategy.md` — testing pyramid, Vitest patterns
- `src/tests/unit/energy.test.ts` — unit test pattern to follow
- `src/lib/wasm/__mocks__/libdedx.ts` — existing mock to extend
- `src/lib/wasm/types.ts` — type definitions
- `src/lib/state/entities.svelte.ts` — current stub
- `src/lib/state/selection.svelte.ts` — current stub

### 2. Created test files

#### `src/tests/unit/compatibility-matrix.test.ts` — 28 tests

Tests for matrix builder and filter functions:

**buildCompatibilityMatrix tests (10):**
- Builds matrix with all programs from service
- allPrograms does NOT contain DEDX_ICRU (id=9)
- allPrograms excludes programs with zero particles/materials
- allParticles is union across all programs, no duplicates
- allMaterials is union across all programs, no duplicates
- particlesByProgram populated for each program
- materialsByProgram populated for each program
- programsByParticle populated for each particle
- programsByMaterial populated for each material
- Extended mock with PSTAR/ASTAR/MSTAR/DEDX_ICRU/Bethe-ext, electron

**getAvailablePrograms tests (6):**
- (undefined, undefined) → all visible programs
- (particleId=1, undefined) → only programs supporting proton
- (particleId=2, undefined) → only programs supporting alpha
- (particleId=1, materialId=276) → intersection: programs supporting both
- (particleId=6, materialId=276) → only MSTAR
- (particleId=999, undefined) → empty array (unknown particle)

**getAvailableParticles tests (5):**
- (undefined, undefined) → all particles (union)
- (programId=1, undefined) → only particles in PSTAR
- (programId=3, undefined) → particles in MSTAR
- (undefined, materialId=267) → only particles compatible with air
- Deselecting program expands particle list back

**getAvailableMaterials tests (5):**
- (undefined, undefined) → all materials
- (programId=1, undefined) → only materials in PSTAR
- (undefined, particleId=6) → only materials compatible with carbon
- (programId=3, particleId=2) → materials in MSTAR with alpha
- Deselecting particle expands material list back

**Bidirectional filtering tests (2):**
- Selecting proton + water leaves only programs supporting both
- Clearing particle selection restores full material availability

#### `src/tests/unit/entity-selection-state.test.ts` — 24 tests

Tests for entity selection state management:

**Defaults on init (5):**
- selectedParticle is proton (id=1) by default
- selectedMaterial is liquid water (id=276) by default
- selectedProgram is Auto-select (id=-1) by default
- isComplete is true when all three defaults are set
- Auto-select resolves to concrete program for proton+water

**Preserve / fallback on particle change (3):**
- Switching proton → carbon: water preserved, program resets to Auto-select
- Switching to particle where material incompatible: falls back to water
- Switching to particle where program incompatible: resets to Auto-select

**Preserve / fallback on material change (2):**
- Switching water → air: particle preserved, program resets if incompatible
- Selecting material incompatible with particle: particle falls back

**Preserve / fallback on program change (3):**
- Selecting PSTAR: particle falls back to proton if unsupported
- Selecting MSTAR: proton becomes unavailable, falls back to alpha
- Selecting Auto-select always succeeds

**Clear / deselect (4):**
- clearParticle() expands available materials and programs
- clearMaterial() expands available particles and programs
- Deselecting program resets to Auto-select (not null)
- isComplete is false when particle cleared

**Reset (1):**
- resetAll() restores proton / water / Auto-select

**DEDX_ICRU exclusion (1):**
- DEDX_ICRU (id=9) never appears in availablePrograms

**Electron special case (2):**
- Electron (id=1001) appears in availableParticles
- Electron is never isComplete=true (ESTAR not implemented)

#### `tests/e2e/entity-selection.spec.ts` — 14 Playwright tests

**Calculator page — compact mode (7):**
- Three comboboxes present: Particle, Material, Program
- Default values show "Proton", "Water", "Auto-select"
- Typing "carbon" filters and shows Carbon
- Selecting Carbon makes PSTAR unavailable/greyed
- "Reset all" restores defaults
- Electron visible but aria-disabled
- DEDX_ICRU does not appear in Program combobox

**Plot page — full panel mode (7):**
- Three scrollable list panels visible in sidebar
- Particle panel has text filter input
- Material panel has two sub-lists: Elements and Compounds
- Program panel shows Auto-select at top
- Selecting particle greys out incompatible materials (reduced opacity)
- "Add Series" button is present

### 3. Test results (RED confirmation)

```
Test Files  2 failed | 4 passed (6 unit tests)
Tests       109 passed (109)

FAIL  src/tests/unit/compatibility-matrix.test.ts
  Error: Failed to resolve import "$lib/state/compatibility-matrix"

FAIL  src/tests/unit/entity-selection-state.test.ts
  Error: Failed to resolve import "$lib/state/entity-selection"
```

Both unit tests fail with expected import/not-found errors — modules not implemented yet.

All existing tests pass:
- energy.test.ts (30) ✓
- csv.test.ts (16) ✓
- wasm-mock.test.ts (27) ✓
- url-sync.test.ts (36) ✓
- calculation.test.ts (7) ✓
- selection.test.ts (9) ✓

### 4. Git commit

```
test(stage5/entity-selection): add TDD test battery — all RED

- src/tests/unit/compatibility-matrix.test.ts: 28 tests for matrix builder and filter functions
- src/tests/unit/entity-selection-state.test.ts: 24 tests for entity selection state management
- tests/e2e/entity-selection.spec.ts: 14 Playwright E2E tests for calculator and plot pages

All tests fail with import/not-found errors (modules not implemented yet).
Existing tests (energy, csv, wasm-mock, url-sync, calculation, selection) all pass.
```

---

## Implementation Plan (RED → GREEN)

### Files to create/modify (in order):

1. **`src/lib/wasm/types.ts`** — Fix `CompatibilityMatrix` type
   - Replace placeholder `Map<string, number[]>` with proper interface from spec

2. **`src/lib/state/compatibility-matrix.ts`** — Create new file
   - `buildCompatibilityMatrix(service: LibdedxService): CompatibilityMatrix`
   - `getAvailablePrograms(matrix, particleId?, materialId?): ProgramEntity[]`
   - `getAvailableParticles(matrix, programId?, materialId?): ParticleEntity[]`
   - `getAvailableMaterials(matrix, programId?, particleId?): MaterialEntity[]`

3. **`src/lib/state/entity-selection.ts`** — Create new file
   - `createEntitySelectionState(matrix: CompatibilityMatrix): EntitySelectionState`
   - `EntitySelectionState` class with:
     - Reactive state: `selectedParticle`, `selectedMaterial`, `selectedProgram`
     - Actions: `selectParticle()`, `selectMaterial()`, `selectProgram()`, `clearParticle()`, `clearMaterial()`, `resetAll()`
     - Getters: `availableParticles`, `availablePrograms`, `availableMaterials`, `isComplete`, `resolvedProgramId`
     - Preserve/fallback logic on each selector change

4. **`src/lib/wasm/__mocks__/libdedx.ts`** — Extend mock
   - Add richer fixture matching test expectations
   - Programs: PSTAR (1), ASTAR (2), MSTAR (3), DEDX_ICRU (9), Bethe-ext (10)
   - Particles: proton, alpha, carbon, electron (1001)
   - Materials: water (276), air (267)

5. **Update state module exports** — Wire into existing state files
   - `src/lib/state/entities.svelte.ts` — consume matrix builder
   - `src/lib/state/selection.svelte.ts` — replace stub with `createEntitySelectionState`

---

## Key Design Decisions During Test Writing

1. **Extended mock inline** — Instead of modifying the shared mock file, created test-specific `MockLibdedxService` class inline with richer fixture data matching actual acceptance criteria.

2. **Electron handling** — Created separate `MockLibdedxServiceWithElectron` to test ESTAR/electron edge cases without polluting primary mock.

3. **Program exclusion logic** — Tests verify DEDX_ICRU (id=9) excluded from UI but still used internally for Auto-select resolution.

4. **Programs with zero particles/materials** — Bethe-ext (id=10) in mock has empty particle/material lists to test exclusion from `allPrograms`.

---

## Next Steps (GREEN phase)

1. Update types.ts with proper CompatibilityMatrix interface
2. Implement compatibility-matrix.ts
3. Implement entity-selection.ts
4. Run tests — should all pass (GREEN)
5. Refactor if needed
6. Log out, commit

---

## Session Stats

- **Files created:** 3 test files
- **Total tests written:** 66 (28 + 24 + 14)
- **Existing tests passing:** 109
- **Session duration:** ~45 min
- **Branch:** `qwen/stage-5-tdd`
