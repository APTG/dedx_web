# opencode task prompt — 2026-05-07

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation (TDD)
> **Branch:** `qwen/stage6-9-inverse-lookups`
> **MCPs needed:** playwright, tailwind, svelte
> **TDD rule:** Write the failing test(s) first, then minimal impl. Fix all
> lint/type errors before committing.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 runes, build commands, AI logging rules.
2. `.opencode/lessons-learned.md` — **MUST READ before writing any reactive
   code.** Entries 1, 2, 3, 4, 5 are all directly relevant to this session.
3. `docs/04-feature-specs/inverse-lookups.md` (Final v6) — the normative spec.
   Read the entire file. Key sections: §1 Feature Gate, §2 Tab Layout, §3
   Shared Context, §4 Range Tab, §5 Inverse STP Tab, §6 Energy Output
   Auto-Scaling, §9 URL State Encoding, §Acceptance Scenarios (all 8),
   §Appendix: data-testid Reference.
4. `docs/06-wasm-api-contract.md` §§2.3, 3 — `InverseStpResult`,
   `InverseCsdaResult`, and the full service interface signatures for
   `getInverseStp`, `getInverseCsda`, `getBraggPeakStp`, `getDensity`,
   `convertEnergy`.
5. `src/lib/wasm/types.ts` — current `LibdedxService` interface (missing the 5
   inverse-lookup methods; you will add them in Task 1).
6. `src/lib/wasm/libdedx.ts` — real WASM implementation (you will add the
   C-binding calls); the WASM module exposes:
   `_dedx_get_inverse_stp(wsPtr, cfgPtr, stp_value, side, errPtr) → double`
   `_dedx_get_inverse_csda(wsPtr, cfgPtr, range_value, errPtr) → double`
   `_dedx_get_bragg_peak_stp(wsPtr, cfgPtr, errPtr) → double`
   `_dedx_get_density(materialId, errPtr) → float`
   (each returns a negative sentinel on error; check errPtr for the code).
7. `src/lib/wasm/__mocks__/libdedx.ts` — both mock classes; must be updated
   in lock-step with the interface (lessons-learned Entry 4).
8. `src/lib/utils/calculator-url.ts` — existing URL codec; you will extend
   `CalculatorUrlState`, `encodeCalculatorUrl`, and `decodeCalculatorUrl` with
   `imode`, `ivalues`, and `iunit` (Task 2).
9. `src/lib/utils/unit-conversions.ts` — existing STP unit helpers:
   `stpMassToKevUm()`, `stpMassToMeVcm()`, `csdaGcm2ToCm()` — use these
   instead of reimplementing the maths.
10. `src/lib/utils/energy-conversions.ts` — existing energy conversion helpers.
11. `src/routes/calculator/+page.svelte` — Calculator page (697 lines); you will
    add the tab switcher, Range tab, and Inverse STP tab here.
12. `src/lib/state/advanced-mode.svelte.ts` — `isAdvancedMode` singleton; the
    tab switcher must be gated on `isAdvancedMode.value`.
13. `src/lib/state/entity-selection.svelte.ts` — `EntitySelectionState`; both
    inverse tabs share the same selection as the Forward tab.
14. `src/tests/contracts/service-interface.contract.test.ts` — add the 5 new
    methods to the runtime method-presence checks (Task 1).
15. `src/tests/contracts/url-codec.contract.test.ts` — add inverse-lookup
    round-trip scenarios (Task 2).

Key source files (read before writing code):

- `src/lib/wasm/types.ts`
- `src/lib/wasm/libdedx.ts`
- `src/lib/wasm/__mocks__/libdedx.ts`
- `src/lib/utils/calculator-url.ts`
- `src/lib/utils/unit-conversions.ts`
- `src/lib/utils/energy-conversions.ts`
- `src/routes/calculator/+page.svelte`
- `src/lib/state/advanced-mode.svelte.ts`
- `src/lib/state/energy-rows.svelte.ts` (row management pattern to follow)

Test files (read before writing tests):

- `src/tests/contracts/service-interface.contract.test.ts`
- `src/tests/contracts/url-codec.contract.test.ts`
- `src/tests/unit/calculator-url.test.ts`
- `tests/e2e/calculator-advanced.spec.ts` (E2E pattern to follow)

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

## Task 1 — WASM service interface: add inverse-lookup methods

**Spec:** `docs/06-wasm-api-contract.md` §3 — service interface signatures.

### Acceptance criteria

- `LibdedxService` (in `src/lib/wasm/types.ts`) declares all five new methods
  with the exact signatures below.
- `LibdedxServiceImpl` (in `src/lib/wasm/libdedx.ts`) implements all five;
  `getInverseStp`, `getInverseCsda`, `getBraggPeakStp` call the C WASM functions
  in a per-value loop; `getDensity` calls `_dedx_get_density`; `convertEnergy`
  is pure TypeScript (uses `energy-conversions.ts` helpers).
- Both mock classes in `src/lib/wasm/__mocks__/libdedx.ts` implement all five
  with sensible stub return values.
- `src/tests/contracts/service-interface.contract.test.ts` passes with the
  5 new methods listed in the runtime checks.
- `pnpm test` and `pnpm build` exit 0.

### Step 1a — tests first (`src/tests/contracts/service-interface.contract.test.ts`)

Add to the runtime check blocks:

```
typeof service.getInverseStp → "function"
typeof service.getInverseCsda → "function"
typeof service.getBraggPeakStp → "function"
typeof service.getDensity → "function"
typeof service.convertEnergy → "function"
```

### Step 1b — implement

**Method signatures to add to `LibdedxService` in `src/lib/wasm/types.ts`:**

```typescript
getInverseStp(params: {
  programId: number;
  particleId: number;
  materialId: number;
  stoppingPowers: number[];   // in MeV·cm²/g
  side: 0 | 1;
  options?: AdvancedOptions;
}): (InverseStpResult | LibdedxError)[];

getInverseCsda(params: {
  programId: number;
  particleId: number;
  materialId: number;
  ranges: number[];           // in g/cm²
  options?: AdvancedOptions;
}): (InverseCsdaResult | LibdedxError)[];

getBraggPeakStp(params: {
  programId: number;
  particleId: number;
  materialId: number;
  options?: AdvancedOptions;
}): number;   // MeV·cm²/g; throws LibdedxError on failure

getDensity(materialId: number): number | undefined;

convertEnergy(params: {
  fromUnit: EnergyUnit;
  toUnit: EnergyUnit;
  massNumber: number;
  atomicMass: number;
  values: number[];
}): number[];
```

**In `src/lib/wasm/libdedx.ts`** (inside `LibdedxServiceImpl`):

- `getInverseStp`: loop over `stoppingPowers`; per value call
  `this.module._dedx_get_inverse_stp(wsPtr, cfgPtr, stp, side, errPtr)`;
  if errPtr contains a non-zero code throw `LibdedxError`; push result or
  error into the output array.
- `getInverseCsda`: same loop pattern using
  `this.module._dedx_get_inverse_csda(wsPtr, cfgPtr, range, errPtr)`.
- `getBraggPeakStp`: single call to
  `this.module._dedx_get_bragg_peak_stp(wsPtr, cfgPtr, errPtr)`;
  throw `LibdedxError` on non-zero errPtr.
- `getDensity`: call `this.module._dedx_get_density(materialId, errPtr)`;
  return `undefined` if errPtr non-zero.
- `convertEnergy`: delegate to the existing `convertEnergyFromMeVperNucl` /
  `convertEnergyFromMeVperU` helpers in `src/lib/utils/energy-conversions.ts`.
  (No WASM call needed.)

Look at how `calculate()` manages `wsPtr`, `cfgPtr`, and `errPtr` allocation to
follow the same malloc/free pattern; use `untrack` if needed.

**In `src/lib/wasm/__mocks__/libdedx.ts`** (both `LibdedxServiceImpl` and
`MockLibdedxServiceWithElectron`):

Stub implementations — exact values are not used by unit tests, just presence:

```typescript
getInverseStp(params) {
  // Return a plausible low/high energy depending on side
  return params.stoppingPowers.map((stp) => ({
    energy: params.side === 0 ? stp * 2 : stp * 10,
    stoppingPower: stp,
  }));
}
getInverseCsda(params) {
  return params.ranges.map((r) => ({ energy: r * 13, csdaRange: r }));
}
getBraggPeakStp(_params) { return 80.0; }   // keV/µm representative value
getDensity(_materialId) { return 1.0; }
convertEnergy(params) { return params.values; } // identity for unit tests
```

### Done when

`pnpm test` green; then commit:

```
feat(wasm): add getInverseStp, getInverseCsda, getBraggPeakStp, getDensity, convertEnergy to LibdedxService
```

---

## Task 2 — URL codec: add imode / ivalues / iunit

> **Depends on nothing** (pure URL string manipulation, no WASM).

**Spec:** `docs/04-feature-specs/inverse-lookups.md` §9 URL State Encoding.

### Acceptance criteria

- `CalculatorUrlState` gains three optional fields:
  `imode?: "csda" | "stp"`, `ivalues?: InverseLookupUrlRow[]`,
  `iunit?: string` (a length unit for csda or an STP unit token for stp).
- `encodeCalculatorUrl` emits `imode`, `ivalues`, and `iunit` params (in that
  order after existing params) when `imode` is set.
- `decodeCalculatorUrl` reads and validates these params; invalid values are
  silently ignored (decoded as `undefined`).
- URL round-trips for both `imode=csda` and `imode=stp` with per-row unit
  suffixes are tested and pass.
- Lessons-learned Entry 5: every union member is tested (all valid `iunit`
  tokens for both modes).
- `pnpm test` green.

### Step 2a — tests first (`src/tests/unit/calculator-url.test.ts` and
`src/tests/contracts/url-codec.contract.test.ts`)

Fixture table — all rows must round-trip:

```
imode=csda, ivalues="7.718:cm,45:um,0.2", iunit="cm"
  → decoded: imode=csda, 3 rows [7.718/cm/explicit, 45/um/explicit, 0.2/cm/master]
  → re-encoded search string contains "imode=csda" and "ivalues=7.718:cm,45:um,0.2" and "iunit=cm"

imode=stp, ivalues="45.76,10.00", iunit="kev-um"
  → decoded: imode=stp, 2 rows [45.76/kev-um/master, 10.00/kev-um/master]
  → re-encoded contains "imode=stp" and "ivalues=45.76,10.00" and "iunit=kev-um"

imode=csda with iunit="km"  (invalid length unit)
  → decoded: iunit silently defaults to "cm"

no imode param → imode is undefined (Forward tab active)
```

### Step 2b — implement

**Extend `CalculatorUrlState`** with:

```typescript
imode?: "csda" | "stp";
ivalues?: InverseLookupUrlRow[];  // new interface, see below
iunit?: string;
```

Add near the top of `calculator-url.ts`:

```typescript
export interface InverseLookupUrlRow {
  rawInput: string;
  unit: string;       // length suffix (nm/um/mm/cm/m) or STP unit token
  unitFromSuffix: boolean;
}

const VALID_CSDA_MASTER_UNITS = new Set(["nm", "um", "mm", "cm", "m"]);
const VALID_STP_MASTER_UNITS = new Set(["kev-um", "mev-cm", "mev-cm2-g"]);
```

In `encodeCalculatorUrl`: after all existing params, if `state.imode`:

```
params.set("imode", state.imode);
if (state.ivalues?.length) {
  params.set("ivalues", encodeIvalues(state.ivalues, state.iunit));
}
if (state.iunit) params.set("iunit", state.iunit);
```

Encode each row as `rawInput:unit` when `unitFromSuffix`, else bare `rawInput`.
Comma-separated — same approach as `energies`.

In `decodeCalculatorUrl`: parse `imode` (accept only "csda" | "stp"), then
`ivalues` (split on comma, split on last colon for optional per-row suffix),
then `iunit` (validate against the appropriate set for the decoded `imode`;
default: `"cm"` for csda, `"kev-um"` for stp).

### Done when

`pnpm test` green; then commit:

```
feat(url): add imode/ivalues/iunit to calculator URL codec
```

---

## Task 3 — Utilities: range suffix parser + energy auto-scaling

> **Depends on nothing** (pure TypeScript, no WASM).

**Spec:** `docs/04-feature-specs/inverse-lookups.md` §4.3 (length suffixes),
§6 (energy auto-scaling prefix ladder).

### Acceptance criteria

- `parseLengthInput(text)` in `src/lib/utils/range-parser.ts` returns
  `{ value: number; unit: string; toCm: number }` for valid inputs,
  `{ error: string }` for unrecognized suffixes, and `{ empty: true }` for
  blank inputs.
- `autoScaleEnergy(valueMev, unit)` in `src/lib/utils/energy-autoscale.ts`
  returns `{ display: string; prefix: string }` using the 4-step prefix ladder
  from spec §6: ≥1000 → GeV, ≥1 → MeV, ≥0.001 → keV, <0.001 → eV.
- Unit tests in `src/tests/unit/range-parser.test.ts` and
  `src/tests/unit/energy-autoscale.test.ts` all pass.

### Step 3a — tests first

**`range-parser.test.ts`** fixture table:

```
"7.718 cm"  → { value: 7.718, unit: "cm", toCm: 1 }
"45 µm"     → { value: 45,    unit: "µm", toCm: 1e-4 }
"45 um"     → { value: 45,    unit: "µm", toCm: 1e-4 }   // alias
"30 m"      → { value: 30,    unit: "m",  toCm: 100 }
"0.2"       → { value: 0.2,   unit: null, toCm: null }   // no suffix
"abc"       → { error: "Enter a numeric value" }
"1.5 km"    → { error: "Unrecognized unit 'km'" }
"-5 cm"     → { value: -5,    unit: "cm", toCm: 1 }      // negative allowed at parse; caller validates sign
""          → { empty: true }
```

Supported suffixes (case-insensitive): `nm` (×1e-7 cm), `µm`/`um` (×1e-4 cm),
`mm` (×1e-1 cm), `cm` (×1), `m` (×100 cm).

**`energy-autoscale.test.ts`** fixture table (from spec §6):

```
0.001   MeV → "1.000 keV"
0.0005  MeV → "500.0 eV"
1.0     MeV → "1.000 MeV"
100.0   MeV → "100.0 MeV"
1200.0  MeV → "1.200 GeV"
9999.0  MeV → "9.999 GeV"
```

`formatEnergyWithUnit(valueMev, baseUnit)` should append the base unit suffix
(e.g. `"MeV"`, `"MeV/nucl"`, `"MeV/u"`) after prefix substitution:
`1200 MeV/nucl → "1.200 GeV/nucl"`.

Column header logic: `columnHeaderUnit(rows, baseUnit)` returns the common prefix
unit if all valid rows share the same prefix, else `"(auto)"`.

### Step 3b — implement

In `src/lib/utils/range-parser.ts`:

- Regex parse `^\s*([\d.eE+-]+)\s*([a-zµ]+)?\s*$` (case-insensitive).
- Normalize suffix: `um` → `µm`, lower-case comparison.
- Return `{ value, unit, toCm }` or `{ error }` or `{ empty }`.

In `src/lib/utils/energy-autoscale.ts`:

- `autoScaleEnergy(valueMev)`: apply prefix ladder, return `{ scaled, prefix }`.
- `formatEnergyWithUnit(valueMev, baseUnit)`: call `autoScaleEnergy`, format to
  4 significant figures (no scientific notation), append prefixed unit string.
- Use `formatSigFigs` from `src/lib/utils/unit-conversions.ts` for sig-fig
  formatting.

### Done when

`pnpm test` green; then commit:

```
feat(utils): add range suffix parser and energy auto-scaling helpers
```

---

## Task 4 — Calculator page: tab switcher + Range tab (single-program)

> **Depends on Tasks 1, 2, 3.**

**Spec:** `docs/04-feature-specs/inverse-lookups.md` §1 (feature gate), §2 (tab
layout), §4 (Range tab), §7 (shared table behaviour), §Acceptance Scenarios
1, 2, 4, 6, 7 (Range parts), §Appendix data-testid.

### Acceptance criteria

- In Basic mode: only the Forward tab content is visible; `[data-testid="inverse-tab-range"]`
  and `[data-testid="inverse-tab-stp"]` are absent from the DOM.
- In Advanced mode: a tab bar `[ Forward ] [ Range ] [ Inverse STP ]` appears
  between the Advanced Options accordion and the result table; switching
  `[data-testid="inverse-tab-range"]` replaces the result table with the Range
  tab content.
- Range tab shows: input column ("Range"), unit dropdown (`inverse-range-unit`),
  energy result column ("→ Energy (auto)"). Pre-filled with `7.718 cm` on first
  switch.
- Inline suffix detection runs on the Range tab: `30 m` → accepted, `0.03 km` →
  error text in `inverse-range-row-error-0` mentioning `"km"`.
- Switching from an inverse tab back to Forward restores the Forward table.
- Disabling Advanced mode while Range tab is active switches back to Forward.
- URL sync: on Range tab, `?imode=csda&ivalues=...&iunit=...` is written to the
  URL bar and restored on reload.
- All data-testid anchors from §Appendix that relate to the Range tab and tab
  buttons are present in the DOM.
- E2E tests for Scenarios 1, 2, 4, and the Range portions of Scenario 6 & 7
  pass (or are `test.skip`-ed when WASM binary is absent).

### Step 4a — tests first (`tests/e2e/inverse-lookups.spec.ts`)

Create the new E2E file with exactly the Playwright snippets from the spec
(Scenarios 1, 2, 4, 6, 7 Range parts):

```typescript
import { test, expect } from "@playwright/test";

test("Range tab: energy from CSDA range @smoke", async ({ page }) => {
  // verbatim from spec §Scenario 1
});

test("Range tab: URL round-trip @regression", async ({ page }) => {
  // verbatim from spec §Scenario 2
});

test("Advanced-mode gate: inverse tabs absent in Basic mode @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 4
});

test("Range tab: 'm' suffix accepted, 'km' rejected @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 6
});

test("Range tab: rejects negative and non-numeric input @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 7 — Range parts only
});
```

Use `test.skip(!wasmPresent, "WASM binary absent")` guard at the top of each
test that requires real WASM computation. Purely DOM-structural tests (Scenario 4
Basic mode gate) do not need WASM.

### Step 4b — implement

**In `src/routes/calculator/+page.svelte`:**

1. Add reactive state:
   ```typescript
   let activeTab = $state<"forward" | "range" | "stp">("forward");
   ```
   
2. Add inverse lookup input state (follow `energy-rows.svelte.ts` row pattern):
   ```typescript
   let rangeRows = $state<RangeRow[]>([{ id: 0, text: "", unit: "cm" }]);
   let rangeResults = $state<(string | "—" | null)[]>([]);
   ```

3. Tab switcher markup (inside the `{#if isAdvancedMode.value}` guard, below the
   Advanced Options accordion, above the result content):
   ```svelte
   <div role="tablist" aria-label="Calculation mode">
     <button role="tab" aria-selected={activeTab === "forward"}
       data-testid="inverse-tab-forward" onclick={() => (activeTab = "forward")}>
       Forward
     </button>
     <button role="tab" aria-selected={activeTab === "range"}
       data-testid="inverse-tab-range" onclick={() => (activeTab = "range")}>
       Range
     </button>
     <button role="tab" aria-selected={activeTab === "stp"}
       data-testid="inverse-tab-stp" onclick={() => (activeTab = "stp")}>
       Inverse STP
     </button>
   </div>
   ```

4. When `isAdvancedMode.value` becomes `false` while `activeTab !== "forward"`,
   reset `activeTab = "forward"` in a `$effect`.

5. Range tab calculation `$effect` — **follow lessons-learned Entry 1 EXACTLY**:
   ```typescript
   $effect(() => {
     // Snapshot ALL reactive deps synchronously before any async call
     const rows = rangeRows;
     const particle = state?.selectedParticle;
     const material = state?.selectedMaterial;
     const program = state?.selectedProgram;
     const advOpts = advancedOptions.value;        // ← snapshot, not live ref
     const density = material?.density;
     if (!particle || !material || !program || activeTab !== "range") return;
     getService().then((svc) => {
       // use frozen snapshots inside .then()
     });
   });
   ```

6. URL init: in the existing URL-init `$effect` (after `urlInitialized` guard),
   read `urlState.imode` and set `activeTab` and pre-fill range/stp rows.

7. URL persistence: extend the URL-sync `$effect` to include `imode`, `ivalues`,
   and `iunit` when `activeTab !== "forward"`. Use `untrack()` around
   `replaceState()` (lessons-learned Entry 1 / implementer rules).

8. Range tab table markup: below the tab bar, `{#if activeTab === "range"}`:
   - `<input data-testid="inverse-range-input-{i}" ...>` for each row
   - `<select data-testid="inverse-range-unit" ...>` master unit selector
   - Result cell: `<td data-testid="inverse-range-result-{i}">` or
     `<td data-testid="inverse-range-result-{i}-{programId}">` in multi-program
   - Error cell: `<span data-testid="inverse-range-row-error-{i}">` (absent when valid)

9. Suffix detection: run `parseLengthInput(row.text)` after the 300ms debounce;
   per-row mode activates when any row has an explicit suffix.

10. Validation before calling WASM:
    - Blank → skip (no WASM call)
    - Parse error → set error message, skip WASM
    - `value ≤ 0` → "Range must be positive"
    - Unrecognised suffix → "Unrecognized unit '{suffix}'"

11. Conversion: `range_gcm2 = range_cm * density`; if density is missing/≤0 →
    "Density not available for this material".

12. Energy display: call `formatEnergyWithUnit(energyMevPerNucl, masterUnit)`.

### Done when

`pnpm lint && pnpm test` green; E2E Scenarios 1, 2, 4 pass; 6 and 7 (Range) pass
or `test.skip` with WASM absent note. Then commit:

```
feat(calculator): add tab switcher and Range tab (inverse CSDA lookup)
```

---

## Task 5 — Inverse STP tab + multi-program layout + export filenames

> **Depends on Task 4.**

**Spec:** `docs/04-feature-specs/inverse-lookups.md` §5 (Inverse STP tab), §3
(multi-program layout), §8 (export), §Acceptance Scenarios 3, 5, 7 (STP), 8.

### Acceptance criteria

- Switching to `[data-testid="inverse-tab-stp"]` shows the Inverse STP tab:
  input column, unit dropdown (`inverse-stp-unit`), E low and E high result columns.
  Pre-filled with `45.76` keV/µm on first switch.
- Unit dropdown offers `keV/µm`, `MeV/cm`, `MeV·cm²/g`; default is `keV/µm` for
  non-gas, `MeV·cm²/g` for gas.
- `getInverseStp()` called twice per batch (side=0 and side=1); results wired to
  `inverse-stp-result-low-{i}` and `inverse-stp-result-high-{i}` cells.
- Above-Bragg-peak input shows `"—"` in both cells with no row highlight (valid
  outcome, not an error).
- Bragg peak hint line below the Inverse STP table shows `getBraggPeakStp()`;
  silently omitted if the call fails.
- Multi-program mode (Range tab): one energy result column per visible program;
  headers `{ProgramName} ({unit})`; cells `data-testid="inverse-range-result-{i}-{programId}"`.
- Multi-program mode (Inverse STP tab): one E low + one E high column per visible
  program; headers `{ProgramName} E low ({unit})` / `{ProgramName} E high ({unit})`;
  cells `data-testid="inverse-stp-result-low-{i}-{programId}"` and
  `data-testid="inverse-stp-result-high-{i}-{programId}"`.
- Export CSV filenames follow spec §8: `dedx_range_{particle}_{material}_{program}.csv`
  (single-program) / `dedx_range_{particle}_{material}.csv` (multi-program).
- E2E Scenarios 3, 5, 7 (STP parts), and 8 pass (or `test.skip`-ed with WASM absent).

### Step 5a — tests first (`tests/e2e/inverse-lookups.spec.ts`)

Append the remaining Playwright snippets from the spec:

```typescript
test("Inverse STP: no-solution cell shows em-dash @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 3
});

test("Inverse STP: dual-branch energies at 30 keV/µm @smoke", async ({
  page,
}) => {
  // verbatim from spec §Scenario 5
});

test("Inverse STP tab: rejects zero and non-numeric input @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 7 — STP parts
});

test("Range tab: multi-program shows one result column per program @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 8 — Range half
});

test("Inverse STP tab: multi-program shows E-low and E-high per program @regression", async ({
  page,
}) => {
  // verbatim from spec §Scenario 8 — STP half
});
```

### Step 5b — implement

**In `src/routes/calculator/+page.svelte`:**

1. Add Inverse STP reactive state analogous to Range tab:
   ```typescript
   let stpRows = $state<StpRow[]>([{ id: 0, text: "" }]);
   let stpUnit = $state<"keV/µm" | "MeV/cm" | "MeV·cm²/g">("keV/µm");
   let stpResultsLow = $state<(string | "—" | null)[]>([]);
   let stpResultsHigh = $state<(string | "—" | null)[]>([]);
   let braggPeakHint = $state<string | null>(null);
   ```

2. Inverse STP calculation `$effect` — same lessons-learned Entry 1 pattern:
   - Snapshot particle/material/program/advOpts/stpUnit synchronously.
   - Convert input values from selected unit to MeV·cm²/g using
     `stpKevUmToMass()` / `stpMeVcmToMass()` (derive from existing
     `unit-conversions.ts`).
   - Call `getInverseStp` twice: side=0 (E low) and side=1 (E high).
   - If result is `LibdedxError` → `"—"`; else format with
     `formatEnergyWithUnit`.

3. Bragg peak hint `$effect`:
   - Snapshot required deps synchronously.
   - Call `getBraggPeakStp()` after getting service.
   - On success: format to 4 sig figs, display
     `"Valid STP range: 0–{peak} keV/µm (…)"`.
   - On `LibdedxError`: set `braggPeakHint = null` (silently omit).

4. Default unit when material changes: watch `state?.selectedMaterial?.isGasByDefault`
   in a `$effect` and reset `stpUnit` to `"MeV·cm²/g"` for gas, `"keV/µm"` for
   non-gas. Do NOT clear typed values (spec §5.3: values are reinterpreted, not
   cleared).

5. STP tab markup: `{#if activeTab === "stp"}`:
   - `<input data-testid="inverse-stp-input-{i}">` per row
   - `<select data-testid="inverse-stp-unit">` unit dropdown
   - `<td data-testid="inverse-stp-result-low-{i}">` and
     `<td data-testid="inverse-stp-result-high-{i}">` for single-program
   - `<span data-testid="inverse-stp-row-error-{i}">` (absent when valid)

6. Multi-program layout (Range tab): when `multiProgState.selectedProgramIds.length > 1`
   and `activeTab === "range"`, render one result `<td>` per visible program
   with `data-testid="inverse-range-result-{i}-{programId}"`.

7. Multi-program layout (STP tab): one E low + one E high `<td>` per visible
   program with `data-testid="inverse-stp-result-low-{i}-{programId}"` and
   `data-testid="inverse-stp-result-high-{i}-{programId}"`.

8. Export: extend `src/lib/state/export.svelte.ts` or the export button handler
   to generate CSV for the active inverse tab when clicked. Column headers and
   filenames per spec §8.

9. Run cross-page parity checklist (from `implementer.md`):
   - Inverse Lookups exist only on Calculator page — no Plot parity needed.
   - BUT verify the 4 pillars are wired on `/calculator` itself:
     Panel gating, URL init, URL persistence, Reactive-dep snapshot.

### Done when

`pnpm lint && pnpm test` green; E2E Scenarios 3, 5, 7 (STP), 8 pass or
`test.skip`-ed. Then commit:

```
feat(calculator): add Inverse STP tab, multi-program inverse layout, and inverse export
```

---

## Cross-task notes

- Task 1 must be committed before Tasks 3, 4, 5 start (mock types drive TS).
- Task 2 must be committed before Task 4 starts (URL init reads `urlState.imode`).
- Task 3 must be committed before Task 4 starts (`parseLengthInput` is called in the
  Range tab effect).
- Task 5 depends on Task 4 (tab infrastructure in `+page.svelte` must exist).
- After all tasks: write `CHANGELOG-AI.md` entry and
  `docs/ai-logs/YYYY-MM-DD-stage6-9-inverse-lookups.md` per AI Logging rules.
