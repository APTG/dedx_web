# 14 April 2026 — Prototyping Spikes

## Session Narrative

### Prompt 1: Create prototyping spike specifications

**User request**: Address the PR review comment that "no prototyping was done"
before finalizing architecture specs. Identify 2–3 prototyping tasks that can
be autonomously driven by an AI coder, create tasks, adjust plans, and write a
proper document with exact scope that can be handed to an LLM agent.

**AI response**: Re-read all current Stage 2 documents (03-architecture.md
Draft v1, all three ADRs, 02-tech-stack.md Draft v2, progress/stage-2.md,
00-redesign-plan.md) to understand the current state including recent fixes
(non-blocking WASM init, Web Worker strategy, `{ value: T }` wrapper
standardization, error boundaries, URL sync loop prevention).

Identified three high-risk architecture assumptions that warrant prototyping:

1. **JSROOT 7 + Svelte 5 `$effect`** — The `JsrootPlot.svelte` wrapper uses
   `$effect` + `untrack` + cleanup returns to manage JSROOT's direct DOM
   writes. This pattern has never been tested with JSROOT 7's actual API.

2. **WASM `--preload-file` on static hosting** — ADR 003 switches from
   `--embed-file` to `--preload-file`, but the legacy `build_wasm.sh` has a
   comment explaining that `--preload-file` caused fetch errors. The `locateFile`
   fix has not been validated.

3. **Module-level `$state` with `{ value: T }` wrapper** — The entire state
   topology depends on this pattern being reactive across component boundaries.
   This is the most fundamental assumption and has not been tested.

Created `docs/11-prototyping-spikes.md` with:
- Self-contained spike specifications that an agent can execute without
  human intervention
- Exact file contents and shell commands for each spike
- Explicit acceptance criteria with pass/fail verdicts
- Fallback instructions for when criteria fail
- Recommended execution order (fastest/most fundamental first)

Updated cross-references:
- `docs/00-redesign-plan.md` — inserted Stage 2.5 between Stage 2 and Stage 3
  with a gate rule
- `docs/progress/stage-2.md` — added Stage 2.5 section with spike table
- `docs/README.md` — added `11-prototyping-spikes.md` to document index

## Tasks

### Prototyping spikes specification
- **Status**: completed
- **Stage**: 2.5 (new)
- **Files changed**:
  - `docs/11-prototyping-spikes.md` (new)
  - `docs/00-redesign-plan.md` (Stage 2.5 inserted)
  - `docs/progress/stage-2.md` (spike table added)
  - `docs/README.md` (new doc entry)
  - `CHANGELOG-AI.md` (new row)
- **Decision**: Three spikes chosen (JSROOT, WASM preload, $state reactivity)
  rather than two, because each validates a different architectural layer
  (UI integration, build pipeline, state management) and failure of any one
  would require significant rework.
- **Decision**: Spikes produce throwaway code in `prototypes/` rather than
  early production code, to avoid premature commitment to patterns that may
  need amendment.
- **Decision**: Gate rule added — Stage 3 cannot begin until all spikes pass
  or architecture docs are amended. This prevents building on unvalidated
  assumptions.
