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

### Prompt 3: Address Copilot's review comments

**AI response**: Copilot flagged two rounds of comments on this PR. First
round (wording accuracy, already fixed before this prompt): the session log
overclaimed "byte-identical" while only describing a pixel-diff verification
method, and twice misstated the font as covering "weights 400–700" when the
committed file and the test's `@font-face` both span the full variable
weight axis (100–900) — both corrected to describe what was actually
verified/shipped, with the byte-identical claim now backed by a real
`sha256sum` check.

Second round caught a real regression the first fix introduced: `FONT_CSS`
forced `font-family: "Inter", sans-serif !important` onto `html, body, *`,
which also clobbered Tailwind's `.font-mono` utility — used on every numeric
result cell (kinetic energy input, CSDA Range, Stopping Power) — so the
committed screenshots no longer matched the real app's typography for
numbers. Rather than just carving out an exception for `.font-mono` (which
would leave those numeric cells rendering through Chromium's *monospace*
fallback stack — the exact same class of nondeterminism this PR exists to
fix, just relocated), pinned a second self-hosted font
(`jetbrains-mono-variable-latin.woff2`, SIL OFL 1.1, ~31 KB) and switched
the injection mechanism entirely: instead of a blanket `*`-selector
`!important` override, the test now redefines the same Tailwind v4 theme
CSS custom properties the app's own compiled CSS already reads —
`--font-sans`/`--default-font-family` (consumed by the Preflight base rule
and any `.font-sans` utility) and `--font-mono`/`--default-mono-font-family`
(consumed by `.font-mono` and the `code/kbd/samp/pre` reset). Confirmed the
four variable names by grepping the built CSS output. This flows through
the app's existing sans/mono distinction instead of collapsing it: numeric
cells stay visually monospace (now via a pinned mono font instead of a
drifting system one), body text stays sans, and no `!important` fights are
needed since nothing is overridden that shouldn't be. Re-verified: rebuilt,
regenerated all four screenshots (now showing correct monospace numerals),
ran `pnpm docs:screenshots` twice more and confirmed `sha256sum` still
matches across runs.

## Tasks

### Pin a self-hosted font for documentation screenshots

- **Status**: completed
- **Stage**: CI / tooling (not a redesign-plan stage)
- **Files changed**:
  - `tests/docs-screenshots.spec.ts`
  - `tests/fixtures/fonts/inter-variable-latin.woff2` (new)
  - `tests/fixtures/fonts/jetbrains-mono-variable-latin.woff2` (new)
  - `tests/fixtures/fonts/OFL-inter.txt` (new)
  - `tests/fixtures/fonts/OFL-jetbrains-mono.txt` (new)
  - `static/screenshots/*.png` (regenerated)
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-07-22-screenshot-font-drift.md`
- **Decision**: Scoped both fonts to the test only (injected as data URIs via
  `addStyleTag`, not added to `static/` or `src/app.css`) rather than giving
  the whole app custom typefaces. The goal was fixing CI determinism, not
  changing the product's visual design — that's a separate decision for the
  team to make deliberately, not as a side effect of a screenshot-stability
  fix. Pinned both sans (Inter) and mono (JetBrains Mono) — not sans alone —
  because the numeric result cells use `font-mono`, which resolves through
  the exact same kind of Chromium-version-dependent generic-family fallback
  as the sans text did; pinning only one would have left the other free to
  drift. Overrode Tailwind's own theme CSS variables
  (`--font-sans`/`--default-font-family`/`--font-mono`/
  `--default-mono-font-family`) rather than a blanket `* { !important }`
  rule, so the app's existing sans/mono distinction is preserved instead of
  collapsed. Used single variable-font files for each (one file covers the
  full weight axis) to keep the fixtures small (~47 KB + ~31 KB combined)
  and the injected CSS simple.
- **Issue**: None outstanding. Future Playwright/Chromium bumps should no
  longer regenerate the committed screenshots on their own; a real UI change
  is still expected to change them as before.
