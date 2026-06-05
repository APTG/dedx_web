import { defineConfig, devices } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────
// Dedicated Playwright config for documentation screenshots.
//
// Kept separate from playwright.config.ts so the screenshot suite does
// NOT run during the normal E2E pipeline (`pnpm test:e2e`). Run it with:
//
//   pnpm docs:screenshots
//
// The suite (tests/docs-screenshots.spec.ts) captures deterministic
// desktop + mobile images into docs/assets/ for the GitHub Pages user
// documentation. See issue #594.
// ─────────────────────────────────────────────────────────────────

export default defineConfig({
  testDir: "./tests",
  testMatch: /docs-screenshots\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  // Screenshots may wait on WASM load + reactive settling.
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? "pnpm preview --host 127.0.0.1"
      : "pnpm build && pnpm preview --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
