# dEdx Web — Full Redesign Plan

> Generated from an AI-assisted planning session on 1 April 2026.
> This document captures all decisions, the stage-by-stage strategy,
> and best practices for continuing the work in any future LLM session.

---

## 1. Context

The current codebase is an outdated, broken React 17 + Bootstrap + JSROOT web interface
for the **libdedx** C library (stopping power / energy calculations), compiled to WebAssembly
via Emscripten.

**Pain points with the current app:**
- It doesn't work.
- Plots are ugly.
- Code is old (React 17, class components, no TypeScript, CRA).

The goal is a **ground-up rewrite** using modern tooling, driven by AI agents
(GitHub Copilot) with spec-driven development.

---

## 2. Technology Choices

| Layer              | Choice                                  |
|--------------------|-----------------------------------------|
| Framework          | **SvelteKit** with **Svelte 5** (TypeScript) |
| Plotting           | **JSROOT** (keep — physics community standard) |
| Styling            | **Tailwind CSS**                        |
| WASM / libdedx     | **Full redesign** (build pipeline + JS wrapper) |
| Deployment         | **GitHub Pages**                        |
| Language           | **TypeScript** (strict mode)            |
| Linting            | **ESLint** (`eslint-plugin-svelte`)     |
| Formatting         | **Prettier** (`prettier-plugin-svelte`) |
| Testing            | **Full coverage** — unit + integration + E2E |
| Unit tests         | Vitest + Svelte Testing Library         |
| E2E tests          | Playwright                              |
| AI agent config    | **GitHub Copilot** customization files in `.github/` |
| UX inspiration     | **ATIMA** (https://www.isotopea.com/webatima/) |

> **Svelte 5 only.** This project uses Svelte 5 with runes (`$state`, `$derived`,
> `$effect`, `$props`, `$bindable`). Do **not** use Svelte 4 patterns:
> no `export let` for props, no `$:` reactive statements, no `createEventDispatcher()`,
> no `onMount`/`onDestroy` from `svelte` (use `$effect` instead), no stores via
> `$` auto-subscription (use runes-based state). The `svelte/store` module is
> replaced by fine-grained reactivity. See https://svelte.dev/docs/svelte/v5-migration-guide.
>
> **Linting & formatting.** ESLint + Prettier run on every save and in CI.
> Ruff is not applicable — it is Python-only. For TypeScript + Svelte, the
> standard toolchain is `eslint-plugin-svelte` + `prettier-plugin-svelte`.
> Consider `eslint-plugin-svelte` with `svelte/recommended` preset.

---

## 3. New Features (not in the old app)

1. **Better unit handling** — MeV vs MeV/nucl vs MeV/u, with proper conversion.
2. **Shareable URLs** — encode full calculation state in URL query params.
3. **Data series comparison** — overlay multiple series on one JSROOT plot.
4. **Multi-program calculation** — run the same query across multiple libdedx programs at once.
5. **PDF + CSV export** — dump results and plots.
6. **Live calculation** — results update reactively as the user types (debounced).

---

## 4. Documentation Structure

All design documents live in `docs/`. Each file serves as a direct input
for an AI agent session implementing that part.

```
docs/
├── 00-redesign-plan.md              ← YOU ARE HERE
├── 01-project-vision.md             # Goals, audience, constraints, inspiration
├── 02-tech-stack.md                 # Technologies + rationale for each choice
├── 03-architecture.md               # Component tree, data flow, WASM lifecycle
├── 04-feature-specs/                # One spec per feature (AI implementation input)
│   ├── entity-selection.md          # Program/ion/material cascading selection
│   ├── calculator.md                # Calculator page with live results
│   ├── plot.md                      # Multi-series JSROOT plotting
│   ├── unit-handling.md             # MeV / MeV/nucl / MeV/u conversion logic
│   ├── multi-program.md             # Calculate across multiple programs at once
│   ├── inverse-lookups.md           # Energy from stopping power / CSDA range
│   ├── advanced-options.md          # MSTAR modes, aggregate state, interpolation
│   ├── export.md                    # CSV + PDF export
│   └── shareable-urls.md            # URL-encoded state for sharing
├── 05-ui-wireframes.md              # Page-by-page layout descriptions
├── 06-wasm-api-contract.md          # TypeScript interface for libdedx wrapper
├── 07-testing-strategy.md           # Unit/integration/E2E plan
├── 08-deployment.md                 # GitHub Actions → GitHub Pages
├── 09-non-functional-requirements.md # Performance, browser support, a11y, responsive
├── decisions/                       # Architecture Decision Records (ADRs)
│   ├── 001-sveltekit-over-react.md
│   ├── 002-keep-jsroot.md
│   ├── 003-wasm-build-pipeline.md
│   └── ...
└── progress/                        # Stage completion logs
    ├── stage-1.md
    └── ...
```

---

## 4.1 AI Agent Configuration (`.github/`)

GitHub Copilot reads customization files from `.github/` to get project
context automatically. These are **version-controlled** and shared with
anyone working on the repo.

```
.github/
├── copilot-instructions.md          # Always-on project context (every interaction)
├── instructions/
│   ├── svelte.instructions.md       # applyTo: **/*.svelte — Svelte 5 runes patterns
│   ├── wasm.instructions.md         # applyTo: src/lib/wasm/** — Emscripten/libdedx rules
│   └── testing.instructions.md      # applyTo: **/*.test.ts — test conventions
├── prompts/
│   ├── implement-feature.prompt.md  # /implement-feature — one-shot from spec file
│   ├── write-spec.prompt.md         # /write-spec — draft a feature spec from template
│   └── new-component.prompt.md      # /new-component — scaffold a Svelte 5 component
├── agents/
│   ├── researcher.agent.md          # Read-only codebase exploration (tools: read, search)
│   └── spec-writer.agent.md         # Feature spec authoring (tools: read, search, edit)
└── skills/
    └── wasm-build/
        └── SKILL.md                 # WASM build pipeline procedure + Emscripten flags
```

**What each primitive does:**

| Primitive | File | When loaded | Purpose |
|-----------|------|-------------|---------|
| Workspace instructions | `copilot-instructions.md` | Every interaction | Project context, Svelte 5 rules, build commands |
| File instructions | `*.instructions.md` | When editing matching files | Framework/domain-specific rules |
| Prompts | `*.prompt.md` | On-demand via `/` slash command | Reusable task templates |
| Custom agents | `*.agent.md` | User picks in agent selector, or auto-delegated | Focused roles with restricted tools |
| Skills | `SKILL.md` in subfolder | On-demand when task matches description | Multi-step workflows with bundled assets |

**Key rules:**
- `copilot-instructions.md` should be **short** (~40 lines). It loads into every request's context window.
  Link to `docs/*.md` files rather than duplicating content.
- File instructions use `applyTo` globs to auto-attach when relevant files are edited.
- The `description` field is the **discovery surface** — without good keywords, the agent won't find the file.
- Prompts replace the "start sessions with context" manual step — `/implement-feature` loads the right docs automatically.

**Bootstrap order (chicken-and-egg):**
The `copilot-instructions.md` and `write-spec.prompt.md` should be created **first**, before
writing any design docs. This way, AI assistance for drafting `docs/01-project-vision.md`
and feature specs already benefits from project context. The remaining file instructions,
agents, and skills are added later alongside the code they govern (Stage 4).

---

## 5. Target Architecture

```
src/
├── lib/
│   ├── wasm/                        # WASM loader + typed wrapper
│   │   ├── libdedx.ts               # TypeScript API over Emscripten
│   │   ├── loader.ts                # Lazy WASM initialization
│   │   └── types.ts                 # Shared types
│   ├── components/                  # Reusable UI components
│   │   ├── EntityDropdown.svelte
│   │   ├── EnergyInput.svelte
│   │   ├── ResultTable.svelte
│   │   └── JsrootPlot.svelte
│   └── stores/                      # Svelte stores for shared state
│       ├── entities.ts              # Programs, ions, materials
│       ├── calculation.ts           # Current calculation state
│       └── url-sync.ts             # Sync store ↔ URL params
├── routes/
│   ├── +layout.svelte               # Shell with nav
│   ├── calculator/
│   │   └── +page.svelte
│   └── plot/
│       └── +page.svelte
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 6. WASM API Contract (Target TypeScript Interface)

This is the most critical design artifact. All frontend code and tests
are written against this interface. The WASM implementation is swappable
(mocked in tests, real in production).

> **The full contract lives in [`docs/06-wasm-api-contract.md`](06-wasm-api-contract.md).**
> Below is a brief summary. Always refer to the full document for implementation.

### Key types

| Type | Purpose |
|------|---------|
| `LibdedxEntity` | Base: `{ id, name }` |
| `IonEntity` | Extends base with `massNumber`, `atomicMass`, `aliases` |
| `ProgramEntity` | Extends base with `version` |
| `MaterialEntity` | Extends base with `density`, `isGasByDefault` |
| `CalculationResult` | `{ energies, stoppingPowers, csdaRanges }` |
| `AdvancedOptions` | `{ aggregateState, interpolation, mstarMode, densityOverride, iValueOverride }` |
| `CustomCompound` | User-defined material with elemental composition |
| `LibdedxError` | Typed error with C error code + message |

### Key design decisions

- **Energy units:** MeV/nucl ≠ MeV/u. The C API uses MeV/nucl; conversion is JS-side.
- **Stateless by default:** Calls go through `dedx_wrappers.h`; stateful API only for custom compounds, inverse lookups, and advanced options.
- **Thin C wrappers:** Local `wasm/dedx_extra.{h,c}` expose internal libdedx data (nucleon number, atomic mass, density, gas state) without modifying the libdedx submodule.
- **ESTAR included:** Electrons via ion ID 1001.
- **MSTAR modes exposed:** 6 modes (a/b/c/d/g/h), default "b".
- **Aggregate state exposed:** 29 gaseous-default materials; override in advanced settings.

---

## 7. Feature Spec Template

Every feature spec in `docs/04-feature-specs/` should follow this format.
AI agents produce significantly better code when given specs in this structure.

```markdown
# Feature: <Name>

## User Story
As a <role>, I want to <action> so that <benefit>.

## Inputs
- (list all user inputs with types and constraints)

## Behavior
- (describe step-by-step what happens, including edge cases)

## Output
- (describe what the user sees / receives)

## Acceptance Criteria
- [ ] (testable criterion 1)
- [ ] (testable criterion 2)
- [ ] ...
```

---

## 8. Implementation Stages

### Stage 0: AI Agent Bootstrap
- **Who:** You (human) + AI for drafting.
- **Produce:**
  - `.github/copilot-instructions.md` — project context, Svelte 5 rules, build commands.
  - `.github/prompts/write-spec.prompt.md` — slash command for drafting feature specs.
  - `.github/prompts/implement-feature.prompt.md` — slash command for implementing from a spec.
- **Why first:** All subsequent stages use AI assistance. Having `copilot-instructions.md`
  ensures the agent already knows this is a Svelte 5 + TypeScript + WASM project, won't
  suggest Svelte 4 patterns, and can reference design docs. The `write-spec` prompt makes
  Stage 1 (writing feature specs) faster and more consistent.
- **Verify:** Start a new Copilot chat and confirm the agent mentions Svelte 5 / runes
  without being told. Test `/write-spec` produces output following the template from §7.

### Stage 1: Requirements & Specifications
- **Who:** You (human), AI assists with drafts (use `/write-spec` prompt).
- **Produce:** `docs/01-project-vision.md`, all `docs/04-feature-specs/*.md`, `docs/06-wasm-api-contract.md`.
- **Validate:** You review all specs for physics correctness.

### Stage 2: Technical Architecture
- **Who:** You + AI.
- **Produce:** `docs/02-tech-stack.md`, `docs/03-architecture.md`, ADRs in `docs/decisions/`.
- **Key:** Document *why* SvelteKit, *why* keep JSROOT, WASM module format (ES module).

### Stage 3: WASM Build Pipeline Redesign
- **Who:** AI implements.
- **Input:** `docs/06-wasm-api-contract.md`, `docs/decisions/003-wasm-build-pipeline.md`.
- **Output:** New build script, TypeScript wrapper in `src/lib/wasm/`, ES module `.mjs` + `.wasm`.
- **Verify:** Wrapper loads in Node.js and returns valid program/ion/material lists.

### Stage 4: Project Scaffolding + Full AI Config
- **Who:** AI implements.
- **Input:** `docs/02-tech-stack.md`, `docs/03-architecture.md`.
- **Output:** SvelteKit project with Tailwind, two routes, Vitest, Playwright, static adapter,
  ESLint + Prettier configured.
- **Also produce** (now that the project structure exists):
  - `.github/instructions/svelte.instructions.md` — Svelte 5 component patterns.
  - `.github/instructions/wasm.instructions.md` — WASM wrapper rules.
  - `.github/instructions/testing.instructions.md` — test conventions.
  - `.github/agents/researcher.agent.md` — read-only codebase explorer.
  - `.github/skills/wasm-build/SKILL.md` — WASM build pipeline procedure.
- **Verify:** App builds, routes work, `eslint . && prettier --check .` pass, deploys to GitHub Pages (empty pages).

### Stage 5: Core Shared Components
- **Who:** AI implements (one component per chat session).
- **Order:**
  1. Entity selection (cascading dropdowns) — Svelte stores + WASM
  2. Energy input component — textarea with per-line validation, debounce
  3. Unit selector — radio/segmented control
  4. Result table — reactive rendering
  5. JSROOT plot wrapper — Svelte component managing JSROOT lifecycle

### Stage 6: Feature Pages (one at a time)
- **Who:** AI implements per feature spec.
- **Order:**

| # | Feature                | Depends on                               |
|---|------------------------|------------------------------------------|
| 1 | Calculator (basic)     | Entity selection, energy input, result table |
| 2 | Live calculation       | Calculator + debounce logic              |
| 3 | Multi-program mode     | Calculator + modified WASM calls         |
| 4 | Plot page with JSROOT  | JSROOT wrapper + entity selection        |
| 5 | Data series comparison | Plot page + series management            |
| 6 | Shareable URLs         | Svelte stores + URL sync                 |
| 7 | CSV + PDF export       | Result table data + file generation      |

### Stage 7: E2E Tests & Polish
- Playwright tests with real WASM.
- Mobile responsive testing.
- JSROOT plot styling (be extremely specific: axis labels, fonts, colors, legend placement).
- Error handling for WASM failures.

### Stage 8: CI/CD
- GitHub Actions: `eslint .` → `prettier --check .` → `svelte-check` → `tsc --noEmit` → Vitest → Playwright → build WASM → build SvelteKit → deploy.

### Stage 9: Legacy Code Removal
- Remove the old React codebase (`src/App.*`, `src/index.*`, `src/Backend/`, `src/Components/`,
  `src/Styles/`, `src/__test__/`, `public/`), the old `build_wasm.sh`, and CRA dependencies
  from `package.json`.
- This should happen **after** the new app is verified working end-to-end and deployed.
- The old code is preserved in git history; the last commit containing it is referenced in §11.

---

## 9. Best Practices for AI Agent Sessions

| Practice | Reason |
|----------|--------|
| **Create `.github/copilot-instructions.md` first** | Every AI session benefits from project context from the start. |
| **One feature per chat session** | Agents lose context in long threads. Start fresh per feature. |
| **Use `/implement-feature` and `/write-spec` prompts** | Consistent context loading without manual re-explanation. |
| **Always reference spec files** | Don't re-explain — say "implement per docs/04-feature-specs/calculator.md". |
| **Start sessions with context** | "Read docs/03-architecture.md and docs/06-wasm-api-contract.md, then implement X." |
| **Commit after each working increment** | Rollback points if AI produces broken code. |
| **Enforce Svelte 5 in instructions** | AI training data has more Svelte 4 than 5. Explicit rules prevent `export let`, `$:`, `createEventDispatcher`. |
| **Test WASM with real module early** | Mocks hide memory management bugs. |
| **Log decisions in `docs/decisions/`** | Future sessions need this context. |
| **Review AI-generated tests** | AI writes tests that pass by construction — check they assert real behavior. |
| **Be specific about JSROOT styling** | "Log-log axes, 14pt labels, legend top-right, line width 2" — not "make it pretty." |
| **Log progress in `docs/progress/`** | So the next session knows what's done and what's next. |
| **Run `eslint . && prettier --check .` before committing** | Catch formatting/lint issues AI may introduce. |
| **Log every AI session** | Append to `CHANGELOG-AI.md` + create `docs/ai-logs/YYYY-MM-DD-<slug>.md`. See `.github/copilot-instructions.md` for format. |

---

## 10. How to Resume This Work

When starting a new LLM session on any machine:

1. Open the `redesign/planning` branch.
2. `.github/copilot-instructions.md` loads automatically — no manual context needed.
3. Check `docs/progress/` to see which stage was last completed.
4. Check `CHANGELOG-AI.md` for recent AI session history.
5. Use `/implement-feature` prompt pointing to the relevant spec, or tell the agent:
   *"Read `docs/00-redesign-plan.md` for full project context."*
5. After implementing, update `docs/progress/` and commit.

---

## 11. Existing Codebase Reference

The current (old) code has useful reference material despite being broken.
The last commit on `master` containing this code should be tagged or noted
before Stage 9 (legacy removal). You can find it with `git log master --oneline -1`.

> **Legacy code last commit:** `0330233` (`docs: add AI session logging system`)

Reference files:

- **WASM function exports:** [`build_wasm.sh`](../build_wasm.sh) — lists all C functions exposed to JS.
- **WASM wrapper:** [`src/Backend/WASMWrapper.js`](../src/Backend/WASMWrapper.js) — shows how libdedx is called via Emscripten `ccall`.
- **Entity loading:** Same file — `getPrograms()`, `getIons()`, `getMaterials()` patterns.
- **Data generation:** [src/Backend/DataSeriesFactory.js](../src/Backend/DataSeriesFactory.js) — linear/log x-value generation.
- **JSROOT usage:** [src/Components/Pages/Plot/JSRootGraph.js](../src/Components/Pages/Plot/JSRootGraph.js) — TGraph/TMultiGraph creation.
- **Calculator logic:** [src/Components/Pages/Data/Calculator.js](../src/Components/Pages/Data/Calculator.js) — input parsing, validation, live update.
- **Plot form:** [src/Components/Pages/Plot/Form.js](../src/Components/Pages/Plot/Form.js) — cascading dropdowns pattern.
- **Unit definitions:** [src/Backend/Utils.js](../src/Backend/Utils.js) — `StoppingPowerUnits` enum.
- **libdedx submodule:** [libdedx/](../libdedx/) — the C library with CMakeLists.txt, data files, examples.
