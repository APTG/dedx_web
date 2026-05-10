import { test, expect } from "@playwright/test";

test("debug WASM loading", async ({ page }) => {
  const errors: Array<{message: string, stack?: string}> = [];
  const logs: string[] = [];
  
  page.on("console", msg => {
    if (msg.type() === "error") {
      errors.push({
        message: msg.text(),
        stack: msg.location()?.toString()
      });
    } else {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", err => {
    errors.push({
      message: err.message,
      stack: err.stack
    });
  });
  
  // Track network requests
  const requests: string[] = [];
  page.on("request", req => {
    requests.push(req.url());
  });
  
  await page.goto("/calculator", { waitUntil: "networkidle", timeout: 30000 });
  
  // Wait longer for WASM to load
  await page.waitForTimeout(8000);
  
  console.log("Console errors:", errors);
  console.log("\n=== Full error details ===");
  errors.forEach((e, i) => {
    console.log(`\nError ${i + 1}:`);
    console.log("  Message:", e.message);
    console.log("  Stack:", e.stack || "N/A");
  });
  
  console.log("\nConsole logs:", logs);
  console.log("\nNetwork requests:", requests.filter(r => r.includes("wasm") || r.includes("libdedx")));
  
  // Check for skeleton loaders
  const skeleton = page.locator('[aria-busy="true"]');
  const skeletonVisible = await skeleton.isVisible().catch(() => false);
  console.log("\nSkeleton loader visible:", skeletonVisible);
  
  // Check for actual form elements
  const particleBtn = page.getByRole("button", { name: "Particle" });
  const particleVisible = await particleBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log("Particle button visible:", particleVisible);
  
  console.log("\n=== Summary ===");
  console.log("Errors:", errors.map(e => e.message));
});
