# opencode task prompt — 2026-04-28 — Stage 6: Calculator (basic)

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation. Work through tasks **in order**.
> After each task: run `pnpm lint && pnpm test` — if green, commit with the
> specified Conventional Commit message, then **stop so the user can run
> `/compact`** before the next task.
> **MCPs available:** `playwright` (run / inspect E2E tests), `tailwind`
> (Tailwind v4 class lookup), `svelte` (call `svelte-autofixer` on every
> `.svelte` file you modify).
> **TDD rule:** Write the failing test(s) first, then the minimal
> implementation to make them pass. No implementation without a test.
> Exception: pure Svelte template layout changes (no state/logic) may skip
> unit tests, but at least one E2E smoke test must cover the new markup.
> **shadcn-svelte rule:** Always prefer shadcn-svelte components (Button,
> Badge, Skeleton, Separator, …) over hand-rolled HTML when a match exists.
> Check `vendor/shadcn-svelte/packages/registry/` for available components.

---

## Context

**Branch:** `qwen/stage-6-calculator`
Create from `master` before starting. Naming per `docs/00-redesign-plan.md §4.2`.

Read at session start (in order):
1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging
2. `docs/00-redesign-plan.md` — Stage 6 status and multi-tool workflow
3. `docs/04-feature-specs/calculator.md` (Final v8) — the Calculator spec;
   this session's primary source of truth
4. `docs/04-feature-specs/shareable-urls.md` — canonical URL param contract
   (needed for Task 6)
5. `docs/ux-reviews/2026-04-28-stage5-completion-and-stage6-readiness.md` —
   the open issues D1–D11, M1, and cleanup items C1–C3, C7, I1–I5 that
   drive this session

Key source files:
- Layout: `src/routes/+layout.svelte`
- Calculator page: `src/routes/calculator/+page.svelte`
- Calculator state: `src/lib/state/calculator.svelte.ts`
- Entity selection state: `src/lib/state/entity-selection.svelte.ts`
- Energy input state: `src/lib/state/energy-input.svelte.ts` ← rename target
- Dead URL sync module: `src/lib/state/url-sync.ts` ← delete target
- Entity comboboxes component: `src/lib/components/entity-selection-comboboxes.svelte`
- Result table component: `src/lib/components/result-table.svelte`
- Plot URL (reference implementation for URL sync): `src/lib/utils/plot-url.ts`
- Energy parser: `src/lib/utils/energy-parser.ts`
- Energy conversions: `src/lib/utils/energy-conversions.ts`
- Unit conversions: `src/lib/utils/unit-conversions.ts`
- WASM types (LibdedxService interface): `src/lib/wasm/types.ts`
- UI state (wasmReady, wasmError, isAdvancedMode): `src/lib/state/ui.svelte.ts`

Test files:
- `src/tests/unit/url-sync.test.ts` ← delete target
- `src/tests/unit/energy-input-format.test.ts` ← delete target (after folding)
- `src/tests/unit/unit-conversions.test.ts` ← receives folded tests
- `src/tests/unit/energy-input-state.test.ts` ← needs import path update after rename
- `src/tests/unit/calculator-state.test.ts`
- `src/tests/unit/energy-conversions.test.ts`
- `tests/e2e/calculator.spec.ts` ← reference for E2E patterns
- `tests/e2e/layout.spec.ts` ← reference for layout E2E

Vendor library reference docs (available offline, no web access needed):
- shadcn-svelte component registry: `vendor/shadcn-svelte/packages/registry/`
- Bits UI headless primitives: `vendor/bits-ui/packages/bits-ui/src/lib/bits/`
- Svelte 5 runes docs: `vendor/svelte/documentation/docs/02-runes/`

Run tests:
```sh
pnpm test                        # Vitest unit + integration tests (uses WASM mock)
pnpm exec playwright test        # E2E tests (needs static/wasm/ — see AGENTS.md)
pnpm lint                        # ESLint + Prettier check
pnpm build                       # Full production build gate
```

---

## AI Logging (MANDATORY)

At session start, create `docs/ai-logs/2026-04-28-stage6-calculator-basic.md`
using the session narrative template from `.github/copilot-instructions.md`.

After **each task** that changes code:
1. Add or update a row in `CHANGELOG-AI.md` (prepend to top of table body).
2. Add a `### Prompt N` section to the session log with what was done.
3. Ensure `docs/ai-logs/README.md` has a one-line pointer to the new log file.

Attribution line in every row: `(Qwen3.5-397B-A17B-FP8 via opencode)`

---

## Task 0 — Fix WASM calculation bug: STP and CSDA range always return 0

**Priority:** CRITICAL — fix this before anything else. The deployed app at
`aptg.github.io/web_dev/calculator` shows Stopping Power = 0 and CSDA Range
= "0 nm" for every input. Root cause: three bugs in `calculate()` inside
`src/lib/wasm/libdedx.ts`. This task diagnoses, tests, and fixes all three.

### Background — why the outputs are zero

Read `libdedx/include/dedx_wrappers.h` for the authoritative C signatures:

```c
// STP: 6 args, float arrays for both energies and stps
int dedx_get_stp_table(
    const int program, const int ion, const int target,
    const int no_of_points, const float *energies, float *stps);

// CSDA: 6 args, float* energies input, double* csda_ranges output
int dedx_get_csda_range_table(
    const int program, const int ion, const int target,
    const int no_of_points, const float *energies, double *csda_ranges);
```

The current TypeScript `calculate()` method has **three bugs**:

1. **Float/double mismatch** — energies and STP buffers are allocated with
   `_malloc(n * 8)` and written via `HEAPF64` (8-byte doubles), but the C
   functions read them as `float` (4-byte). For a double like `100.0`, the
   lower 4 bytes are all-zero, so C sees `0.0f` → output is always 0.

2. **Swapped parameters 3 and 4** — the call is
   `_dedx_get_stp_table(programId, particleId, materialId, energiesPtr, numEnergies, stpPtr, csdaPtr)`,
   but the C function expects `(program, ion, target, no_of_points, energies*, stps*)`.
   `energiesPtr` (a large heap address like 1 048 576) lands in the
   `no_of_points` slot, `numEnergies` (e.g., 1) lands in the `energies*` slot
   — so C iterates 1 000 000+ times over near-zero memory addresses, computing
   STP at energy ≈ 0.

3. **CSDA not computed at all** — `_dedx_get_stp_table` does NOT fill a
   CSDA buffer; the 7th argument `csdaPtr` is silently ignored by C. A
   separate call to `_dedx_get_csda_range_table` is required but missing.

### Step 0a — tests first: integration test with real WASM

The WASM mock used by Vitest (`src/lib/wasm/__mocks__/`) does not exercise
real C code. For this task write an **integration test** that loads the actual
WASM binary. Check whether `tests/integration/` or `src/tests/integration/`
already exists; if not, create `src/tests/integration/wasm-calculate.test.ts`.

**Important:** look at `wasm/verify.mjs` for the expected numeric values:
PSTAR (program 2), proton (particle 1), Water liquid (material 276), energy
100 MeV/nucl → mass STP ≈ 7.3 MeV·cm²/g (within 10%), CSDA ≈ 7.718 cm
(within 10%). These are NIST PSTAR reference values.

```typescript
// src/tests/integration/wasm-calculate.test.ts
// Runs only when static/wasm/libdedx.mjs exists (skipped in standard CI).
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import path from "path";

const wasmMjs = path.resolve("static/wasm/libdedx.mjs");
const skipIfNoWasm = existsSync(wasmMjs) ? describe : describe.skip;

skipIfNoWasm("LibdedxServiceImpl.calculate() — real WASM", () => {
  let service: import("$lib/wasm/libdedx").LibdedxServiceImpl;

  beforeAll(async () => {
    const { LibdedxServiceImpl } = await import("$lib/wasm/libdedx");
    // Load the real Emscripten module. The mjs file exports a default factory.
    const factory = (await import(/* @vite-ignore */ wasmMjs)).default;
    const module = await factory();
    service = new LibdedxServiceImpl(module);
    await service.init();
  });

  it("returns non-zero stopping power for 100 MeV proton in water (PSTAR)", () => {
    // PSTAR = program 2, proton = particle 1, Water liquid = material 276
    const result = service.calculate(2, 1, 276, [100]);
    expect(result.stoppingPowers[0]).toBeGreaterThan(0);
    // NIST PSTAR reference: ~7.3 MeV·cm²/g ± 10%
    expect(result.stoppingPowers[0]).toBeCloseTo(7.3, 0);
  });

  it("returns non-zero CSDA range for 100 MeV proton in water (PSTAR)", () => {
    const result = service.calculate(2, 1, 276, [100]);
    expect(result.csdaRanges[0]).toBeGreaterThan(0);
    // NIST PSTAR reference: ~7.718 cm ± 10%
    expect(result.csdaRanges[0]).toBeCloseTo(7.718, 0);
  });

  it("returns the correct number of results for multiple energies", () => {
    const result = service.calculate(2, 1, 276, [1, 10, 100]);
    expect(result.stoppingPowers).toHaveLength(3);
    expect(result.csdaRanges).toHaveLength(3);
    result.stoppingPowers.forEach((v) => expect(v).toBeGreaterThan(0));
    result.csdaRanges.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});
```

These tests will be **skipped** in standard CI (no WASM binary) and **pass**
locally once the fix is applied. Do not add a `vitest.config` override — the
`describe.skip` guard is sufficient.

### Step 0b — E2E test: verify non-zero results in the browser

Add a test block to `tests/e2e/calculator.spec.ts`:

```typescript
test.describe("WASM calculation produces real values", () => {
  test("100 MeV proton in Water (PSTAR) shows non-zero STP and range", async ({
    page,
  }) => {
    await page.goto("/calculator");
    // Wait for WASM to load and the calculator to become ready
    await page.waitForSelector('[data-testid="result-table"]', { timeout: 10000 });

    // Select PSTAR (program 2), proton, Water liquid — use the comboboxes
    // (the exact aria labels are in entity-selection-comboboxes.svelte)
    // If entity selection is not yet wired in E2E, at minimum type an energy
    // and verify the result cell is NOT "0" or "0 nm".

    // Type 100 MeV in the first energy row input
    const energyInput = page.locator('[data-testid="energy-input-0"]');
    await energyInput.fill("100 MeV");
    await energyInput.blur();

    // Wait for calculation (debounced 300 ms + WASM time)
    await page.waitForTimeout(600);

    // The stopping power cell must not be "0" or empty
    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    const stpText = await stpCell.textContent();
    expect(stpText).not.toBe("0");
    expect(stpText).not.toBe("");
    expect(stpText).not.toContain("0 keV");

    // The CSDA range cell must not be "0 nm" or empty
    const rangeCell = page.locator('[data-testid="range-cell-0"]');
    const rangeText = await rangeCell.textContent();
    expect(rangeText).not.toBe("0 nm");
    expect(rangeText).not.toBe("");
  });
});
```

**Note:** if `data-testid="energy-input-0"`, `stp-cell-0`, or `range-cell-0`
do not yet exist in the result table markup, add them as part of this task.
Check `src/lib/components/result-table.svelte` first.

### Step 0c — fix `src/lib/wasm/libdedx.ts`

**Read the full file first** (`src/lib/wasm/libdedx.ts`) before editing.

#### 1. Add `HEAPF32` to the `EmscriptenModule` interface

Find the `interface EmscriptenModule { ... }` block and add:

```typescript
HEAPF32: Float32Array;
```

alongside the existing `HEAP32` and `HEAPF64` declarations.

#### 2. Add `_dedx_get_csda_range_table` to the interface

Add the declaration for the second WASM function:

```typescript
_dedx_get_csda_range_table(
  program_id: number,
  particle_id: number,
  material_id: number,
  num_energies: number,
  energies: number,
  csda: number,
): number;
```

#### 3. Rewrite the `calculate()` method body

Replace the allocation, write, call, and read sections with:

```typescript
calculate(
  programId: number,
  particleId: number,
  materialId: number,
  energies: number[],
  _options?: AdvancedOptions,
): CalculationResult {
  const numEnergies = energies.length;

  // energies and STP are float (4 bytes each) in the C API.
  // CSDA ranges are double (8 bytes each).
  const energiesPtr = this.module._malloc(numEnergies * 4);
  const stpPtr     = this.module._malloc(numEnergies * 4);
  const csdaPtr    = this.module._malloc(numEnergies * 8);

  try {
    const heapF32 = this.module.HEAPF32;
    const heapF64 = this.module.HEAPF64;

    // Write inputs and zero-initialise output buffers.
    for (let i = 0; i < numEnergies; i++) {
      heapF32[energiesPtr / 4 + i] = energies[i] ?? 0;  // float*
      heapF32[stpPtr     / 4 + i] = 0;                  // float* (zeroed)
      heapF64[csdaPtr    / 8 + i] = 0;                  // double* (zeroed)
    }

    // Call 1: stopping powers (6 args: program, ion, target, n, energies*, stps*)
    const stpErr = this.module._dedx_get_stp_table(
      programId, particleId, materialId,
      numEnergies, energiesPtr, stpPtr,
    );
    if (stpErr !== 0) {
      throw new LibdedxError(stpErr, "WASM STP calculation failed");
    }

    // Call 2: CSDA ranges (6 args: program, ion, target, n, energies*, csda*)
    const csdaErr = this.module._dedx_get_csda_range_table(
      programId, particleId, materialId,
      numEnergies, energiesPtr, csdaPtr,
    );
    if (csdaErr !== 0) {
      throw new LibdedxError(csdaErr, "WASM CSDA calculation failed");
    }

    const stoppingPowers: number[] = [];
    const csdaRanges: number[] = [];
    for (let i = 0; i < numEnergies; i++) {
      const stpMass  = heapF32[stpPtr  / 4 + i] ?? 0;  // read float
      const csdaGcm2 = heapF64[csdaPtr / 8 + i] ?? 0;  // read double

      // Subnormal / non-finite guard — log and continue rather than throw.
      if (!Number.isFinite(stpMass) || (Math.abs(stpMass) > 0 && Math.abs(stpMass) < Number.MIN_VALUE * 1e10)) {
        console.warn("[dedx] subnormal/invalid WASM output (stopping power)", {
          programId, particleId, materialId, energyMevNucl: energies[i], rawValue: stpMass,
        });
      }
      if (!Number.isFinite(csdaGcm2) || (Math.abs(csdaGcm2) > 0 && Math.abs(csdaGcm2) < Number.MIN_VALUE * 1e10)) {
        console.warn("[dedx] subnormal/invalid WASM output (CSDA range)", {
          programId, particleId, materialId, energyMevNucl: energies[i], rawValue: csdaGcm2,
        });
      }

      stoppingPowers.push(stpMass);
      csdaRanges.push(csdaGcm2);
    }

    return { energies: [...energies], stoppingPowers, csdaRanges };
  } finally {
    this.module._free(energiesPtr);
    this.module._free(stpPtr);
    this.module._free(csdaPtr);
  }
}
```

**Important:** the `calculate()` return values are now **raw WASM outputs**
(`stoppingPowers` in MeV·cm²/g, `csdaRanges` in g/cm²). The conversion
to keV/µm and cm already happens downstream in `calculator.svelte.ts`
`performCalculation()` — do not add unit conversion here.

#### 4. Pitfall — HEAPF32 index arithmetic

`HEAPF32[ptr / 4 + i]` divides by **4** (size of a float32). Do not use
`ptr / 8` for float buffers — that is the HEAPF64 stride.

### Step 0d — verify with real WASM (if available locally)

If `static/wasm/libdedx.mjs` is present:

```sh
pnpm exec vitest run src/tests/integration/wasm-calculate.test.ts
```

Confirm all three integration tests pass with non-zero values close to the
NIST reference.

Then run the full E2E suite:

```sh
pnpm exec playwright test tests/e2e/calculator.spec.ts
```

If WASM binaries are not present locally, run only the standard unit test
suite (`pnpm test`) and confirm it stays green — the integration tests will
be automatically skipped.

### Step 0e — also expose `getMinEnergy` / `getMaxEnergy` on `LibdedxService`

**Why:** the energy range label in Task 3 (D2) needs per-program energy bounds.
The WASM already exports `dedx_get_min_energy` and `dedx_get_max_energy`
(confirmed in `wasm/verify.mjs`).

Add to `EmscriptenModule` interface:

```typescript
_dedx_get_min_energy(program_id: number, ion_id: number): number;  // returns float (MeV/nucl)
_dedx_get_max_energy(program_id: number, ion_id: number): number;  // returns float (MeV/nucl)
```

Add to `LibdedxService` interface in `src/lib/wasm/types.ts`:

```typescript
getMinEnergy(programId: number, particleId: number): number;
getMaxEnergy(programId: number, particleId: number): number;
```

Implement in `LibdedxServiceImpl`:

```typescript
getMinEnergy(programId: number, particleId: number): number {
  return this.module._dedx_get_min_energy(programId, particleId);
}
getMaxEnergy(programId: number, particleId: number): number {
  return this.module._dedx_get_max_energy(programId, particleId);
}
```

Add two unit tests to `src/tests/unit/calculator-state.test.ts` (or a
new integration test file) that mock these methods and verify the returned
values are forwarded without modification.

### Step 0f — lint and commit

```sh
pnpm lint && pnpm test
```

All tests green. Then commit:

```
fix(wasm): correct float/double types, param order, add CSDA call in calculate()
```

Body for the commit message (optional but recommended):

```
Three bugs caused every calculation to return 0:
1. energies/STP buffers used HEAPF64 (double) instead of HEAPF32 (float)
2. numEnergies and energiesPtr were swapped in _dedx_get_stp_table call
3. _dedx_get_csda_range_table was never called; CSDA always came back 0
Also exposes getMinEnergy/getMaxEnergy on LibdedxService (needed for Task 3).
```

---

## Task 1 — Code cleanup: delete dead modules + rename energy-input state

**References:** UX review §6.5.1 items C1, C2, C7.

This task removes dead code and renames a misleadingly named module. No new
features. Tests must stay green; no new tests needed.

### Step 1a — verify before deleting (greps must return zero lines)

```sh
grep -rn "url-sync" src/ --include="*.ts" --include="*.svelte" | grep -v "\.test\."
grep -rn "energy-input-format" src/ --include="*.ts" | grep -v "\.test\."
```

If either returns non-zero results, stop and report what you found — do not delete.

### Step 1b — delete dead `url-sync` module

```sh
rm src/lib/state/url-sync.ts
rm src/tests/unit/url-sync.test.ts
```

### Step 1c — fold `energy-input-format.test.ts` into `unit-conversions.test.ts`

Open `src/tests/unit/energy-input-format.test.ts` and identify the test cases
NOT already covered in `unit-conversions.test.ts`. Specifically look for:

1. A probe that asserts `formatSigFigs` uses scientific notation for extreme
   magnitudes (e.g., inputs like `1e-20` or `1e15`).
2. A probe asserting `formatSigFigs(0, 4) === '0'` (zero case).

Add these cases to the existing `describe('formatSigFigs')` block in
`src/tests/unit/unit-conversions.test.ts`, then delete
`src/tests/unit/energy-input-format.test.ts`.

### Step 1d — rename `energy-input.svelte.ts` → `energy-rows.svelte.ts`

```sh
mv src/lib/state/energy-input.svelte.ts src/lib/state/energy-rows.svelte.ts
```

Find every importer and update the path:
```sh
grep -rn "energy-input.svelte" src/ --include="*.ts" --include="*.svelte"
```

Update each `from "$lib/state/energy-input.svelte"` and `from "./energy-input.svelte"` to
use `energy-rows.svelte` instead. Key files to update:
- `src/lib/state/calculator.svelte.ts` (line 1)
- `src/tests/unit/energy-input-state.test.ts` (import at top)

### Step 1e — verify

```sh
pnpm lint && pnpm test
```

All tests must be green. Commit:
```
chore: delete dead url-sync.ts, rename energy-input→energy-rows, fold format test
```

---

## Task 2 — Extract canonical SI prefix table to `energy-units.ts`

**References:** UX review §6.5.1 C3, §6.5.2 I3. The SI prefix factor table
(`keV=0.001`, `MeV=1`, `GeV=1000`, `TeV=1e6`) is currently restated
independently in `energy-parser.ts` and `energy-conversions.ts`. Extract to a
single authoritative module.

### Step 2a — tests first (`src/tests/unit/energy-conversions.test.ts`)

Add a `describe('SI_PREFIX_TABLE canonical import')` block:

```typescript
import { SI_PREFIX_TABLE } from "$lib/utils/energy-units";

describe("SI_PREFIX_TABLE canonical import", () => {
  it("has MeV = 1 (base unit)", () => expect(SI_PREFIX_TABLE.MeV).toBe(1));
  it("has keV = 0.001", () => expect(SI_PREFIX_TABLE.keV).toBe(0.001));
  it("has GeV = 1000", () => expect(SI_PREFIX_TABLE.GeV).toBe(1000));
  it("has TeV = 1e6", () => expect(SI_PREFIX_TABLE.TeV).toBe(1e6));
  it("has eV = 1e-6", () => expect(SI_PREFIX_TABLE.eV).toBeCloseTo(1e-6));
});
```

These tests fail until Step 2b creates the module.

### Step 2b — create `src/lib/utils/energy-units.ts`

```typescript
/**
 * Canonical SI-prefix conversion factors to MeV.
 * Every energy parser and converter MUST import from here — single source of truth.
 * Adding a new SI prefix here is sufficient; no other file needs to be edited.
 */
export const SI_PREFIX_TABLE = {
  eV: 1e-6,
  keV: 0.001,
  MeV: 1,
  GeV: 1000,
  TeV: 1e6,
} as const;

export type SiPrefix = keyof typeof SI_PREFIX_TABLE;
```

### Step 2c — update `energy-parser.ts` and `energy-conversions.ts`

In both files, remove the locally defined SI prefix constant/map and replace
usage with the imported `SI_PREFIX_TABLE` from `$lib/utils/energy-units`.

Only the base SI-prefix factor is centralised here — per-nucleon and atomic-mass
handling logic in `energy-conversions.ts` is unchanged.

### Step 2d — verify

```sh
pnpm lint && pnpm test
```

All tests green. Commit:
```
refactor(units): extract canonical SI prefix table to energy-units.ts
```

---

## Task 3 — Material phase badge + resolved program label + energy range label

**References:** `calculator.md` §"Material Phase Badge" (lines 118–130),
wireframe (lines 556–571), AC lines 749–753, 766–767, 797–800.
UX review issues D1 (phase badge), D2 (energy range label), D3 (program label).

### Step 3a — tests first: phase badge

In `src/tests/unit/entity-selection-comboboxes.test.ts` (or the nearest
component test file), add a `describe("Material phase badge")` block.
Use Svelte Testing Library to render `EntitySelectionComboboxes` with a mock
`EntitySelectionState`:

```typescript
it("shows 'gas' when selectedMaterial.isGasByDefault is true", async () => {
  const mockState = createMockState({ selectedMaterial: { id: 1, name: "Air", isGasByDefault: true, density: 0.00129 } });
  const { getByText } = render(EntitySelectionComboboxes, { props: { state: mockState } });
  expect(getByText("gas")).toBeInTheDocument();
});

it("shows 'liquid' when material name contains 'liquid'", async () => {
  const mockState = createMockState({ selectedMaterial: { id: 276, name: "Water, Liquid", isGasByDefault: false, density: 1.0 } });
  const { getByText } = render(EntitySelectionComboboxes, { props: { state: mockState } });
  expect(getByText("liquid")).toBeInTheDocument();
});

it("shows 'solid' for non-gas materials without 'liquid' in name", async () => {
  const mockState = createMockState({ selectedMaterial: { id: 10, name: "Aluminum", isGasByDefault: false, density: 2.7 } });
  const { getByText } = render(EntitySelectionComboboxes, { props: { state: mockState } });
  expect(getByText("solid")).toBeInTheDocument();
});

it("renders no phase badge when no material is selected", async () => {
  const mockState = createMockState({ selectedMaterial: null });
  const { queryByTestId } = render(EntitySelectionComboboxes, { props: { state: mockState } });
  expect(queryByTestId("phase-badge")).not.toBeInTheDocument();
});
```

### Step 3b — implement phase badge in `entity-selection-comboboxes.svelte`

Add a helper at the top of the `<script>` block:

```typescript
import { Badge } from "$lib/components/ui/badge";

function getMaterialPhase(material: MaterialEntity | null): "gas" | "liquid" | "solid" | null {
  if (!material) return null;
  if (material.isGasByDefault) return "gas";
  if (material.name.toLowerCase().includes("liquid")) return "liquid";
  return "solid";
}

let materialPhase = $derived(getMaterialPhase(state.selectedMaterial));
```

Wrap the material combobox and badge in a `flex items-center gap-2` container:

```svelte
<div class="flex items-center gap-2">
  <!-- existing material EntityCombobox here -->
  {#if materialPhase}
    <Badge variant="outline" class="text-xs shrink-0" data-testid="phase-badge">
      {materialPhase}
    </Badge>
  {/if}
</div>
```

Run `svelte-autofixer` on `entity-selection-comboboxes.svelte` after editing.

### Step 3c — resolved program label in `calculator/+page.svelte`

After the `<EntitySelectionComboboxes>` and `<EnergyUnitSelector>` blocks and
before the result table card, insert:

```svelte
{#if state.isComplete}
  {@const program = state.selectedProgram}
  <p class="text-sm text-muted-foreground -mt-2">
    {#if program.id === -1 && (program as import('$lib/state/entity-selection.svelte').AutoSelectProgram).resolvedProgram}
      Results calculated using
      <strong>{(program as import('$lib/state/entity-selection.svelte').AutoSelectProgram).resolvedProgram!.name}</strong>
      (auto-selected)
    {:else if program.id !== -1}
      Results calculated using <strong>{program.name}</strong>
    {/if}
  </p>
{/if}
```

To keep the template clean, extract the resolution string to a `$derived` in
the `<script>` block instead of inline logic in the template.

### Step 3d — energy range label below the result table

**Important:** `LibdedxService` does not yet expose `getMinEnergy()`/`getMaxEnergy()`.
For this task, use the hardcoded conservative range `0.001 – 10000 MeV/nucl`
(matches all tabulated libdedx programs). Add a `TODO: replace with service call
when LibdedxService.getMinEnergy/getMaxEnergy are implemented` comment.

In `calculator/+page.svelte`, after the result table card closing tag, add:

```svelte
{#if state.isComplete && calcState}
  <p class="text-xs text-muted-foreground">
    Valid range: 0.001 – 10 000 MeV/nucl
    ({state.selectedProgram.id === -1
      ? (state.selectedProgram as AutoSelectProgram).resolvedProgram?.name ?? "auto"
      : state.selectedProgram.name},
    {state.selectedParticle?.name ?? ""})
    <!-- TODO: replace hardcoded range with service.getMinEnergy/getMaxEnergy when available -->
  </p>
{/if}
```

### Step 3e — verify

```sh
pnpm lint && pnpm test
```

All tests green. Commit:
```
feat(calculator): add material phase badge, resolved program label, energy range hint
```

---

## Task 4 — Restore defaults button + paste > 200 values warning

**References:** UX review issue D5, `calculator.md` AC "Performance" (lines 840–843),
`calculator.md` §Error Handling / Large Input (lines 489–495).

### Step 4a — tests first: `resetAll()` in `calculator-state.test.ts`

Add a `describe("resetAll")` block:

```typescript
it("resetAll() resets entity selection (calls entitySelection.resetAll)", () => {
  // arrange: spy on entitySelection.resetAll
  // act: calcState.resetAll()
  // assert: entitySelection.resetAll was called
});

it("resetAll() resets rows to a single pre-filled '100' row", () => {
  calcState.updateRowText(0, "500");
  calcState.addRow();
  calcState.resetAll();
  expect(calcState.rows.filter(r => r.status !== "empty")).toHaveLength(1);
  expect(calcState.rows[0].rawInput).toBe("100");
});

it("resetAll() resets masterUnit to 'MeV'", () => {
  calcState.setMasterUnit("MeV/nucl");
  calcState.resetAll();
  expect(calcState.masterUnit).toBe("MeV");
});
```

### Step 4b — add `resetAll()` to `CalculatorState` interface and implementation

In `src/lib/state/calculator.svelte.ts`, add to the interface:
```typescript
resetAll(): void;
```

Implement it:
```typescript
resetAll() {
  entitySelection.resetAll();
  inputState.resetRows([{ text: "100" }]);
  // masterUnit auto-resets to "MeV" since proton (default after resetAll) only shows MeV
},
```

If `inputState.resetRows()` does not exist, add it to
`src/lib/state/energy-rows.svelte.ts`:
```typescript
resetRows(initial: { text: string }[]): void;
```

Implementation: replace the rows array with the initial rows (each with a fresh
unique `id`), reset `masterUnit` to `"MeV"`.

### Step 4c — add `hasLargeInput` derived value

In `src/lib/state/energy-rows.svelte.ts`, expose:
```typescript
hasLargeInput: boolean; // true when filled rows exceed 200
```

Implement as:
```typescript
hasLargeInput: $derived(rows.filter(r => r.text.trim() !== "").length > 200),
```

Expose it from `CalculatorState` as well (delegate to `inputState.hasLargeInput`).

### Step 4d — add paste > 200 warning in `calculator/+page.svelte`

Below the result table card and the energy range label, add:
```svelte
{#if calcState?.hasLargeInput}
  <p class="text-sm text-amber-600" role="status">
    Large input ({calcState.rows.filter(r => r.status !== 'empty').length} values).
    Calculation may be slow.
  </p>
{/if}
```

### Step 4e — add Restore defaults button

Replace the current h1 heading at the top of the calculator content area:

```svelte
<!-- Before: -->
<h1 class="text-3xl font-bold">Calculator</h1>

<!-- After: -->
<div class="flex items-center justify-between">
  <h1 class="text-3xl font-bold">Calculator</h1>
  {#if calcState}
    <Button variant="ghost" size="sm" onclick={() => calcState!.resetAll()}>
      Restore defaults
    </Button>
  {/if}
</div>
```

Import `Button` from `$lib/components/ui/button`.

### Step 4f — E2E test for large-input warning

In `tests/e2e/calculator.spec.ts`, add:
```typescript
test("paste > 200 values shows large-input warning", async ({ page }) => {
  await page.goto("/calculator");
  await page.waitForSelector("[data-testid='result-table']", { timeout: 10_000 });

  // Build a 201-line paste payload
  const lines = Array.from({ length: 201 }, (_, i) => String(i + 1)).join("\n");
  await page.getByRole("textbox").first().fill(lines);
  // ... or use clipboard paste if fill creates only one row
  
  await expect(page.getByRole("status", { name: /large input/i })).toBeVisible({ timeout: 2000 });
});
```

Use the playwright MCP to run `tests/e2e/calculator.spec.ts` and confirm it passes.

### Step 4g — verify

```sh
pnpm lint && pnpm test
```

Commit:
```
feat(calculator): add restore-defaults button, large-input warning, resetAll()
```

---

## Task 5 — App toolbar: Share URL + disabled Export buttons + mobile nav

**References:** `calculator.md` lines 833–836, `export.md` §0 (buttons live in
toolbar), UX review D10 (no toolbar), D11 (no version label), M1 (mobile nav overflow).

This is the most significant layout change in this session — it modifies
`src/routes/+layout.svelte`.

### Step 5a — E2E tests first (`tests/e2e/toolbar.spec.ts` — new file)

```typescript
import { test, expect } from "@playwright/test";

test("toolbar has Share URL button on calculator page", async ({ page }) => {
  await page.goto("/calculator");
  await expect(page.getByRole("button", { name: /share url/i })).toBeVisible();
});

test("toolbar has Export PDF and Export CSV buttons; both start disabled", async ({ page }) => {
  await page.goto("/calculator");
  const exportPdf = page.getByRole("button", { name: /export pdf/i });
  const exportCsv = page.getByRole("button", { name: /export csv/i });
  await expect(exportPdf).toBeVisible();
  await expect(exportPdf).toBeDisabled();
  await expect(exportCsv).toBeVisible();
  await expect(exportCsv).toBeDisabled();
});

test("Share URL button shows Copied feedback on click", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/calculator");
  await page.getByRole("button", { name: /share url/i }).click();
  // The button or a nearby element should indicate success
  await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 2000 });
});

test("toolbar is also present on plot page", async ({ page }) => {
  await page.goto("/plot");
  await expect(page.getByRole("button", { name: /share url/i })).toBeVisible();
});
```

### Step 5b — implement toolbar in `src/routes/+layout.svelte`

In the `<div class="flex h-14 items-center justify-between">` nav container,
the left side already has logo + nav links. Add the right-side toolbar:

```svelte
<script lang="ts">
  // ... existing imports ...
  import { Button } from "$lib/components/ui/button";

  let copied = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  async function shareUrl() {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    copied = true;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => (copied = false), 2000);
  }
</script>

<!-- Inside the nav, right side (sibling to the left flex group): -->
<div class="flex items-center gap-2">
  <Button variant="outline" size="sm" disabled class="hidden sm:inline-flex">
    Export PDF
  </Button>
  <Button variant="outline" size="sm" disabled class="hidden sm:inline-flex">
    Export CSV ↓
  </Button>
  <Button variant="outline" size="sm" onclick={shareUrl}>
    {#if copied}
      <span aria-live="polite">Copied!</span>
    {:else}
      Share URL
    {/if}
  </Button>
</div>
```

Key decisions:
- **Export PDF and Export CSV are always `disabled`** in this stage (Stage 6.7 wires the actual export). They are `hidden sm:inline-flex` — hidden on mobile to avoid nav overflow (M1).
- **Share URL** is always visible, even on mobile. It copies `window.location.href` to clipboard.
- The `copied` feedback uses an `aria-live` span so screen readers announce it.

### Step 5c — mobile nav overflow (M1)

Ensure the nav doesn't overflow on narrow viewports. The current nav left side
uses `flex items-center gap-6`. With the right-side toolbar added, the total
width may exceed 375 px on mobile. Apply:

```svelte
<!-- On the outer flex row: add flex-wrap or min-w-0 to left side -->
<div class="flex h-14 items-center justify-between gap-2">
  <div class="flex items-center gap-3 min-w-0">  <!-- was gap-6; add min-w-0 -->
    <!-- logo + nav links -->
  </div>
  <div class="flex items-center gap-2 shrink-0">
    <!-- toolbar buttons -->
  </div>
</div>
```

The `shrink-0` on the toolbar and `min-w-0` on the left group ensures the left
nav truncates before the toolbar disappears.

### Step 5d — verify

```sh
pnpm lint && pnpm test && pnpm exec playwright test tests/e2e/toolbar.spec.ts
```

All green. Commit:
```
feat(layout): add app toolbar with Share URL and disabled Export PDF/CSV buttons
```

---

## Task 6 — Calculator URL sync (calculator-url.ts + wire to page)

**References:** `calculator.md` §"URL State Encoding" (lines 491–541),
`shareable-urls.md` canonical params. This is the Stage 6.6 deliverable.

The existing `src/lib/state/url-sync.ts` was deleted in Task 1. This task
implements the canonical version from scratch, following `plot-url.ts` as the
reference implementation.

### Step 6a — unit tests first (`src/tests/unit/calculator-url.test.ts` — new file)

```typescript
import { describe, it, expect } from "vitest";
import { encodeCalculatorUrl, decodeCalculatorUrl } from "$lib/utils/calculator-url";
import type { CalculatorUrlState } from "$lib/utils/calculator-url";

const defaultState: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
};

describe("encodeCalculatorUrl", () => {
  it("encodes particle, material, program=auto, energies, eunit", () => {
    const p = encodeCalculatorUrl(defaultState);
    expect(p.get("particle")).toBe("1");
    expect(p.get("material")).toBe("276");
    expect(p.get("program")).toBe("auto");
    expect(p.get("energies")).toBe("100");
    expect(p.get("eunit")).toBe("MeV");
  });

  it("encodes explicit program ID", () => {
    const p = encodeCalculatorUrl({ ...defaultState, programId: 4 });
    expect(p.get("program")).toBe("4");
  });

  it("encodes multiple rows as comma-separated", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "200", unit: "MeV", unitFromSuffix: false },
      ],
    });
    expect(p.get("energies")).toBe("100,200");
  });

  it("encodes mixed-unit rows with :unit suffix for rows that differ from masterUnit", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      masterUnit: "MeV",
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "500", unit: "keV", unitFromSuffix: true },
      ],
    });
    expect(p.get("energies")).toBe("100,500:keV");
  });

  it("skips empty rows", () => {
    const p = encodeCalculatorUrl({
      ...defaultState,
      rows: [
        { rawInput: "100", unit: "MeV", unitFromSuffix: false },
        { rawInput: "", unit: "MeV", unitFromSuffix: false },
      ],
    });
    expect(p.get("energies")).toBe("100");
  });
});

describe("decodeCalculatorUrl", () => {
  it("decodes basic params", () => {
    const params = new URLSearchParams("particle=1&material=276&program=auto&energies=100,200&eunit=MeV");
    const s = decodeCalculatorUrl(params);
    expect(s.particleId).toBe(1);
    expect(s.materialId).toBe(276);
    expect(s.programId).toBeNull();
    expect(s.rows).toEqual([
      { rawInput: "100", unit: "MeV", unitFromSuffix: false },
      { rawInput: "200", unit: "MeV", unitFromSuffix: false },
    ]);
    expect(s.masterUnit).toBe("MeV");
  });

  it("decodes mixed-unit rows with :unit suffix", () => {
    const params = new URLSearchParams("energies=100,500:keV&eunit=MeV");
    const s = decodeCalculatorUrl(params);
    expect(s.rows[0]).toEqual({ rawInput: "100", unit: "MeV", unitFromSuffix: false });
    expect(s.rows[1]).toEqual({ rawInput: "500", unit: "keV", unitFromSuffix: true });
  });

  it("falls back to default single row on missing energies param", () => {
    const params = new URLSearchParams("particle=1&material=276");
    const s = decodeCalculatorUrl(params);
    expect(s.rows).toEqual([{ rawInput: "100", unit: "MeV", unitFromSuffix: false }]);
  });

  it("ignores invalid particle ID and returns null", () => {
    const params = new URLSearchParams("particle=INVALID");
    const s = decodeCalculatorUrl(params);
    expect(s.particleId).toBeNull();
  });

  it("ignores unrecognised eunit and defaults to MeV", () => {
    const params = new URLSearchParams("eunit=bebok");
    const s = decodeCalculatorUrl(params);
    expect(s.masterUnit).toBe("MeV");
  });

  it("decodes explicit program ID", () => {
    const params = new URLSearchParams("program=4");
    const s = decodeCalculatorUrl(params);
    expect(s.programId).toBe(4);
  });
});
```

### Step 6b — create `src/lib/utils/calculator-url.ts`

Model this on `src/lib/utils/plot-url.ts`:

```typescript
import type { EnergyUnit } from "$lib/wasm/types";

const VALID_ENERGY_UNITS: ReadonlySet<string> = new Set([
  "MeV", "MeV/nucl", "MeV/u", "keV", "GeV", "GeV/nucl", "GeV/u", "TeV", "TeV/nucl", "TeV/u",
]);

export interface CalculatorUrlRow {
  rawInput: string;
  unit: EnergyUnit;
  unitFromSuffix: boolean;
}

export interface CalculatorUrlState {
  particleId: number | null;
  materialId: number | null;
  programId: number | null;  // null = auto-select
  rows: CalculatorUrlRow[];
  masterUnit: EnergyUnit;
}

export function encodeCalculatorUrl(state: CalculatorUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.particleId !== null) params.set("particle", String(state.particleId));
  if (state.materialId !== null) params.set("material", String(state.materialId));
  params.set("program", state.programId === null ? "auto" : String(state.programId));

  const nonEmpty = state.rows.filter(r => r.rawInput.trim() !== "");
  if (nonEmpty.length > 0) {
    const encoded = nonEmpty.map(r =>
      r.unitFromSuffix && r.unit !== state.masterUnit
        ? `${r.rawInput}:${r.unit}`
        : r.rawInput
    ).join(",");
    params.set("energies", encoded);
  }
  params.set("eunit", state.masterUnit);
  return params;
}

export function decodeCalculatorUrl(params: URLSearchParams): CalculatorUrlState {
  const parseId = (v: string | null): number | null => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return isFinite(n) && n > 0 ? n : null;
  };

  const masterUnit: EnergyUnit =
    VALID_ENERGY_UNITS.has(params.get("eunit") ?? "")
      ? (params.get("eunit") as EnergyUnit)
      : "MeV";

  const rows: CalculatorUrlRow[] = [];
  const energiesParam = params.get("energies");
  if (energiesParam) {
    for (const part of energiesParam.split(",")) {
      const colonIdx = part.lastIndexOf(":");
      if (colonIdx > 0) {
        const rawInput = part.slice(0, colonIdx);
        const unitStr = part.slice(colonIdx + 1);
        if (VALID_ENERGY_UNITS.has(unitStr)) {
          rows.push({ rawInput, unit: unitStr as EnergyUnit, unitFromSuffix: true });
          continue;
        }
      }
      rows.push({ rawInput: part, unit: masterUnit, unitFromSuffix: false });
    }
  }

  return {
    particleId: parseId(params.get("particle")),
    materialId: parseId(params.get("material")),
    programId:
      params.get("program") === "auto" || !params.get("program")
        ? null
        : parseId(params.get("program")),
    rows: rows.length > 0 ? rows : [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
    masterUnit,
  };
}
```

### Step 6c — wire to `src/routes/calculator/+page.svelte`

Follow the same `$app/navigation` + `$app/stores` pattern as `plot/+page.svelte`.

**Read URL on load** — update the `$effect` that initialises state:

```svelte
<script lang="ts">
  import { page } from "$app/stores";
  import { replaceState } from "$app/navigation";
  import { decodeCalculatorUrl, encodeCalculatorUrl } from "$lib/utils/calculator-url";

  // ...existing imports...

  let urlInitialized = $state(false);

  $effect(() => {
    if (wasmReady.value && !state && !calcState) {
      getService().then((service) => {
        const matrix = buildCompatibilityMatrix(service);
        state = createEntitySelectionState(matrix);
        calcState = createCalculatorState(state, service);

        // Restore state from URL params
        const urlState = decodeCalculatorUrl($page.url.searchParams);
        if (urlState.particleId !== null) state.selectParticle(urlState.particleId);
        if (urlState.materialId !== null) state.selectMaterial(urlState.materialId);
        if (urlState.programId !== null) state.selectProgram(urlState.programId);
        calcState.setMasterUnit(urlState.masterUnit);
        // Populate rows from URL (skip default "100" if URL had its own rows)
        if ($page.url.searchParams.has("energies")) {
          // Clear existing rows and set from URL
          urlState.rows.forEach((r, i) => {
            const text = r.unitFromSuffix ? `${r.rawInput} ${r.unit}` : r.rawInput;
            if (i === 0) {
              calcState!.updateRowText(0, text);
            } else {
              calcState!.addRow();
              calcState!.updateRowText(i, text);
            }
          });
        }
        urlInitialized = true;
      });
    }
  });

  // Write URL on state change (after initial load is complete)
  $effect(() => {
    if (!urlInitialized || !calcState || !state) return;
    const params = encodeCalculatorUrl({
      particleId: state.selectedParticle?.id ?? null,
      materialId: state.selectedMaterial?.id ?? null,
      programId: state.resolvedProgramId,
      rows: calcState.rows,
      masterUnit: calcState.masterUnit,
    });
    replaceState(`${$page.url.pathname}?${params}`, {});
  });
</script>
```

**Guard:** the write `$effect` must check `urlInitialized` before running to
avoid overwriting URL with defaults on first load. Only start writing after the
read phase is complete.

### Step 6d — E2E tests (`tests/e2e/calculator-url.spec.ts` — new file)

```typescript
test("calculator state is encoded in URL after loading", async ({ page }) => {
  await page.goto("/calculator");
  await page.waitForFunction(() => window.location.search.includes("particle="));
  expect(page.url()).toContain("particle=1");   // proton default
  expect(page.url()).toContain("material=276"); // water default
});

test("loading URL with particle=6 restores carbon selection", async ({ page }) => {
  await page.goto("/calculator?particle=6&material=276&energies=100,200&eunit=MeV");
  // Carbon combobox trigger should show "Carbon (C)"
  await expect(page.getByText(/Carbon \(C\)/)).toBeVisible({ timeout: 8000 });
  // Both energy rows should be visible
  await expect(page.getByRole("textbox").nth(0)).toHaveValue("100");
  await expect(page.getByRole("textbox").nth(1)).toHaveValue("200");
});

test("invalid URL params fall back to defaults without error", async ({ page }) => {
  await page.goto("/calculator?particle=NOPE&energies=notanumber&eunit=bebok");
  // Page should load normally with proton/water defaults
  await expect(page.getByRole("heading", { name: /calculator/i })).toBeVisible({ timeout: 8000 });
  // No visible error message
  await expect(page.getByText(/error/i)).not.toBeVisible();
});
```

### Step 6e — verify

```sh
pnpm lint && pnpm test && pnpm exec playwright test tests/e2e/calculator-url.spec.ts
```

Commit:
```
feat(calculator): implement URL state sync per shareable-urls spec (calculator-url.ts)
```

---

## Task 7 — Stage 5.1 polish: loading skeleton + auto-fallback notification + retry CTA

**References:** UX review §5.2 "Yellow lights — should be addressed in early Stage 6".
These three items were flagged as not blocking Stage 6 start but should land early.

### Step 7a — loading skeleton (replace "Loading..." text)

The shadcn-svelte `Skeleton` component may not be installed yet. Check:
```sh
ls src/lib/components/ui/skeleton* 2>/dev/null || echo "not installed"
```

If missing, install:
```sh
pnpm dlx shadcn-svelte@latest add skeleton
```

In `src/routes/calculator/+page.svelte`, replace the `{#if !wasmReady.value...}` loading block:

```svelte
{#if !wasmReady.value || !state || !calcState}
  <div class="mx-auto max-w-4xl space-y-6" aria-busy="true" aria-label="Loading calculator">
    <!-- Entity selector row skeleton -->
    <div class="flex flex-wrap gap-3">
      <Skeleton class="h-10 w-44 rounded-md" />
      <Skeleton class="h-10 w-44 rounded-md" />
      <Skeleton class="h-10 w-36 rounded-md" />
      <Skeleton class="h-10 w-28 rounded-md" />
    </div>
    <!-- Table skeleton -->
    <div class="rounded-lg border bg-card p-6 space-y-2">
      <Skeleton class="h-8 w-full" />
      <Skeleton class="h-8 w-full" />
      <Skeleton class="h-8 w-3/4" />
    </div>
  </div>
```

Import `Skeleton` from `$lib/components/ui/skeleton`.

Also update `src/routes/plot/+page.svelte` to use the same skeleton pattern for
the `"Loading WASM module…"` state — the pattern there uses a plain text, which
should also become a skeleton consistent with the calculator.

### Step 7b — in-body retry CTA when WASM fails

In `src/routes/calculator/+page.svelte`, import `wasmError` from
`$lib/state/ui.svelte` and add an error branch inside the main content area:

```svelte
{#if wasmError.value}
  <div class="mx-auto max-w-md rounded-lg border border-destructive bg-destructive/10 p-8 text-center space-y-4">
    <p class="font-semibold text-destructive">Failed to load the calculation engine.</p>
    <p class="text-sm text-muted-foreground">
      Please try refreshing the page or use a different browser.
    </p>
    <Button variant="destructive" size="sm" onclick={() => window.location.reload()}>
      Retry
    </Button>
    <details class="text-left text-xs text-muted-foreground mt-2">
      <summary class="cursor-pointer">Show details</summary>
      <pre class="mt-1 whitespace-pre-wrap">{wasmError.value.message}</pre>
    </details>
  </div>
{:else if !wasmReady.value || !state || !calcState}
  <!-- skeleton from 7a above -->
```

### Step 7c — auto-fallback notification when program silently resets

When `entitySelection.selectParticle()` silently resets the program to Auto-select
because the previously-chosen program doesn't support the new particle, the user
sees nothing. Fix this:

**Add to `EntitySelectionState` interface** in `entity-selection.svelte.ts`:
```typescript
lastAutoFallbackMessage: string | null;
clearAutoFallbackMessage(): void;
```

**Inside `createEntitySelectionState()`**, detect the program reset:
```typescript
let lastAutoFallbackMessage = $state<string | null>(null);

// Inside selectParticle(), after the logic that resets program to auto:
// (find the place where selectedProgram is reset to AUTO_SELECT_PROGRAM)
// Add:
if (selectedProgram.id !== -1 && !newAvailablePrograms.some(p => p.id === selectedProgram.id)) {
  // Program was reset
  lastAutoFallbackMessage = `Program changed to Auto-select — "${selectedProgram.name}" does not support the selected particle.`;
  selectedProgram = AUTO_SELECT_PROGRAM;  // existing reset logic
}
```

Expose in return object:
```typescript
lastAutoFallbackMessage: {
  get value() { return lastAutoFallbackMessage; }
},
clearAutoFallbackMessage() { lastAutoFallbackMessage = null; },
```

**In `src/routes/calculator/+page.svelte`**, add a dismissable notification
below the entity selector row (and inside the main `{:else}` branch):

```svelte
{#if state.lastAutoFallbackMessage}
  <div class="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
    <span role="status" aria-live="polite">{state.lastAutoFallbackMessage}</span>
    <button
      class="ml-2 text-amber-600 hover:text-amber-800 text-lg leading-none"
      aria-label="Dismiss"
      onclick={() => state!.clearAutoFallbackMessage()}>
      ×
    </button>
  </div>
{/if}
```

Also wire it in `src/lib/components/selection-live-region.svelte` so screen
readers get the announcement via the existing live region infrastructure.

**Unit tests** for the new methods:
```typescript
// In entity-selection-state.test.ts:
it("selectParticle that forces program reset sets lastAutoFallbackMessage", ...);
it("clearAutoFallbackMessage() clears the message", ...);
```

### Step 7d — verify

```sh
pnpm lint && pnpm test
```

Commit:
```
feat(calculator): loading skeleton, retry CTA, auto-fallback notification for entity selection
```

---

## Task 8 — Documentation grooming (no code changes)

**References:** UX review §6.5.2 items I1, I2, I4, I5.
Pure doc edits — no tests, no lint changes, just markdown files.

### Step 8a — I1: cross-check stubs

At the top of `docs/04-feature-specs/shareable-urls.md` (after the status header):
```markdown
> **Cross-check:** If this file disagrees with `shareable-urls-formal.md`, the formal contract wins.
```

At the top of `docs/04-feature-specs/shareable-urls-formal.md`:
```markdown
> **Cross-check:** If this file disagrees with `shareable-urls.md`, this formal contract wins.
```

### Step 8b — I2: consolidate calculator wireframes

In `docs/04-feature-specs/entity-selection.md`, find the compact-mode ASCII
wireframe section (§Compact Mode). Replace the ASCII art with:
```markdown
> **Wireframe:** see `calculator.md §Page Layout Overview` — the Calculator
> spec owns the compact-mode wireframe. Anything here is a derived view.
```

In `docs/05-ui-wireframes.md`, replace any duplicated calculator wireframe with:
```markdown
**Calculator page:** See [`docs/04-feature-specs/calculator.md §Page Layout Overview`](04-feature-specs/calculator.md).
```

### Step 8c — I4: STP conversion note in wasm-api-contract.md

Find the `convertStpUnits` entry in `docs/06-wasm-api-contract.md` and add:
```markdown
> **Implementation note:** `convertStpUnits` is implemented in TypeScript
> (`src/lib/utils/unit-conversions.ts`), not in C. The WASM layer returns
> raw values in MeV·cm²/g (stopping power) and g/cm² (CSDA range); all
> display-unit conversion happens on the JS side.
```

### Step 8d — I5: historical narrative disclaimers

Add at the top of `docs/ux-reviews/README.md`:
```markdown
> **Note:** These are historical, point-in-time reviews. For current
> intended behavior, the specs under `docs/04-feature-specs/` are
> authoritative.
```

Add an equivalent note to `docs/ai-logs/README.md`:
```markdown
> **Note:** These session logs are historical records. For current intended
> behavior, see `docs/04-feature-specs/`. For current implementation, see
> the code.
```

### Step 8e — verify and commit

```sh
pnpm lint  # docs-only change; should trivially pass
```

Commit:
```
docs: grooming — shareable-urls cross-check, wireframe consolidation, STP implementation note, historical disclaimers
```

---

## Final checklist before handing back

After all 8 tasks:

- [ ] `pnpm lint` clean
- [ ] `pnpm test` green (all Vitest unit + integration tests)
- [ ] `pnpm exec playwright test` green (no new failures vs baseline)
- [ ] `pnpm build` succeeds (production build gate)
- [ ] Each task has exactly one Conventional Commit on `qwen/stage-6-calculator`
- [ ] `CHANGELOG-AI.md` has new rows at the top (one per significant task)
- [ ] `docs/ai-logs/2026-04-28-stage6-calculator-basic.md` exists with session narrative
- [ ] `docs/ai-logs/README.md` has a one-line pointer to the new log file

**Feature verification:**
- [ ] `src/lib/state/url-sync.ts` does not exist (deleted)
- [ ] `src/tests/unit/url-sync.test.ts` does not exist (deleted)
- [ ] `src/lib/state/energy-input.svelte.ts` does not exist (renamed to `energy-rows.svelte.ts`)
- [ ] `src/lib/utils/energy-units.ts` exists and is imported by both parser and converter
- [ ] `src/lib/utils/calculator-url.ts` exists with `encodeCalculatorUrl` / `decodeCalculatorUrl`
- [ ] Calculator URL round-trip: navigate to `?particle=6&material=276&energies=100,200` → Carbon selected, two rows visible, results shown
- [ ] Share URL button in layout toolbar copies `window.location.href` to clipboard and shows "Copied!"
- [ ] Export PDF and Export CSV buttons are present in toolbar and disabled
- [ ] Material phase badge ("gas" / "liquid" / "solid") visible next to material combobox
- [ ] Resolved program label visible below entity selectors when selection is complete
- [ ] Energy range label visible below the result table
- [ ] "Restore defaults" button resets calculator to Proton / Water / Auto / `100` MeV
- [ ] Paste > 200 values → warning appears with role="status"
- [ ] Loading state shows a skeleton instead of "Loading..."
- [ ] WASM error state shows retry CTA inside the content area
- [ ] Auto-fallback notification appears (and is dismissable) when program is silently reset

---

## Notes on shadcn-svelte

- Button: `import { Button } from "$lib/components/ui/button"`
- Badge: `import { Badge } from "$lib/components/ui/badge"`
- Skeleton: `import { Skeleton } from "$lib/components/ui/skeleton"`
- To add a missing component: `pnpm dlx shadcn-svelte@latest add <name>`
- Do NOT hand-roll these elements — shadcn handles dark-mode theming via CSS vars
- CSS variables: `src/app.css` (`@theme inline` block)
- Use the `tailwind` MCP for any Tailwind v4 class questions

## Notes on Svelte 5 (CRITICAL — Qwen has seen more Svelte 4 data)

| **Use** | **Never use** |
|---------|---------------|
| `$state`, `$derived`, `$effect` | `export let`, `$:` |
| `$effect` for lifecycle and side-effects | `onMount`, `onDestroy` from `svelte` |
| `onclick={handler}` | `on:click={handler}` |
| Reassign to mutate `$state` arrays | `.push()`, `.splice()` |
| `$props()` for component props | destructuring `export let` |

After editing any `.svelte` file, call `svelte-autofixer` via the Svelte MCP.
Offline fallback: `vendor/svelte/documentation/docs/02-runes/` and
`vendor/svelte/documentation/docs/99-legacy/`.

## Notes on Qwen-specific pitfalls

- **Type inference chains:** always add explicit generic type parameters when
  using `$state<T>` or `$derived` with complex types. Qwen can silently widen
  inferred types.
- **`replaceState` return value:** `replaceState` from `$app/navigation` returns
  a `Promise<void>`. You do not need to `await` it in a `$effect`, but do not
  call it synchronously outside an effect or on every micro-tick.
- **URL write guard:** always check `urlInitialized` (or equivalent) before
  calling `replaceState` in the write `$effect` to avoid overwriting URL with
  defaults during the initial entity-selection setup phase.
- **Svelte rune reactivity in `.svelte.ts` files:** `$state` and `$derived`
  work in `.svelte.ts` files but the file must have the `.svelte.ts` extension
  — never use runes in a plain `.ts` file.
- **Conventional Commit format:** `type(scope): imperative lowercase message` —
  no trailing period, no capital first letter after the colon, scope optional
  but encouraged. Examples: `feat(calculator):`, `fix(parser):`, `chore:`,
  `docs:`, `refactor(units):`.
