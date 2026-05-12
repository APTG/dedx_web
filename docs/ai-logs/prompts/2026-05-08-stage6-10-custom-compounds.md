# opencode task prompt — 2026-05-08

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation (TDD)
> **Branch:** `qwen/stage6-10-custom-compounds`
> **MCPs needed:** playwright, tailwind, svelte
> **TDD rule:** Write the failing test(s) first, then minimal impl. Fix all
> lint/type errors before committing.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 runes, build commands, AI logging rules.
2. `.opencode/lessons-learned.md` — **MUST READ before writing any reactive
   code.** All entries are directly relevant; pay special attention to entries 1
   (reactive dep snapshot), 3 (cross-page parity), 4 (mock sync), and 5
   (contract test coverage).
3. `docs/04-feature-specs/custom-compounds.md` (Final v4) — the normative spec.
   Read the **entire file**. Key sections: §Feature Overview (Advanced-only
   gate), §1 Compound Library (storage schema), §2 Custom Compounds in Entity
   Selection, §3 Compound Editor, §4 Validation Rules, §5 WASM Integration,
   §6 URL Encoding, §7 localStorage Schema, §8 Export Behavior, §9 Edge Cases,
   §Acceptance Checklist (AC-1–AC-13), §Reactive Triggers Matrix,
   §Acceptance Scenarios (1–6), §Cross-Page Parity Checklist,
   §Stage 6.10 Preflight Addendum (§6.10.1–6.10.6), §Appendix data-testid.
4. `docs/06-wasm-api-contract.md` — full file. Pay special attention to
   `CustomCompound` type (§2.5) and the four new service methods:
   `calculateCustomCompound`, `getPlotDataCustomCompound`,
   `getInverseStpCustomCompound`, `getInverseCsdaCustomCompound`,
   `getBraggPeakStpCustomCompound`.
5. `src/lib/wasm/types.ts` — current `LibdedxService` interface. The 4 custom
   compound methods are not yet present; you will add them in Task 2.
6. `src/lib/wasm/libdedx.ts` — real WASM implementation (add custom compound
   method implementations here in Task 2).
7. `src/lib/wasm/__mocks__/libdedx.ts` — mock classes; must be updated in
   lock-step with the interface (lessons-learned Entry 4).
8. `wasm/dedx_extra.{h,c}` — existing C wrappers for flat inverse and density
   functions. You will add custom compound C wrappers here in Task 2.
9. `wasm/build.sh` — EXPORTED_FUNCTIONS list that must be extended with the new
   C symbol names.
10. `wasm/contract-manifest.json` — ABI manifest consumed by `wasm/verify.mjs`;
    update with custom compound export symbols in Task 2.
11. `src/lib/utils/calculator-url.ts` — existing URL codec; you will extend
    `CalculatorUrlState`, `encodeCalculatorUrl`, and `decodeCalculatorUrl` with
    `material=custom` sentinel and `mat_*` params in Task 3.
12. `src/lib/utils/plot-url.ts` — plot URL codec; extend analogously in Task 3.
13. `src/lib/state/entity-selection.svelte.ts` — current `MaterialEntity`,
    `MaterialRef` types and the material-selection store; you will extend it to
    support custom compound references in Task 5.
14. `src/lib/state/advanced-mode.svelte.ts` — `isAdvancedMode` singleton; all
    custom compound UI is gated on `isAdvancedMode.value`.
15. `src/lib/state/inverse-lookups.svelte.ts` — existing inverse lookup state;
    you will add custom compound dispatch paths in Task 5.
16. `src/lib/state/export.svelte.ts` — export state; extend for custom compound
    CSV filenames and PDF composition table in Task 5.
17. `src/routes/calculator/+page.svelte` — Calculator page; extended in Task 5.
18. `src/routes/plot/+page.svelte` — Plot page; extended in Task 5.
19. `src/tests/contracts/service-interface.contract.test.ts` — add the 4 new
    custom compound methods to runtime checks (Task 2).
20. `src/tests/contracts/url-codec.contract.test.ts` — add `material=custom`
    round-trip scenarios (Task 3).
21. `libdedx/include/dedx.h` — read `dedx_config` struct to understand
    `elements_id`, `elements_atoms`, `elements_length`, `target`, `density_set`,
    `ivalue_set` fields that enable custom compound calculations.

Key source files (read before writing code):

- `src/lib/wasm/types.ts`
- `src/lib/wasm/libdedx.ts` (especially the `calculate()` method pattern for
  `dedx_load_config` / `dedx_allocate_workspace` / `dedx_free_*` lifecycle)
- `src/lib/wasm/__mocks__/libdedx.ts`
- `wasm/dedx_extra.c` + `wasm/dedx_extra.h`
- `wasm/build.sh` (EXPORTED_FUNCTIONS array)
- `src/lib/utils/calculator-url.ts`
- `src/lib/state/entity-selection.svelte.ts`
- `src/lib/state/advanced-mode.svelte.ts`
- `src/routes/calculator/+page.svelte`
- `src/routes/plot/+page.svelte`

Test files (read before writing tests):

- `src/tests/contracts/service-interface.contract.test.ts`
- `src/tests/contracts/url-codec.contract.test.ts`
- `tests/e2e/calculator-advanced.spec.ts` (E2E pattern to follow)
- `tests/e2e/inverse-lookups.spec.ts` (E2E pattern from Stage 6.9)

Run tests:

```sh
pnpm lint && pnpm format       # must be clean before committing
pnpm test                      # Vitest unit + component tests (no WASM)
pnpm exec playwright test      # E2E (needs WASM in static/wasm/)
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` § "AI Session Logging").
Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

---

## WASM Capability Audit (REQUIRED before Task 2)

Before writing any WASM code, complete the mandatory checklist from
`.opencode/agents/implementer.md` § "WASM capability discovery checklist":

1. Read `docs/06-wasm-api-contract.md` fully.
2. Inspect `src/lib/wasm/**` (types, wrapper, mocks).
3. Verify `LibdedxService` interface + mock signatures match all call sites.
4. Read `wasm/dedx_extra.{h,c}` to see the flat-function patterns already used
   (e.g. `dedx_get_inverse_stp_flat`, `dedx_get_bragg_peak_stp`).
5. Read `libdedx/include/dedx.h` — confirm `dedx_config.elements_id`,
   `dedx_config.elements_atoms`, `dedx_config.elements_length`,
   `dedx_config.density_set`, and `dedx_config.ivalue_set` exist and understand
   their semantics (`target=0` activates the custom compound path).

Hard rules (from implementer contract):

- Do **not** infer WASM behavior from UI/spec prose alone.
- Do **not** invent new WASM capabilities beyond the four functions listed below.
- In your `TASK DONE` for Task 2, explicitly record what C symbols now exist vs.
  what was missing before.

---

## Task 1 — Pure TypeScript utilities + compound store (no WASM, no UI)

> **Depends on nothing.** These are pure TypeScript modules — no WASM calls,
> no Svelte reactivity, no DOM.

**Spec:** `docs/04-feature-specs/custom-compounds.md` §1 (storage), §3.2–3.3
(formula + weight-fraction modes), §4 (validation rules), §6.10.1–6.10.6
(preflight addendum — data model, validation matrix, persistence contract).

### Acceptance criteria

- `src/lib/utils/element-data.ts` exports:
  - `ELEMENT_DATA: Map<number, { symbol: string; name: string; atomicWeight: number }>` for Z=1–118
  - `resolveElement(token: string): number | null` — accepts symbol (case-insensitive), full name (case-insensitive), or decimal Z string ("1" → 1, "26" → 26); returns atomic number Z or `null` if unknown
- `src/lib/utils/formula-parser.ts` exports:
  - `parseFormula(formula: string): Array<{ atomicNumber: number; atomCount: number }> | { error: string }` — parses `"C5H8O2"`, `"LiF"`, `"H2O"`, `"Fe"` into sorted (ascending Z) element arrays; handles integer counts only; rejects unknown symbols with `{ error: "Unknown element: 'Xx'" }`; collapses duplicate Z by summing counts; rejects atom count ≤ 0
- `src/lib/state/custom-compounds.svelte.ts` exports a reactive singleton `customCompoundsStore` with the following interface:

  ```typescript
  interface CustomCompoundsStore {
    readonly compounds: StoredCustomCompoundV1[];
    create(fields: CompoundCreateInput): StoredCustomCompoundV1; // throws ValidationError
    update(id: string, fields: Partial<CompoundCreateInput>): void; // throws ValidationError
    delete(id: string): void;
    getById(id: string): StoredCustomCompoundV1 | undefined;
    validateFields(fields: CompoundCreateInput): ValidationResult;
    getCompatiblePrograms(
      compound: Pick<StoredCustomCompoundV1, "elements">,
      allPrograms: ProgramEntity[],
      matrix: CompatibilityMatrix,
    ): {
      compatible: ProgramEntity[];
      incompatible: Array<{ program: ProgramEntity; missingZ: number[] }>;
    };
  }
  ```

  - Backed by `$state` (Svelte 5 runes). The `compounds` getter returns the reactive array.
  - `localStorage` key `customCompounds`; schema v1 (`{ schemaVersion: 1, compounds: [...] }`).
  - On init: reads localStorage, migrates legacy array-only shape (wrap in v1 envelope), drops invalid rows silently.
  - `create`: generates `id` as `cc_` + `crypto.randomUUID()`; sets `createdAt`/`updatedAt`; normalizes `normalizedName`; sorts elements ascending Z.
  - `update`: keeps `id` and `createdAt` stable; updates `updatedAt` and `normalizedName`.
  - `delete`: removes by `id`; no error if not found.
  - Validation rules (per spec §4): name non-empty + ≤80 chars; density > 0 and ≤25 g/cm³; I-value if present > 0 and ≤10 000 eV; ≥1 element; each Z ∈ [1,118]; no duplicate Z; each atom count > 0; each atom count ≤1000 (formula mode only — pass mode as a parameter so validation can be skipped for weight-fraction derived counts).
  - Duplicate-name detection (case-insensitive + trim + collapse-spaces): `validateFields` includes `{ duplicateNameWarning: boolean }` in result but does NOT treat duplicates as errors.
  - `getCompatiblePrograms`: for each program, checks that every element Z in the compound has an elemental material in the compatibility matrix; returns `{ compatible, incompatible }`.

- `pnpm test` and `pnpm build` exit 0.

### Step 1a — tests first

**`src/tests/unit/element-data.test.ts`:**

```typescript
// resolveElement
expect(resolveElement("H")).toBe(1);
expect(resolveElement("h")).toBe(1);
expect(resolveElement("hydrogen")).toBe(1);
expect(resolveElement("1")).toBe(1);
expect(resolveElement("Fe")).toBe(26);
expect(resolveElement("iron")).toBe(26);
expect(resolveElement("Xx")).toBeNull();
expect(resolveElement("0")).toBeNull();
expect(resolveElement("999")).toBeNull();
```

**`src/tests/unit/formula-parser.test.ts`:**

```typescript
// parseFormula
expect(parseFormula("H2O")).toEqual([
  { atomicNumber: 1, atomCount: 2 },
  { atomicNumber: 8, atomCount: 1 },
]);
expect(parseFormula("C5H8O2")).toEqual([
  { atomicNumber: 1, atomCount: 8 },
  { atomicNumber: 6, atomCount: 5 },
  { atomicNumber: 8, atomCount: 2 },
]);
expect(parseFormula("LiF")).toEqual([
  { atomicNumber: 3, atomCount: 1 },
  { atomicNumber: 9, atomCount: 1 },
]);
expect(parseFormula("Fe")).toEqual([{ atomicNumber: 26, atomCount: 1 }]);
expect(parseFormula("Xx2O")).toMatchObject({ error: expect.stringContaining("Xx") });
expect(parseFormula("")).toMatchObject({ error: expect.anything() });
```

**`src/tests/unit/custom-compounds.test.ts`:**

```typescript
// create/update/delete round-trip
// validateFields: all AC-3 and AC-4 rules
// migration: legacy array-only → v1 envelope
// getCompatiblePrograms: returns incompatible when element Z missing from matrix
```

### Step 1b — implement

- `ELEMENT_DATA`: include atomic weights for all 118 elements (use standard IUPAC 2021 values; precision to 3 decimal places is sufficient).
- `parseFormula`: use a regex parser — repeatedly match `([A-Z][a-z]?)(\d*)` from the formula string; each matched token becomes `{ atomicNumber: resolveElement(symbol), atomCount: parseInt(n) || 1 }`.
- `customCompoundsStore`: use a module-level `$state` wrapper object (`{ value: CustomCompoundStoreEnvelopeV1 }`) so reactivity works across components. Persist on every mutation via `localStorage.setItem("customCompounds", JSON.stringify(envelope))`.

### Done when

`pnpm test` green; then commit:

```
feat(compounds): add element-data, formula-parser, and custom-compounds store
```

---

## Task 2 — WASM layer: custom compound C wrappers + TypeScript interface

> **Depends on nothing** (can proceed in parallel with Task 1 if desired, but
> must be committed before Tasks 4 and 5).
> **Requires WASM rebuild.**

**Spec:** `docs/04-feature-specs/custom-compounds.md` §5 (WASM Integration),
`docs/06-wasm-api-contract.md` §2.5 + the four service method signatures.

### Acceptance criteria

- Four new C wrapper functions added to `wasm/dedx_extra.{h,c}`:
  - `dedx_calculate_custom_forward_flat` — allocates a `dedx_config` workspace with `elements_id`/`elements_atoms`/`density_set`/`ivalue_set`, then loops over `n_energies` calling `dedx_get_stp` + `dedx_get_csda`, writing results into caller-provided output arrays.
  - `dedx_get_inverse_csda_custom_flat` — same config setup, calls `dedx_get_inverse_csda` (the internal scalar function, not the flat JS-facing one) for a single range value.
  - `dedx_get_inverse_stp_custom_flat` — same config setup, calls the internal inverse STP lookup for a single STP value + side.
  - `dedx_get_bragg_peak_stp_custom_flat` — same config setup, calls the existing `dedx_get_bragg_peak_stp` pattern from `dedx_extra.c`.
- `wasm/build.sh` EXPORTED_FUNCTIONS updated with all four new symbols.
- WASM rebuilt (`wasm/build.sh`); `wasm/verify.mjs` passes with all checks.
- `wasm/contract-manifest.json` updated with the four new exports under a `dedx_extra_custom_compound` key and `serviceBacking` entries for the 4 new service methods.
- `LibdedxService` interface in `src/lib/wasm/types.ts` gains all four methods with exact signatures from `docs/06-wasm-api-contract.md`.
- `LibdedxServiceImpl` in `src/lib/wasm/libdedx.ts` implements all four methods using the new flat C functions via `this.module._dedx_...`.
- Both mock classes in `src/lib/wasm/__mocks__/libdedx.ts` implement all four with deterministic stub return values (see below).
- `src/tests/contracts/service-interface.contract.test.ts` passes with the 4 new methods added to the runtime method-presence checks.
- `pnpm test` and `pnpm build` exit 0.

### Step 2a — C wrappers in `wasm/dedx_extra.c`

Study the existing `dedx_get_inverse_stp_flat` function carefully — it sets up a
`dedx_config` via `dedx_load_config`, allocates a workspace with
`dedx_allocate_workspace`, calls the core function, then frees both. Follow the
**same lifecycle**.

For the custom compound variants, the difference is:

- Set `cfg->target = 0` (custom compound path in libdedx)
- Set `cfg->elements_id = elem_ids` (pointer to the caller's int array)
- Set `cfg->elements_atoms = elem_atoms` (pointer to the caller's double array)
- Set `cfg->elements_length = n_elements`
- If `density > 0`: set `cfg->density_set = density` (the field that overrides the target's built-in density)
- If `ivalue > 0`: set `cfg->ivalue_set = ivalue` (optional I-value override; 0 means "not set")

**Signatures to add to `wasm/dedx_extra.h`:**

```c
/**
 * Forward stopping-power and CSDA calculation for a user-defined compound.
 * @param n_elements   Number of elements in the compound
 * @param elem_ids     Array of atomic numbers Z (length n_elements)
 * @param elem_atoms   Array of atom counts per formula unit (length n_elements)
 * @param density      Material density in g/cm³ (must be > 0)
 * @param ivalue       Mean excitation energy in eV (0 = not set; use Bragg additivity)
 * @param n_energies   Number of energy points
 * @param energies     Array of kinetic energies in MeV/nucl (length n_energies)
 * @param stp_out      Output array for stopping powers in MeV·cm²/g (length n_energies)
 * @param csda_out     Output array for CSDA ranges in g/cm² (length n_energies)
 * @param err          Receives error code (0 on success)
 */
void dedx_calculate_custom_forward_flat(
    int program, int ion,
    int n_elements, int *elem_ids, double *elem_atoms,
    double density, double ivalue,
    int n_energies, double *energies,
    double *stp_out, double *csda_out,
    int *err
);

/** Inverse CSDA for a custom compound: given a CSDA range in g/cm², returns energy in MeV/nucl. */
double dedx_get_inverse_csda_custom_flat(
    int program, int ion,
    int n_elements, int *elem_ids, double *elem_atoms,
    double density, double ivalue,
    double range_gcm2,
    int *err
);

/** Inverse STP for a custom compound: given STP in MeV·cm²/g, returns energy in MeV/nucl.
 *  side=0 → low-energy branch; side=1 → high-energy branch. */
double dedx_get_inverse_stp_custom_flat(
    int program, int ion,
    int n_elements, int *elem_ids, double *elem_atoms,
    double density, double ivalue,
    double stp_mevcm2g, int side,
    int *err
);

/** Bragg peak stopping power for a custom compound, in MeV·cm²/g. */
double dedx_get_bragg_peak_stp_custom_flat(
    int program, int ion,
    int n_elements, int *elem_ids, double *elem_atoms,
    double density, double ivalue,
    int *err
);
```

### Step 2b — TypeScript service methods

**Method signatures to add to `LibdedxService` in `src/lib/wasm/types.ts`:**

```typescript
calculateCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;  // { name, elements: [{atomicNumber, atomCount}], density, iValue? }
  energies: number[];        // in MeV/nucl
  options?: AdvancedOptions; // only interpolation + mstarMode are honoured; density/ival/phase from compound
}): CalculationResult;

getPlotDataCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
  pointCount: number;
  logScale: boolean;
}): CalculationResult;  // generated JS-side by calling calculateCustomCompound iteratively

getInverseStpCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
  stoppingPowers: number[];  // in MeV·cm²/g
  side: 0 | 1;
}): (InverseStpResult | LibdedxError)[];

getInverseCsdaCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
  ranges: number[];           // in g/cm²
}): (InverseCsdaResult | LibdedxError)[];

getBraggPeakStpCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
}): number;   // MeV·cm²/g; throws LibdedxError on failure
```

**In `src/lib/wasm/libdedx.ts`:**

- `calculateCustomCompound`: use `_malloc` to allocate `Int32Array` (elem_ids) and `Float64Array` (elem_atoms, energies, stp_out, csda_out), write compound data, call `_dedx_calculate_custom_forward_flat`, read results, free all.
- `getPlotDataCustomCompound`: JS-side only — call `_dedx_get_min_energy` + `_dedx_get_max_energy` (look at how `calculate()` obtains energy bounds), generate `pointCount` log- or linear-spaced energies, call `calculateCustomCompound` iteratively, accumulate results.
- `getInverseStpCustomCompound` and `getInverseCsdaCustomCompound`: loop over input values; per value malloc+call+free the C wrapper.
- `getBraggPeakStpCustomCompound`: single call.
- Initialize error pointer to 0 before every call (lessons-learned — uninitialized memory bug from Stage 6.9).

**In `src/lib/wasm/__mocks__/libdedx.ts`** (both mock classes):

```typescript
calculateCustomCompound(params) {
  return {
    energies: params.energies,
    stoppingPowers: params.energies.map(() => 50.0),
    csdaRanges: params.energies.map(() => 1.5),
  };
}
getPlotDataCustomCompound(params) {
  const n = params.pointCount;
  const energies = Array.from({ length: n }, (_, i) => 0.1 + i * 10);
  return {
    energies,
    stoppingPowers: energies.map(() => 50.0),
    csdaRanges: energies.map(() => 1.5),
  };
}
getInverseStpCustomCompound(params) {
  return params.stoppingPowers.map((stp) => ({
    energy: params.side === 0 ? stp * 0.5 : stp * 5,
    stoppingPower: stp,
  }));
}
getInverseCsdaCustomCompound(params) {
  return params.ranges.map((r) => ({ energy: r * 15, csdaRange: r }));
}
getBraggPeakStpCustomCompound(_params) { return 95.0; }
```

### Step 2c — contract tests

Add to `src/tests/contracts/service-interface.contract.test.ts`:

```
typeof service.calculateCustomCompound → "function"
typeof service.getPlotDataCustomCompound → "function"
typeof service.getInverseStpCustomCompound → "function"
typeof service.getInverseCsdaCustomCompound → "function"
typeof service.getBraggPeakStpCustomCompound → "function"
```

### Done when

`pnpm test` green; WASM rebuilt and `node wasm/verify.mjs` passes; then commit:

```
feat(wasm): add custom compound C wrappers and TypeScript service methods
```

---

## Task 3 — URL codec: `material=custom` + `mat_*` params

> **Depends on nothing** (pure string manipulation, no WASM, no Svelte).

**Spec:** `docs/04-feature-specs/custom-compounds.md` §6 URL Encoding (§6.1
ABNF, §6.2 Canonicalization step 9, §6.3 Conditional enablement, §6.4 Round-
trip guarantee, §6.5 Parse validation, §6.6 Example URLs).

### Acceptance criteria

- `CalculatorUrlState` in `src/lib/utils/calculator-url.ts` gains:
  ```typescript
  materialIsCustom?: boolean;        // true → emit material=custom
  matName?: string;                  // compound display name (percent-encoded in URL)
  matDensity?: number;               // g/cm³
  matElements?: Array<{ atomicNumber: number; atomCount: number }>; // sorted ascending Z
  matIval?: number;                  // eV; omitted when absent
  matPhase?: "gas" | "condensed";    // omitted when "condensed" (default)
  ```
- `encodeCalculatorUrl`: when `materialIsCustom`, emit `material=custom` (in place of the numeric material param) followed by — in step-9 canonicalization order — `mat_name`, `mat_density`, `mat_elements`, `mat_ival` (omit if absent), `mat_phase` (omit if "condensed"). `mat_elements` is `Z1:count1,Z2:count2,...` with elements in ascending Z order; atom counts serialized via `Number.prototype.toString()`.
- `decodeCalculatorUrl`: if `material=custom`, set `materialIsCustom=true` and parse `mat_name`, `mat_density`, `mat_elements`, `mat_ival`, `mat_phase` per spec §6.5 validation table (missing/invalid → fallback + warning flag). Invalid individual `mat_elements` Z or count entries are dropped silently; if no valid elements remain, treat as missing.
- A `fromUrlWarning?: string` field on the decoded state indicates the specific validation failure (used by the UI to show the warning banner).
- `PlotUrlState` in `src/lib/utils/plot-url.ts` gains the same `materialIsCustom` + `mat_*` fields and the same encode/decode logic for the plot page URL.
- All round-trips pass; malformed inputs recover to defaults without throwing.
- `pnpm test` green.

### Step 3a — tests first

**`src/tests/unit/custom-compound-url.test.ts`** — fixture table (all rows must round-trip):

```
PMMA (C₅H₈O₂, ρ=1.19, condensed, no iValue):
  encode → "material=custom&mat_name=PMMA&mat_density=1.19&mat_elements=1%3A8%2C6%3A5%2C8%3A2"
  decode → { materialIsCustom: true, matName: "PMMA", matDensity: 1.19,
             matElements: [{atomicNumber:1,atomCount:8},{atomicNumber:6,atomCount:5},{atomicNumber:8,atomCount:2}] }
  mat_phase omitted (condensed default) ✓

Custom Water (H₂O, ρ=1.0, gas):
  encode → includes "mat_phase=gas"
  decode → { matPhase: "gas" }

PMMA with I-value 74 eV:
  encode → includes "mat_ival=74"
  decode → { matIval: 74 }

mat_density missing → { fromUrlWarning: "Custom compound data missing from URL" }
mat_elements all invalid → { fromUrlWarning: "Custom compound data missing from URL" }
mat_ival=0 → silently ignored (matIval absent)
mat_phase=unknown → silently ignored (defaults to "condensed")
duplicate Z in mat_elements (1:2,1:3) → collapsed by summing → {atomicNumber:1, atomCount:5}

Compound name with special chars "&PMMA=test":
  encode → percent-encoded via encodeURIComponent
  decode → exact original string restored
```

Add to `src/tests/contracts/url-codec.contract.test.ts`:

```
Round-trip: material=custom + mat_* → encode → decode → same compound fields
```

### Step 3b — implement

In `encodeCalculatorUrl` / `decodeCalculatorUrl`:

- Use standard `URLSearchParams` for percent-encoding (via `params.set("mat_name", state.matName)` and `params.get("mat_name")` + `decodeURIComponent`).
- In decode: a `fromUrlWarning` string is returned as part of the state (not a thrown error) — the Calculator page reads it and renders the warning banner.

### Done when

`pnpm test` green; then commit:

```
feat(url): add material=custom and mat_* params to URL codec
```

---

## Task 4 — Compound editor modal + entity selection integration

> **Depends on Task 1** (uses `customCompoundsStore`, `parseFormula`,
> `resolveElement`). Task 2 is not required (editor uses no WASM).

**Spec:** `docs/04-feature-specs/custom-compounds.md` §2 (entity selection),
§3 (compound editor), §4 (validation), §AC-1–AC-7b, §Acceptance Scenarios
1, 2, 5, 5b, §Appendix data-testid.

### Acceptance criteria

- `src/lib/components/CompoundEditorModal.svelte` — modal dialog with:
  - Name input (`data-testid="compound-name-input"`)
  - Density input (`data-testid="compound-density-input"`) with "g/cm³" label
  - I-value input (`data-testid="compound-ival-input"`) with "eV" label (optional)
  - Phase segmented control (Gas / Condensed; default Condensed)
  - Mode toggle (Formula / Weight fraction; default Formula)
  - Element rows: each row has an element selector + atom count input + remove button (formula mode) or weight % input (weight-fraction mode)
  - "Add element" button
  - Live weight-fraction sum indicator (`data-testid="compound-sum-indicator"`) — only shown in weight-fraction mode; error colour when sum ∉ [99.9, 100.1]%
  - Inline validation error (`data-testid="compound-validation-error"`) for formula parse failures, density out-of-range, atom count violations
  - "Save" button (`data-testid="compound-save-btn"`) — disabled when validation fails or weight-fraction sum out of range
  - "Cancel" button
  - "Delete" button (edit mode only) with secondary confirmation dialog
  - Duplicate-name warning shown inline (does not block save)
  - Props: `mode: "new" | "edit"`, `initialCompound?: StoredCustomCompoundV1`, callbacks: `onSave`, `onCancel`, `onDelete`
  - On open in new mode: name input receives focus
  - `data-testid="compound-editor-modal"` on the modal container
- Entity selection — Calculator page combobox:
  - "Custom Compounds" group at the bottom of the material dropdown (below built-in compounds), with header text "Custom Compounds" (`data-testid="compound-group"`)
  - Each custom compound entry: name (bold) + density in g/cm³ + edit icon (✏) + delete icon (🗑) + "(custom)" badge
  - Text filter applies to custom compound names (same filter input)
  - "+ Add compound" button at the bottom of the group (`data-testid="compound-add-btn"`)
  - Entire "Custom Compounds" group **absent from the DOM** (not hidden) when `isAdvancedMode.value === false`
- Entity selection — Plot page sidebar:
  - "Custom" sub-list below the built-in "Compounds" sub-list (`data-testid="plot-compound-group"`)
  - Same name + density + badge display
  - Absent from DOM in Basic mode
- Program compatibility filter:
  - Incompatible programs (missing elemental data for any compound element) greyed out in the program selector with a tooltip listing the missing element symbols and Z values
  - Uses `customCompoundsStore.getCompatiblePrograms()` — re-evaluated reactively when the active compound's element list changes
- `pnpm test` and `pnpm build` exit 0.

### Step 4a — tests first (`tests/e2e/custom-compounds.spec.ts`)

Create the new E2E file with exactly the Playwright snippets from the spec:

```typescript
import { test, expect } from "@playwright/test";

test("custom compound: create LiF-pellet and verify CSDA range @smoke", async ({ page }) => {
  // verbatim from spec §Scenario 1
});

test("custom compound: create H2O and see calculation @smoke", async ({ page }) => {
  // verbatim from spec §Scenario 2
});

test("custom compound: invalid formula blocks save @regression", async ({ page }) => {
  // verbatim from spec §Scenario 5
});

test("custom compound: density > 25 blocks save @regression", async ({ page }) => {
  // verbatim from spec §Scenario 5b
});
```

Use `test.skip(!wasmPresent, "WASM binary absent")` guard for tests that require
real WASM computation. DOM-structural tests (Basic mode gate, editor validation)
do not need WASM.

### Step 4b — implement

**Compound editor modal:**

- Use a Bits UI Dialog primitive (`bits-ui` is already a dependency; see `vendor/bits-ui/` for source). Open/close via `bind:open`.
- Weight-fraction mode: store weight % per element row. Compute `n_i = w_i / M_i` using `ELEMENT_DATA.atomicWeight` for live display. Sum displayed below rows with colour coding.
- Formula mode: call `parseFormula()` on blur / save to produce element array.
- On save: call `customCompoundsStore.create()` or `customCompoundsStore.update()`. On ValidationError, display message in `compound-validation-error`.

**Entity selection integration:**

- In `src/routes/calculator/+page.svelte` (or the existing entity selector component): read `customCompoundsStore.compounds` reactively; render "Custom Compounds" group inside `{#if isAdvancedMode.value}`.
- Store the active material as a `MaterialRef` union: `{ kind: "builtin"; id: number } | { kind: "custom"; id: string }` (as defined in spec §6.10.2).
- "Custom" compounds are never greyed out for particle/program selection (spec §2.3).

### Done when

`pnpm lint && pnpm test` green; E2E Scenarios 1, 2, 5, 5b pass or `test.skip`
with WASM absent note. Then commit:

```
feat(compounds): add compound editor modal and entity selection integration
```

---

## Task 5 — Calculator + Plot page integration + export behavior

> **Depends on Tasks 1, 2, 3, 4.**

**Spec:** `docs/04-feature-specs/custom-compounds.md` §5.1–5.6 (WASM
integration, interaction with Advanced Options, inverse lookup, default unit),
§6 (URL encoding), §8 (export), §9 (edge cases), §AC-8–AC-13,
§Reactive Triggers Matrix, §Cross-Page Parity Checklist, §Acceptance Scenarios
3, 4, 6, §6.10.1 scenarios 4–7.

### Acceptance criteria

**Calculator page (`src/routes/calculator/+page.svelte`):**

- When the active material `ref.kind === "custom"`, forward calculation calls `service.calculateCustomCompound()` instead of `service.calculate()`.
- Reactive dep snapshot rule (lessons-learned Entry 1): `customCompoundsStore.getById(ref.id)` and all other reactive deps are read **synchronously** at the top of the calculation `$effect`, before any `getService().then()`.
- When active material switches to Basic mode: fall back to built-in liquid water (ID 276); retain the custom compound ref in memory; restore on switch back to Advanced mode.
- URL sync: when a custom compound is active in Advanced mode, emit `material=custom` + all `mat_*` params (via `encodeCalculatorUrl`). On URL init (`decodeCalculatorUrl`): if `materialIsCustom`, reconstruct a transient `StoredCustomCompoundV1` from `mat_*` params.
- "Compound from shared URL" banner (`data-testid="compound-from-url-banner"`): shown when URL contains `material=custom` and the compound ID/name is **not** in `localStorage`. Banner contains "Save to library" and "Dismiss" buttons. "Save to library" calls `customCompoundsStore.create()`.
- Advanced Options panel disabling: when a custom compound is active, disable the density override, I-value override, and aggregate state toggle fields, each with the appropriate tooltip from spec §5.3. Interpolation and MSTAR controls remain active.
- Default display unit: read `compound.phase` ("condensed" → keV/µm, "gas" → MeV·cm²/g) analogously to `isGasByDefault` for built-in materials.
- Inverse lookup tabs (Range + Inverse STP): when a custom compound is active, use `service.getInverseCsdaCustomCompound()` and `service.getInverseStpCustomCompound()` respectively. The `getBraggPeakStpCustomCompound()` hint is used for the Bragg peak line.
- Multi-program mode: each program calls `calculateCustomCompound()` independently; one program's runtime error does not abort others.

**Plot page (`src/routes/plot/+page.svelte`):**

- When a custom compound series is added, `getPlotDataCustomCompound()` generates the dense energy grid. Series label shows compound name + "(custom)" badge.
- Custom compound series in the `{#if isAdvancedMode.value}` guard; switching to Basic mode removes custom compound series from the series list (they are NOT restored on re-entry to Advanced mode).
- URL sync on plot page: same `material=custom` + `mat_*` params when a custom compound is the selected material for a new series.
- "Compound from shared URL" banner on plot page too, with same logic.

**Export behavior:**

- CSV filename: `dedx_{compoundName}_custom_{particle}_{program}.csv` (spaces replaced with underscores in compound name).
- Advanced PDF metadata `MATERIAL` row: `"{name} (custom)  ρ = {density} g/cm³"` for condensed; `"{name} (custom, gas)  ρ = {density} g/cm³"` for gas.
- Elemental composition table below MATERIAL row (advanced PDF only): columns Element, Z, Atom count, Weight % — all per spec §8.2.
- If I-value override stored: "I-value override: X eV (built-in Bragg additivity bypassed)" line below the table.

**Cross-page parity checklist (from implementer.md):**

Before declaring any task done, verify on **both** calculator and plot pages:

```
[ ] Panel gating:     isAdvancedMode.value guard on custom compound group
[ ] URL init:         mat_* parsed in the URL init $effect
[ ] Persistence:      mat_* emitted in the URL sync $effect
[ ] Reactive-dep:     customCompoundsStore.getById() read synchronously before .then()
```

### Step 5a — tests first (`tests/e2e/custom-compounds.spec.ts`, append)

```typescript
test("custom compound: URL round-trip survives reload @regression", async ({ page }) => {
  // verbatim from spec §Scenario 3
});

test("custom compound: from-URL banner + save flow @regression", async ({ page }) => {
  // verbatim from spec §Scenario 4 / §6.10.1 scenario 7
});

test("custom compound: created on Calculator available on Plot page @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 6
});
```

### Step 5b — implement

**`$effect` pattern for calculation dispatch** (lessons-learned Entry 1):

```typescript
$effect(() => {
  // Read ALL reactive deps synchronously
  const ref = entityState.activeMaterialRef; // { kind, id }
  const compound = ref?.kind === "custom" ? (customCompoundsStore.getById(ref.id) ?? null) : null;
  const energies = energyRowsState.parsedEnergies;
  const particle = entityState.selectedParticle;
  const program = entityState.selectedProgram;
  const advOpts = advancedOptions.value; // snapshot
  if (!particle || !program || !energies.length) return;

  getService().then((svc) => {
    if (compound) {
      // Use frozen snapshots inside .then()
      calcState.setResult(
        svc.calculateCustomCompound({
          programId: program.id,
          particleId: particle.id,
          compound: {
            name: compound.name,
            elements: compound.elements,
            density: compound.density,
            iValue: compound.iValue,
          },
          energies,
          options: { interpolation: advOpts.interpolation, mstarMode: advOpts.mstarMode },
        }),
      );
    } else {
      calcState.setResult(
        svc.calculate({
          programId: program.id,
          particleId: particle.id,
          materialId: (ref as { kind: "builtin"; id: number }).id,
          energies,
          options: advOpts,
        }),
      );
    }
  });
});
```

**Advanced Options disable rules:** add `isCustomCompoundActive` derived signal
that is `true` when `activeMaterialRef?.kind === "custom"`. Pass it as a prop to
`AdvancedOptionsPanel` and apply `disabled` + `title` attributes to the density,
I-value, and aggregate-state controls.

**Missing-reference fallback:** in the URL init `$effect`, after parsing `mat_*`
params, if `materialIsCustom && !matName` (or density/elements missing), set
`fromUrlWarning` and fall back to built-in water. If `materialIsCustom` and params
are complete but compound is not in `localStorage`, reconstruct a transient object
and show the "from URL" banner.

### Done when

`pnpm lint && pnpm test` green; E2E Scenarios 3, 4, 6 pass or `test.skip`-ed with
WASM absent note; cross-page parity checklist verified. Then commit:

```
feat(calculator): wire custom compound calculation, URL sync, and export
feat(plot): wire custom compound series and Basic-mode guard
```

---

## Cross-task notes

- Task 1 must be committed before Task 4 (editor uses the store and formula parser).
- Task 2 must be committed before Task 5 (WASM methods needed for dispatch).
- Task 3 must be committed before Task 5 (URL codec needed for URL sync).
- Task 4 must be committed before Task 5 (entity selection integration).
- Tasks 1, 2, 3 are independent and can start in parallel.
- After all tasks: write `CHANGELOG-AI.md` entry and
  `docs/ai-logs/YYYY-MM-DD-stage6-10-custom-compounds.md` per AI Logging rules.
- Run `pnpm guard:staged` before every commit (guards against generated artifacts,
  vendor gitlink changes, and WASM binaries — see `.opencode/agents/implementer.md`).
- **Do not push** the branch unless explicitly requested. Output the manual push
  command in your `TASK DONE` message.
