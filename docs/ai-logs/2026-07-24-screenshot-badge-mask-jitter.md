# 2026-07-24 — Screenshot auto-PR churn from build-info badge mask jitter (#880)

## Session Narrative

### Prompt 1: Investigate why PR #880 (`docs: update screenshots`) fired

**AI response**: Pixel-diffed the two committed PNGs (`calculator-desktop.png`,
`plot-desktop.png`) against their base-commit versions using a pure-Python PNG
decoder (no ImageMagick/PIL available in this environment). Both diffs were
tiny: exactly 32 pixels in a 2×16px strip at the same x-coordinate
(x=251–252), color `#e5e7eb` → `#ffffff`. `#e5e7eb` is the `maskColor` passed
to `page.screenshot()` in `tests/docs-screenshots.spec.ts` for the build-info
badge ("Deployed: `<hash>` · `<date>` · `<branch>`"), so this was the mask
rectangle's right edge moving by ~2px between runs, not a real UI change.

Root cause: the mask's bounding box comes from `page.getByText("Deployed:")`,
which Playwright resolves to the whole `<span>` (it contains the full badge
text as one text run). The badge's content — commit short hash + today's
date — changes on every push to master (`scripts/deploy.cjs`), and Inter is a
proportional font, so different digit/hex-letter combinations render at
slightly different pixel widths. Measured this directly: rendered 5,000
random `commit`/`date` combinations offscreen with the same pinned Inter font
the test uses and found widths ranging up to ~244px (vs. the shorter static
"webdedx — Stopping power calculations" line at 230px), confirming the badge
is genuinely the widest-varying element in that footer column. Each of the
two independent CI runs (base vs. head) computes the mask box from its own
run's badge text, so the two boxes' right edges rarely land on the exact same
pixel — leaving a sliver that's masked gray in one image and background white
in the other.

### Prompt 2: Fix it so this stops recurring

**AI response**: Masking a dynamically-sized element can never be fully
deterministic in a proportional font — the fix is to stop deriving the mask
box from the actual (varying) content at all. Replaced the masking approach
with content replacement: after waiting for the badge to render, overwrite
its `textContent` with a fixed placeholder
(`"Deployed: 0000000 · 2000-01-01 · master"`) via
`buildInfo.evaluate(el => { el.textContent = ... })`, then dropped the
`mask`/`maskColor` options from `page.screenshot()` entirely — deterministic
text needs no masking. Removed the now-unused `dynamicMasks()` helper.

Verified end-to-end, not just by reasoning: built the WASM module (Docker) and
the app in a scratch clone, ran `pnpm exec playwright test
--config=playwright.docs.config.ts` once, then made an empty git commit
(different short hash, and — since the clone was in a detached-HEAD state —
a completely different `git describe --all` branch string too) and reran. All
four output PNGs (`calculator-desktop/mobile`, `plot-desktop/mobile`) were
byte-for-byte identical (`cmp`) across the two runs despite the underlying
build metadata differing in every field. Confirmed the changed test file
passes `tsc --noEmit`, `eslint`, and `prettier --check`.

Did not regenerate the committed `static/screenshots/*.png` in this PR —
they still reflect the old solid-gray-box masking. The next push to master
(this PR's merge) will trigger the existing `screenshots.yml` workflow, which
will pick up the new placeholder text and open the usual one-time
auto-merged `docs: update screenshots` PR. That one is expected; no further
churn should follow it.

## Tasks

### Replace build-info badge screenshot masking with fixed placeholder text

- **Status**: completed
- **Stage**: CI / tooling (not a redesign-plan stage)
- **Files changed**:
  - `tests/docs-screenshots.spec.ts`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-07-24-screenshot-badge-mask-jitter.md`
- **Decision**: Overwrite the badge's `textContent` with a fixed string
  instead of trying to make the mask box deterministic (e.g. forcing a fixed
  CSS width on the span). A fixed-width mask would still have required
  guessing/verifying a safe upper bound and risked layout side effects on the
  narrow mobile viewport; replacing the content sidesteps the sizing problem
  entirely and, as a side benefit, the docs screenshot now shows legible
  placeholder text in the footer instead of a blank gray box.
- **Issue**: None outstanding. This is a distinct failure mode from the two
  previously-fixed screenshot issues (#755 badge-race height churn, #865
  font-rendering nondeterminism) — this one is mask-boundary jitter from
  masking dynamically-sized content, not timing or font drift.
