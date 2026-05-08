# 2026-05-06 — PR #427 Post-Mortem: Process & Tooling Improvements

**Model:** GitHub Copilot (analysis) + GitHub Copilot coding agent (implementation) via GitHub Copilot

---

## Session Narrative

### Prompt 1: Analysis request from @grzanka

> Read the AI logs, especially the opencode session dumps, like
> `docs/ai-logs/2026-05-05-stage6-8-select-fix-opencode-session.md` (it's a very
> long file, but I am afraid you need to read it wholly to get full picture).
> I've got impression that during the work on last PR (namely PR #427) the opencode
> performed poorly and many fixes had to be later applied during PR review by
> @copilot agent (see PR discussion and my comments).
>
> Can you suggest some plan to improve opencode behaviour? I suspect it misses the
> things which could be spotted by E2E testing (playwright) and good understanding
> of the ways the user should interact with the app.
>
> Maybe the specifications are also not detailed enough?
>
> We have ahead pretty complex tasks 6.9–6.13 and I would like to improve the way
> opencode is being used with local models before tackling them.

**AI response (analysis):** The analysis identified 19 defect categories across
PR #427, organized into a breakdown table. The main finding was that the local
Qwen model missed reactive wiring bugs that only manifested in the browser — bugs
that a mandatory Playwright smoke run after each task would have caught. The
recommendations were:

1. **Reactive dep snapshot** — ban reading reactive state inside `.then()`
2. **Object-reference tracking** — always use `$derived(JSON.stringify(...))` for nested state keys
3. **Cross-page parity** — explicit 4-pillar audit checklist for calc+plot
4. **Service interface arity** — grep-and-update rule for any signature change
5. **URL codec coverage** — `satisfies Record<Union, string>` contract tests
6. **Silent no-op test detection** — props must match `$props()` destructuring
7. **`untrack()` around `replaceState`** — already in implementer.md but missed
8. **`isAdvancedMode` guard** — every advanced-option read must be gated
9. **`initAdvancedModeFromUrl` on both pages** — string-presence contract test
10. **CI branch trigger drift** — wildcard all relevant prefixes
11. **Convention drift** — ESLint guards for import paths
12. **`waitForTimeout` ban** — already documented, ESLint to enforce
13. **PR description maintenance** — update before re-review
14. **Long session compaction** — keep tasks ≤ 40 steps

The analysis also noted that the feature spec for Advanced Options lacked DOM
observables in acceptance criteria, a reactive triggers matrix, and cross-page
parity checklists — making it harder for the implementer to self-verify.

**Are specs detailed enough?** No. The analysis found that `advanced-options.md`
described the _what_ (inputs, URL params) but not the _how to test_
(DOM selectors, polling patterns, cross-page pillars). Future specs need explicit
Acceptance Scenarios with `data-testid` observables, a reactive triggers matrix,
and a cross-page parity checklist.

**Is E2E understanding the gap?** Partially. The implementer ran the full E2E
suite (`pnpm exec playwright test`) but did not run the Playwright MCP interactively
to observe the DOM during development. A mandatory "user-flow smoke" step using the
Playwright MCP browser would have caught the density-override no-op visually.

### Prompt 2: Implementation request

> Please open a PR with the process improvements described above.

**AI response (implementation):** Implemented all nine deliverables (a)–(i) as
a single PR. See "What this PR changes" below.

---

## Tasks

### (a) Create `.opencode/lessons-learned.md`

- **Status**: completed
- **Stage**: post-mortem / process improvement
- **Files changed**: `.opencode/lessons-learned.md` (new)
- **Decision**: 14 entries (PR #427 required ≥14), each with Symptom/Root-cause/Rule/Examples
  in ✅/❌ code-example format. File is auto-prepended to every implementer prompt.

### (b) Update implementer agent

- **Status**: completed
- **Stage**: process improvement
- **Files changed**: `.opencode/agents/implementer.md`, `opencode.json`
- **Decision**: Added Step 8a (Playwright MCP smoke) and Step 8b (reactive-trigger
  checklist) to the workflow. Lowered `maxSteps` from 80 to 40. Added lessons-learned
  cross-link. Updated output contract to require 5-bullet "What changed" summary +
  "Smoke test:" line.

### (c) Update reviewer agent

- **Status**: completed
- **Stage**: process improvement
- **Files changed**: `.opencode/agents/reviewer.md`, `opencode.json`
- **Decision**: Promoted model from Qwen3.6-35B to Qwen3.5-397B. Added 5 new diff
  checks: silent no-op tests, service interface arity, URL codec round-trip,
  cross-page parity, convention checks. Permitted `pnpm exec playwright test --grep
@smoke` in reviewer bash permissions.

### (d) Spec template

- **Status**: completed
- **Stage**: process improvement
- **Files changed**: `docs/04-feature-specs/_template.md` (new), `docs/04-feature-specs/README.md`
- **Decision**: Template has 7 sections (Goal, Acceptance scenarios with DOM observables,
  Reactive triggers matrix, URL round-trip table, Cross-page parity checklist, Test
  plan, Out of scope). Each section has a worked example from `advanced-options.md`.

### (e) ESLint rules

- **Status**: completed (with documented pre-existing violations)
- **Stage**: tooling
- **Files changed**: `eslint.config.js`
- **Decision**: Added `no-restricted-imports` (warn severity — pre-existing violations
  in `src/lib/**` prevent error severity until product code is fixed) and
  `no-restricted-syntax` ban on `waitForTimeout()` (error severity) in E2E tests.
  **Pre-existing violations noted:** `$lib/utils` (missing `.js`) and `*.svelte.ts`
  imports in `src/lib/**` and `src/routes/**`; also `@typescript-eslint/no-non-null-assertion`
  and other pre-existing errors throughout `src/`. None of these are introduced by
  this PR. Lint is not currently enforced in CI (not in `ci.yml`).

### (f) Playwright tag taxonomy

- **Status**: completed
- **Stage**: tooling
- **Files changed**: `playwright.config.ts`, `package.json`,
  `tests/e2e/advanced-options.spec.ts`, `tests/e2e/plot.spec.ts`
- **Decision**: Added `@smoke`/`@regression`/`@nightly` tag taxonomy in comment block
  at top of `playwright.config.ts`. Added `test:e2e:smoke` and `test:e2e:nightly`
  scripts to `package.json`. Tagged one existing test in each of `advanced-options.spec.ts`
  and `plot.spec.ts` with `@smoke`.

### (g) Contract tests

- **Status**: completed
- **Stage**: test infrastructure
- **Files changed**: `src/tests/contracts/url-codec.contract.test.ts` (new),
  `src/tests/contracts/page-init.contract.test.ts` (new),
  `src/tests/contracts/service-interface.contract.test.ts` (new)
- **Decision**: 24 new contract tests across 3 files. URL codec uses
  `satisfies Record<Union, string>` map to catch missing union members at
  compile time. Page-init tests are source-text string assertions (cheap,
  catch the exact missing-`initAdvancedModeFromUrl` bug). Service interface
  tests use `satisfies new () => LibdedxService` TS assertion.

### (h) AI log

- **Status**: completed
- **Stage**: documentation
- **Files changed**: `docs/ai-logs/2026-05-06-pr427-postmortem.md` (new),
  `CHANGELOG-AI.md`, `docs/ai-logs/README.md`

### (i) Update AGENTS.md

- **Status**: completed
- **Stage**: documentation
- **Files changed**: `AGENTS.md`
- **Decision**: Added "MUST READ" bullet for lessons-learned in "Other working rules"
  section.

### Bonus: fix pre-existing `waitForTimeout` violations in E2E tests

- **Status**: completed (opportunistic, files were already touched)
- **Files changed**: `tests/e2e/calculator-advanced.spec.ts`,
  `tests/e2e/export.spec.ts`, `tests/e2e/plot.spec.ts`
- **Decision**: Since I was already touching these files to tag `@smoke`, and the
  new ESLint rule bans `waitForTimeout()`, I fixed the pre-existing violations.
  Also fixed one pre-existing `!` non-null assertion in `export.spec.ts`.

---

## Follow-up Tasks for Stage 6.9 Onward

- **Rewrite specs using the new template**: all Stage 6.9–6.13 specs must use
  `docs/04-feature-specs/_template.md`. Key specs to (re)write first:
  `inverse-lookups.md`, `custom-compounds.md`.
- **Verify lessons-learned entries on next PR**: check Entries 1 and 2 (reactive
  dep snapshot) and Entry 3 (cross-page parity) on the first Stage 6.9 PR.
- **Upgrade ESLint `no-restricted-imports` to "error"** once the pre-existing
  `$lib/utils` and `*.svelte.ts` violations in product code are fixed.
- **Add lint to CI pipeline** — `pnpm lint` is not currently in `ci.yml`.
- **Tag more existing tests as `@smoke`** — add `@smoke` to at least one test
  in each major E2E spec file for complete smoke coverage.
