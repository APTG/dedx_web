# 2026-05-07 — Stage 6.9 Inverse Lookups — opencode prompt authoring

**Model:** Claude Sonnet 4.6 via Claude Code

## Session Narrative

### Prompt 1: Draft opencode prompt for Stage 6.9 Inverse Lookups

**AI response**: Read the canonical prompt schema from
`docs/opencode-prompt-authoring.md` and the Final v6 spec from
`docs/04-feature-specs/inverse-lookups.md`. Also read the two reference commits:

- `1048631` (PR #432 post-mortem — lessons-learned, agent contracts, contract tests)
- `cb08e1a` (PR #433 — spec prep for Stages 6.9–6.13 including inverse-lookups v5+v6)

Explored the current codebase state to identify what exists vs. what needs to be
built:

**Already exists:**

- `InverseStpResult` and `InverseCsdaResult` types in `types.ts` (scalar fields)
- Unit-conversion helpers in `unit-conversions.ts` (stpMassToKevUm, csdaGcm2ToCm)
- `LibdedxService` interface (9 methods — but missing all 5 inverse-lookup methods)
- `calculatorUrlQueryString` codec in `calculator-url.ts` (no imode/ivalues/iunit yet)
- Calculator page (697 lines, no tab switcher or inverse tabs)

**Needs to be built (5 tasks):**

1. WASM service interface + mock: add getInverseStp, getInverseCsda,
   getBraggPeakStp, getDensity, convertEnergy
2. URL codec extension: imode/ivalues/iunit round-trip
3. Pure utilities: range suffix parser + energy auto-scaling (prefix ladder §6)
4. Calculator tab UI + Range tab (single-program, URL init, E2E Scenarios 1,2,4,6,7)
5. Inverse STP tab + multi-program columns + export (E2E Scenarios 3,5,7,8)

Generated `docs/ai-logs/prompts/2026-05-07-stage6-9-inverse-lookups.md` with
the full 5-task prompt following the canonical schema.

## Tasks

### Draft opencode prompt for Stage 6.9

- **Status**: completed
- **Stage**: 6.9 — Inverse Lookups (Range + Inverse STP tabs)
- **Files changed**:
  - `docs/ai-logs/prompts/2026-05-07-stage6-9-inverse-lookups.md` (created)
  - `docs/ai-logs/prompts/README.md` (added index row)
  - `docs/ai-logs/2026-05-07-stage6-9-inverse-lookups-prompt.md` (this file)
  - `CHANGELOG-AI.md` (prepend row)
- **Decision**: Split into 5 tasks rather than 3-4 because Task 1 (WASM interface)
  and Task 2 (URL codec) are foundational and must commit before the UI tasks
  start. The 40-step implementer limit would be exceeded if WASM+URL+UI were
  combined. Task 3 (pure utilities) can run in any order but is cleanest before
  Task 4.
- **Key spec details referenced**:
  - All 8 Acceptance Scenarios from spec §Acceptance Scenarios with verbatim
    Playwright snippets
  - All 16 data-testid anchors from spec §Appendix: data-testid Reference
  - lessons-learned Entries 1, 2, 4, 5 referenced inline in relevant task steps
  - C function names confirmed from `docs/06-wasm-api-contract.md` §3 binding table
