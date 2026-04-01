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
| Framework          | **SvelteKit** (TypeScript)              |
| Plotting           | **JSROOT** (keep — physics community standard) |
| Styling            | **Tailwind CSS**                        |
| WASM / libdedx     | **Full redesign** (build pipeline + JS wrapper) |
| Deployment         | **GitHub Pages**                        |
| Language           | **TypeScript**                          |
| Testing            | **Full coverage** — unit + integration + E2E |
| Unit tests         | Vitest + Svelte Testing Library         |
| E2E tests          | Playwright                              |
| UX inspiration     | **ATIMA** (https://www.isotopea.com/webatima/) |

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
│   ├── export.md                    # CSV + PDF export
│   └── shareable-urls.md            # URL-encoded state for sharing
├── 05-ui-wireframes.md              # Page-by-page layout descriptions
├── 06-wasm-api-contract.md          # TypeScript interface for libdedx wrapper
├── 07-testing-strategy.md           # Unit/integration/E2E plan
├── 08-deployment.md                 # GitHub Actions → GitHub Pages
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

```typescript
type EnergyUnit = 'MeV' | 'MeV/nucl' | 'MeV/u';
type StpUnit = 'MeV·cm²/g' | 'MeV/cm' | 'keV/μm';

interface LibdedxEntity {
  id: number;
  name: string;
}

interface CalculationResult {
  energies: number[];
  stoppingPowers: number[];
  csdaRanges: number[];
}

interface LibdedxService {
  init(): Promise<void>;
  getPrograms(): LibdedxEntity[];
  getIons(programId: number): LibdedxEntity[];
  getMaterials(programId: number): LibdedxEntity[];

  // Single program calculation
  calculate(params: {
    programId: number;
    ionId: number;
    materialId: number;
    energies: number[];
    energyUnit: EnergyUnit;
    stpUnit: StpUnit;
  }): CalculationResult;

  // Multi-program calculation (new feature)
  calculateMulti(params: {
    programIds: number[];
    ionId: number;
    materialId: number;
    energies: number[];
    energyUnit: EnergyUnit;
    stpUnit: StpUnit;
  }): Map<number, CalculationResult>;

  // Plot data with auto-generated energy grid
  getPlotData(params: {
    programId: number;
    ionId: number;
    materialId: number;
    pointCount: number;
    logScale: boolean;
    stpUnit: StpUnit;
  }): CalculationResult;
}
```

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

### Stage 1: Requirements & Specifications
- **Who:** You (human), AI assists with drafts.
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

### Stage 4: Project Scaffolding
- **Who:** AI implements.
- **Input:** `docs/02-tech-stack.md`, `docs/03-architecture.md`.
- **Output:** SvelteKit project with Tailwind, two routes, Vitest, Playwright, static adapter.
- **Verify:** App builds, routes work, deploys to GitHub Pages (empty pages).

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
- GitHub Actions: lint → type-check → unit tests → E2E → build WASM → build SvelteKit → deploy.

---

## 9. Best Practices for AI Agent Sessions

| Practice | Reason |
|----------|--------|
| **One feature per chat session** | Agents lose context in long threads. Start fresh per feature. |
| **Always reference spec files** | Don't re-explain — say "implement per docs/04-feature-specs/calculator.md". |
| **Start sessions with context** | "Read docs/03-architecture.md and docs/06-wasm-api-contract.md, then implement X." |
| **Commit after each working increment** | Rollback points if AI produces broken code. |
| **Use `.github/copilot-instructions.md`** | Project conventions Copilot follows automatically. |
| **Test WASM with real module early** | Mocks hide memory management bugs. |
| **Log decisions in `docs/decisions/`** | Future sessions need this context. |
| **Review AI-generated tests** | AI writes tests that pass by construction — check they assert real behavior. |
| **Be specific about JSROOT styling** | "Log-log axes, 14pt labels, legend top-right, line width 2" — not "make it pretty." |
| **Log progress in `docs/progress/`** | So the next session knows what's done and what's next. |

---

## 10. How to Resume This Work

When starting a new LLM session on any machine:

1. Open the `redesign/planning` branch.
2. Tell the agent: *"Read `docs/00-redesign-plan.md` for full project context."*
3. Check `docs/progress/` to see which stage was last completed.
4. Point the agent to the relevant spec files for the next piece of work.
5. After implementing, update `docs/progress/` and commit.

---

## 11. Existing Codebase Reference

The current (old) code has useful reference material despite being broken:

- **WASM function exports:** [build_wasm.sh](../build_wasm.sh) — lists all C functions exposed to JS.
- **WASM wrapper:** [src/Backend/WASMWrapper.js](../src/Backend/WASMWrapper.js) — shows how libdedx is called via Emscripten `ccall`.
- **Entity loading:** Same file — `getPrograms()`, `getIons()`, `getMaterials()` patterns.
- **Data generation:** [src/Backend/DataSeriesFactory.js](../src/Backend/DataSeriesFactory.js) — linear/log x-value generation.
- **JSROOT usage:** [src/Components/Pages/Plot/JSRootGraph.js](../src/Components/Pages/Plot/JSRootGraph.js) — TGraph/TMultiGraph creation.
- **Calculator logic:** [src/Components/Pages/Data/Calculator.js](../src/Components/Pages/Data/Calculator.js) — input parsing, validation, live update.
- **Plot form:** [src/Components/Pages/Plot/Form.js](../src/Components/Pages/Plot/Form.js) — cascading dropdowns pattern.
- **Unit definitions:** [src/Backend/Utils.js](../src/Backend/Utils.js) — `StoppingPowerUnits` enum.
- **libdedx submodule:** [libdedx/](../libdedx/) — the C library with CMakeLists.txt, data files, examples.
