# Refactor URL parser to follow the formal ABNF spec (§6 layered architecture)

> **Note:** This issue was written by Claude Sonnet 4.6 (AI) at the request of the project maintainer.

---

## Background

The project has a detailed formal URL contract spec in
[`docs/04-feature-specs/shareable-urls-formal.md`](docs/04-feature-specs/shareable-urls-formal.md)
(Final v6, April 2026). It defines:

- An **ABNF grammar** for all query-string parameters (§2)
- A **semantic resolution pipeline** (§3.1 — 14 numbered steps)
- A **canonicalization algorithm** with strict parameter ordering (§4)
- **21 conformance test vectors** covering valid inputs, recovery, and edge cases (§5)
- A **recommended implementation architecture** (§6)

The spec's §6 recommends four clean, layered functions:

```
parseQuery(raw: string): ParsedTokens          // ABNF-equivalent tokenizer
resolveState(tokens, route, services): ResolvedState  // semantic pass
canonicalize(state): string                    // single canonical URL writer
migrateUrl(vFrom, vTo, state): state           // version migration chain
```

---

## Problem: current code does not follow the spec architecture

The current implementation collapses all four spec phases into two monolithic
decode functions that mix tokenization, semantic resolution, validation,
defaulting, and fallback logic in a single pass:

- [`src/lib/utils/calculator-url.ts` — `decodeCalculatorUrl()`](src/lib/utils/calculator-url.ts#L450)
- [`src/lib/utils/plot-url.ts` — `decodePlotUrl()`](src/lib/utils/plot-url.ts#L230)

### Specific deviations from the spec

| Spec requirement                                                                         | Current state                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseQuery` — pure ABNF tokenization, no semantics                                      | Absent. Uses `URLSearchParams.get()` + ad-hoc `split(",")` / `lastIndexOf(":")` directly inside the decode functions                                                                                                         |
| `resolveState` — separate semantic pass (mode gating, defaults, validation, precedence)  | Merged inline into `decodeCalculatorUrl` / `decodePlotUrl`                                                                                                                                                                   |
| `canonicalize` — one canonical URL writer shared across calculator and plot              | Split into `encodeCalculatorUrl` + `calculatorUrlQueryString` (calculator) and `encodePlotUrl` + `plotUrlQueryString` (plot) with no shared `ResolvedState` type; correctness of canonical ordering is untested structurally |
| `migrateUrl` — version migration chain                                                   | [`_urlv` is parsed and immediately discarded with `void _urlv`](src/lib/utils/calculator-url.ts#L475-L476) — no migration logic exists                                                                                       |
| Spec §3.2: duplicate resolution is a distinct step                                       | Implemented as `resolveLastWins()` helper but called inline, not as an explicit pipeline stage                                                                                                                               |
| Spec §3.1 step 5: `extdata` is extracted before duplicate resolution                     | Handled correctly (a workaround comment notes why), but the necessity is a symptom of the merged pipeline                                                                                                                    |
| Spec §3.5: advanced-mode gating must be enforced as a single conditional-enablement pass | Scattered across many `if (isAdvancedMode)` blocks inside the single decode function                                                                                                                                         |

### Concrete impact

1. **Untestable in isolation.** There is no way to unit-test tokenization
   without also exercising semantic resolution and defaulting. Any test
   must provide a fully valid `URLSearchParams` object.

2. **No migration path.** The spec defines a `migrateUrl` chain for future
   major version bumps (§3.4). The current code has a comment placeholder
   but no actual chain. Adding migration in the current architecture means
   adding more branches to an already large function.

3. **Canonicalization is not a pure function of state.** The encoder takes
   `CalculatorUrlState` / `PlotUrlInput` (which includes raw inputs), not a
   `ResolvedState`. This makes it harder to guarantee that the same logical
   state always produces the same URL.

4. **Drift risk between calculator and plot decoders.** Duplicate-Z
   collapsing logic, `parseStrictFiniteNumber`, `parseStrictAtomicNumber`,
   `resolveLastWins`, and the entire `mat_*` block are copy-pasted between
   the two files. A future change to one is likely to miss the other.

---

## What needs to be done

### 1. Introduce a `parseQuery` stage

Extract all ABNF tokenization into a pure function:

```ts
// New file: src/lib/utils/url-parse.ts
function parseQuery(raw: string | URLSearchParams): ParsedTokens;
```

`ParsedTokens` is a plain record of raw string values for each known
parameter key (after duplicate resolution and `extdata` extraction), plus
an ordered list of `extdata` sources. No semantics, no defaulting, no
type coercion.

This function should be trivially unit-testable against the 21 conformance
vectors in §5 of the formal spec.

### 2. Introduce a `resolveState` stage

All mode gating (§3.5), defaults (§3.6), validation (§3.7), and conditional
enablement currently scattered through `decodeCalculatorUrl` /
`decodePlotUrl` should become a single:

```ts
function resolveCalculatorState(tokens: ParsedTokens): ResolvedCalculatorState;
function resolvePlotState(tokens: ParsedTokens): ResolvedPlotState;
```

`ResolvedState` types carry fully typed, validated, defaulted values — no
raw strings, no `undefined` where a default applies.

### 3. Implement the `migrateUrl` chain

```ts
function migrateUrl(vFrom: number, vTo: number, tokens: ParsedTokens): ParsedTokens;
```

Even though `CURRENT_URL_MAJOR = 1` currently and there is nothing to
migrate, the chain must exist so that a future major bump can be wired in
without touching `resolveState`. The version-mismatch banner
([`src/lib/components/url-version-warning-banner.svelte`](src/lib/components/url-version-warning-banner.svelte))
and the version logic
([`src/lib/utils/url-version.ts`](src/lib/utils/url-version.ts))
should hook into this chain.

### 4. Consolidate shared helpers

Move `resolveLastWins`, `parseStrictFiniteNumber`, `parseStrictAtomicNumber`,
and the `mat_*` element parsing block to a single internal module so they
are not duplicated between `calculator-url.ts` and `plot-url.ts`.

### 5. Keep existing public API stable (or update call sites)

The public signatures `decodeCalculatorUrl` / `decodeCalculatorUrl` /
`encodePlotUrl` / `calculatorUrlQueryString` / `plotUrlQueryString` are
called from:

- [`src/routes/calculator/+page.svelte`](src/routes/calculator/+page.svelte)
- [`src/routes/plot/+page.svelte`](src/routes/plot/+page.svelte)
- Various state modules under [`src/lib/state/`](src/lib/state/)

These can remain as thin wrappers over the new layered internals, or call
sites can be updated — either approach is acceptable as long as the
observable URL behavior is unchanged.

---

## Acceptance criteria

- [ ] A `parseQuery` function exists that accepts a raw query string (or
      `URLSearchParams`) and returns `ParsedTokens` with no semantic
      logic.
- [ ] All 21 conformance test vectors from
      [`docs/04-feature-specs/shareable-urls-formal.md` §5](docs/04-feature-specs/shareable-urls-formal.md)
      are covered by unit tests against `parseQuery`.
- [ ] A `resolveCalculatorState` and `resolvePlotState` function exist,
      separately testable without a full page render.
- [ ] A `migrateUrl` stub exists and is wired into the version-check path
      in [`src/lib/utils/url-version.ts`](src/lib/utils/url-version.ts).
- [ ] No logic is duplicated between the calculator and plot URL modules.
- [ ] All existing tests continue to pass:
  - Unit: [`src/tests/unit/calculator-url.test.ts`](src/tests/unit/calculator-url.test.ts),
    [`src/tests/unit/plot-url.test.ts`](src/tests/unit/plot-url.test.ts)
  - Contract: [`src/tests/contracts/url-codec.contract.test.ts`](src/tests/contracts/url-codec.contract.test.ts)
  - E2E: [`tests/e2e/url-parser.spec.ts`](tests/e2e/url-parser.spec.ts),
    [`tests/e2e/calculator-url.spec.ts`](tests/e2e/calculator-url.spec.ts)
- [ ] New unit tests are added to cover the `parseQuery` tokenization
      layer in isolation (conformance vectors §5.1 and §5.2).
- [ ] The E2E tests in [`tests/e2e/url-parser.spec.ts`](tests/e2e/url-parser.spec.ts)
      continue to pass against the refactored implementation (all 6 acceptance
      scenarios: urlv mismatch, load-defaults, current version, missing urlv,
      custom compound round-trip, duplicate params, unknown params dropped).
- [ ] An AI session log is written to `docs/ai-logs/` and a row is
      prepended to `CHANGELOG-AI.md` per the mandatory logging rules in
      `CLAUDE.md`.

---

## Files of interest for the implementor

| File                                                                                               | Role                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`docs/04-feature-specs/shareable-urls-formal.md`](docs/04-feature-specs/shareable-urls-formal.md) | **Normative spec** — ABNF grammar, semantic rules, canonicalization algorithm, conformance vectors |
| [`docs/04-feature-specs/shareable-urls.md`](docs/04-feature-specs/shareable-urls.md)               | UX/product companion spec (wins on UX behavior if conflict)                                        |
| [`src/lib/utils/calculator-url.ts`](src/lib/utils/calculator-url.ts)                               | Current monolithic calculator decoder/encoder                                                      |
| [`src/lib/utils/plot-url.ts`](src/lib/utils/plot-url.ts)                                           | Current monolithic plot decoder/encoder                                                            |
| [`src/lib/external-data/url.ts`](src/lib/external-data/url.ts)                                     | `extdata` param parsing (already reasonably isolated)                                              |
| [`src/lib/utils/url-version.ts`](src/lib/utils/url-version.ts)                                     | Version negotiation helpers                                                                        |
| [`src/lib/utils/energy-parser.ts`](src/lib/utils/energy-parser.ts)                                 | Energy token parser (called by encoder; keep as-is)                                                |
| [`src/tests/contracts/url-codec.contract.test.ts`](src/tests/contracts/url-codec.contract.test.ts) | Contract tests ensuring every union member round-trips                                             |
| [`tests/e2e/url-parser.spec.ts`](tests/e2e/url-parser.spec.ts)                                     | Playwright E2E tests for the 6 acceptance scenarios                                                |
| [`tests/e2e/calculator-url.spec.ts`](tests/e2e/calculator-url.spec.ts)                             | Broader Playwright E2E coverage for calculator URL state                                           |

---

## Out of scope for this issue

- Changing any URL parameter names or semantics (the public URL contract is frozen at v1)
- Implementing a real `migrateUrl` migration path (only the stub + wiring is needed)
- Changing the UI or component tree
- Touching the WASM wrapper or libdedx integration
