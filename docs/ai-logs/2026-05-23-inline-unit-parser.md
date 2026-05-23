# 2026-05-23 — Inline-unit parser, Basic mode layout fix, URL v2 `lookups=` rename

## Session Narrative

### Prompt 1: Clarify issue #557 description — ASCII input, um not µm

**AI response**: Updated issue #557 body to specify ASCII-only input grammar (`um` instead of `µm`, `keV/um` instead of `keV/µm`). Also incorporated the `ivalues=` → `lookups=` rename from PR #565 comments. Updated "Files touched" to reflect that `table-basic.svelte` already exists (created in #567).

### Prompt 2: Plan implementation

**AI response**: Explored codebase with three parallel agents to understand existing parsers (`energy-parser.ts`), state layer (`energy-rows.svelte.ts`, `calculator.svelte.ts`), URL codec (`calculator-url.ts`), and test patterns. Identified that range/STP parsers do not exist yet; energy parsing already works. Wrote implementation plan including a bonus fix for the Basic mode card→table layout switching prematurely on first keystroke.

### Prompt 3: Implement issue #557

**AI response**: Implemented all items in scope:

1. **Basic mode layout fix** — `updateRowText` in `energy-rows.svelte.ts` gained an optional `autoAdd = true` parameter; Basic mode's `oninput` handler passes `false`. Enter key explicitly calls `calcState.addRow()` when no next row exists.
2. **`inputmode` attributes** — `inputmode="decimal"` on Basic energy inputs; `inputmode="text"` on Advanced (`result-table.svelte`).
3. **First-focus hint** — ghost banner "type a unit too — e.g. `10 keV`" on first focus of row 0, localStorage-persisted (`dedx_tip_inline_unit_seen`), auto-dismissed after 10 s.
4. **`src/lib/parse/inline-unit.ts`** — pure-function parsers for range (`parseRangeInput`) and STP (`parseSTPInput`) input columns. Range values are normalised to cm inline. STP returns value + ASCII unit type; density-dependent conversion to WASM-native MeV·cm²/g is left to the caller. URL-token helpers (`stpInputUnitToUrlToken`, `urlTokenToSTPInputUnit`, `rangeUnitToUrlToken`, `urlTokenToRangeUnit`) decouple parser notation from hyphenated URL tokens.
5. **`src/tests/unit/inline-unit.test.ts`** — 42 Vitest cases covering all units, case variants, whitespace, boundary values, and error paths.
6. **`calculator-url.ts`** — bumped `CALCULATOR_URL_VERSION` to 2; renamed `ivalues=` → `lookups=` in encode; decode checks `lookups=` first with `ivalues=` as v1 backward-compat fallback; renamed TypeScript field `InverseModeUrlState.ivalues` → `.lookups`.
7. **Updated tests** — `calculator-url.test.ts` and `url-codec.contract.test.ts` updated for `lookups=` and `urlv=2`.
8. **`+page.svelte`** — updated `inverseMode.ivalues` → `inverseMode.lookups`.

## Tasks

### Inline-unit parser

- **Status**: completed
- **Stage**: Input grammar (issue #557)
- **Files changed**:
  - `src/lib/parse/inline-unit.ts` (NEW)
  - `src/tests/unit/inline-unit.test.ts` (NEW)
- **Decision**: Range normalised to cm in the parser (trivial scalar, no density); STP returns value + unit type and lets the calculator state handle density-dependent conversion. URL token helpers kept separate from parse types so callers can use either layer independently.

### Basic mode layout fix

- **Status**: completed
- **Stage**: Input grammar (issue #557 bonus)
- **Files changed**:
  - `src/lib/state/energy-rows.svelte.ts`
  - `src/lib/state/calculator.svelte.ts`
  - `src/lib/components/results/table-basic.svelte`
- **Decision**: Minimal change — add optional `autoAdd` param to `updateRowText` (default `true` preserves Advanced mode). Basic mode passes `false`; single "Add row" button and Enter key add rows explicitly.

### inputmode attributes

- **Status**: completed
- **Files changed**:
  - `src/lib/components/results/table-basic.svelte` (`inputmode="decimal"`)
  - `src/lib/components/result-table.svelte` (`inputmode="text"`)

### First-focus onboarding hint

- **Status**: completed
- **Files changed**: `src/lib/components/results/table-basic.svelte`

### URL v2 `lookups=` rename

- **Status**: completed
- **Files changed**:
  - `src/lib/utils/calculator-url.ts`
  - `src/routes/calculator/+page.svelte`
  - `src/tests/unit/calculator-url.test.ts`
  - `src/tests/contracts/url-codec.contract.test.ts`

### Deferred to #559

- `→ default` conditional column in Advanced result table
- Range and STP input rows in Advanced mode (Range→mode, STP→mode)
- `table-advanced.svelte` (component does not exist yet)
