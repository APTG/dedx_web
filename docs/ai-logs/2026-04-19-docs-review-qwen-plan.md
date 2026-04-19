# 2026-04-19 — Docs critical review + opencode/Qwen workflow

## Session Narrative

### Prompt 1: Critical review of `docs/`; are we ready for the next migration step? If not, suggest next steps and update the plan in a PR. Also adapt the plan for trying coding with Qwen 3.5 via opencode against PLGrid llmlab (OpenAI-compatible API), with a separate branch and Copilot fall-back. Adjust logs and make a PR if needed.

**AI response** (Claude Sonnet 4.5 via Copilot):

Reviewed `docs/00-redesign-plan.md`, `docs/README.md`, `docs/04-feature-specs/README.md`,
`docs/progress/stage-1.md`, `docs/progress/stage-2.md`, the four ADRs in `docs/decisions/`,
`CHANGELOG-AI.md`, `docs/ai-logs/README.md`, `.github/copilot-instructions.md`, and the
repo root for any existing opencode/AGENTS config.

**Verdict on Stage 3 readiness:** Ready. Stage 1 (12 feature specs Final), Stage 2
(4 ADRs, tech-stack v2, architecture v1), Stage 2.5 (4 spikes incl. Spike 4 Zarr v3
verdict closed 2026-04-18), and Stage 2.6 (libdedx investigation Phase 1+2, 44/44
runtime checks PASS, 13 KB `.mjs` + 457 KB `.wasm`) are all complete with gates open.
Stage 3 is essentially "promote `prototypes/libdedx-investigation/wasm-runtime/` into
`src/lib/wasm/` per `06-wasm-api-contract.md`".

**Documentation gaps identified (none blocking):**
1. Plan §4 file tree lists `05-ui-wireframes.md`, `07-testing-strategy.md`,
   `08-deployment.md` — these were never created; their content is folded into
   feature specs / ADRs / NFR. Tree was out of sync with reality.
2. No multi-tool / opencode workflow documented even though Spike 1 and Spike 3 used
   opencode + Qwen3.5-397B successfully.
3. `.gitignore` lacked `.env.*`, `.opencode/`, `*.key` — minor secrets-hygiene gap.
4. `CHANGELOG-AI.md` row format did not require model + tool attribution (was
   convention-only).

**Adapted plan for opencode + Qwen via PLGrid llmlab (PR changes):**

- `docs/00-redesign-plan.md`
  - §4 file tree: replaced phantom `05/07/08` entries with the docs that actually
    exist (added `04-feature-specs` full enumeration, `11-prototyping-spikes.md`,
    ADR 004, `progress/stage-2.md`); added an explicit note explaining why the old
    standalone docs were not created.
  - New **§4.2 Multiple AI tools (opencode + Qwen via PLGrid llmlab)**: when to use
    Qwen (self-contained, well-specified, independently testable stages), local
    setup (opencode + AGENTS.md + env-var key + provider config + egress note),
    branching (`qwen/<stage>`, `[qwen]` PR prefix), fall-back rule (time-box, file
    closing log, abandon branch, resume on `master` with Copilot), merge gate, and
    explicit "what you do NOT need" (no new MCP, no spec rewrites).
  - §9 Best Practices: added row mandating `(<model> via <tool>)` attribution.
- `.github/copilot-instructions.md`: changelog entry format updated to require the
  attribution suffix.
- `.gitignore`: added `.env.*`, `.opencode/`, `*.key`.
- This log + `CHANGELOG-AI.md` row + `docs/ai-logs/README.md` index entry.

**Decision:** Did NOT create a new ADR for the opencode/Qwen workflow. It is a
process/tooling note, not an architecture decision — kept inside the redesign plan
where future agents will see it on session bootstrap. If the experiment proves
durable and the PLGrid endpoint becomes a long-term dependency, promoting to ADR
005 would be appropriate.

**Decision:** Did NOT commit a real `opencode.json` or `AGENTS.md`. The setup is
described in §4.2; the actual config + secret wiring should be done by the human
running opencode locally so the apiKey reference is correct for their environment
and PLGrid model id. Once tested, a sanitized `opencode.json` + minimal `AGENTS.md`
can be committed in a follow-up.

## Tasks

### Critical review of docs and Stage 3 readiness
- **Status**: completed
- **Stage**: 2 → 3 transition
- **Files changed**: none (review output is in this log + PR description)
- **Decision**: Stage 3 may begin without further doc work; the gaps below are
  improvements, not blockers.

### Plan update — clarify §4 file tree
- **Status**: completed
- **Stage**: meta (plan maintenance)
- **Files changed**: `docs/00-redesign-plan.md`
- **Decision**: prefer "fold into existing specs + add note" over "create empty
  stubs", because the content already exists in the right places and stubs would
  lie about completeness.

### Plan update — §4.2 Multiple AI tools (opencode + Qwen / PLGrid)
- **Status**: completed
- **Stage**: meta (plan maintenance)
- **Files changed**: `docs/00-redesign-plan.md`, `.github/copilot-instructions.md`,
  `.gitignore`
- **Decision**: kept §4.2 as a process section in the plan rather than an ADR.
  Branching convention `qwen/<stage>`, time-box + abandon + resume on `master`
  is explicit so the experiment cannot pollute `master` history.
- **Issue**: real `opencode.json`/`AGENTS.md` not committed (see narrative).
  Suggested as a follow-up once the human runs the first Qwen session and
  confirms the exact PLGrid model id + endpoint.

### Logging this session
- **Status**: completed
- **Files changed**: `CHANGELOG-AI.md`, `docs/ai-logs/2026-04-19-docs-review-qwen-plan.md`,
  `docs/ai-logs/README.md`
