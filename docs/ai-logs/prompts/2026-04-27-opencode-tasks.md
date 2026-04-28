# opencode task prompt — 2026-04-27

> **Model:** Qwen3.5-397B-A17B-FP8  
> **Session type:** Multi-task implementation. Work through the tasks **in
> order**. After each task is complete and `pnpm test` is green, commit with
> a Conventional Commits message and **stop so the user can run `/compact`**
> before the next task.  
> **MCPs available:** `playwright` (run / inspect E2E tests),
> `tailwind` (Tailwind CSS class lookup).  
> **TDD rule:** Write the failing test(s) first, then write the minimal
> implementation to make them pass. No implementation without a test.

---

## Context

Branch: `copilot/check-stage-5-implementations`  
Read at session start (in order):
1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging
2. `docs/04-feature-specs/unit-handling.md` (v4) — energy-unit rules
3. `docs/04-feature-specs/entity-selection.md` (v7) — particle naming rules
4. `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md` — the
   open UX issues that drive this session
5. `tests/e2e/particle-unit-switching.spec.ts` — the `test.fixme()` block lists
   the E2E assertions to un-skip once tasks 5–6 land

Key source files:
- Parser: `src/lib/utils/energy-parser.ts`
- Conversions: `src/lib/utils/energy-conversions.ts`
- Particle aliases: `src/lib/config/particle-aliases.ts`
- Particle names: `src/lib/config/particle-names.ts`
- Entity comboboxes: `src/lib/components/entity-selection-comboboxes.svelte`
- Calculator state: `src/lib/state/calculator.svelte.ts`
- Energy input state: `src/lib/state/energy-input.svelte.ts`
- Entity selection state: `src/lib/state/entity-selection.svelte.ts`
- Result table: `src/lib/components/result-table.svelte`
- Calculator page: `src/routes/calculator/+page.svelte`
- Unit selector component: `src/lib/components/energy-unit-selector.svelte`

Test files:
- `src/tests/unit/energy-parser.test.ts`
- `src/tests/unit/energy-conversions.test.ts`
- `src/tests/unit/entity-selection-comboboxes.test.ts`
- `src/tests/unit/calculator-state.test.ts`
- `tests/e2e/particle-unit-switching.spec.ts`
- `tests/e2e/complex-interactions.spec.ts`

Run tests:
```sh
pnpm test                        # Vitest unit tests (no WASM needed)
pnpm exec playwright test        # E2E tests (needs WASM in static/wasm/)
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` §"AI Session Logging").

For each task:
1. Prepend a row to `CHANGELOG-AI.md` table body.
2. Create `docs/ai-logs/YYYY-MM-DD-<slug>.md` with the session narrative.
3. Add a one-line pointer to `docs/ai-logs/README.md`.

Attribution line: `(Qwen3.5-397B-A17B-FP8 via opencode)`

---

## Task 1 — TeV units in the energy parser

**Spec:** `docs/04-feature-specs/unit-handling.md` v4 §3 "Supported Suffixes"
(the table now includes `TeV`, `TeV/nucl`, `TeV/u` with multiplier ×1e6).

### Step 1a — tests first (`src/tests/unit/energy-parser.test.ts`)

Add a new `describe("TeV range")` block with these failing tests:

```
"1 TeV" → { value: 1, unit: "TeV" }
"0.5 TeV/nucl" → { value: 0.5, unit: "TeV/nucl" }
"2 TeV/u" → { value: 2, unit: "TeV/u" }
"10 TeV" is accepted (not rejected as unknown unit)
```

### Step 1b — tests first (`src/tests/unit/energy-conversions.test.ts`)

Add tests that verify the SI-prefix multiplier for TeV is ×1e6:

```
convertEnergyToMeVperNucl(1, "TeV", 1) === 1e6   // proton 1 TeV = 1e6 MeV/nucl
convertEnergyToMeVperNucl(1, "TeV/nucl", 12, 12.011) === 1e6
convertEnergyToMeVperNucl(1, "TeV/u", 12, 12.011) ≈ 1e6 (within float)
convertEnergyFromMeVperNucl(1e6, "TeV", 1) === 1
convertEnergyFromMeVperNucl(1e6, "TeV/nucl", 12, 12.011) === 1e6
```

### Step 1c — implement

In `src/lib/utils/energy-parser.ts`:
- Add `"TeV" | "TeV/nucl" | "TeV/u"` to the `EnergySuffixUnit` union type.
- Add three entries to `CANONICAL_UNITS`:
  ```typescript
  ["TeV", "TeV"],
  ["TeV/nucl", "TeV/nucl"],
  ["TeV/u", "TeV/u"],
  ```

In `src/lib/utils/energy-conversions.ts`:
- Add `TeV: 1e6` to `SI_PREFIX_TO_MEV`.
- Add `"TeV": "MeV"`, `"TeV/nucl": "MeV/nucl"`, `"TeV/u": "MeV/u"` to `BASE_UNITS`.

Verify `pnpm test` is green, then commit:
```
feat(parser): add TeV, TeV/nucl, TeV/u energy units (×1e6 MeV)
```

---

## Task 2 — Typo suggestions in the energy parser

**Spec:** `docs/04-feature-specs/unit-handling.md` v4 §3a "Typo Suggestions".

Rule: when `parseEnergyInput` returns `{ error: "unknown unit: X" }`, check
whether `X.toLowerCase()` exactly matches the lowercase form of exactly one
canonical unit. If so, append `— did you mean Y?` to the error string.
Never silently auto-correct.

### Step 2a — tests first (`src/tests/unit/energy-parser.test.ts`)

Add a `describe("typo suggestions")` block. The error string must match
`/unknown unit: X — did you mean Y\?/`. Tests:

| Input | Expected error string |
|-------|-----------------------|
| `"100 meV"` | `unknown unit: meV — did you mean MeV?` |
| `"100 mev"` | `unknown unit: mev — did you mean MeV?` |
| `"100 MEV"` | `unknown unit: MEV — did you mean MeV?` |
| `"100 KeV"` | `unknown unit: KeV — did you mean keV?` |
| `"100 MeV/Nucl"` | `unknown unit: MeV/Nucl — did you mean MeV/nucl?` |
| `"100 MeV/NUCL"` | `unknown unit: MeV/NUCL — did you mean MeV/nucl?` |
| `"100 GeV/Nucl"` | `unknown unit: GeV/Nucl — did you mean GeV/nucl?` |
| `"100 TeV/Nucl"` | `unknown unit: TeV/Nucl — did you mean TeV/nucl?` |
| `"100 MeV/U"` | `unknown unit: MeV/U — did you mean MeV/u?` |
| `"100 GeV/U"` | `unknown unit: GeV/U — did you mean GeV/u?` |
| `"100 TeV/U"` | `unknown unit: TeV/U — did you mean TeV/u?` |
| `"100 bebok"` | `unknown unit: bebok` (no suggestion — no case-fold match) |
| `"100 EV"` | `unknown unit: EV` (no suggestion — "ev" doesn't case-fold-match "eV") |

> Note on `EV` → no suggestion: `"ev".toLowerCase()` is `"ev"`, and the
> canonical `eV` also lowercases to `"ev"` — so there IS a case-fold match.
> BUT `eV` in SI means electron-volt (lower-case e), not "EV". To avoid
> suggesting `eV` for the all-caps `EV` (which looks like "electron-volts" in
> non-SI usage), add `eV` to an explicit exclusion list so it never gets
> suggested. Document this in a comment.

### Step 2b — implement

In `src/lib/utils/energy-parser.ts`, after the `CANONICAL_UNITS` map:

```typescript
// Units whose case-fold match is ambiguous or confusing — never suggest them.
const NO_SUGGEST: ReadonlySet<string> = new Set(["eV"]);

// Build a case-fold lookup: lowercase(suffix) → canonical unit (if unique).
const TYPO_SUGGESTIONS: ReadonlyMap<string, EnergySuffixUnit> = (() => {
  const m = new Map<string, EnergySuffixUnit>();
  for (const canonical of CANONICAL_UNITS.values()) {
    if (NO_SUGGEST.has(canonical)) continue;
    const lower = canonical.toLowerCase();
    if (m.has(lower)) {
      m.delete(lower); // ambiguous — remove so we never suggest
    } else {
      m.set(lower, canonical);
    }
  }
  return m;
})();
```

In `parseEnergyInput`, change the unknown-unit branch from:
```typescript
return { error: `unknown unit: ${unitStr}` };
```
to:
```typescript
const suggestion = TYPO_SUGGESTIONS.get(unitStr.toLowerCase());
const hint = suggestion ? ` — did you mean ${suggestion}?` : "";
return { error: `unknown unit: ${unitStr}${hint}` };
```

Verify `pnpm test` is green, then commit:
```
feat(parser): typo suggestions for common unit casing errors
```

---

## Task 3 — Particle display names and "Common particles" / "Ions" groups

**Spec:** `docs/04-feature-specs/entity-selection.md` v7
§"Particle naming preferences".

| ID | Display label |
|----|---------------|
| 1 | `proton` (lowercase) |
| 2 | `alpha particle` (lowercase) |
| 1001 | `electron` (lowercase) |
| 3–118 | `Element (Symbol)` e.g. `Carbon (C)` |

Group headings: **"Common particles"** (IDs 1, 2, 1001), **"Ions"** (IDs 3–118).

### Step 3a — tests first (`src/tests/unit/entity-selection-comboboxes.test.ts`)

Look for the existing `describe("Particle combobox")` block (or equivalent).
Add / update failing tests:

1. Proton label is `"proton"` (not `"Hydrogen (H)"`).
2. Helium label is `"alpha particle"` (not `"Helium (He)"`).
3. Electron label is `"electron"` (not `"Electron"`).
4. Carbon label is `"Carbon (C)"`.
5. A group with accessible name `"Common particles"` exists and contains
   `"proton"`, `"alpha particle"`, `"electron"`.
6. A group with accessible name `"Ions"` exists and contains `"Carbon (C)"`.

> Use `screen.getByRole("group", { name: /^Common particles$/i })` for the
> group assertions — the component renders
> `<div role="group" aria-label="Common particles">` (same pattern as the
> existing Elements / Compounds / Tabulated data groups).

### Step 3b — implement `particle-names.ts`

Add lowercase overrides for IDs 1, 2, 1001 to `PARTICLE_NAME_OVERRIDES`:

```typescript
export const PARTICLE_NAME_OVERRIDES: ReadonlyMap<number, string> = new Map([
  [1, "proton"],
  [2, "alpha particle"],
  [1001, "electron"],
]);
```

### Step 3c — implement `entity-selection-comboboxes.svelte`

Update `getParticleLabel(particle)`:

```typescript
function getParticleLabel(particle: ParticleEntity): string {
  // Special-named particles have no parenthetical symbol — the name IS the identifier.
  if (particle.id === 1) return "proton";
  if (particle.id === 2) return "alpha particle";
  if (particle.id === 1001) return "electron";
  const symbol = particle.symbol || "";
  return symbol ? `${particle.name} (${symbol})` : particle.name;
}
```

Update `particleItems` derivation to produce section headers. Split the flat
list into three groups. The current code already separates the electron — extend
that pattern:

```typescript
const particleItems = $derived.by(() => {
  // "Common particles" group: proton (1), alpha (2), electron (1001)
  const COMMON_IDS = new Set([1, 2, 1001]);
  const commonParticles = state.allParticles
    .filter((p) => COMMON_IDS.has(p.id))
    .sort((a, b) => {
      // fixed order: proton, alpha particle, electron
      const ORDER = [1, 2, 1001];
      return ORDER.indexOf(a.id) - ORDER.indexOf(b.id);
    });
  
  const ionParticles = state.allParticles
    .filter((p) => !COMMON_IDS.has(p.id))
    .sort((a, b) => a.id - b.id);

  function toItem(particle: ParticleEntity) {
    return {
      entity: particle,
      available: particle.id !== 1001 && state.availableParticles.some((p) => p.id === particle.id),
      label: getParticleLabel(particle),
      description: particle.id === 1001 ? ELECTRON_UNSUPPORTED_SHORT : undefined,
      searchText: getParticleSearchText(particle),
    };
  }

  // Use same section-header pattern as materialItems
  return [
    { type: "section" as const, label: "Common particles" },
    ...commonParticles.map(toItem),
    { type: "section" as const, label: "Ions" },
    ...ionParticles.map(toItem),
  ];
});
```

> The combobox component (`entity-combobox.svelte`) already handles
> `{ type: "section", label }` entries (the same pattern used by Materials and
> Programs). No changes needed there.

Verify `pnpm test` is green, then commit:
```
feat(ui): rename particle groups to "Common particles"/"Ions", use proton/alpha particle/electron labels
```

---

## Task 4 — Fix `setRowUnit`: convert KE instead of stamping suffix

**Context:** `src/lib/state/calculator.svelte.ts:297-316`  
Currently `setRowUnit(index, unit)` strips the old suffix and stamps the new
unit string verbatim — the numeric value does NOT change. This silently scales
kinetic energy by the ratio of the old and new mass numbers.

**Fix:** convert the numeric value using `convertEnergyToMeVperNucl` →
`convertEnergyFromMeVperNucl` before writing back.

### Step 4a — tests first (`src/tests/unit/calculator-state.test.ts`)

Find (or create) a `describe("setRowUnit")` block. 

**Existing test to INVERT** (the old behaviour was wrong):
```typescript
// OLD assertion (wrong): 12 MeV → MeV/nucl on Carbon should keep "12 MeV/nucl"
// NEW assertion (correct): 12 MeV ÷ 12 nucleons = 1 MeV/nucl
expect(rawInput).toBe("1 MeV/nucl");
```

**New tests to ADD:**
```
Carbon (A=12, m_u=12.011), row "12 MeV", setRowUnit(0, "MeV/nucl")
  → row text becomes "1 MeV/nucl"

Carbon (A=12, m_u=12.011), row "1 MeV/nucl", setRowUnit(0, "MeV")
  → row text becomes "12 MeV"

Helium (A=4, m_u=4.002602), row "80 MeV", setRowUnit(0, "MeV/nucl")
  → row text becomes "20 MeV/nucl"

Proton (A=1), row "100 MeV", setRowUnit(0, "MeV/nucl")
  → row text becomes "100 MeV/nucl"  (A=1, no numeric change)
```

Use `formatSigFigs(value, 4)` to format the converted number — same function
used everywhere else in the calculator state.

### Step 4b — implement

Replace the body of `setRowUnit` in `calculator.svelte.ts`:

```typescript
setRowUnit(index: number, unit: EnergyUnit) {
  const row = inputState.rows[index];
  if (!row) return;

  const trimmed = row.text.trim();
  if (trimmed === "") return;

  const particle = entitySelection.selectedParticle;
  if (!particle) return;

  const parsed = parseEnergyInput(trimmed);
  if (!("value" in parsed) || parsed.unit === null && parsed.value === undefined) return;
  if ("error" in parsed || "empty" in parsed) return;

  const currentUnit = parsed.unit ?? inputState.masterUnit;
  const mevNucl = convertEnergyToMeVperNucl(
    parsed.value,
    currentUnit,
    particle.massNumber,
    particle.atomicMass
  );
  const converted = convertEnergyFromMeVperNucl(
    mevNucl,
    unit,
    particle.massNumber,
    particle.atomicMass
  );
  inputState.updateRowText(index, `${formatSigFigs(converted, 4)} ${unit}`);
},
```

You will also need to import `convertEnergyFromMeVperNucl` at the top of the
file (it is already exported from `energy-conversions.ts`).

### Step 4c — E2E

Un-skip (remove `test.fixme(`) the test in
`tests/e2e/particle-unit-switching.spec.ts`:
```
"Carbon 12 MeV → toggle row unit MeV → MeV/nucl: number should become 1 (1 MeV/nucl), KE conserved"
```

Use the `playwright` MCP to run just this spec file and confirm it passes:
```sh
pnpm exec playwright test tests/e2e/particle-unit-switching.spec.ts
```

Also confirm the previously-passing "current behaviour" test for Carbon unit
toggle is updated to assert the new correct value (`"1 MeV/nucl"`).

Verify `pnpm test` is green, then commit:
```
fix(calculator): setRowUnit now converts KE instead of stamping suffix
```

---

## Task 5 — KE conservation on particle switch (`selectParticle`)

**Spec:** `docs/04-feature-specs/unit-handling.md` v4 §2 "Unit Preservation on
Particle Change".

**Algorithm** (per-nucleon-first):
1. For each row, parse current text → `(value, detectedUnit ?? masterUnit)`.
2. Compute `E_nucl = convertEnergyToMeVperNucl(value, unit, oldA, oldMassU)`.
3. Choose the new display unit:
   - If old unit was `MeV/nucl` AND new particle has `massNumber > 1` → keep `MeV/nucl`.
   - If old unit was `MeV/u` AND new particle has `massNumber > 1` → keep `MeV/u`.
   - Otherwise → use `MeV` (always valid).
4. `newValue = convertEnergyFromMeVperNucl(E_nucl, newUnit, newA, newMassU)`.
5. Rewrite the row text:
   - If old row had an explicit typed suffix → write `"${formatSigFigs(newValue, 4)} ${newUnit}"`.
   - If old row had NO suffix (plain number, uses master unit) → write `"${formatSigFigs(newValue, 4)}"` (plain number, no suffix) and set master unit accordingly.
6. **Electron edge case** (new particle ID 1001): always convert to total MeV
   (`newUnit = "MeV"`, `newValue = E_nucl × oldA`), because the electron has
   no nucleons.
7. Rows that fail to parse (invalid / empty) → leave untouched.

**Architecture decision:** the row conversion must happen in `CalculatorState`
(which owns both `EnergyInputState` and `EntitySelectionState`), NOT inside
`EntitySelectionState.selectParticle()` (which should stay pure selection
logic). Wire it via a `$effect` in `calculator.svelte.ts` that watches
`entitySelection.selectedParticle` and converts rows when the particle changes.

### Step 5a — unit tests first (`src/tests/unit/calculator-state.test.ts`)

Add a `describe("KE conservation on particle switch")` block:

```
He (A=4) row "20 MeV/nucl" → switch to proton (A=1):
  row text → "80 MeV"   [20 × 4 / 1 = 80]
  mevNucl column → 80

He (A=4) row "20 MeV/nucl" → switch to proton → switch back to He:
  row text → "20 MeV/nucl"  (round-trip)

He (A=4) row "80 MeV" → switch to proton (A=1):
  row text → "20 MeV"   [80/4 = 20 MeV/nucl × 1 = 20 MeV]

Carbon (A=12) row "120 MeV" → switch to proton:
  row text → "10 MeV"   [120/12 = 10 MeV/nucl × 1 = 10 MeV]

Carbon (A=12) row "10 MeV/nucl" → switch to He (A=4):
  row text → "10 MeV/nucl"  (MeV/nucl conserved, same value)

He (A=4) row "20 MeV/nucl" → switch to electron (ID=1001):
  row text → "80 MeV"  (total energy, no per-nucleon unit for electron)
  no "MeV/nucl is not available" validation error

Plain number row "100" (master unit MeV, proton) → switch to Carbon (A=12):
  row text → "100"  (plain number stays plain, master unit MeV)
  mevNucl → 100/12 ≈ 8.333
```

### Step 5b — implement in `calculator.svelte.ts`

Inside `createCalculatorState`, add a ref that tracks the previous particle:

```typescript
let previousParticle = $state<ParticleEntity | null>(entitySelection.selectedParticle);

$effect(() => {
  const newParticle = entitySelection.selectedParticle;
  const oldParticle = previousParticle;

  // Only convert if the particle actually changed and we had one before.
  if (newParticle && oldParticle && newParticle.id !== oldParticle.id) {
    convertRowsForNewParticle(oldParticle, newParticle);
  }
  previousParticle = newParticle;
});
```

Implement `convertRowsForNewParticle(oldParticle, newParticle)` following the
algorithm in §5 above. It calls `inputState.updateRowText(index, newText)` for
each converted row.

### Step 5c — E2E: un-skip all remaining `fixme` tests

In `tests/e2e/particle-unit-switching.spec.ts`, un-skip ALL remaining
`test.fixme()` tests:

1. `"He 20 MeV/nucl → proton: row should show 80 MeV (KE conserved)"`
2. `"He 20 MeV/nucl → proton → He: row should round-trip back to 20 MeV/nucl"`
3. `"Carbon 100 MeV/nucl → switch master unit MeV/nucl → MeV: row should show 1200 MeV"` *(requires master unit selector — if not yet added, keep fixme and note dependency on Task 6)*
4. `"He 20 MeV/nucl + multiple rows: KE conservation applies independently to each row"`
5. `"Switching to electron from a heavy ion clears MeV/nucl rows or remaps to MeV"`

Also update the "current behaviour" tests in the first `test.describe` block —
they lock down the OLD (wrong) behaviour and must now be INVERTED or REMOVED:
- `"He 20 MeV/nucl → switch to proton: typed number stays '20'..."` → REMOVE
  (replaced by the un-skipped fixme)
- `"He 80 MeV → switch to proton: typed number stays '80'"` → UPDATE to assert
  `rowText === "20 MeV"` (KE conserved)
- `"Proton 100 MeV → switch to carbon → switch back to hydrogen: number unchanged"` → UPDATE to assert `rowText === "100"` (proton ↔ proton via Carbon: 100 MeV proton → 100/1=100 MeV/nucl on Carbon = 1200 MeV... wait, this is the tricky one. 100 MeV proton (A=1) → Carbon (A=12): E_nucl = 100/1 = 100 MeV/nucl; Carbon display = 100 MeV/nucl or 1200 MeV. But the test was plain "100" with master unit MeV. In master-mode the row text should become "100 MeV/nucl" or just "100" with master unit switching? Following spec: plain number rows stay plain, master unit resets to MeV if needed → Carbon "100 MeV" → E_nucl=100/1=100 → Carbon at 100 MeV/nucl → text "100" if master unit is MeV/nucl... This is complex, be careful here.)

  **Simplest correct approach for plain-number rows:** convert to E_nucl, then express as a plain number in the new particle's master unit (MeV for proton/electron, MeV/nucl for heavy ions if the previous row was also plain). Document the choice in a comment.

Use the `playwright` MCP to run the full E2E suite and confirm all tests pass.

Verify `pnpm test` is green, then commit:
```
feat(calculator): conserve MeV/nucl on particle switch; re-express row values via per-nucleon-first algorithm
```

---

## Task 6 — Master energy unit selector on the calculator page

**Context:** `EnergyUnitSelector` (`src/lib/components/energy-unit-selector.svelte`)
is fully built and tested, but `src/routes/calculator/+page.svelte` does not
render it. The UX review (§"Issue 3") reports this as a spec mismatch.

### Step 6a — E2E test first (`tests/e2e/complex-interactions.spec.ts`)

Add a test:
```
"Master unit selector is visible on calculator page for heavy ions"
  - Load calculator, select Carbon
  - Expect a radiogroup labelled /energy unit/i to be visible
  - It should have radio options "MeV" and "MeV/nucl"
  - Click "MeV/nucl"
  - Column header should now contain "MeV/nucl"
```

Add a second test:
```
"Master unit selector shows only MeV for proton (disabled)"
  - Load calculator (default = proton)
  - The MeV radio option should be present
  - There should be no MeV/nucl radio option (or it should be disabled)
```

Also un-skip the `test.fixme` in `particle-unit-switching.spec.ts`:
```
"Carbon 100 MeV/nucl → switch master unit MeV/nucl → MeV: row should show 1200 MeV"
```
(This test was kept fixme in Task 5 pending this task.)

### Step 6b — implement

In `src/routes/calculator/+page.svelte`, import and render
`EnergyUnitSelector` above the `ResultTable`:

```svelte
<EnergyUnitSelector
  value={calcState.masterUnit}
  particle={entitySelection.selectedParticle}
  disabled={calcState.isPerRowMode}
  onchange={(unit) => calcState.setMasterUnit(unit)}
/>
```

Check the existing `EnergyUnitSelector` component props signature to match
exactly. It already handles particle-dependent options (MeV only for proton
and electron, MeV + MeV/nucl for heavy ions) — do not duplicate that logic.

When per-row mode is active (`calcState.isPerRowMode === true`), the selector
should be visually disabled/greyed out (the component may already handle this
via a `disabled` prop).

Use the `tailwind` MCP to look up appropriate spacing classes if you need to
add margin/padding between the selector and the table.

Verify `pnpm test` is green, then commit:
```
feat(calculator): re-add master energy unit selector above result table
```

---

## Task 7 — "Add row" button below the result table

**Context:** `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`
§"Issue 4". The existing `EnergyInputState.addRow()` method adds a row; there is
just no UI affordance for it. The recommended fix is a small `+ Add row` button.

### Step 7a — update the locking E2E test first

In `tests/e2e/particle-unit-switching.spec.ts`, the test:
```
"there is no explicit 'Add row' button rendered in the result table"
```
was deliberately written to lock down the current (no-button) behaviour.
**Invert this test** to assert the button IS present:
```typescript
await expect(page.getByRole("button", { name: /^Add row$/i })).toHaveCount(1);
```

### Step 7b — unit test (`src/tests/components/result-table.test.ts` or equivalent)

Add a test:
```
"Add row button is rendered and calls addRow when clicked"
  - render ResultTable with a mock calcState
  - click the "Add row" button
  - verify calcState.addRow() was called (or that the row count increased)
```

### Step 7c — implement in `result-table.svelte`

After the closing `</table>` tag, add a shadcn-svelte `Button` (variant
`"outline"`, size `"sm"`) labelled `"+ Add row"`:

```svelte
<script>
  import { Button } from "$lib/components/ui/button";
</script>

<!-- After </table> -->
<div class="mt-2 flex justify-start">
  <Button variant="outline" size="sm" onclick={() => state.addRow()}>
    + Add row
  </Button>
</div>
```

The `state` prop is the `CalculatorState` already passed into the component.
Confirm `state.addRow` exists (it is delegated from `inputState.addRow()` via
`CalculatorState` — if not already exposed, add it to the `CalculatorState`
interface in `calculator.svelte.ts`).

Use the `tailwind` MCP for any spacing or button styling questions.

Verify `pnpm test` is green, then commit:
```
feat(result-table): add "Add row" button below energy table
```

---

## Task 8 — Wire debounce into calculation trigger

**Context:** `calculator.md:840` mandates a 300 ms debounce. A `debounce()`
utility exists in `src/lib/utils/debounce.ts` (8 unit tests, no callers).

### Step 8a — tests first (`src/tests/unit/calculator-state.test.ts`)

Add a `describe("debounce")` test:
```
"triggerCalculation is not called synchronously on rapid text updates"
  - create a calculator state with a mock service that counts calls
  - call updateRowText 5 times rapidly (without awaiting)
  - at that point the service should have been called 0 or 1 times
    (not 5 times)
  - after 350 ms the service should have been called exactly once
```

Use fake timers (`vi.useFakeTimers()`) to control time in the test.

### Step 8b — implement

In `calculator.svelte.ts`, wrap the `triggerCalculation` call that fires on
input changes. The cleanest pattern for Svelte 5 is to debounce inside the
`$effect` or `updateRowText` method:

```typescript
const debouncedCalculate = debounce(async () => {
  const energies = getValidEnergies();
  await performCalculation(energies);
}, 300);
```

Replace the direct `state.triggerCalculation()` call in `result-table.svelte`
(or the `$effect` in calculator.svelte.ts) with `debouncedCalculate()`.

The import: `import { debounce } from "$lib/utils/debounce";`

Verify `pnpm test` is green, then commit:
```
feat(calculator): debounce calculation trigger to 300ms per spec
```

---

## Task 9 — Dead code cleanup

**Context:** `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`
§"Issue 6" and `docs/progress/stage-5-audit-2026-04-26.md` §2-3. Three source
files and their dedicated tests are unreachable dead code since Stage 5.4
replaced `energy-input.svelte` with the unified result table.

### Step 9a — verify files are truly unused

```sh
grep -rn "energy-input" src/ --include="*.ts" --include="*.svelte" | grep -v "\.test\." | grep -v "energy-input\.svelte\.ts"
grep -rn "units/energy" src/ --include="*.ts" --include="*.svelte" | grep -v "\.test\."
grep -rn "energy-input-format" src/ --include="*.ts" | grep -v "\.test\."
```

Confirm there are zero non-test imports of `energy-input.svelte`,
`src/lib/units/energy.ts`, and `energy-input-format.test.ts` (which only
tests things from the dead files).

### Step 9b — delete

```
src/lib/components/energy-input.svelte              ← dead component (~290 LOC)
src/lib/units/energy.ts                             ← superseded by energy-conversions.ts (~190 LOC)
src/tests/unit/energy-input-format.test.ts          ← tests for the above
src/tests/components/energy-input.test.ts           ← component tests for dead component (13 tests)
```

Also remove the corresponding import/mock lines in:
- `src/tests/unit/energy-parser.test.ts` if it imports from `units/energy`
- any `__mocks__` files that re-export the deleted modules

### Step 9c — verify

```sh
pnpm test
```

All remaining tests (the ~420+ unit + integration tests that cover live code)
must stay green. If any test breaks, it means a file was NOT actually dead —
restore it and investigate.

Verify `pnpm test` is green, then commit:
```
chore: delete dead energy-input.svelte, units/energy.ts, and their tests (~480 LOC)
```

---

## Final checklist before handing back

After all 9 tasks:

- [ ] `pnpm test` green (all Vitest unit tests)
- [ ] `pnpm exec playwright test` green (all E2E tests, no `fixme` left except
      any intentionally deferred items)
- [ ] `pnpm lint` clean
- [ ] Each task has a Conventional Commit
- [ ] `CHANGELOG-AI.md` has one or more new rows at the top
- [ ] `docs/ai-logs/` has a session log file for this session
- [ ] `docs/ai-logs/README.md` has a pointer to the new log file

---

## Notes on shadcn-svelte usage

- Import buttons from `$lib/components/ui/button`
- Import badges from `$lib/components/ui/badge`
- Do NOT hand-roll button/badge HTML when a shadcn component exists
- Use the `tailwind` MCP to look up any Tailwind v4 class names you are
  unsure about (e.g. `mt-2`, `flex`, `justify-start`)
- CSS variables for theming are in `src/app.css` (the `@theme inline` block)

## Notes on Svelte 5

- Use `$state`, `$derived`, `$effect`, `$props` — never Svelte 4 patterns
- Lifecycle: `$effect(() => { ... return () => cleanup(); })` not `onMount`
- Event handlers: `onclick={handler}` not `on:click`
- Reactivity: mutate `$state` arrays by reassignment, not `.push()`
