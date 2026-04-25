# dEdx Web — Full Redesign Plan

> Generated from an AI-assisted planning session on 1 April 2026.
> This document captures all decisions, the stage-by-stage strategy,
> and best practices for continuing the work in any future LLM session.

---

## 1. Context

### Versioning

| Version | Status | URL | Notes |
|---------|--------|-----|-------|
| **v1.1.0** | Released 1 April 2022 | [aptg.github.io/web](https://aptg.github.io/web/) | Last stable release; legacy React 17 app |
| **v2.x** | In development | [aptg.github.io/web_dev](https://aptg.github.io/web_dev/) | This rewrite — SvelteKit + Svelte 5 + WASM |

The first production release of v2 will be tagged `v2.0.0` and deployed to `APTG/web` (see Stage 8).

### What is being rewritten and why

The **v1.1.0** codebase is an outdated, broken React 17 + Bootstrap + JSROOT web interface
for the **libdedx** C library (stopping power / energy calculations), compiled to WebAssembly
via Emscripten.

**Pain points with v1:**
- It doesn't work.
- Plots are ugly.
- Code is old (React 17, class components, no TypeScript, CRA).

The goal of **v2** is a **ground-up rewrite** using modern tooling, driven by AI agents
(GitHub Copilot) with spec-driven development.

---

## 2. Technology Choices

| Layer              | Choice                                  |
|--------------------|-----------------------------------------|
| Framework          | **SvelteKit** with **Svelte 5** (TypeScript) |
| Plotting           | **JSROOT** (keep — physics community standard) |
| Styling            | **Tailwind CSS**                        |
| UI components      | **shadcn-svelte** + Bits UI ([ADR 005](decisions/005-shadcn-svelte-components.md)) |
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
│   ├── entity-selection.md          # Particle/material/program cascading selection
│   ├── calculator.md                # Calculator page with live results
│   ├── plot.md                      # Multi-series JSROOT plotting
│   ├── unit-handling.md             # MeV / MeV/nucl / MeV/u conversion logic
│   ├── multi-program.md             # Calculate across multiple programs at once
│   ├── inverse-lookups.md           # Energy from stopping power / CSDA range
│   ├── advanced-options.md          # MSTAR modes, aggregate state, interpolation
│   ├── export.md                    # CSV + PDF export
│   ├── shareable-urls.md            # URL-encoded state for sharing
│   ├── shareable-urls-formal.md     # Formal ABNF + canonicalization companion
│   ├── custom-compounds.md          # User-defined compound materials
│   ├── external-data.md             # User-hosted .webdedx (Zarr v3) data
│   └── build-info.md                # Build info badge in footer
├── 05-ui-wireframes.md              # Big-picture layout overview; links to per-spec wireframes
├── 06-wasm-api-contract.md          # TypeScript interface for libdedx wrapper
├── 07-testing-strategy.md           # Test pyramid, Vitest + Playwright strategy; links to per-spec AC
├── 08-deployment.md                 # GitHub Pages pipeline, WASM build, CI; links to ADRs
├── 09-non-functional-requirements.md # WCAG 2.1 AA, performance budgets, browser support, responsive, security
├── 10-terminology.md                # Glossary — physics/end-user terms and developer/stack terms
├── 11-prototyping-spikes.md         # Stage 2.5 spike specs (JSROOT, WASM, $state, extdata format)
├── decisions/                       # Architecture Decision Records (ADRs)
│   ├── 001-sveltekit-over-react.md
│   ├── 002-keep-jsroot.md
│   ├── 003-wasm-build-pipeline.md
│   ├── 004-zarr-v3-external-format.md
│   └── 005-shadcn-svelte-components.md  # UI component library decision
├── progress/                        # Stage completion logs
│   ├── stage-1.md
│   └── stage-2.md
└── ai-logs/                         # Detailed AI session logs
```

> **Vendor library docs** are in `vendor/` at the repo root.
> The vendor subdirectories are shallow git submodules containing source,
> TypeScript types, and docs for third-party libraries used by the project — so
> AI agents can read them locally without web access. See `vendor/README.md`.

> **AGENTS.md** at the repo root is the opencode/Qwen context-loading entry
> point — the counterpart to `.github/copilot-instructions.md`. It is small
> and delegates to this plan and the docs index above.

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

## 4.2 Multiple AI tools (opencode + Qwen via PLGrid llmlab)

The default driver for implementation sessions is **GitHub Copilot** (per
§4.1). However, Spike 1 and Spike 3 were already implemented successfully
with **opencode + Qwen3.5-397B**, so the project supports a parallel
multi-tool workflow. This section documents how to run an implementation
stage with opencode + Qwen against the PLGrid **llmlab** OpenAI-compatible
endpoint, and how to fall back to Copilot on `master` if the experiment
does not converge.

### When to consider Qwen / opencode

A stage or feature is a good Qwen candidate when it is:

- **Self-contained** — minimal cross-file context (e.g., the WASM wrapper
  in Stage 3, a single feature page in Stage 6).
- **Well-specified** — has a Final spec or ADR with explicit acceptance
  criteria (the AI's job is execution, not design).
- **Independently testable** — `pnpm lint && pnpm test && pnpm build`
  (or, for Stage 3, `node verify.mjs`) gives an unambiguous pass/fail.

Tightly coupled, design-heavy, or cross-cutting work should stay on
Copilot for now.

### Local setup (one-time)

1. **opencode** installed locally. opencode reads its config from
   `opencode.json` at the repo root or `~/.config/opencode/config.json`.
   Per-repo config is preferred so Qwen has the same defaults for every
   contributor. ✅ Created 19 April 2026: [`opencode.json`](../opencode.json) —
   PLGrid provider (env-var credentials), `@sveltejs/opencode` plugin,
   Tailwind MCP, Playwright MCP. Fill in `PLGRID_LLMLAB_BASE_URL` env var
   before first use.
2. **AGENTS.md** at the repo root acting as the opencode context-loading
   counterpart of `.github/copilot-instructions.md`. Keep it tiny and
   delegate to existing docs (do not duplicate content). ✅ Created
   19 April 2026: [`AGENTS.md`](../AGENTS.md) — points at copilot-instructions,
   docs index, vendor library docs, MCP setup, and Svelte 5 rules.
3. **PLGrid llmlab credentials** — exported as an environment variable
   (e.g. `PLGRID_LLMLAB_API_KEY`). Never commit the key. `.gitignore`
   covers `.env`, `.env.*`, `.opencode/`, and `*.key`.
4. **opencode provider config** ✅ Done — see `opencode.json` above.
   Model id: `Qwen/Qwen3.5-397B-A17B-FP8` (as used in Spike 1/3 logs;
   verify against PLGrid's current model list before first use).
5. **Egress note** — PLGrid llmlab is reachable from your laptop, but
   **not** from GitHub Actions runners or the Copilot cloud agent. Qwen
   sessions are therefore human-driven from a developer machine; CI runs
   the same lint/test/build matrix regardless of which AI authored the
   commit.

### Branching, attribution, and fall-back

- **Branch name**: `qwen/<stage-or-feature>` (e.g. `qwen/stage-3-wasm`,
  `qwen/feature-calculator`). The prefix flags the branch as an
  experiment.
- **PR title**: prefix with `[qwen]` so reviewers know to expect a
  different style.
- **Attribution**: every `CHANGELOG-AI.md` row and every
  `docs/ai-logs/...` session log MUST record the model and tool, e.g.
  `(opencode + Qwen3.5-397B)` — already the convention for the Qwen
  spikes; now mandatory (see §9).
- **Fall-back rule**: time-box each Qwen attempt (suggested: one working
  day per stage, two for Stage 3). If the branch does not pass
  `pnpm lint && pnpm test && pnpm build` and the spec's Acceptance
  Criteria within the time-box, **do not merge**. File a closing log
  entry under `docs/ai-logs/YYYY-MM-DD-qwen-<stage>-attempt.md` with
  what worked, what failed, and any reusable artifacts; abandon the
  branch; resume the same stage on `master` with Copilot.
- **Merge gate** (when Qwen does succeed): same CI as Copilot work, plus
  a human or Copilot review pass. Squash-merge so the `master` history
  stays linear regardless of authorship.

### What you do **not** need

- No new MCP servers, Skills, or prompt files. opencode + Qwen reads the
  existing `docs/` tree directly — this is the spec-driven payoff.
- No spec rewrites. Specs are tool-agnostic.
- No Copilot-specific tools (`parallel_validation`, `report_progress`)
  on the Qwen side. Substitute manual `pnpm` commands and `git push`.

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
│       ├── entities.ts              # Programs, particles, materials
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
| `ParticleEntity` | Extends base with `massNumber`, `atomicMass`, `aliases` |
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
- **ESTAR included:** Electrons via particle ID 1001.
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
- **Produce:** `docs/01-project-vision.md`, all `docs/04-feature-specs/*.md`, `docs/06-wasm-api-contract.md`, `docs/10-terminology.md`.
- **Validate:** You review all specs for physics correctness.
- **Terminology scope:** Two audiences — (1) *physics / end-user*: domain terms used in the UI, tooltips, and user documentation (stopping power, CSDA range, Bragg additivity, mean excitation energy, etc.); (2) *developer*: technical-stack terms used in code, commit messages, and internal docs (WASM, Emscripten, runes, dedx_config, entity, series, etc.).

### Stage 2: Technical Architecture
- **Who:** You + AI.
- **Produce:** `docs/02-tech-stack.md`, `docs/03-architecture.md`, ADRs in `docs/decisions/`.
- **Key:** Document *why* SvelteKit, *why* keep JSROOT, WASM module format (ES module).

### Stage 2.5: Prototyping Spikes (Risk Reduction)
- **Who:** AI implements autonomously (one spike per session).
- **Input:** [`docs/11-prototyping-spikes.md`](11-prototyping-spikes.md).
- **Produce:** Four throwaway prototypes in `prototypes/` that validate:
  1. JSROOT 7 rendering inside a Svelte 5 `$effect` (DOM ownership, cleanup, re-draw). ✅
  2. Emscripten `--preload-file` served by SvelteKit static adapter and sub-path hosting. ✅
  3. Module-level `$state` with `{ value: T }` wrapper reactive across components. ✅
  4. External data format: Zarr v3 + sharding vs Apache Parquet — file size, per-ion
     HTTP Range reads, and `zarrita` vs `hyparquet` JS bundle size.
- **Gate (Stage 3):** Spikes 1–3 must pass before Stage 3 begins. ✅ Gate open.
- **Gate (external-data feature):** Spike 4 must produce `VERDICT.md` before
  `docs/04-feature-specs/external-data.md` is implemented.
- **Verify:** Each spike produces a `VERDICT.md` with pass/fail per criterion.

### Stage 2.6: libdedx Data Source Investigation (pre-Stage 3 gate)
- **Who:** AI-assisted investigation.
- **Purpose:** Full static analysis of libdedx C headers to verify data availability,
  coverage, units, and bundle strategy before Stage 3 implementation begins.
- **Produce:**
  - `prototypes/libdedx-investigation/inspect_headers.py` — static analysis script (no compilation)
  - `prototypes/libdedx-investigation/data/headers_stats.json` — machine-readable full output
  - `prototypes/libdedx-investigation/REPORT.md` — markdown report with all findings
- **Phase 1 complete (15 April 2026).** Key findings:
  - **Data fully embedded** — `dedx_data_access.c` has zero `fopen()` calls; all
    stopping-power tables are compiled-in static arrays. The Spike 2 `.data` sidecar
    was never read at runtime. **Outcome A confirmed.**
  - **`--preload-file` unnecessary for runtime** — investigation confirmed the Stage 3
    WASM build target is `.mjs` + `.wasm` only; ADR 003 must stay in sync with this decision.
  - **ESTAR open** — `dedx_estar.h` not compiled by `dedx_embedded_data.c`; resolved in Phase 2.
  - **19 tabulated ions** (Z=1, 2, 3–18, electron); ~240-particle claim applies to parametric path.
  - **279 materials** (spec ~280 — CLOSE); 29 gas targets (exact match).
  - **Units confirmed** — density g/cm³, I-value eV, STP MeV·cm²/g, CSDA g/cm².
  - **412 KB raw float data** across unique tables; estimated Stage 3 WASM: ~650–860 KB.
- **Phase 2 complete:** WASM runtime verification resolved the ESTAR question, confirmed
  `dedx_fill_program_list()` / `dedx_fill_ion_list()` outputs, and spot-checked representative STP values.
- **Gate:** Investigation complete. Stage 3 may proceed on the verified `.mjs` + `.wasm`
  build path; remaining follow-up is to keep ADR 003/documentation aligned with the implemented build.

### Stage 3: WASM Build Pipeline Redesign ✅
- **Who:** AI implements.
- **Input:** `docs/06-wasm-api-contract.md`, `docs/decisions/003-wasm-build-pipeline.md`.
- **Output:** New build script, TypeScript wrapper in `src/lib/wasm/`, ES module `.mjs` + `.wasm`.
- **Test-driven principle:** For each Stage 3 increment, add or tighten
  verification assertions first (RED). Until `wasm/verify.mjs` is relocated in
  Stage 3, start from
  `prototypes/libdedx-investigation/wasm-runtime/verify.mjs` (see
  `docs/07-testing-strategy.md` §5), then implement wrapper/build changes until
  checks pass (GREEN), then refactor without changing behavior and re-run the
  same verification checks after refactor.
- **CI (first PR gate):** Delete `.github/workflows/test_and_deploy.yml` (legacy CRA);
  add `.github/workflows/ci.yml` triggering on every push/PR to `master` — runs
  the verification script from its current location first, then `node wasm/verify.mjs`
  after relocation.
- **Verify:** The verification script passes from
  `prototypes/libdedx-investigation/wasm-runtime/verify.mjs` during transition
  and, after relocation, from `wasm/verify.mjs`; TypeScript wrapper returns
  valid program/particle/material lists.
- **Status:** GREEN phase complete (21 April 2026). All 67 contract checks pass.
  See `docs/progress/stage-3.md`.

> **WASM output location (resolved):** `wasm/build.sh` now outputs to
> `static/wasm/libdedx.{mjs,wasm}` with `ENVIRONMENT=web,node`. The `node` component
> preserves `verify.mjs` Node.js compatibility without a separate build. CI uploads
> `static/wasm/` as an artifact from the `wasm-verify` job; the `e2e-tests` job
> downloads it before `pnpm build`. Resolved on branch `fix/wasm-web-ci`.

### Stage 3.7: Legacy Code Removal ✅ (21 April 2026)
- **Rationale:** Moved forward from Stage 9. The old React codebase conflicts with
  Stage 3 work (wrong `src/` structure, broken `package.json` scripts, CRA artefacts
  in `public/`). The new SvelteKit project cannot coexist with these files.
- **Removed:**
  - `src/` — entire legacy React codebase (App.js, Backend/, Components/, Styles/,
    `__test__/`, index.js, reportWebVitals.js, setupTests.js, logo.svg)
  - `public/index.html`, `public/logo192.png`, `public/logo512.png`,
    `public/manifest.json`, `public/robots.txt` — CRA public artefacts
  - `build_wasm.sh` — superseded by `wasm/build.sh`
- **Kept:**
  - `public/favicon.ico` — project favicon (to be copied to SvelteKit `static/`)
  - `public/webdEdx_logo.svg` — project logo (to be copied to SvelteKit `static/`)
- **Note:** `package.json` has already been reduced to the temporary WASM-only
  scripts needed before scaffolding; Stage 4 replaces it with the SvelteKit project
  manifest.
- **Legacy code last commit:** `0330233` (`docs: add AI session logging system`).

### Stage 3.8: Early development deploy ✅ (21 April 2026)
- **Rationale:** Establish the `master → APTG/web_dev` deployment pipeline so
  it is exercised and confirmed working well before the full app is complete.
  Makes the dev site immediately visible to collaborators.
- **Deliverables:**
  - `.github/workflows/deploy.yml` — triggers on push to `master`; builds the
    WASM + SvelteKit app and deploys to `APTG/web_dev` via
    `peaceiris/actions-gh-pages@v4`.
  - `docs/08-deployment.md §5.1` — documents early deploy phase, one-time
    repo setup, and Stage 8 migration path.
- **One-time repo setup (human step):** Create a fine-grained PAT with
  `Contents: Read and write` on `APTG/web_dev`, store as
  `WEB_DEV_DEPLOY_TOKEN` secret; enable GitHub Pages on `APTG/web_dev`
  (source: `gh-pages` branch); create `dev` environment in `dedx_web` repo
  settings. See [`docs/08-deployment.md §5.1`](08-deployment.md) for the
  full checklist.
- **Stage 8 migration:** add `v*` tag trigger and a production deploy job to
  `deploy.yml` that builds and pushes `build/` to `APTG/web`.

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
- **Expand CI:** add `pnpm install`, `pnpm lint`, `pnpm check` (svelte-check + tsc),
  `pnpm build` to `ci.yml` — every PR now gets a full type-check and build gate.
- **Verify:** App builds, routes work, `eslint . && prettier --check .` pass, deploys to GitHub Pages (empty pages).

### Stage 5: Core Shared Components
- **Who:** AI implements (one component per chat session).
- **Order:**
  1. ✅ Entity selection (cascading dropdowns) — Svelte stores + WASM (merged PR #366, Apr 2026)
  2. ✅ Energy input component — textarea with per-line validation, debounce (merged PR #368, Apr 2026)
  3. ✅ Unit selector — radio/segmented control (merged PR #370, Apr 2026)
  4. ✅ Result table — unified input/result table (Stage 5.4, completed Apr 2026)
  5. JSROOT plot wrapper — Svelte component managing JSROOT lifecycle
- **Expand CI:** add `pnpm test` (Vitest) to `ci.yml` — first unit tests are written
  in this stage; every PR's test suite must pass before merge.

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
- **Expand CI:** add `pnpm exec playwright install --with-deps` + `pnpm exec playwright test`
  to `ci.yml`.

### Stage 8: CI/CD — Deploy job
- `ci.yml` already has lint, type-check, Vitest, Playwright, and build from Stages 3–7.
- This stage adds the **deploy job**: push `build/` to `APTG/web_dev` on `master`,
  to `APTG/web` on `v*` tag. See [`docs/08-deployment.md §5`](08-deployment.md)
  for the full workflow YAML.
- **First production release:** tag `v2.0.0` → deploys to `APTG/web`, replacing v1.1.0.

### Stage 9: Legacy Code Removal ✅ (completed early as Stage 3.7)
- Legacy React source, CRA public artefacts, and `build_wasm.sh` were removed on
  21 April 2026 as Stage 3.7, ahead of the originally planned post-deployment window.
  See §8 Stage 3.7 for the complete file list and rationale.
- No separate Stage 9 cleanup remains in `package.json`; Stage 4 replaces it wholesale
  when the SvelteKit app is scaffolded.
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
| **Use RED → GREEN → REFACTOR in migration stages** | Keeps implementation tied to executable acceptance criteria and reduces regressions during rewrites. |
| **Be specific about JSROOT styling** | "Log-log axes, 14pt labels, legend top-right, line width 2" — not "make it pretty." |
| **Log progress in `docs/progress/`** | So the next session knows what's done and what's next. |
| **Run `eslint . && prettier --check .` before committing** | Catch formatting/lint issues AI may introduce. |
| **Log every AI session** | Append to `CHANGELOG-AI.md` + create `docs/ai-logs/YYYY-MM-DD-<slug>.md`. See `.github/copilot-instructions.md` for format. |
| **Record model + tool in every log entry** | Both `CHANGELOG-AI.md` rows and session logs must include `(<model> via <tool>)` — e.g. `(Claude Sonnet 4.6)` for Copilot, `(opencode + Qwen3.5-397B)` for opencode/PLGrid. Required for multi-tool workflows (see §4.2). |

---

## 10. How to Resume This Work

When starting a new LLM session on any machine:

1. Open the working branch (check `git branch` or `CHANGELOG-AI.md` for the latest).
2. `.github/copilot-instructions.md` loads automatically — no manual context needed.
3. Check `docs/progress/` to see which stage was last completed.
4. Check `CHANGELOG-AI.md` for recent AI session history.
5. Use `/implement-feature` prompt pointing to the relevant spec, or tell the agent:
   *"Read `docs/00-redesign-plan.md` for full project context."*
6. After implementing, update `docs/progress/` and commit.

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
