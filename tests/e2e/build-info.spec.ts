import { test, expect } from "@playwright/test";

const MOCK_DEPLOY = {
  date: "2026-05-06",
  commit: "abc1234",
  commitFull: "abc1234def5678901234567890123456789012345",
  branch: "feat/build-info",
  repoUrl: "https://github.com/APTG/dedx_web",
};

// Helper: mock deploy.json response and navigate.
async function gotoWithBadge(page: import("@playwright/test").Page, path = "/") {
  await page.route("**/deploy.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DEPLOY),
    }),
  );
  await page.goto(path);
}

test.describe("Build info badge", () => {
  test("badge visible in footer with correct format", async ({ page }) => {
    await gotoWithBadge(page, "/calculator");

    const badge = page.getByText(/^Deployed:/);
    await expect(badge).toBeVisible({ timeout: 5000 });

    const text = await badge.textContent();
    expect(text).toContain("abc1234");
    expect(text).toContain("2026-05-06");
    expect(text).toContain("feat/build-info");
  });

  test("commit hash is a link to the correct GitHub commit URL", async ({ page }) => {
    await gotoWithBadge(page, "/calculator");

    await expect(page.getByText(/^Deployed:/)).toBeVisible({ timeout: 5000 });

    const link = page.getByRole("link", { name: "abc1234" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/APTG/dedx_web/commit/abc1234def5678901234567890123456789012345",
    );
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("badge is inside the footer element", async ({ page }) => {
    await gotoWithBadge(page, "/calculator");
    await expect(page.getByText(/^Deployed:/)).toBeVisible({ timeout: 5000 });

    // Badge must be a descendant of <footer>
    const badgeInFooter = page.locator("footer").getByText(/^Deployed:/);
    await expect(badgeInFooter).toBeVisible();
  });

  test("badge visible on plot page too (appears on every route)", async ({ page }) => {
    await gotoWithBadge(page, "/plot");
    await expect(page.locator("footer").getByText(/^Deployed:/)).toBeVisible({ timeout: 5000 });
  });

  test("badge absent when deploy.json returns 404", async ({ page }) => {
    await page.route("**/deploy.json", (route) => route.fulfill({ status: 404 }));
    await page.goto("/calculator");

    // Give the fetch time to settle (poll instead of waitForTimeout).
    await expect
      .poll(() => page.locator("footer").getByText(/^Deployed:/).count(), { timeout: 3000 })
      .toBe(0);

    // No error text visible either.
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test("badge absent when deploy.json returns malformed JSON", async ({ page }) => {
    await page.route("**/deploy.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "NOT_JSON{{" }),
    );
    await page.goto("/calculator");

    await expect
      .poll(() => page.locator("footer").getByText(/^Deployed:/).count(), { timeout: 3000 })
      .toBe(0);
  });
});
