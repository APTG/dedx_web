import { test, expect } from "@playwright/test";

const appPages = [
  { path: "/calculator", heading: "Calculator" },
  { path: "/plot", heading: "Plot" },
  { path: "/docs", heading: "Documentation" },
];

test.describe("Navigation bar", () => {
  for (const { path } of appPages) {
    test(`nav bar is visible on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("nav")).toBeVisible();
    });
  }

  test("nav contains Calculator link", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("link", { name: "Calculator" })).toBeVisible();
  });

  test("nav contains Plot link", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("link", { name: "Plot" })).toBeVisible();
  });

  test("nav contains Docs link", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("link", { name: "Docs" })).toBeVisible();
  });

  test("nav contains webdedx brand link", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.getByRole("link", { name: /webdedx/i })).toBeVisible();
  });
});

test.describe("Footer", () => {
  for (const { path } of appPages) {
    test(`footer is visible on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("footer")).toBeVisible();
    });
  }

  test("footer mentions webdedx", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.locator("footer")).toContainText("webdedx");
  });
});

test.describe("Page headings", () => {
  for (const { path, heading } of appPages) {
    test(`${path} has h1 "${heading}"`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }
});

test.describe("Browser page titles", () => {
  test('calculator page title includes "Calculator"', async ({ page }) => {
    await page.goto("/calculator");
    await expect(page).toHaveTitle(/Calculator/i);
  });

  test('plot page title includes "Plot"', async ({ page }) => {
    await page.goto("/plot");
    await expect(page).toHaveTitle(/Plot/i);
  });
});

test.describe("WASM loading state", () => {
  test("WASM loads and entity selectors are ready", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page.locator('[aria-label="Particle"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[aria-label="Material"]')).toBeVisible();
    await expect(page.locator('[aria-label="Program"]')).toBeVisible();
  });

  test.skip("shows explicit WASM error state when initialization fails", async () => {
    // TODO(Stage 5): enable once we have deterministic error injection for WASM load.
  });
});
