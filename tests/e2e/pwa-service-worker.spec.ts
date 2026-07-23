import { test, expect } from "@playwright/test";

// Offline-capable PWA — issue #881.
test.describe("PWA service worker", () => {
  test("registers, activates, and takes control of the page @smoke", async ({ page }) => {
    await page.goto("/calculator");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // clients.claim() (in the SW's activate handler) takes a beat to reach
    // this page after the "ready" promise settles — poll rather than assert
    // synchronously, per this repo's timeout-discipline convention.
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 10000,
      })
      .toBe(true);
  });

  test("a previously-visited page still loads and calculates fully offline @regression", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // First visit: WASM downloads over the network and the SW precaches the
    // app shell + wasm binaries.
    await page.goto("/calculator");
    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 20000 })
      .toBeGreaterThan(0);

    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(async () => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 10000,
      })
      .toBe(true);

    const failedRequests: string[] = [];
    page.on("requestfailed", (request) => failedRequests.push(request.url()));

    await context.setOffline(true);
    try {
      await page.reload();
      await expect
        .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 20000 })
        .toBeGreaterThan(0);
    } finally {
      await context.setOffline(false);
    }

    expect(failedRequests).toEqual([]);
  });
});
