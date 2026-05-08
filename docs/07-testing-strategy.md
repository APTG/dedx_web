# Testing Strategy

> **Status:** Reference document (19 April 2026)
>
> This document gives the big-picture testing approach for dEdx Web.
> Feature-level acceptance criteria (the specific assertions that must pass for
> each feature) live in the individual feature specs under
> [`docs/04-feature-specs/`](04-feature-specs/). Accessibility testing
> requirements live in [`09-non-functional-requirements.md §1`](09-non-functional-requirements.md).

---

## 1. Test pyramid

```
                    ┌───────────────┐
                    │  E2E (Playwright)  │  ← few, slow, high-confidence
                    │  axe-core a11y     │
                    ├────────────────────┤
                    │  Integration       │  ← WASM wrapper, data flows
                    │  (Vitest)          │
                    ├────────────────────┤
                    │  Unit              │  ← components, pure logic
                    │  (Vitest + STL)   │  ← most tests, fast
                    └────────────────────┘
```

The project uses **Vitest** for unit and integration tests and **Playwright**
for end-to-end tests. These checks are already wired into CI:

- `wasm-verify`: Docker WASM build + `node wasm/verify.mjs`
- `unit-tests`: `vitest run --coverage`
- `e2e-tests`: Playwright against built app with WASM binaries downloaded from
  `wasm-verify` artifacts

See `.github/workflows/ci.yml` for the exact matrix.

### 1.1 Test-driven principles for migration work

- Treat each migration step as a small RED → GREEN → REFACTOR loop.
- Convert acceptance criteria into executable checks before implementation
  changes whenever feasible.
- For **Stage 3 (WASM build pipeline)** specifically: add or tighten
  `wasm/verify.mjs` checks first. Until that target file exists, make initial
  RED changes in `prototypes/libdedx-investigation/wasm-runtime/verify.mjs`
  (see §5), then implement `wasm/build.sh` and `src/lib/wasm/` changes until
  all checks pass.
- Keep refactors behavior-preserving by re-running the same verification set
  after cleanup.

---

## 2. Unit & integration tests — Vitest

**Tool:** Vitest + Svelte Testing Library (STL).

**What is tested:**

- Individual Svelte 5 components: rendering, prop reactivity, ARIA attributes,
  keyboard interactions.
- Pure TypeScript logic: unit conversion formulas, URL encoding/decoding,
  data-validation functions, CSV serialisation.
- Integration tests currently focus on app/state flows (`src/tests/integration`)
  rather than direct real-WASM wrapper calls.
- Real libdedx contract/runtime integration is validated in CI by
  `node wasm/verify.mjs` (WASM verify job) and by Playwright E2E against the
  built app with downloaded WASM artifacts.

**Key constraints from feature specs:**

- Every interactive component must have `aria-label`, role, and state
  assertions in its unit test.
- Unit conversion tests must cover all three unit modes
  (MeV, MeV/nucl, MeV/u). See [unit-handling.md](04-feature-specs/unit-handling.md).
- URL encode/decode must be losslessly round-trip tested.
  See [shareable-urls.md](04-feature-specs/shareable-urls.md) and
  [shareable-urls-formal.md](04-feature-specs/shareable-urls-formal.md).

**Run:** `pnpm test`

---

## 3. End-to-end tests — Playwright

**Tool:** Playwright (browser-level).

**What is tested:**

- Full user journeys: select particle + material + program → calculate → read results.
- Plot page: add series, verify chart renders, remove series.
- Export: download CSV, download PDF (file existence + MIME type).
- Share URL: copy URL, navigate to it, verify state restored.
- Error states: invalid input, WASM load failure fallback.

**Accessibility E2E (mandatory):**

- `@axe-core/playwright` runs on every E2E test page.
- **Zero Level AA violations are required for CI to pass.**
- Manual screen-reader verification (NVDA/VoiceOver) is a human step,
  not automated — documented in [09-non-functional-requirements.md §1.3](09-non-functional-requirements.md).

**Run:** `pnpm exec playwright test`

---

## 4. CI matrix (current)

Active CI workflow (`.github/workflows/ci.yml`) runs on pushes to `master`,
`feature/**`, `fix/**`, and `qwen/**`, and on pull requests targeting
`master`:

1. **WASM Build + Contract Verification**
   - builds `static/wasm/libdedx.*` via Docker
   - runs `node wasm/verify.mjs`
   - uploads WASM binaries + verification stats artifacts
2. **Unit & Integration Tests**
   - runs `pnpm exec vitest run --coverage --reporter=verbose`
   - uploads coverage artifact
3. **E2E Tests (Playwright)**
   - depends on WASM verify job
   - downloads WASM binaries artifact
   - runs `pnpm build` then `pnpm test:e2e`

Recommended local pre-push checklist:

```
pnpm lint          ← ESLint + Prettier check
pnpm test          ← Vitest (unit + integration)
pnpm exec playwright test   ← E2E + axe-core
pnpm build         ← SvelteKit static build (must not fail)
```

A Lighthouse performance budget on a simulated 3G Fast profile (targets:
FCP ≤ 1.5 s, TTI ≤ 3.5 s — see
[09-non-functional-requirements.md §3](09-non-functional-requirements.md))
is planned as an additional CI gate; not currently enforced.

---

## 5. WASM build verification

The WASM module (`libdedx.wasm` + `libdedx.mjs`) has its own verification
step independent of the SvelteKit build:

```
node wasm/verify.mjs    ← runs in Node.js, calls key exported functions,
                          checks return values are physically plausible
```

This script is the acceptance gate for Stage 3 (WASM build pipeline) and is
run in CI (`wasm-verify` job).
See [ADR 003](decisions/003-wasm-build-pipeline.md) and
[06-wasm-api-contract.md](06-wasm-api-contract.md).

---

## 6. Feature-level acceptance criteria

Each feature spec contains a numbered acceptance-criteria checklist.
Tests are written to match those criteria exactly. Cross-reference:

| Feature                  | Spec with AC                                                |
| ------------------------ | ----------------------------------------------------------- |
| Entity selection         | [entity-selection.md](04-feature-specs/entity-selection.md) |
| Calculator               | [calculator.md](04-feature-specs/calculator.md)             |
| Plot                     | [plot.md](04-feature-specs/plot.md)                         |
| Unit handling            | [unit-handling.md](04-feature-specs/unit-handling.md)       |
| Export (CSV + PDF)       | [export.md](04-feature-specs/export.md)                     |
| Shareable URLs           | [shareable-urls.md](04-feature-specs/shareable-urls.md)     |
| Custom compounds         | [custom-compounds.md](04-feature-specs/custom-compounds.md) |
| External data (.webdedx) | [external-data.md](04-feature-specs/external-data.md)       |
| Multi-program            | [multi-program.md](04-feature-specs/multi-program.md)       |
| Inverse lookups          | [inverse-lookups.md](04-feature-specs/inverse-lookups.md)   |
| Advanced options         | [advanced-options.md](04-feature-specs/advanced-options.md) |

---

## 7. E2E test-tag taxonomy (Playwright)

E2E tests are tagged in the test name using `@tag` suffix. The `playwright.config.ts`
and `package.json` support three tags:

| Tag           | Description                                                                  | Script                    | When to run                                   |
| ------------- | ---------------------------------------------------------------------------- | ------------------------- | --------------------------------------------- |
| `@smoke`      | Primary acceptance scenario — fast, deterministic, covers the core user flow | `pnpm test:e2e:smoke`     | Every task (implementer + reviewer), every PR |
| `@regression` | Edge cases, error states, cross-page parity                                  | `pnpm test:e2e` (default) | Every PR                                      |
| `@nightly`    | Slow / expensive (not yet used)                                              | `pnpm test:e2e:nightly`   | Nightly CI (future)                           |

### Tagging convention

```typescript
// Inline @tag in the test name (idiomatic for this project):
test("density 2× halves CSDA range @smoke", async ({ page }) => { ... });

// Or in a describe block name:
test.describe("Advanced Options @smoke", () => { ... });
```

### Rules

- Every feature spec must include at least one `@smoke`-tagged E2E test
  covering the primary acceptance scenario.
- `@smoke` tests must complete within 30 s (use `test.setTimeout(30000)` if WASM
  loading is needed).
- Never use `waitForTimeout()` in any E2E test — use `waitForSelector`,
  `waitForFunction`, or `expect.poll`. The ESLint config enforces this ban via
  `no-restricted-syntax`. See `.opencode/lessons-learned.md` Entry 12.

See `playwright.config.ts` for the timeout discipline comment block.
