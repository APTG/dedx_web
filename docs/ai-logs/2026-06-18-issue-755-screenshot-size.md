# 2026-06-18 — Issue #755: Different pixel size of generated screenshots

## Session Narrative

### Prompt 1: Analyze issue #755, describe it better in a comment, figure out a fix

**AI response**: The issue contained only a title and a screenshot of PR #752's
diff. Investigation showed the auto-generated documentation screenshots change
**pixel dimensions** (height) between CI runs, churning the
`docs: update screenshots` auto-PR.

Evidence — committed vs regenerated (`screenshots/auto-update`):

| Image                    | Committed   | Regenerated | Δ        |
| ------------------------ | ----------- | ----------- | -------- |
| `calculator-desktop.png` | 1280 × 807  | 1280 × 807  | 0        |
| `plot-desktop.png`       | 1280 × 767  | 1280 × 767  | 0        |
| `calculator-mobile.png`  | 375 × 949   | 375 × 933   | −16 px   |
| `plot-mobile.png`        | 375 × 1110  | 375 × 1094  | −16 px   |

Width is always stable (`deviceScaleFactor: 1`); only height drifts, and both
mobile images shifted by the same 16 px — a single shared ~16 px text line.

Root cause: `build-info-badge.svelte` fetches `deploy.json` in a `$effect` and
renders the `Deployed: …` footer line only after that async fetch resolves.
`docs-screenshots.spec.ts` waited only for `networkidle`, so capture could
happen before the badge rendered. In the footer the left column is
`flex-col` (`sm:flex-row`), so on mobile the badge adds a full row (+16 px);
`fullPage: true` then bakes that variable height into the PNG dimensions. The
existing `mask` only hides the badge's pixels, not its presence in layout.

Posted a detailed analysis comment on the issue.

### Prompt 2: Make a PR with the fix

**AI response**: `preparePage` now additionally awaits `document.fonts.ready`
(stable text metrics) and `getByText("Deployed:").waitFor({ state: "visible" })`
so the badge is always present at capture time → deterministic footer height.
`deploy.json` is always produced by the `prebuild` step, so the badge reliably
renders and the wait will not hang.

## Tasks

### Stabilize documentation screenshot dimensions

- **Status**: completed
- **Stage**: CI / screenshots (issue #755)
- **Files changed**: `tests/docs-screenshots.spec.ts`, `CHANGELOG-AI.md`,
  `docs/ai-logs/2026-06-18-issue-755-screenshot-size.md`,
  `docs/ai-logs/README.md`
- **Decision**: Wait for the badge rather than hide it — keeps the badge visible
  in the docs images (still masked for commit-hash/date churn) while removing the
  layout race. Considered hiding the badge via CSS or a fixed `clip`; the wait is
  the least invasive and environment-independent given `deploy.json` is always
  built by `prebuild`.
- **Issue**: None outstanding. The committed PNGs will be regenerated at one
  consistent size by the next screenshots workflow run after this merges.
