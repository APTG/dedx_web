# dEdx Web — Full Redesign Plan

> Generated from an AI-assisted planning session on 1 April 2026.
> This document captures all decisions, the stage-by-stage strategy,
> and best practices for continuing the work in any future LLM session.

---

## 1. Context

### Versioning

| Version    | Status                | URL                                                       | Notes                                      |
| ---------- | --------------------- | --------------------------------------------------------- | ------------------------------------------ |
| **v1.1.0** | Released 1 April 2022 | [aptg.github.io/web](https://aptg.github.io/web/)         | Last stable release; legacy React 17 app   |
| **v2.x**   | Open beta / feedback  | [aptg.github.io/web_dev](https://aptg.github.io/web_dev/) | This rewrite — SvelteKit + Svelte 5 + WASM |

The first production release of v2 will be tagged `v2.0.0` and deployed to `APTG/web` (see Stage 9).

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

| Layer           | Choice                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| Framework       | **SvelteKit** with **Svelte 5** (TypeScript)                                       |
| Plotting        | **JSROOT** (keep — physics community standard)                                     |
| Styling         | **Tailwind CSS**                                                                   |
| UI components   | **shadcn-svelte** + Bits UI ([ADR 005](decisions/005-shadcn-svelte-components.md)) |
| WASM / libdedx  | **Full redesign** (build pipeline + JS wrapper)                                    |
| Deployment      | **GitHub Pages**                                                                   |
| Language        | **TypeScript** (strict mode)                                                       |
| Linting         | **ESLint** (`eslint-plugin-svelte`)                                                |
| Formatting      | **Prettier** (`prettier-plugin-svelte`)                                            |
| Testing         | **Full coverage** — unit + integration + E2E                                       |
| Unit tests      | Vitest + Svelte Testing Library                                                    |
| E2E tests       | Playwright                                                                         |
| AI agent config | **GitHub Copilot** customization files in `.github/`                               |
| UX inspiration  | **ATIMA** (https://www.isotopea.com/webatima/)                                     |

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

| Primitive              | File                      | When loaded                                     | Purpose                                         |
| ---------------------- | ------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Workspace instructions | `copilot-instructions.md` | Every interaction                               | Project context, Svelte 5 rules, build commands |
| File instructions      | `*.instructions.md`       | When editing matching files                     | Framework/domain-specific rules                 |
| Prompts                | `*.prompt.md`             | On-demand via `/` slash command                 | Reusable task templates                         |
| Custom agents          | `*.agent.md`              | User picks in agent selector, or auto-delegated | Focused roles with restricted tools             |
| Skills                 | `SKILL.md` in subfolder   | On-demand when task matches description         | Multi-step workflows with bundled assets        |

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

| Type                | Purpose                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| `LibdedxEntity`     | Base: `{ id, name }`                                                            |
| `ParticleEntity`    | Extends base with `massNumber`, `atomicMass`, `aliases`                         |
| `ProgramEntity`     | Extends base with `version`                                                     |
| `MaterialEntity`    | Extends base with `density`, `isGasByDefault`                                   |
| `CalculationResult` | `{ energies, stoppingPowers, csdaRanges }`                                      |
| `AdvancedOptions`   | `{ aggregateState, interpolation, mstarMode, densityOverride, iValueOverride }` |
| `CustomCompound`    | User-defined material with elemental composition                                |
| `LibdedxError`      | Typed error with C error code + message                                         |

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
- **Terminology scope:** Two audiences — (1) _physics / end-user_: domain terms used in the UI, tooltips, and user documentation (stopping power, CSDA range, Bragg additivity, mean excitation energy, etc.); (2) _developer_: technical-stack terms used in code, commit messages, and internal docs (WASM, Emscripten, runes, dedx_config, entity, series, etc.).

### Stage 2: Technical Architecture

- **Who:** You + AI.
- **Produce:** `docs/02-tech-stack.md`, `docs/03-architecture.md`, ADRs in `docs/decisions/`.
- **Key:** Document _why_ SvelteKit, _why_ keep JSROOT, WASM module format (ES module).

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

- **Rationale:** Moved forward from Stage 10. The old React codebase conflicts with
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
    repo setup, and Stage 9 migration path.
- **One-time repo setup (human step):** Create a fine-grained PAT with
  `Contents: Read and write` on `APTG/web_dev`, store as
  `WEB_DEV_DEPLOY_TOKEN` secret; enable GitHub Pages on `APTG/web_dev`
  (source: `gh-pages` branch); create `dev` environment in `dedx_web` repo
  settings. See [`docs/08-deployment.md §5.1`](08-deployment.md) for the
  full checklist.
- **Stage 9 migration:** add `v*` tag trigger and a production deploy job to
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

### Stage 5: Core Shared Components ✅ (28 April 2026)

- **Who:** AI implements (one component per chat session).
- **Order:**
  1. ✅ Entity selection (cascading dropdowns) — Svelte stores + WASM ([PR #366](https://github.com/APTG/dedx_web/pull/366), Apr 2026; cascading-fixes [PR #371](https://github.com/APTG/dedx_web/pull/371))
  2. ✅ Energy input component — textarea with per-line validation, debounce ([PR #368](https://github.com/APTG/dedx_web/pull/368), Apr 2026)
  3. ✅ Unit selector — radio/segmented control ([PR #370](https://github.com/APTG/dedx_web/pull/370), Apr 2026)
  4. ✅ Result table — unified input/result table ([PR #374](https://github.com/APTG/dedx_web/pull/374), Apr 2026; follow-up fixes [PR #376](https://github.com/APTG/dedx_web/pull/376), [PR #377](https://github.com/APTG/dedx_web/pull/377), [PR #378](https://github.com/APTG/dedx_web/pull/378), [PR #379](https://github.com/APTG/dedx_web/pull/379))
  5. ✅ JSROOT plot wrapper — Svelte component managing JSROOT lifecycle ([PR #394](https://github.com/APTG/dedx_web/pull/394), Apr 2026)
- **Expand CI:** add `pnpm test` (Vitest) to `ci.yml` — first unit tests are written
  in this stage; every PR's test suite must pass before merge.
- **Status:** Complete. See [`docs/progress/stage-5.md`](progress/stage-5.md) for the consolidated stage summary, [`docs/progress/stage-5-entity-selection.md`](progress/stage-5-entity-selection.md), [`docs/progress/stage-5.4-result-table.md`](progress/stage-5.4-result-table.md), [`docs/progress/stage-5-audit-2026-04-26.md`](progress/stage-5-audit-2026-04-26.md), and the closing [UX review](ux-reviews/2026-04-28-stage5-completion-and-stage6-readiness.md).

### Stage 6: Feature Pages ✅ Complete (May 2026)

- **Who:** AI implements per feature spec (one sub-stage per session).
- **Input:** Individual spec files in `docs/04-feature-specs/`.
- **Status:** All 13 sub-stages complete. Calculator core, live calc, multi-program comparison, Plot page, shareable URLs, basic/advanced export, Build Info badge, Advanced Options, Inverse Lookups, Custom Compounds, advanced export additions, multi-program polish, and formal URL parser are all shipped.

#### Sub-stages

| #    | Feature                                                             | Status | Spec                                                                             | Notes / PR(s)                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1  | Calculator core: URL sync, toolbar, Share URL button                | ✅     | [`calculator.md`](04-feature-specs/calculator.md)                                | [#399](https://github.com/APTG/dedx_web/pull/399), [log](ai-logs/2026-04-28-stage6-calculator-basic.md)                                                                                                                                             |
| 6.2  | Live calculation (debounced reactive updates)                       | ✅     | [`calculator.md`](04-feature-specs/calculator.md)                                | [#368](https://github.com/APTG/dedx_web/pull/368) (Stage 5.2 debounce foundation), [#399](https://github.com/APTG/dedx_web/pull/399) (Calculator wiring)                                                                                            |
| 6.3  | Multi-program comparison — grouped table, quantity focus, URL       | ✅     | [`multi-program.md`](04-feature-specs/multi-program.md)                          | [#423](https://github.com/APTG/dedx_web/pull/423), [#410](https://github.com/APTG/dedx_web/pull/410) (mobile scroll), [log](ai-logs/2026-05-04-stage6-multi-program.md)                                                                             |
| 6.4  | Plot page with JSROOT + data series comparison                      | ✅     | [`plot.md`](04-feature-specs/plot.md)                                            | [#394](https://github.com/APTG/dedx_web/pull/394) (Stage 5.5)                                                                                                                                                                                       |
| 6.5  | Shareable URLs — Calculator + Plot + Advanced mode round-trip       | ✅     | [`shareable-urls.md`](04-feature-specs/shareable-urls.md)                        | [#399](https://github.com/APTG/dedx_web/pull/399) (calc), [#394](https://github.com/APTG/dedx_web/pull/394) (plot), [#423](https://github.com/APTG/dedx_web/pull/423) (adv mode), [#457](https://github.com/APTG/dedx_web/pull/457) (formal parser) |
| 6.6  | CSV + PDF + SVG export — Calculator + Plot (basic mode)             | ✅     | [`export.md`](04-feature-specs/export.md)                                        | [#405](https://github.com/APTG/dedx_web/pull/405) (calc), [#422](https://github.com/APTG/dedx_web/pull/422) (plot), [log](ai-logs/2026-04-29-stage6-export-and-e2e-fixes.md), [log](ai-logs/2026-05-04-stage6-plot-export-copilot-fixes.md)         |
| 6.7  | Build info badge (footer)                                           | ✅     | [`build-info.md`](04-feature-specs/build-info.md) Final v1                       | [#431](https://github.com/APTG/dedx_web/pull/431). Commit hash + ISO date + branch in footer; `deploy.cjs` → `deploy.json` at build time. [log](ai-logs/2026-05-06-stage6-7-build-info.md)                                                          |
| 6.8  | Advanced Options panel (density, I-value, agg state, interp, MSTAR) | ✅     | [`advanced-options.md`](04-feature-specs/advanced-options.md)                    | [#427](https://github.com/APTG/dedx_web/pull/427), [log](ai-logs/2026-05-06-stage6-8-density-advanced-mode-fix.md)                                                                                                                                  |
| 6.9  | Inverse Lookups (Range + Inverse STP tabs)                          | ✅     | [`inverse-lookups.md`](04-feature-specs/inverse-lookups.md) Final v6             | [#439](https://github.com/APTG/dedx_web/pull/439). Advanced-mode only; tab-content guards fixed. 11/11 E2E pass. Dep: 6.8 ✅.                                                                                                                       |
| 6.10 | Custom Compounds                                                    | ✅     | [`custom-compounds.md`](04-feature-specs/custom-compounds.md) Final v3           | [#444](https://github.com/APTG/dedx_web/pull/444) (preflight), [#445](https://github.com/APTG/dedx_web/pull/445). Compound editor, localStorage, `calculateCustomCompound()`, `material=custom` + `mat_*`.                                          |
| 6.11 | Export: advanced mode additions                                     | ✅     | [`export.md`](04-feature-specs/export.md) Final v6 §§1.1, 4.1, 6.1               | [#451](https://github.com/APTG/dedx_web/pull/451). CSV configuration modal (Calculator + Plot, advanced only); PNG export (Plot, advanced only); Calculator advanced PDF metadata block. Dep: 6.8 ✅.                                               |
| 6.12 | Multi-program polish                                                | ✅     | [`multi-program.md`](04-feature-specs/multi-program.md) Final v3 §§5, 6          | [#452](https://github.com/APTG/dedx_web/pull/452). Drag-and-drop column reorder, keyboard Alt+Arrow reorder, column visibility dropdown, delta/% tooltip. Deferred from 6.3.                                                                        |
| 6.13 | Formal URL parser (full ABNF conformance)                           | ✅     | [`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) Final v6 | [#457](https://github.com/APTG/dedx_web/pull/457). `urlv` negotiation + warning banner; strict token parsing; `material=custom` + `mat_*` round-trip. Dep: 6.10 ✅. [log](ai-logs/2026-05-12-stage6-13-url-parser-upgrades.md)                      |

> **Completed in Stage 7.5:** External data (`external-data.md`, Zarr v3 `.webdedx` format)
> and its URL grammar (`extdata=` param, `ext-ref` entity grammar in
> `shareable-urls-formal.md`) shipped in [PR #465](https://github.com/APTG/dedx_web/pull/465).

### Stage 7: E2E Tests, Polish & External Data ✅ Complete

- **Who:** AI implements per sub-stage spec (one per session).
- **Input:** [`docs/07-testing-strategy.md`](07-testing-strategy.md), [`docs/09-non-functional-requirements.md`](09-non-functional-requirements.md), and individual spec files in [`docs/04-feature-specs/`](04-feature-specs/).
- **Status:** Complete. Stage 7.1 is implemented in [PR #459](https://github.com/APTG/dedx_web/pull/459); Stage 7.2 is complete in [PR #460](https://github.com/APTG/dedx_web/pull/460); Stage 7.3 is complete in [PR #463](https://github.com/APTG/dedx_web/pull/463); Stage 7.4 is complete in [PR #464](https://github.com/APTG/dedx_web/pull/464); Stage 7.5 external data is complete in [PR #465](https://github.com/APTG/dedx_web/pull/465). Stage 8 open beta / user-feedback issue handling is now the active phase.

#### Sub-stages

| #   | Feature                                             | Status | Spec / Doc                                                                                                                       | Notes / PR(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7.1 | Playwright E2E suite with real WASM + CI step       | ✅     | [`07-testing-strategy.md`](07-testing-strategy.md), [`08-deployment.md`](08-deployment.md)                                       | [#459](https://github.com/APTG/dedx_web/pull/459). Full E2E suite against actual `libdedx.wasm`; Playwright install/test in CI; WASM artifact download before `pnpm build`. [log](progress/stage-7.1.md)                                                                                                                                                                                                                                                     |
| 7.2 | JSROOT plot styling polish                          | ✅     | [`plot.md`](04-feature-specs/plot.md)                                                                                            | [#460](https://github.com/APTG/dedx_web/pull/460). Most styling (log-log defaults, axis labels with units, line width 2, color palette, grid, disabled scroll-zoom) was implemented in earlier stages. Font size: visual inspection found JSROOT defaults more readable than a forced 0.04 NDC override — no explicit font-size set. No JSROOT canvas legend — series list below canvas serves as legend per `plot.md`. [log](progress/stage-7.2.md)         |
| 7.3 | Mobile responsive polish                            | ✅     | [`09-non-functional-requirements.md`](09-non-functional-requirements.md)                                                         | [#463](https://github.com/APTG/dedx_web/pull/463). Calculator + Plot + multi-program table on small screens; WCAG 2.1 AA touch targets; tested with Playwright Pixel 5 and iPad Air device emulation                                                                                                                                                                                                                                                         |
| 7.4 | WASM error handling                                 | ✅     | [`calculator.md`](04-feature-specs/calculator.md), [`06-wasm-api-contract.md`](06-wasm-api-contract.md)                          | [#464](https://github.com/APTG/dedx_web/pull/464). Per-row retry on DEDX_ERR_ENERGY_OUT_OF_RANGE (101): out-of-range rows marked red while valid rows still show results. Multi-program pre-checks set explicit per-program errors and continue calculating safe programs, avoiding stale comparison cells. Fatal errors rendered below result table with "Show details" code toggle. Plot preview WASM errors surfaced inline. [log](progress/stage-7.4.md) |
| 7.5 | External data (Zarr v3 `.webdedx` user-hosted data) | ✅     | [`external-data.md`](04-feature-specs/external-data.md), [`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) | [#465](https://github.com/APTG/dedx_web/pull/465). `extdata=` URL param, `ext-ref` entity grammar, SRIM `.webdedx` converter tooling, external entity merging, Calculator/Plot integration, source attribution, service caching, and review/E2E follow-ups. [log](progress/stage-7.5.md)                                                                                                                                                                     |

### Stage 8: Open Beta & User Feedback ⏳ Active

- **Who:** You (human) collects feedback; AI implements fixes per issue.
- **When:** Active after Stage 7 completion; `APTG/web_dev` is already live on every `master` push.
- **Goal:** Catch visual/layout bugs and UX annoyances before the production release.
  During this window both apps are live for side-by-side comparison:
  - `aptg.github.io/web` — v1.1.0 (old React app, still works as reference)
  - `aptg.github.io/web_dev` — v2.x (new SvelteKit app, receiving feedback)
    Once Stage 9 tags `v2.0.0`, `APTG/web` gets overwritten and the comparison
    window closes — so this stage must happen first.
- **Process:**
  1. Share the `web_dev` URL with users and invite feedback.
  2. File issues on GitHub with a `beta-feedback` label; tag critical ones `must-fix`.
  3. Fix issues in `master` — each push auto-deploys to `web_dev`.
  4. Repeat until all `must-fix` issues are resolved and the team is satisfied.
- **Gate (Stage 9):** No open `beta-feedback` issues tagged `must-fix`; team sign-off.
- **Verify:** `web_dev` reflects all fixes; acceptance from at least one external user.

#### Stage 8 PRs

| PR                                                | Area                                  | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#470](https://github.com/APTG/dedx_web/pull/470) | Tooling / type-check cleanup          | ✅     | Fixed repository-wide `pnpm check` diagnostics and scoped `svelte-check` to app sources so vendor/prototype submodules are ignored.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [#474](https://github.com/APTG/dedx_web/pull/474) | Plot / alpha particle beta feedback   | ✅     | Fixed alpha stopping-power plot preview recursion by generating plot grids from libdedx tabulated energy ranges; added built-in/custom-compound unit coverage and an E2E regression for the reported URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [#476](https://github.com/APTG/dedx_web/pull/476) | External data beta feedback           | ✅     | Fixed Calculator and Plot selectors to display loaded external programs and external-only entities under an `External` group; added `ExternalSourcesPanel` for source attribution; fixed SRIM water material matching via `rawName` and parenthetical-suffix fuzzy logic; added user-guide instructions with copy-pasteable example URLs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [#478](https://github.com/APTG/dedx_web/pull/478) | Converter + plot review follow-ups    | ✅     | Fixed SRIM converter to deduplicate ICRU materials and always assign `icruId` (density-variant entries get a suffixed name and no `icruId`); fixed external plot URL restore race condition by gating URL write-back until all async external series are fully restored; added unit tests for external preview/restore mapping.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [#481](https://github.com/APTG/dedx_web/pull/481) | External CSDA derivation              | ✅     | Derives CSDA range by trapezoidal integration of 1/S(E) for `.webdedx` stores without a `csda_range` array (e.g. SRIM data from S3); added `computeCsdaColumn()` in `units.ts` with null-propagation; result cached alongside STP entry; fixed Calculator to convert external CSDA from g/cm² to cm before display.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [#490](https://github.com/APTG/dedx_web/pull/490) | Plot energy units                     | ✅     | Derives Plot X-axis and CSV energy units from visible particles: proton-only and electron-containing plots use `MeV`; heavy-ion plots without electrons use `MeV/nucl`; heavy-ion X values convert to total MeV when an electron series is visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [#491](https://github.com/APTG/dedx_web/pull/491) | External programs in advanced mode    | ✅     | Widened `MultiProgramState` to `EntityId` (`number \| ExtRef`); added External section to `MultiProgramPicker`; wired external program calculation via `ExternalDataService.interpolateAt()`; fixed URL-round-trip race; added 22 unit tests and 5 E2E tests. Review follow-ups: gated E2E suite behind `@nightly`, clamped `massASnapshot` to ≥1 for electrons, removed `as unknown as` type cast, fixed ARIA `role="group"` for listbox section.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [#495](https://github.com/APTG/dedx_web/pull/495) | Manual S3 external-data CI            | ✅     | Adds a workflow-dispatch-only S3 E2E suite that builds WASM, generates a tiny synthetic `.webdedx` store, serves it from runner-hosted MinIO, and runs the external-data advanced-mode Playwright suite against `EXTERNAL_DATA_URL`; active tests no longer depend on direct Cyfronet network access while the user guide keeps public SRIM example links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [#507](https://github.com/APTG/dedx_web/pull/507) | Tooling / vite.config.ts              | ✅     | Applied 2 Copilot Autofix code-quality suggestions to `vite.config.ts`. |
| [#508](https://github.com/APTG/dedx_web/pull/508) | Entity-selection tabbed picker        | ✅     | Replaced the cascading three-combobox / sidebar entity selector with a single tabbed picker (Particle / Material / Program) used on Calculator and Plot. Adds a recipe bar (`particle → material → program` + reset), inline Z=… in particle labels, side-by-side Elements / Compounds / Custom columns in the Material tab with density rendered as `(ρ=… g/cm³)` next to the name, an `+ Add compound` button surfacing the modal Custom Compound editor, a `DATA` program tag in place of the keyboard-evocative `TAB` badge, auto-collapse on Calculator when the selection is complete, and mobile-stacked tab labels. Dropped the `?v8=1` feature flag and the parallel `picker-mode` switch; the picker reads the global `isAdvancedMode` for Custom column + `⊞ explore compat` visibility. Renamed all components/tests/test IDs to `entity-selection/` and `picker-*` so the source no longer carries the `v8` codename.                                                               |
| [#511](https://github.com/APTG/dedx_web/pull/511) | Entity-selector chrome + state rework | ✅     | Removed `recipe-bar.svelte` and the `picker-recipe-*` testids; added `activeTarget`, `expanded`, `across`, `multiSelected` to `EntitySelectionState` with `setActiveTarget` / `setExpanded` / `setAcross` / `toggleMulti` setters; introduced `advanced-toolbar.svelte` (Compare-across dropdown — Programs enabled, Materials/Particles disabled; Load-external + Explore-compat disabled placeholders; `↺` reset); tabs render a coral active-target underline and a red-dashed/`!`-badge empty-tab styling (`picker-tab-{id}-empty` testid); Material tab gains coral `+ New custom material` pill in Advanced; `multi-list.svelte` drafted then deleted after review (invalid HTML, no consumers); `showAdvancedToolbar` prop hides toolbar on Plot. |
| [#516](https://github.com/APTG/dedx_web/pull/516) | Persistent picker-level search row    | ✅     | Lifted per-tab `<SearchInput>` out of `particle-tab.svelte` / `material-tab.svelte` / `program-tab.svelte` into a single `<EntitySelection>`-owned search row (`data-testid="picker-search-row"`) between the tab bar and the panel. Added chevron toggle (`▼` / `▲`, `data-testid="picker-toggle"`) on the right edge that expands/collapses the panel via `selectionState.setExpanded`. Placeholder switches with `activeTarget`; `data-testid` follows `picker-{activeTab}-search` so existing tests keep working. Particle ↑/↓/↵ keyboard nav preserved via `$bindable` handler slots. |
| [#520](https://github.com/APTG/dedx_web/pull/520) | Move external-sources-panel; per-source × Remove | ✅ | Moved `external-sources-panel.svelte` from `src/lib/components/` into `src/lib/components/entity-selection/`. Each source row is now individually collapsible (`<details>`). Per-source × Remove button calls `externalDataService.evict(label)` then the parent-supplied `onRemove` callback. Both calculator and plot pages filter the evicted label from `loadedExternalSources`. |
| [#521](https://github.com/APTG/dedx_web/pull/521) | Load-external modal: URL validator + drag-drop + recents | ✅ | New `load-external-modal.svelte` (bits-ui `Dialog`): URL tab with `https?://…\.webdedx` regex validation + auto-label from URL stem + `webdedx.externalRecents.v1` localStorage recents (5 entries, click-to-fill); Local directory tab with File System Access API drop zone (Chrome/Edge 86+, graceful degradation). New `FileSystemDirectoryHandleStore` (zarrita-compatible). Added `ExternalDataService.loadFromUrl()` / `loadFromDirectory()`; `loadStoreMetadataFromStore` + optional `storeOverride` on slice loaders; non-http sources filtered from shareable URL. `onLoadExternal` prop wired through `entity-selection.svelte` → `AdvancedToolbar` — enables the formerly-disabled button. Runtime source-add rebuilds `ExternalCompatibilityContext` in `calculator/+page.svelte`. |

| [#522](https://github.com/APTG/dedx_web/pull/522) | Drag handle reorder in multi-program-picker | ✅ | Added ⋮⋮ drag handle on each selected non-default program row in `multi-program-picker.svelte`. Mouse reorder via HTML5 DnD API; touch reorder via `touchstart`/`touchmove`/`touchend` + `document.elementFromPoint`; `Alt+ArrowUp`/`Alt+ArrowDown` keyboard reorder when handle has focus (blocked at position 1 to preserve default-first invariant). Always-present `aria-live="polite"` region announces "Moved X to position N of M" after each reorder. 14 new unit tests covering handle visibility, keyboard reorder edge cases, and announcement content. |
| [#523](https://github.com/APTG/dedx_web/pull/523) | Compare-across Materials / Particles end-to-end | 🚧 | Enabled the previously-disabled Materials and Particles options in the `picker-compare-across` dropdown (`advanced-toolbar.svelte`). Introduced `MultiEntityState` (`src/lib/state/multi-entity.svelte.ts`) — a lightweight analog to `MultiProgramState` that holds `comparisonResults` keyed by entity ID and a display-name resolver. Added multi-select rendering to `particle-tab.svelte` and `material-tab.svelte`: dismissible pills for selected entities, ✓ indicators per row, anchor-entity "(anchor)" label, `aria-multiselectable` on list. Wired debounced WASM calculation effects in `calculator/+page.svelte` that iterate over `entityState.multiSelected[dim]` and populate `MultiEntityState.comparisonResults`. `ResultTable` gains a new `{:else if isMultiEntity}` branch rendering grouped two-row headers (STP + CSDA groups, per-entity sub-headers with ◆ anchor marker) and per-entity result cells. `MultiProgramPicker` now renders only when `across === "program"`. |

### Stage 9: CI/CD — Deploy job

- `ci.yml` already has lint, type-check, Vitest, Playwright, and build from Stages 3–7.
- This stage adds the **deploy job**: push `build/` to `APTG/web_dev` on `master`,
  to `APTG/web` on `v*` tag. See [`docs/08-deployment.md §5`](08-deployment.md)
  for the full workflow YAML.
- **First production release:** tag `v2.0.0` → deploys to `APTG/web`, replacing v1.1.0.

### Stage 10: Legacy Code Removal ✅ (completed early as Stage 3.7)

- Legacy React source, CRA public artefacts, and `build_wasm.sh` were removed on
  21 April 2026 as Stage 3.7, ahead of the originally planned post-deployment window.
  See §8 Stage 3.7 for the complete file list and rationale.
- No separate Stage 10 cleanup remains in `package.json`; Stage 4 replaces it wholesale
  when the SvelteKit app is scaffolded.
- The old code is preserved in git history; the last commit containing it is referenced in §11.

---

## 9. Best Practices for AI Agent Sessions

| Practice                                                   | Reason                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Create `.github/copilot-instructions.md` first**         | Every AI session benefits from project context from the start.                                                                                                                                                            |
| **One feature per chat session**                           | Agents lose context in long threads. Start fresh per feature.                                                                                                                                                             |
| **Use `/implement-feature` and `/write-spec` prompts**     | Consistent context loading without manual re-explanation.                                                                                                                                                                 |
| **Always reference spec files**                            | Don't re-explain — say "implement per docs/04-feature-specs/calculator.md".                                                                                                                                               |
| **Start sessions with context**                            | "Read docs/03-architecture.md and docs/06-wasm-api-contract.md, then implement X."                                                                                                                                        |
| **Commit after each working increment**                    | Rollback points if AI produces broken code.                                                                                                                                                                               |
| **Enforce Svelte 5 in instructions**                       | AI training data has more Svelte 4 than 5. Explicit rules prevent `export let`, `$:`, `createEventDispatcher`.                                                                                                            |
| **Test WASM with real module early**                       | Mocks hide memory management bugs.                                                                                                                                                                                        |
| **Log decisions in `docs/decisions/`**                     | Future sessions need this context.                                                                                                                                                                                        |
| **Review AI-generated tests**                              | AI writes tests that pass by construction — check they assert real behavior.                                                                                                                                              |
| **Use RED → GREEN → REFACTOR in migration stages**         | Keeps implementation tied to executable acceptance criteria and reduces regressions during rewrites.                                                                                                                      |
| **Be specific about JSROOT styling**                       | "Log-log axes, 14pt labels, legend top-right, line width 2" — not "make it pretty."                                                                                                                                       |
| **Log progress in `docs/progress/`**                       | So the next session knows what's done and what's next.                                                                                                                                                                    |
| **Run `eslint . && prettier --check .` before committing** | Catch formatting/lint issues AI may introduce.                                                                                                                                                                            |
| **Log every AI session**                                   | Append to `CHANGELOG-AI.md` + create `docs/ai-logs/YYYY-MM-DD-<slug>.md`. See `.github/copilot-instructions.md` for format.                                                                                               |
| **Record model + tool in every log entry**                 | Both `CHANGELOG-AI.md` rows and session logs must include `(<model> via <tool>)` — e.g. `(Claude Sonnet 4.6)` for Copilot, `(opencode + Qwen3.5-397B)` for opencode/PLGrid. Required for multi-tool workflows (see §4.2). |

---

## 10. How to Resume This Work

When starting a new LLM session on any machine:

1. Open the working branch (check `git branch` or `CHANGELOG-AI.md` for the latest).
2. `.github/copilot-instructions.md` loads automatically — no manual context needed.
3. Check `docs/progress/` to see which stage was last completed.
4. Check `CHANGELOG-AI.md` for recent AI session history.
5. Use `/implement-feature` prompt pointing to the relevant spec, or tell the agent:
   _"Read `docs/00-redesign-plan.md` for full project context."_
6. After implementing, update `docs/progress/` and commit.

---

## 11. Existing Codebase Reference

The current (old) code has useful reference material despite being broken.
The last commit on `master` containing this code should be tagged or noted
before Stage 10 (legacy removal). You can find it with `git log master --oneline -1`.

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
