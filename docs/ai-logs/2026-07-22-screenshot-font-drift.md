# 2026-07-22 — Screenshot auto-PR firing with no visible UI change (#865)

## Session Narrative

### Prompt 1: Investigate why the screenshot-update workflow fires even without a visible UI change (PR #864)

**AI response**: Pixel-diffed PR #864's before/after PNGs with ImageMagick
(`compare -metric AE`) against the base commit (4428ad5, a dependabot
dev-dependency bump touching no `src/` files). Confirmed the diff is real,
not diff-tool noise: text glyphs are shifted a few px per character,
compounding into visible reflow — `calculator-mobile.png` gained an extra
wrapped line (1032px → 1008px height).

Root cause: the app defines no custom font anywhere (`src/app.css`,
`src/app.html` — no `@font-face`, no Tailwind `fontFamily` override), so text
renders in whatever concrete font Chromium resolves the generic
`ui-sans-serif, system-ui, sans-serif` stack to. The triggering commit bumped
`@playwright/test` 1.60.0 → 1.61.1; the workflow does a fresh
`pnpm exec playwright install --with-deps chromium` every run, so that bump
pulled a new bundled Chromium build. Chromium releases routinely tweak
font-matching/hinting/anti-aliasing for generic families, so the glyph
metrics resolved for "sans-serif" can drift between builds even with
byte-identical HTML/CSS. This is a different failure mode from the two
previously-fixed screenshot issues (#755 badge-race height churn, #825
stale-branch PR bug) — this one is font-rendering nondeterminism tied to the
browser binary, not app/test timing.

Filed issue #865 with the analysis and evidence.

### Prompt 2: Do what you think is best — report the issue, then branch, commit, and open a PR

**AI response**: Implemented the fix scoped entirely to the screenshot test,
not the production app (avoids a user-facing typography change as a side
effect of a CI stability fix). Downloaded the Google-hosted Inter font
(latin subset, SIL OFL 1.1 license) via a CSS2 request for weights
400/500/600/700; Google serves Inter as a single variable-font file
regardless of which discrete weights are requested (confirmed: all four
requested `@font-face` blocks pointed at the same URL), so the committed
`tests/fixtures/fonts/inter-variable-latin.woff2` (~47 KB) actually spans
the font's full variable weight axis — `fc-query` reports named instances
from Thin through Black. The test's injected `@font-face` declares the
matching full range (`font-weight: 100 900`) so Tailwind's various
font-weight utilities all resolve against it. Injected it in
`tests/docs-screenshots.spec.ts` via a data-URI `@font-face` +
`font-family` override applied in the same `addStyleTag` call as the
existing `FREEZE_CSS`. The existing `document.fonts.ready` wait (added for
issue #755) now also covers this font, so no new wait logic was needed.

Verified locally: built the app, ran `pnpm docs:screenshots` twice in a row.
Pixel-diffed the two output sets with ImageMagick (`compare -metric AE`) —
0 differing pixels across all four images — and additionally confirmed
byte-for-byte identical via `sha256sum`, so the capture is now fully
deterministic, not just visually indistinguishable. All four screenshots
were regenerated and committed with the new stable renders (one intentional
one-time re-baseline, since Inter's metrics differ slightly from whatever
the host previously resolved).

## Tasks

### Pin a self-hosted font for documentation screenshots

- **Status**: completed
- **Stage**: CI / tooling (not a redesign-plan stage)
- **Files changed**:
  - `tests/docs-screenshots.spec.ts`
  - `tests/fixtures/fonts/inter-variable-latin.woff2` (new)
  - `tests/fixtures/fonts/OFL.txt` (new)
  - `static/screenshots/*.png` (regenerated)
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-07-22-screenshot-font-drift.md`
- **Decision**: Scoped the font to the test only (injected as a data URI via
  `addStyleTag`, not added to `static/` or `src/app.css`) rather than giving
  the whole app a custom typeface. The goal was fixing CI determinism, not
  changing the product's visual design — that's a separate decision for the
  team to make deliberately, not as a side effect of a screenshot-stability
  fix. Used a single variable-font file (one file covers the full weight
  axis, matching the `font-weight: 100 900` declared in the test's
  `@font-face`) to keep the fixture small (~47 KB) and the injected CSS
  simple.
- **Issue**: None outstanding. Future Playwright/Chromium bumps should no
  longer regenerate the committed screenshots on their own; a real UI change
  is still expected to change them as before.
