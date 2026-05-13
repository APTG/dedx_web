import { defineConfig, devices } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────
// Test-tag taxonomy — use in test() or test.describe() names:
//
//   @smoke     — primary acceptance scenario for the feature;
//                fast, run by implementer and reviewer.
//                Script: pnpm test:e2e:smoke
//   @regression — edge cases, error states, cross-page parity;
//                 run on every PR.
//                 Script: pnpm test:e2e  (default full run)
//   @nightly   — slow / expensive tests (not yet used).
//                Script: pnpm test:e2e:nightly
//
// Timeout discipline:
//   - Never use waitForTimeout() — use waitForSelector / waitForFunction /
//     expect.poll with explicit timeouts. See .opencode/lessons-learned.md
//     Entry 12.
//   - Set test.setTimeout(ms) at the top of individual tests that involve
//     WASM loading (30–60 s) or long debounce chains (5–10 s).
// ─────────────────────────────────────────────────────────────────

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  // Global timeout per test: 60 s. WASM loading and reactive settling can take
  // several seconds; WASM-dependent tests may use test.setTimeout() to extend
  // the limit further.
  timeout: 60000,
  // Assertion timeout: how long expect(...).toBeVisible() etc. will poll.
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    // Navigation timeout for page.goto() / page.waitForSelector() etc.
    navigationTimeout: 30000,
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Mobile and tablet projects only run @responsive-tagged tests. The
    // remaining suites are designed for desktop viewports and are exercised
    // by the chromium project. This keeps cross-device CI fast (no 3× test
    // multiplier) and avoids false negatives from tests not designed for
    // narrow viewports.
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
  ],
  webServer: {
    command: "pnpm preview --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
