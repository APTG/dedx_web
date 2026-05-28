import { defineConfig, devices } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────
// Dev-Server Testing Mode Configuration
// ─────────────────────────────────────────────────────────────────
// This configuration targets the Vite dev server (pnpm dev on port 5173)
// instead of the production build (pnpm preview on port 4173).
// This provides HMR and immediate feedback without needing full rebuilds.
// Run with: pnpm exec playwright test --config=playwright.dev.config.ts
// ─────────────────────────────────────────────────────────────────

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    navigationTimeout: 30000,
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      grep: /@responsive/,
    },
    {
      name: "tablet",
      use: { ...devices["iPad Air"] },
      grep: /@responsive/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      grep: /@firefox/,
    },
  ],
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
