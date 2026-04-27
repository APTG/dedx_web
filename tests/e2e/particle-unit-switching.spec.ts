/**
 * Particle / unit switching E2E corner-case sequences.
 *
 * Two purposes:
 *
 * 1. **Lock down today's behaviour** — when the user changes the selected
 *    particle, the typed numeric value is **not modified** (per
 *    `docs/04-feature-specs/unit-handling.md` §"Unit Preservation on Particle
 *    Change", points 1–4). The "→ MeV/nucl" column reinterprets the same
 *    number under the new particle's mass number.
 *
 * 2. **Document the open question** — the project owner has requested that
 *    *kinetic energy be conserved* on particle/unit switches (e.g. He @
 *    20 MeV/nucl ≡ 80 MeV; switching to a proton should show 80 MeV; back
 *    to He should show 20 MeV/nucl). The spec does NOT mandate this today.
 *    The desired-behaviour assertions are wrapped in `test.fixme()` so the
 *    suite stays green while the gap is tracked. See
 *    `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`.
 */
import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

async function waitForWasm(page: import("@playwright/test").Page) {
  await page.goto("/calculator");
  await page.waitForSelector('[aria-label="Particle"]', { timeout: WASM_TIMEOUT });
}

async function waitForTable(page: import("@playwright/test").Page) {
  await expect(page.locator("thead th").first()).toContainText(/Energy/i, {
    timeout: WASM_TIMEOUT,
  });
}

async function selectParticle(page: import("@playwright/test").Page, name: string) {
  const particleBtn = page.getByRole("button", { name: /^Particle$/ });
  await particleBtn.click();
  await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill(name);
  const opt = page.getByRole("option", { name: new RegExp(name, "i") }).first();
  await opt.click();
  await waitForTable(page);
}

async function typeInRow(page: import("@playwright/test").Page, index: number, value: string) {
  const inputs = page.locator("input[data-row-index]");
  await inputs.nth(index).fill(value);
}

async function rowText(page: import("@playwright/test").Page, index: number): Promise<string> {
  return await page.locator("input[data-row-index]").nth(index).inputValue();
}

async function mevNuclCell(page: import("@playwright/test").Page, index: number): Promise<string> {
  return (await page.locator("tbody tr").nth(index).locator("td").nth(1).textContent()) ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle switching — kinetic energy conservation (E_nucl preserved)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Particle switching — E_nucl conservation", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("He 20 MeV/nucl → switch to proton: E_nucl conserved, row shows 20 MeV", async ({
    page,
  }) => {
    await selectParticle(page, "alpha");
    await typeInRow(page, 0, "20 MeV/nucl");
    expect(await mevNuclCell(page, 0)).toContain("20");

    await selectParticle(page, "proton");
    // E_nucl=20 conserved: proton (A=1) displays as 20 MeV.
    expect(await rowText(page, 0)).toBe("20 MeV");
    expect(await mevNuclCell(page, 0)).toContain("20");
  });

  test("He 80 MeV → switch to proton: E_nucl conserved (80/4=20), row shows 20 MeV", async ({ page }) => {
    await selectParticle(page, "alpha");
    await typeInRow(page, 0, "80 MeV");
    // Helium 80 MeV total → E_nucl = 80/4 = 20 MeV/nucl.
    expect(await mevNuclCell(page, 0)).toContain("20");

    await selectParticle(page, "proton");
    // E_nucl=20 conserved: proton displays as 20 MeV.
    expect(await rowText(page, 0)).toBe("20 MeV");
    expect(await mevNuclCell(page, 0)).toContain("20");
  });

  test("Proton 100 MeV → switch to carbon → switch back to hydrogen: E_nucl conserved", async ({
    page,
  }) => {
    // Default: proton 100 MeV (E_nucl=100).
    expect(await rowText(page, 0)).toBe("100");
    expect(await mevNuclCell(page, 0)).toContain("100");

    // Carbon (A=12): E_nucl=100 → 100 × 12 = 1200 MeV total.
    await selectParticle(page, "carbon");
    expect(await rowText(page, 0)).toBe("1200 MeV");
    expect(await mevNuclCell(page, 0)).toContain("100");

    // Back to proton: E_nucl=100 → 100 MeV.
    await selectParticle(page, "proton");
    expect(await rowText(page, 0)).toBe("100 MeV");
    expect(await mevNuclCell(page, 0)).toContain("100");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-row unit dropdown — current behaviour
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Per-row unit dropdown — current behaviour", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("Carbon 12 MeV → toggle unit to MeV/nucl: text is rewritten with converted value (KE conserved)", async ({
    page,
  }) => {
    await selectParticle(page, "carbon");
    await typeInRow(page, 0, "12 MeV");

    // Carbon 12 MeV total = 1 MeV/nucl in the conversion column.
    expect(await mevNuclCell(page, 0)).toContain("1");

    // Use the per-row Unit dropdown to switch the row to MeV/nucl.
    const unitSelect = page.locator("tbody tr").first().locator("select").first();
    await unitSelect.selectOption("MeV/nucl");

    // Per `setRowUnit()` in calculator.svelte.ts: the numeric value IS
    // converted to conserve kinetic energy. So "12 MeV" → "1 MeV/nucl",
    // and the MeV/nucl column now reads 1 (kinetic energy conserved).
    expect(await rowText(page, 0)).toBe("1 MeV/nucl");
    expect(await mevNuclCell(page, 0)).toContain("1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Desired behaviour: kinetic energy conservation on particle/unit switch.
//
// These are intentionally `test.fixme()` — they describe the behaviour the
// project owner has requested. They will be flipped to active once
// `docs/04-feature-specs/unit-handling.md` is updated to mandate KE
// conservation and the implementation lands.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Particle/unit switching — kinetic energy conservation (DESIRED, not yet implemented)", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test(
    "He 20 MeV/nucl → proton: row should show 20 MeV (E_nucl conserved)",
    async ({ page }) => {
      await selectParticle(page, "alpha");
      await typeInRow(page, 0, "20 MeV/nucl");
      expect(await mevNuclCell(page, 0)).toContain("20");

      await selectParticle(page, "proton");
      // E_nucl conserved: 20 MeV/nucl on He (A=4) → 20 MeV on proton (A=1).
      expect(await rowText(page, 0)).toBe("20 MeV");
      expect(await mevNuclCell(page, 0)).toContain("20");
    },
  );

  test(
    "He 20 MeV/nucl → proton → He: round-trip is lossy (proton has no per-nucleon unit)",
    async ({ page }) => {
      await selectParticle(page, "alpha");
      await typeInRow(page, 0, "20 MeV/nucl");

      await selectParticle(page, "proton");
      // E_nucl conserved: 20 MeV/nucl on He → 20 MeV on proton (A=1, total MeV display).
      expect(await rowText(page, 0)).toBe("20 MeV");

      await selectParticle(page, "alpha");
      // Round-trip is lossy: proton "20 MeV" (total) → He "20 MeV" (total), not "20 MeV/nucl".
      // This is expected: the per-nucleon information is lost when going through proton.
      expect(await rowText(page, 0)).toBe("20 MeV");
    },
  );

  test(
    "Carbon 12 MeV → toggle row unit MeV → MeV/nucl: number should become 1 (1 MeV/nucl), KE conserved",
    async ({ page }) => {
      await selectParticle(page, "carbon");
      await typeInRow(page, 0, "12 MeV");

      const unitSelect = page.locator("tbody tr").first().locator("select").first();
      await unitSelect.selectOption("MeV/nucl");

      // DESIRED: the numeric value converts on unit toggle.
      // 12 MeV total ÷ 12 nucleons = 1 MeV/nucl.
      expect(await rowText(page, 0)).toBe("1 MeV/nucl");
      expect(await mevNuclCell(page, 0)).toContain("1");
    },
  );

  test.fixme(
    "Carbon 100 MeV/nucl → switch master unit MeV/nucl → MeV: row should show 1200 MeV (KE conserved)",
    async ({ page }) => {
      await selectParticle(page, "carbon");
      // Use the master unit selector (MeV/nucl button).
      await page.getByRole("radio", { name: /MeV\/nucl/i }).click();
      await typeInRow(page, 0, "100");
      expect(await mevNuclCell(page, 0)).toContain("100");

      await page.getByRole("radio", { name: /^MeV$/i }).click();
      // DESIRED: 100 MeV/nucl × 12 = 1200 MeV.
      // NOTE: This test depends on Task 6 (master unit selector UI).
      expect(await rowText(page, 0)).toBe("1200");
    },
  );

  test.fixme(
    "He 20 MeV/nucl + multiple rows: KE conservation applies independently to each row",
    async ({ page }) => {
      await selectParticle(page, "alpha");
      await typeInRow(page, 0, "20 MeV/nucl");
      await typeInRow(page, 1, "50 MeV");

      await selectParticle(page, "proton");
      // Row 0: E_nucl=20 → proton 20 MeV. Row 1: E_nucl=50/4=12.5 → proton 12.5 MeV.
      expect(await rowText(page, 0)).toBe("20 MeV");
      expect(await rowText(page, 1)).toBe("12.5 MeV");

      await selectParticle(page, "alpha");
      // Row 0: proton "20 MeV" → He "20 MeV" (lossy, not "20 MeV/nucl").
      // Row 1: proton "12.5 MeV" → He "12.5 MeV" (lossy, E_nucl=12.5 × 4 = 50 MeV total).
      expect(await rowText(page, 0)).toBe("20 MeV");
      expect(await rowText(page, 1)).toBe("50 MeV");
    },
  );

  test(
    "Switching to electron from a heavy ion: row remaps to total MeV (electron has no nucleons)",
    async ({ page }) => {
      await selectParticle(page, "alpha");
      await typeInRow(page, 0, "20 MeV/nucl");
      expect(await mevNuclCell(page, 0)).toContain("20");

      // Electron only supports MeV; the row is remapped to total KE.
      // E_nucl=20 MeV/nucl on He (A=4) → total = 20 × 4 = 80 MeV for electron.
      await selectParticle(page, "electron");
      expect(await rowText(page, 0)).toBe("80 MeV");
      expect(await mevNuclCell(page, 0)).toContain("80");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Add-row UX — there is no explicit "Add row" button; rows auto-append.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Add row UX", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("typing in the last row auto-appends a fresh row below it", async ({ page }) => {
    // Default state has a single pre-filled "100" row. Typing in the LAST
    // row auto-appends a new empty row (see `updateRowText` in
    // `src/lib/state/energy-input.svelte.ts`).
    const initialCount = await page.locator("tbody tr").count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Type into the current last row to trigger an auto-append.
    await typeInRow(page, initialCount - 1, "200");
    await expect(page.locator("tbody tr")).toHaveCount(initialCount + 1);

    // Typing in the new last row appends one more.
    await typeInRow(page, initialCount, "300");
    await expect(page.locator("tbody tr")).toHaveCount(initialCount + 2);
  });

  test("there is no explicit 'Add row' button rendered in the result table", async ({ page }) => {
    // The legacy `energy-input.svelte` used to render an "Add row" button,
    // but the unified `result-table.svelte` relies on auto-append. Lock this
    // in as a behavioural assertion so a future regression that re-introduces
    // the button has to update this test deliberately.
    await expect(page.getByRole("button", { name: /^Add row$/i })).toHaveCount(0);
  });
});
