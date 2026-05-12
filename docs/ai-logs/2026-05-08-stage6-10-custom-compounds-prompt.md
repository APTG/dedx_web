# 2026-05-08 — Stage 6.10 Custom Compounds opencode prompt authoring

**Model:** Claude Sonnet 4.6 via Claude Code

## Session Narrative

### Prompt 1: Draft opencode/Qwen prompt for Stage 6.10 Custom Compounds

**User request:** Generate a detailed prompt file with subtasks for opencode and Qwen
for Stage 6.10 (Custom Compounds). Find templates and guidelines in the repo. Tell which
branch to work on and which prompt to paste into opencode.

**AI response:**

Read the following at session start:
- `docs/00-redesign-plan.md` — confirmed Stage 6.10 is next; recommended order is
  6.10 before 6.11–6.13 per the updated plan.
- `CHANGELOG-AI.md` — confirmed 6.9 Inverse Lookups is the last completed sub-stage
  (PR #439, all E2E passing).
- `docs/04-feature-specs/custom-compounds.md` — Full Final v4 spec: compound library,
  editor, validation, WASM integration (including 4 new custom compound service
  methods), URL encoding (`material=custom` + `mat_*`), localStorage schema, export,
  and the Stage 6.10 Preflight Addendum (§6.10.1–6.10.6).
- Existing prompt template: `docs/ai-logs/prompts/2026-05-07-stage6-9-inverse-lookups.md`
  — 5-task TDD prompt. Used as the structural template.
- `src/lib/wasm/libdedx.ts`, `wasm/dedx_extra.c`, `wasm/build.sh` — confirmed none of
  the 4 custom compound WASM methods exist yet; no custom compound C wrappers in
  `dedx_extra.c`; `build.sh` EXPORTED_FUNCTIONS does not include any custom compound symbols.
- `src/lib/utils/calculator-url.ts`, `src/lib/state/entity-selection.svelte.ts` — confirmed
  no `mat_*` URL params and no `MaterialRef` union type exist yet.
- `libdedx/include/dedx.h` — confirmed `dedx_config` struct has `elements_id`,
  `elements_atoms`, `elements_length`, `density_set`, `ivalue_set` fields for the
  custom compound path (target=0).

Produced `docs/ai-logs/prompts/2026-05-08-stage6-10-custom-compounds.md` — a 5-task
TDD prompt for Qwen3.5-397B on branch `qwen/stage6-10-custom-compounds`.

Tasks:
1. Pure TypeScript utilities + compound store (`element-data.ts`, `formula-parser.ts`,
   `custom-compounds.svelte.ts` with localStorage CRUD + validation + migration +
   `getCompatiblePrograms`).
2. WASM C wrappers (`dedx_calculate_custom_forward_flat`, `dedx_get_inverse_csda_custom_flat`,
   `dedx_get_inverse_stp_custom_flat`, `dedx_get_bragg_peak_stp_custom_flat`) + TypeScript
   service interface (`calculateCustomCompound`, `getPlotDataCustomCompound`,
   `getInverseStpCustomCompound`, `getInverseCsdaCustomCompound`,
   `getBraggPeakStpCustomCompound`) + mock updates + WASM rebuild.
3. URL codec — `material=custom` + `mat_*` params in `calculator-url.ts` and `plot-url.ts`
   with round-trip guarantee, parse validation, and `fromUrlWarning` recovery.
4. Compound editor modal (`CompoundEditorModal.svelte`) + entity selection integration
   (Calculator "Custom Compounds" group, Plot "Custom" sub-list, program compatibility
   filter with greyed-out tooltip).
5. Calculator + Plot page integration (dispatch to `calculateCustomCompound`, Advanced
   Options disable rules, URL sync, from-URL banner, Basic-mode fallback, inverse lookup
   custom compound variants) + export behavior (CSV filenames, PDF composition table).

Key decisions made during prompt authoring:
- **WASM work required**: 4 new C functions + WASM rebuild are necessary for Tasks 2 and 5.
  The prompt includes the full C signatures derived from the `dedx_config` field analysis.
- **Task ordering**: Tasks 1, 2, 3 are independent and can run in parallel; Task 4 depends
  on Task 1; Task 5 depends on all others.
- **`getPlotDataCustomCompound` is JS-side only**: iterative calls to `calculateCustomCompound`;
  no extra C code needed — noted explicitly in the prompt.
- **`MaterialRef` union type**: introduced in Task 4/5 to cleanly distinguish custom vs
  built-in material references throughout the calculator and plot pages.

## Tasks

### Draft opencode prompt for Stage 6.10 Custom Compounds

- **Status**: completed
- **Stage**: Stage 6.10 (Custom Compounds)
- **Files changed**:
  - `docs/ai-logs/prompts/2026-05-08-stage6-10-custom-compounds.md` — new prompt file
  - `docs/ai-logs/prompts/README.md` — index updated
  - `docs/ai-logs/README.md` — log listing updated
  - `CHANGELOG-AI.md` — changelog row prepended
- **Decision**: 5-task decomposition chosen to match the successful Stage 6.9 pattern;
  WASM rebuild is Task 2 rather than Task 1 so pure-TS utilities can proceed in parallel
  without blocking on a Docker WASM build.
- **Issue**: The 4 custom compound C wrappers are substantial WASM work; Qwen should be
  instructed to check `libdedx/include/dedx.h` for exact `dedx_config` field names before
  writing C code.
