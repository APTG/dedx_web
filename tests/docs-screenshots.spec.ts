import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

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

/** Navigate, freeze motion, and let the page settle before shooting. */
async function preparePage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.addStyleTag({ content: FREEZE_CSS });
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
        .getByRole("heading", { name: "Stopping Power Calculator", exact: true })
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
