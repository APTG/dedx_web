# opencode prompt archive

Prompts and task lists that were fed into opencode sessions (Qwen / GPT
runs from PLGrid llmlab). The actual session transcripts live in
`docs/ai-logs/*-qwen-session.md`; the per-session summary lives in the
sibling `docs/ai-logs/YYYY-MM-DD-<slug>.md` file.

These input files are kept for traceability — they document **what the
human asked the model to do**, separate from **what the model did**
(captured in the session log) and **the resulting code** (captured in the
git commit). When an old prompt and the corresponding session log diverge,
the session log is authoritative for what shipped.

## Index

| Prompt | Session log | Date | Notes |
|--------|-------------|------|-------|
| [stage5-result-table.md](stage5-result-table.md) | [`../2026-04-25-stage5.4-result-table.md`](../2026-04-25-stage5.4-result-table.md) + [qwen-session](../2026-04-25-stage5.4-result-table-qwen-session.md) | 25 Apr 2026 | Stage 5.4 — unified input/result table |
| [opencode-prompt-ux-review-fixes.md](opencode-prompt-ux-review-fixes.md) | [`../2026-04-25-ux-review-fixes.md`](../2026-04-25-ux-review-fixes.md) + [qwen-session](../2026-04-25-ux-review-open-issues-qwen-session.md) | 25 Apr 2026 | UX review follow-up tasks (stage 5.3 + 5.4 polish) |
| [2026-04-27-opencode-tasks.md](2026-04-27-opencode-tasks.md) | [`../2026-04-27-opencode-tasks-1-9-summary.md`](../2026-04-27-opencode-tasks-1-9-summary.md) + [qwen-session](../2026-04-27-opencode-tasks-1-9-qwen-session.md) | 27 Apr 2026 | 9 ordered TDD tasks — TeV units, parser typos, particle naming, master selector, Add row, debounce |
| [2026-04-27-opencode-tasks-jsroot-plot.md](2026-04-27-opencode-tasks-jsroot-plot.md) | [`../2026-04-27-stage5-jsroot-plot.md`](../2026-04-27-stage5-jsroot-plot.md) + [qwen-session](../2026-04-27-stage5-jsroot-plot-qwen-session.md) | 27 Apr 2026 | Stage 5.5 — JSROOT plot wrapper |

## Convention

- Filename mirrors the session log slug, prefixed with the date when
  the session started.
- A new prompt is added here at the same time as its companion session
  log under `docs/ai-logs/`.
- Once a prompt is consumed and the resulting work is merged, the file
  is read-only history — do not edit it to reflect spec changes; cut a
  new prompt instead.
