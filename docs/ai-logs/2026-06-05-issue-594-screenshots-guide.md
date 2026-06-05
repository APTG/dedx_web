# 2026-06-05 — Issue #594: Automated documentation screenshots + quick user guide

## Session Narrative

### Prompt 1: "create two screenshots and very short user guide, work towards issue 594. follow best practices, add ai logs."

**AI response**: Built the first increment of the Playwright-based documentation
screenshot automation requested in
[#594](https://github.com/APTG/dedx_web/issues/594), generated real screenshots,
and wrote a short end-user guide that embeds them.

What was created:

1. **`tests/docs-screenshots.spec.ts`** — a dedicated screenshot suite kept
   _outside_ `tests/e2e/` so it never runs in the normal E2E pipeline. It
   captures the Calculator and Plot pages at desktop (1280×720) and mobile
   (375×667) viewports. For determinism it injects CSS that freezes all
   animations/transitions/caret and masks the dynamic build-info footer
   (commit hash + date) with a neutral grey so the committed PNGs don't churn
   on every commit.
2. **`playwright.docs.config.ts`** — a separate config (`testDir: ./tests`,
   `testMatch: docs-screenshots.spec.ts`) that reuses the existing
   build+preview `webServer`. This is what keeps the suite out of the default
   run while still being runnable on its own.
3. **`package.json`** — `docs:screenshots` script
   (`playwright test --config=playwright.docs.config.ts`).
4. **`docs/assets/`** — four generated PNGs (calculator/plot × desktop/mobile).
5. **`docs/user-guide.md`** — a concise two-minute Calculator + Plot tour
   embedding the screenshots; linked from `docs/README.md`.

**Generating the screenshots in the web sandbox** required some work, captured
here for the next session:

- The Playwright Chromium build on disk was `1194`; the installed
  `playwright-core` wanted `1223`, and the Playwright CDN is not in the network
  allowlist. Worked around by pointing a throwaway local config at the existing
  `/opt/pw-browsers/chromium-1194` binary (the committed config is untouched).
- Real screenshots need the WASM engine. `static/wasm/` was empty; the CI
  `wasm-binaries` artifact host (Azure blob) and GitHub Pages are both blocked
  by the allowlist. Resolved by starting `dockerd`, initialising the `libdedx`
  submodule (GitHub is reachable), pulling the Emscripten image via the Google
  mirror (`mirror.gcr.io/emscripten/emsdk:5.0.5` — Docker Hub itself was
  rate-limited), tagging it as `emscripten/emsdk:5.0.5`, and running
  `wasm/build.sh`. After rebuilding the app with WASM present, the calculator
  renders live results (proton in liquid water at 100 MeV → 0.7286 keV/µm,
  CSDA range 7.721 cm) and the plot shows the real stopping-power curve.

Not done (left for a follow-up on #594): the GitHub Actions
`workflow_dispatch` workflow that runs the script and auto-commits refreshed
images, and the "screenshots out of sync" PR check. The local tooling is the
prerequisite for both.

## Tasks

### Documentation screenshot automation (initial increment)

- **Status**: partial (local tooling + sample images + guide done; CI workflow deferred)
- **Stage**: Stage 8 (Open Beta & User Feedback) — documentation
- **Files changed**:
  - `tests/docs-screenshots.spec.ts` (new)
  - `playwright.docs.config.ts` (new)
  - `package.json` (`docs:screenshots` script)
  - `docs/user-guide.md` (new)
  - `docs/assets/calculator-desktop.png`, `calculator-mobile.png`,
    `plot-desktop.png`, `plot-mobile.png` (new)
  - `docs/README.md` (index entry)
- **Decision**: Used a dedicated Playwright config rather than the `playwright
  test <file>` form suggested in the issue, because the default `playwright.config.ts`
  restricts discovery to `tests/e2e/` (`testDir`), so an explicit path outside
  that dir finds no tests. A separate config is the clean way to both exclude
  the suite from CI E2E and run it on demand.
- **Decision**: Masked only the footer (build info) — the rest of the UI is
  deterministic once animations are frozen and the default proton/water/100 MeV
  state is loaded.
- **Issue**: The committed images must be regenerated where the WASM binaries
  exist (CI or a local build). WASM is gitignored, so it is intentionally not
  committed alongside the screenshots.
