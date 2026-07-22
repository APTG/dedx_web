import { test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────
// Documentation screenshots (issue #594)
//
// Captures deterministic desktop + mobile images of the app that are
// embedded in the in-app User Guide (/docs/user-guide). They live under
// static/ so they are served by the app (and on GitHub Pages). This file
// lives OUTSIDE tests/e2e/ so it is excluded from the normal E2E run;
// invoke it explicitly:
//
//   pnpm docs:screenshots
//
// Determinism:
//   - animations / transitions / caret are frozen via injected CSS
//   - the dynamic build-info badge (commit hash + date) is masked so
//     the images do not churn on every commit
//
// Output: static/screenshots/<name>-(desktop|mobile).png
// ─────────────────────────────────────────────────────────────────

const OUT_DIR = "static/screenshots";
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 375, height: 667 },
} as const;

// Strip all motion so a screenshot taken mid-transition is identical to one
// taken after it settles.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

// The app has no self-hosted font, so both body text (Tailwind's generic
// `sans-serif` stack) and numeric results (`font-mono`, e.g. the CSDA
// Range / Stopping Power values) render in whatever concrete font Chromium
// resolves those generic stacks to. That resolution can shift between
// Chromium builds (i.e. every time `@playwright/test` bumps), changing
// glyph metrics enough to reflow text and churn the committed PNGs with no
// actual app change (issue #865).
//
// Pin self-hosted fonts here — scoped to this test only, not the production
// app — by overriding the same Tailwind v4 theme variables the app's own
// CSS reads (`--font-sans`/`--default-font-family` for body text,
// `--font-mono`/`--default-mono-font-family` for `.font-mono` and the
// `code/kbd/samp/pre` reset). This is preferred over a blanket
// `* { font-family: ... !important }`: it flows through the app's existing
// sans/mono distinction instead of collapsing it, so `font-mono` numeric
// cells stay visually monospace in the screenshots (matching the real app)
// while both families are pinned to committed font bytes.
function loadFontBase64(filename: string): string {
  const path = join(dirname(fileURLToPath(import.meta.url)), "fixtures/fonts", filename);
  return readFileSync(path).toString("base64");
}
const INTER_BASE64 = loadFontBase64("inter-variable-latin.woff2");
const JETBRAINS_MONO_BASE64 = loadFontBase64("jetbrains-mono-variable-latin.woff2");
const FONT_CSS = `
  @font-face {
    font-family: "Docs Screenshot Sans";
    font-style: normal;
    font-weight: 100 900;
    font-display: block;
    src: url(data:font/woff2;base64,${INTER_BASE64}) format("woff2");
  }
  @font-face {
    font-family: "Docs Screenshot Mono";
    font-style: normal;
    font-weight: 100 900;
    font-display: block;
    src: url(data:font/woff2;base64,${JETBRAINS_MONO_BASE64}) format("woff2");
  }
  :root {
    --font-sans: "Docs Screenshot Sans", sans-serif;
    --default-font-family: "Docs Screenshot Sans", sans-serif;
    --font-mono: "Docs Screenshot Mono", monospace;
    --default-mono-font-family: "Docs Screenshot Mono", monospace;
  }
`;

/** Navigate, freeze motion, and let the page settle before shooting. */
async function preparePage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.addStyleTag({ content: FREEZE_CSS + FONT_CSS });
  // Let WASM load + reactive state settle (no network chatter left).
  await page.waitForLoadState("networkidle");
  // Web fonts must be ready so text metrics (and wrapping) are stable across runs.
  // Return void so Playwright doesn't try to serialize the FontFaceSet result.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // The build-info badge renders only after an async deploy.json fetch resolves
  // (build-info-badge.svelte). deploy.json is always produced by the prebuild
  // step, so the badge will appear — but waiting for networkidle alone can shoot
  // in the gap before it renders. Without this wait the footer is one ~16px line
  // shorter on some runs, and fullPage:true bakes that into the PNG dimensions,
  // churning the auto-generated screenshots PR (#755).
  await page.getByText("Deployed:").waitFor({ state: "visible" });
}

/**
 * The build-info badge (commit hash, build date, branch) changes every build.
 * Masking just that span — rather than the whole footer — keeps the committed
 * PNGs stable without hiding the static footer text. The badge only renders
 * once deploy.json loads, so fall back to no mask when it is absent.
 */
async function dynamicMasks(page: Page) {
  const buildInfo = page.getByText("Deployed:");
  return (await buildInfo.count()) > 0 ? [buildInfo] : [];
}

interface Shot {
  name: string;
  path: string;
  /** Wait for this to be visible before capturing (page-specific anchor). */
  ready: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  {
    name: "calculator",
    path: "/calculator",
    ready: async (page) => {
      await page
        .getByRole("heading", { name: "Range & Stopping Power Calculator", exact: true })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "plot",
    path: "/plot",
    ready: async (page) => {
      await page.getByRole("heading", { name: "Plot", exact: true }).waitFor({ state: "visible" });
    },
  },
];

for (const shot of SHOTS) {
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test(`@docs ${shot.name} — ${device}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await preparePage(page, shot.path);
      await shot.ready(page);
      await page.screenshot({
        path: `${OUT_DIR}/${shot.name}-${device}.png`,
        fullPage: true,
        mask: await dynamicMasks(page),
        maskColor: "#e5e7eb",
      });
    });
  }
}
